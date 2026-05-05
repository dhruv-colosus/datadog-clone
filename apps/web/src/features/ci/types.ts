export type CiExecutionStatus = "success" | "failure" | "canceled" | "running";
export type CiTestStatus = "passed" | "failed" | "skipped" | "flaky";
export type CiJobStatus =
  | "success"
  | "failure"
  | "canceled"
  | "skipped"
  | "running";
export type CiJobKind = "stage" | "job" | "step" | "command";

export type CiPipeline = {
  id: string;
  name: string;
  repo: string;
  defaultBranch: string;
  service: string;
  team: string | null;
  avgDurationMs: number;
  createdMs: number;
};

export type CiPipelineExecution = {
  id: string;
  pipelineId: string;
  pipelineName?: string;
  service?: string;
  commitSha: string;
  branch: string;
  status: CiExecutionStatus;
  triggeredBy: string | null;
  triggerType: "push" | "pr" | "manual" | "schedule";
  durationMs: number | null;
  queueTimeMs: number;
  startedMs: number;
  finishedMs: number | null;
  errorDomain: string | null;
};

export type CiJob = {
  id: string;
  executionId: string;
  parentJobId: string | null;
  name: string;
  kind: CiJobKind;
  status: CiJobStatus;
  durationMs: number;
  startedMs: number;
  finishedMs: number | null;
  logsExcerpt: string | null;
};

export type CiExecutionDetail = CiPipelineExecution & { jobs: CiJob[] };

export type CiTestRun = {
  id: string;
  executionId: string;
  suite: string;
  testName: string;
  status: CiTestStatus;
  durationMs: number;
  retryCount: number;
  errorMessage: string | null;
  skippedReason: string | null;
  createdMs: number;
};

export type CiTestServiceStat = {
  service: string;
  totalTests: number;
  skippedByItr: number;
  skipRatePct: number;
  timeSavedMs: number;
  dailySeries: Array<{
    day: string;
    totalTests: number;
    skippedByItr: number;
    timeSavedMs: number;
  }>;
};
