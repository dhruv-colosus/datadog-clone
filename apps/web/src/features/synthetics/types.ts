export type TestType = "api" | "browser" | "multistep";

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

export type AuthType =
  | "none"
  | "basic"
  | "bearer"
  | "api_key"
  | "digest"
  | "ntlm"
  | "hmac"
  | "oauth2"
  | "aws_sigv4";

export type AuthConfig = {
  type: AuthType;
  username?: string | null;
  password?: string | null;
  token?: string | null;
  keyName?: string | null;
  keyValue?: string | null;
  keyLocation?: "header" | "query";
};

export type BrowserStepType =
  | "goto"
  | "click"
  | "type"
  | "wait"
  | "hover"
  | "scroll"
  | "press"
  | "select"
  | "assert_contains"
  | "assert_url"
  | "assert_element";

export type BrowserStep = {
  id: string;
  type: BrowserStepType;
  target?: string | null;
  value?: string | null;
  ms?: number | null;
};

export type BrowserConfig = {
  startingUrl: string;
  browsers: string[];
  devices: string[];
  steps: BrowserStep[];
};

export type RetryConfig = {
  count: number;
  intervalMs: number;
};

export type AlertCondition = {
  failingMinutes: number;
  fromLocations: number;
};

export type DowntimeWindow = {
  startMs: number;
  endMs: number;
  reason: string;
};

export type SyntheticTestStatus = "OK" | "ALERT" | "NO DATA";

