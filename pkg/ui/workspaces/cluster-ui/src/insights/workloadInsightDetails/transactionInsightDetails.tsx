// Copyright 2022 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.
import React, { useEffect, useRef } from "react";
import Helmet from "react-helmet";
import { RouteComponentProps } from "react-router-dom";
import { ArrowLeft } from "@cockroachlabs/icons";
import { Tabs } from "antd";
import "antd/lib/col/style";
import "antd/lib/row/style";
import { Button } from "src/button";
import { getMatchParamByName } from "src/util/query";
import { TxnInsightDetailsRequest, TxnInsightDetailsReqErrs } from "src/api";
import { InsightNameEnum, TxnInsightDetails } from "../types";

import { commonStyles } from "src/common";
import { TimeScale } from "../../timeScaleDropdown";
import { idAttr } from "src/util";
import { TransactionInsightDetailsOverviewTab } from "./transactionInsightDetailsOverviewTab";
import { TransactionInsightsDetailsStmtsTab } from "./transactionInsightDetailsStmtsTab";
import { timeScaleRangeToObj } from "src/timeScaleDropdown/utils";

import "antd/lib/tabs/style";

export interface TransactionInsightDetailsStateProps {
  insightDetails: TxnInsightDetails;
  insightError: TxnInsightDetailsReqErrs | null;
  timeScale?: TimeScale;
  hasAdminRole: boolean;
}

export interface TransactionInsightDetailsDispatchProps {
  refreshTransactionInsightDetails: (req: TxnInsightDetailsRequest) => void;
  setTimeScale: (ts: TimeScale) => void;
  refreshUserSQLRoles: () => void;
}

export type TransactionInsightDetailsProps =
  TransactionInsightDetailsStateProps &
    TransactionInsightDetailsDispatchProps &
    RouteComponentProps<unknown>;

enum TabKeysEnum {
  OVERVIEW = "overview",
  STATEMENTS = "statements",
}

const MAX_REQ_ATTEMPTS = 3;

export const TransactionInsightDetails: React.FC<
  TransactionInsightDetailsProps
> = ({
  refreshTransactionInsightDetails,
  setTimeScale,
  history,
  insightDetails,
  insightError,
  timeScale,
  match,
  hasAdminRole,
  refreshUserSQLRoles,
}) => {
  const fetches = useRef<number>(0);
  const executionID = getMatchParamByName(match, idAttr);

  useEffect(() => {
    refreshUserSQLRoles();
  }, [refreshUserSQLRoles]);

  useEffect(() => {
    if (fetches.current === MAX_REQ_ATTEMPTS) {
      return;
    }

    const txnDetails = insightDetails.txnDetails;
    const stmts = insightDetails.statements;
    const contentionInfo = insightDetails.blockingContentionDetails;

    const stmtsComplete =
      stmts != null && stmts.length === txnDetails?.stmtExecutionIDs?.length;

    const contentionComplete =
      contentionInfo != null ||
      (txnDetails != null &&
        txnDetails.insights.find(
          i => i.name === InsightNameEnum.highContention,
        ) == null);

    if (!stmtsComplete || !contentionComplete || txnDetails == null) {
      // Only fetch if we are missing some information.
      // Note that we will attempt to refetch if we are stll missing some
      // information only if the results differ from what we already have,
      // with the maximum number of retries capped at MAX_REQ_ATTEMPTS.
      const execReq = timeScaleRangeToObj(timeScale);
      const req = {
        mergeResultWith: insightDetails,
        start: execReq.start,
        end: execReq.end,
        txnExecutionID: executionID,
        excludeTxn: txnDetails != null,
        excludeStmts: stmtsComplete,
        excludeContention: contentionComplete,
      };
      refreshTransactionInsightDetails(req);
      fetches.current += 1;
    }
  }, [
    timeScale,
    executionID,
    refreshTransactionInsightDetails,
    insightDetails,
  ]);

  const prevPage = (): void => history.goBack();

  return (
    <div>
      <Helmet title={"Details | Insight"} />
      <div>
        <Button
          onClick={prevPage}
          type="unstyled-link"
          size="small"
          icon={<ArrowLeft fontSize={"10px"} />}
          iconPosition="left"
          className={commonStyles("small-margin")}
        >
          Previous page
        </Button>
        <h3
          className={commonStyles("base-heading", "no-margin-bottom")}
        >{`Transaction Execution ID: ${String(
          getMatchParamByName(match, idAttr),
        )}`}</h3>
      </div>
      <section>
        <Tabs
          className={commonStyles("cockroach--tabs")}
          defaultActiveKey={TabKeysEnum.OVERVIEW}
        >
          <Tabs.TabPane tab="Overview" key={TabKeysEnum.OVERVIEW}>
            <TransactionInsightDetailsOverviewTab
              maxRequestsReached={fetches.current === MAX_REQ_ATTEMPTS}
              errors={insightError}
              statements={insightDetails.statements}
              txnDetails={insightDetails.txnDetails}
              contentionDetails={insightDetails.blockingContentionDetails}
              setTimeScale={setTimeScale}
              hasAdminRole={hasAdminRole}
            />
          </Tabs.TabPane>
          {(insightDetails.txnDetails?.stmtExecutionIDs?.length ||
            insightDetails.statements?.length) && (
            <Tabs.TabPane
              tab="Statement Executions"
              key={TabKeysEnum.STATEMENTS}
            >
              <TransactionInsightsDetailsStmtsTab
                isLoading={
                  insightDetails.statements == null &&
                  fetches.current < MAX_REQ_ATTEMPTS
                }
                error={insightError?.statementsErr}
                statements={insightDetails?.statements}
              />
            </Tabs.TabPane>
          )}
        </Tabs>
      </section>
    </div>
  );
};
