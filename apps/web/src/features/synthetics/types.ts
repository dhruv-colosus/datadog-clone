export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type Subtype =
  | "http"
  | "ssl"
  | "dns"
  | "tcp"
  | "udp"
  | "icmp"
  | "websocket"
  | "grpc";

export type AssertionType =
  | "status_code"
  | "response_time"
  | "header"
  | "body"
  | "body_size";

export type AssertionOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "less_than"
  | "less_than_or_equal"
  | "greater_than"
  | "greater_than_or_equal";

export type SyntheticHeader = {
  key: string;
  value: string;
};

export type SyntheticAssertion = {
  type: AssertionType;
  operator: AssertionOperator;
  expected?: string | number | null;
  target?: string | null;
};

export type SyntheticRequest = {
  headers: SyntheticHeader[];
  query: SyntheticHeader[];
  body?: string | null;
  bodyType?: "raw" | "json" | "form";
  timeoutMs?: number;
};

export type SyntheticTestStatus = "OK" | "ALERT" | "NO DATA";

export type SyntheticTest = {
  id: string;
  name: string;
  subtype: Subtype;
  method: HttpMethod;
  url: string;
  request: SyntheticRequest;
  assertions: SyntheticAssertion[];
  locations: string[];
  frequencySeconds: number;
  tags: string[];
  environment: string | null;
  team: string | null;
  enabled: boolean;
  favorite: boolean;
  lastStatus: SyntheticTestStatus;
  lastRunMs: number | null;
  ownerId?: number;
  createdMs: number;
  modifiedMs: number;
};

export type AssertionResult = {
  type: AssertionType;
  operator: AssertionOperator;
  target?: string | null;
  expected?: string | number | null;
  actual?: string | number | null;
  passed: boolean;
};

export type SyntheticTimings = {
  dnsMs: number;
  connectionMs: number;
  sslMs: number;
  ttfbMs: number;
  downloadMs: number;
};

export type SyntheticResult = {
  id: string;
  testId: string | null;
  executedMs: number;
  location: string;
  status: "OK" | "ALERT";
  statusCode: number | null;
  responseTimeMs: number | null;
  timings: SyntheticTimings;
  assertionResults: AssertionResult[];
  responseHeaders: Record<string, string>;
  responseSizeBytes: number | null;
  errorMessage: string | null;
};

export const LOCATIONS = [
  { id: "aws:us-east-1", label: "N. Virginia (AWS)" },
  { id: "aws:us-west-2", label: "Oregon (AWS)" },
  { id: "aws:eu-west-1", label: "Ireland (AWS)" },
  { id: "aws:ap-southeast-1", label: "Singapore (AWS)" },
  { id: "aws:ap-northeast-1", label: "Tokyo (AWS)" },
  { id: "gcp:europe-west3", label: "Frankfurt (GCP)" },
] as const;

export const FREQUENCY_OPTIONS = [
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 1800, label: "30 minutes" },
  { value: 3600, label: "1 hour" },
  { value: 21600, label: "6 hours" },
  { value: 86400, label: "1 day" },
] as const;

export function statusColor(s: SyntheticTestStatus): string {
  if (s === "OK") return "#1A8341";
  if (s === "ALERT") return "#D93025";
  return "#5f6368";
}

export function statusBg(s: SyntheticTestStatus): string {
  if (s === "OK") return "#E6F4EA";
  if (s === "ALERT") return "#FCE8E6";
  return "#F1F3F4";
}