export type SyntheticTest = {
  id: string;
  name: string;
  testType: TestType;
  subtype: Subtype;
  method: HttpMethod;
  url: string;
  request: SyntheticRequest;
  assertions: SyntheticAssertion[];
  browserConfig: BrowserConfig;
  auth: AuthConfig;
  retry: RetryConfig;
  alertCondition: AlertCondition;
  monitorMessage: string;
  downtimes: DowntimeWindow[];
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
  type: string;
  operator: string;
  target?: string | null;
  expected?: string | number | null;
  actual?: string | number | null;
  passed: boolean;
  durationMs?: number;
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

export type SyntheticEvent = {
  id: string;
  testId: string;
  executedMs: number;
  location: string;
  status: "OK" | "ALERT";
  message: string;
};

export const LOCATIONS = [
  { id: "aws:us-east-1", label: "N. Virginia (AWS)", region: "Americas" },
  { id: "aws:us-east-2", label: "Ohio (AWS)", region: "Americas" },
  { id: "aws:us-west-1", label: "N. California (AWS)", region: "Americas" },
  { id: "aws:us-west-2", label: "Oregon (AWS)", region: "Americas" },
  { id: "aws:ca-central-1", label: "Canada Central (AWS)", region: "Americas" },
  { id: "aws:sa-east-1", label: "São Paulo (AWS)", region: "Americas" },
  { id: "gcp:us-central1", label: "Iowa (GCP)", region: "Americas" },
  { id: "gcp:us-east4", label: "N. Virginia (GCP)", region: "Americas" },
  { id: "gcp:us-west1", label: "Oregon (GCP)", region: "Americas" },
  { id: "gcp:us-west2", label: "Los Angeles (GCP)", region: "Americas" },
  { id: "azure:eastus", label: "Virginia (Azure)", region: "Americas" },

  { id: "aws:eu-west-1", label: "Ireland (AWS)", region: "EMEA" },
  { id: "aws:eu-west-2", label: "London (AWS)", region: "EMEA" },
  { id: "aws:eu-west-3", label: "Paris (AWS)", region: "EMEA" },
  { id: "aws:eu-central-1", label: "Frankfurt (AWS)", region: "EMEA" },
  { id: "aws:eu-north-1", label: "Stockholm (AWS)", region: "EMEA" },
  { id: "aws:eu-south-1", label: "Milan (AWS)", region: "EMEA" },
  { id: "gcp:europe-west3", label: "Frankfurt (GCP)", region: "EMEA" },
  { id: "gcp:europe-west1", label: "Belgium (GCP)", region: "EMEA" },

  { id: "aws:ap-northeast-1", label: "Tokyo (AWS)", region: "Asia Pacific" },
  { id: "aws:ap-northeast-2", label: "Seoul (AWS)", region: "Asia Pacific" },
  { id: "aws:ap-southeast-1", label: "Singapore (AWS)", region: "Asia Pacific" },
  { id: "aws:ap-southeast-2", label: "Sydney (AWS)", region: "Asia Pacific" },
  { id: "aws:ap-south-1", label: "Mumbai (AWS)", region: "Asia Pacific" },
  { id: "aws:ap-east-1", label: "Hong Kong (AWS)", region: "Asia Pacific" },
  { id: "gcp:asia-northeast1", label: "Tokyo (GCP)", region: "Asia Pacific" },
  { id: "gcp:asia-southeast1", label: "Singapore (GCP)", region: "Asia Pacific" },
  { id: "gcp:australia-southeast1", label: "Sydney (GCP)", region: "Asia Pacific" },
] as const;

export const ALL_LOCATION_IDS = LOCATIONS.map((l) => l.id);

export const REGIONS = ["Americas", "EMEA", "Asia Pacific"] as const;

export const FREQUENCY_OPTIONS = [
  { value: 30, label: "30s", display: "30 seconds" },
  { value: 60, label: "1m", display: "1 minute" },
  { value: 300, label: "5m", display: "5 minutes" },
  { value: 600, label: "10m", display: "10 minutes" },
  { value: 900, label: "15m", display: "15 minutes" },
  { value: 1800, label: "30m", display: "30 minutes" },
  { value: 3600, label: "1h", display: "1 hour" },
  { value: 43200, label: "12h", display: "12 hours" },
  { value: 86400, label: "1d", display: "1 day" },
] as const;

export const BROWSERS = [
  { id: "chrome", label: "Chrome" },
  { id: "edge", label: "Edge" },
  { id: "firefox", label: "Firefox" },
] as const;

export const DEVICES = [
  { id: "laptop_large", label: "Laptop Large", w: 1440, h: 1100 },
  { id: "tablet", label: "Tablet", w: 768, h: 1020 },
  { id: "mobile_small", label: "Mobile Small", w: 320, h: 550 },
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

export function locationLabel(id: string): string {
  return LOCATIONS.find((l) => l.id === id)?.label ?? id;
}

export type ApiTemplate = {
  id: string;
  title: string;
  description: string;
  category: "feature" | "performance" | "security" | "protocol";
  subtype: Subtype;
  method: HttpMethod;
  assertions: SyntheticAssertion[];
  frequencySeconds: number;
};

export const API_TEMPLATES: ApiTemplate[] = [
  {
    id: "grpc-health",
    title: "gRPC Health Check",
    description:
      "Determine if your gRPC servers and services are responsive, running, and capable of handling remote procedure calls",
    category: "protocol",
    subtype: "grpc",
    method: "GET",
    assertions: [{ type: "status_code", operator: "is", expected: 200 }],
    frequencySeconds: 300,
  },
  {
    id: "info-disclosure",
    title: "Information Disclosure in Headers",
    description:
      "Test for misconfiguration in headers that might disclose information that can aid an attacker, such as the server version and technologies in use",
    category: "security",
    subtype: "http",
    method: "GET",
    assertions: [
      { type: "header", operator: "is_not", target: "Server", expected: "" },
      {
        type: "header",
        operator: "is_not",
        target: "X-Powered-By",
        expected: "",
      },
    ],
    frequencySeconds: 900,
  },
  {
    id: "latency-rt",
    title: "Latency / Response Time",
    description:
      "Test for overall response time latency with a breakdown of network timing (DNS, Connection, SSL, Time to first Byte, Download)",
    category: "performance",
    subtype: "http",
    method: "GET",
    assertions: [
      { type: "response_time", operator: "less_than", expected: 2000 },
      { type: "status_code", operator: "is", expected: 200 },
    ],
    frequencySeconds: 60,
  },
  {
    id: "secure-cookie",
    title: "Secure Cookie Test",
    description: "Test for unsecured cookie misconfiguration",
    category: "security",
    subtype: "http",
    method: "GET",
    assertions: [
      {
        type: "header",
        operator: "contains",
        target: "Set-Cookie",
        expected: "Secure",
      },
      {
        type: "header",
        operator: "contains",
        target: "Set-Cookie",
        expected: "HttpOnly",
      },
    ],
    frequencySeconds: 1800,
  },
  {
    id: "security-headers",
    title: "Security Headers",
    description:
      "Test if the API has defined proper security headers to make it more secure and reliable",
    category: "security",
    subtype: "http",
    method: "GET",
    assertions: [
      {
        type: "header",
        operator: "is",
        target: "X-Content-Type-Options",
        expected: "nosniff",
      },
      {
        type: "header",
        operator: "contains",
        target: "Strict-Transport-Security",
        expected: "max-age",
      },
    ],
    frequencySeconds: 1800,
  },
  {
    id: "cors",
    title: "CORS Test",
    description:
      "Test if the API exposes a Cross-Origin Resource Sharing (CORS) header so that the browser knows whether it can be accessed from another origin",
    category: "security",
    subtype: "http",
    method: "OPTIONS",
    assertions: [
      {
        type: "header",
        operator: "is_not",
        target: "Access-Control-Allow-Origin",
        expected: "",
      },
    ],
    frequencySeconds: 1800,
  },
  {
    id: "uptime",
    title: "High Uptime / Availability",
    description:
      "Configure a test with the shortest frequency available e.g. 1m to detect availability incidents quickly",
    category: "performance",
    subtype: "http",
    method: "GET",
    assertions: [{ type: "status_code", operator: "is", expected: 200 }],
    frequencySeconds: 60,
  },
  {
    id: "ssl",
    title: "SSL Certificate",
    description:
      "Test the validity, expiry date, signing algorithm, and the chain of trust of your SSL certificates",
    category: "protocol",
    subtype: "ssl",
    method: "GET",
    assertions: [{ type: "status_code", operator: "is", expected: 200 }],
    frequencySeconds: 86400,
  },
];

export type BrowserTemplate = {
  id: string;
  title: string;
  description: string;
  category: "device" | "region" | "network";
};

export const BROWSER_TEMPLATES: BrowserTemplate[] = [
  {
    id: "large-screen",
    title: "Large Screen Check",
    description: "Test your website on a large screen across browsers",
    category: "device",
  },
  {
    id: "tablet",
    title: "Tablet Check",
    description: "Test your website on a tablet sized screen across browsers",
    category: "device",
  },
  {
    id: "mobile",
    title: "Mobile Screen Check",
    description: "Test your website on a mobile sized screen across browsers",
    category: "device",
  },
  {
    id: "multi-region",
    title: "Multi-Region Check",
    description:
      "Test your website against a location in each of the three primary geographic regions (AMER, APAC and EMEA)",
    category: "region",
  },
  {
    id: "block-ads",
    title: "Block Ad Networks",
    description:
      "Test your website while blocking common third-party ad networks",
    category: "network",
  },
];
