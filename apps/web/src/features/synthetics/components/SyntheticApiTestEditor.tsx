"use client";

import {
  CaretDown,
  CaretRight,
  Heartbeat,
  Info,
  Lightning,
  Plus,
  ShieldCheck,
  Trash,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useCreateSyntheticTest,
  usePatchSyntheticTest,
  useRunOnce,
} from "../hooks";
import {
  ALL_LOCATION_IDS,
  API_TEMPLATES,
  FREQUENCY_OPTIONS,
  LOCATIONS,
  REGIONS,
  type AlertCondition,
  type AssertionOperator,
  type AssertionType,
  type AuthConfig,
  type AuthType,
  type HttpMethod,
  type RetryConfig,
  type Subtype,
  type SyntheticAssertion,
  type SyntheticHeader,
  type SyntheticRequest,
  type SyntheticResult,
  type SyntheticTest,
} from "../types";

const HTTP_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

const SUBTYPES: { value: Subtype; label: string; comingSoon?: boolean }[] = [
  { value: "http", label: "HTTP" },
  { value: "grpc", label: "gRPC", comingSoon: true },
  { value: "ssl", label: "SSL", comingSoon: true },
  { value: "dns", label: "DNS", comingSoon: true },
  { value: "websocket", label: "WebSocket", comingSoon: true },
  { value: "tcp", label: "TCP", comingSoon: true },
  { value: "udp", label: "UDP", comingSoon: true },
  { value: "icmp", label: "ICMP", comingSoon: true },
];

const ASSERTION_TYPES: { value: AssertionType; label: string }[] = [
  { value: "status_code", label: "Status code" },
  { value: "response_time", label: "Response time (ms)" },
  { value: "header", label: "Header" },
  { value: "body", label: "Body" },
  { value: "body_size", label: "Body size (bytes)" },
];

const OPERATORS: { value: AssertionOperator; label: string }[] = [
  { value: "is", label: "is" },
  { value: "is_not", label: "is not" },
  { value: "less_than", label: "less than" },
  { value: "less_than_or_equal", label: "≤" },
  { value: "greater_than", label: "greater than" },
  { value: "greater_than_or_equal", label: "≥" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
];

type EditorProps = {
  initial?: SyntheticTest;
  mode: "create" | "edit";
  templateId?: string | null;
};

type FormState = {
  name: string;
  subtype: Subtype;
  method: HttpMethod;
  url: string;
  request: SyntheticRequest;
  assertions: SyntheticAssertion[];
  auth: AuthConfig;
  retry: RetryConfig;
  alertCondition: AlertCondition;
  monitorMessage: string;
  locations: string[];
  frequencySeconds: number;
  tags: string[];
  environment: string;
  team: string;
  enabled: boolean;
};

const DEFAULT_MONITOR_MESSAGE = `{{! Test result details }}
Your test {{#is_alert}}failed{{else}}recovered{{/is_alert}} after running for {{eval "synthetics.attributes.result.duration/1000" }}s on the {{#if synthetics.attributes.location.privateLocation}}Private{{else}}Managed{{/if}} Location {{synthetics.attributes.location.id}}.

{{! If alert, provide details about the failure }}
{{#is_alert}}{{#is_exact_match "synthetics.attributes.result.failure.code" "INCORRECT_ASSERTION"}}
{{! Test failed due to failed assertions, list them }}
# Failed assertions
{{#each synthetics.attributes.result.assertions}}{{#unless valid}}
- \`{{type}}\` {{operator}} \`{{expected}}\`
{{/unless}}{{/each}}
{{/is_exact_match}}{{/is_alert}}

@team-on-call`;

function defaultForm(): FormState {
  return {
    name: "",
    subtype: "http",
    method: "GET",
    url: "",
    request: {
      headers: [],
      query: [],
      bodyType: "raw",
      body: "",
      timeoutMs: 15_000,
    },
    assertions: [
      { type: "status_code", operator: "is", expected: 200 },
      { type: "response_time", operator: "less_than", expected: 2000 },
    ],
    auth: { type: "none" },
    retry: { count: 0, intervalMs: 300 },
    alertCondition: { failingMinutes: 0, fromLocations: 1 },
    monitorMessage: DEFAULT_MONITOR_MESSAGE,
    locations: ["aws:us-east-1"],
    frequencySeconds: 60,
    tags: [],
    environment: "",
    team: "",
    enabled: true,
  };
}

function fromTemplate(tplId: string): FormState {
  const base = defaultForm();
  const tpl = API_TEMPLATES.find((t) => t.id === tplId);
  if (!tpl) return base;
  return {
    ...base,
    name: tpl.title,
    subtype: tpl.subtype,
    method: tpl.method,
    assertions: tpl.assertions,
    frequencySeconds: tpl.frequencySeconds,
  };
}

function toForm(test: SyntheticTest): FormState {
  return {
    name: test.name,
    subtype: test.subtype,
    method: test.method,
    url: test.url,
    request: {
      headers: test.request.headers ?? [],
      query: test.request.query ?? [],
      bodyType: test.request.bodyType ?? "raw",
      body: test.request.body ?? "",
      timeoutMs: test.request.timeoutMs ?? 15_000,
    },
    assertions: test.assertions ?? [],
    auth: test.auth ?? { type: "none" },
    retry: test.retry ?? { count: 0, intervalMs: 300 },
    alertCondition: test.alertCondition ?? { failingMinutes: 0, fromLocations: 1 },
    monitorMessage: test.monitorMessage || DEFAULT_MONITOR_MESSAGE,
    locations: test.locations ?? [],
    frequencySeconds: test.frequencySeconds,
    tags: test.tags ?? [],
    environment: test.environment ?? "",
    team: test.team ?? "",
    enabled: test.enabled,
  };
}

export function SyntheticApiTestEditor({ initial, mode, templateId }: EditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => {
    if (initial) return toForm(initial);
    if (templateId) return fromTemplate(templateId);
    return defaultForm();
  });
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    request: true,
    define: true,
    assertions: true,
    locations: true,
    retry: false,
    schedule: true,
    downtimes: false,
    monitor: true,
  });
  const [tab, setTab] = useState<"snippets" | "preview" | "variables">(
    "snippets",
  );
  const [previewResults, setPreviewResults] = useState<SyntheticResult[] | null>(
    null,
  );

  const createMut = useCreateSyntheticTest();
  const patchMut = usePatchSyntheticTest(initial?.id ?? "");
  const runOnceMut = useRunOnce();

  const toggle = (k: string) =>
    setOpenSection((prev) => ({ ...prev, [k]: !prev[k] }));

  const handleSend = async () => {
    setTab("preview");
    const results = await runOnceMut.mutateAsync({
      test_type: "api",
      method: form.method,
      url: form.url,
      request: form.request,
      assertions: form.assertions,
      auth: form.auth,
      locations: form.locations.length ? form.locations : ["aws:us-east-1"],
    });
    setPreviewResults(results);
  };

  const handleSave = async () => {
    if (!form.url.trim() || !form.name.trim()) {
      alert("URL and Name are required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      test_type: "api" as const,
      subtype: form.subtype,
      method: form.method,
      url: form.url.trim(),
      request: form.request,
      assertions: form.assertions,
      browser_config: {
        startingUrl: "",
        browsers: [],
        devices: [],
        steps: [],
      },
      auth: form.auth,
      retry: form.retry,
      alert_condition: form.alertCondition,
      monitor_message: form.monitorMessage,
      downtimes: [],
      locations: form.locations,
      frequency_seconds: form.frequencySeconds,
      tags: form.tags,
      environment: form.environment.trim() || null,
      team: form.team.trim() || null,
      enabled: form.enabled,
    };
    if (mode === "create") {
      const created = await createMut.mutateAsync(payload);
      router.push(`/synthetics/tests/${created.id}`);
    } else if (initial) {
      await patchMut.mutateAsync(payload);
      router.push(`/synthetics/tests/${initial.id}`);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#f8f9fa] text-[#202124]">
      <header className="flex h-12 items-center border-b border-[#dadce0] bg-white px-6">
        <div className="flex items-center gap-2 text-[13px] text-[#5f6368]">
          <Link href="/synthetics/tests" className="hover:underline">
            <SyntheticsIcon />
          </Link>
          <span>/</span>
          <Heartbeat size={16} className="text-[#632ca6]" />
          <span className="text-[14px] font-medium text-[#202124]">
            {mode === "create" ? "New API Test" : form.name || "Edit Test"}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="mx-auto w-full max-w-[920px] px-6 pb-24 pt-6">
            <Section
              n={1}
              title="Request Type"
              open={openSection.request}
              onToggle={() => toggle("request")}
            >
              <div className="flex flex-wrap gap-1">
                {SUBTYPES.map((s) => {
                  const active = form.subtype === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      disabled={s.comingSoon}
                      onClick={() =>
                        setForm((f) => ({ ...f, subtype: s.value }))
                      }
                      className={
                        "rounded-md border px-3 py-1.5 text-[13px] " +
                        (active
                          ? "border-[#006CC2] bg-[#e6f1f9] text-[#006CC2]"
                          : s.comingSoon
                            ? "border-[#dadce0] bg-white text-[#bdc1c6] disabled:cursor-not-allowed"
                            : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]")
                      }
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section
              n={2}
              title="Define Request"
              open={openSection.define}
              onToggle={() => toggle("define")}
            >
              <div className="rounded-md bg-[#f1f3f4] p-3">
                <label className="text-[12px] font-medium text-[#202124]">
                  URL <span className="text-[#d93025]">*</span>
                </label>
                <div className="mt-1 flex items-stretch overflow-hidden rounded-md border border-[#bdc1c6] bg-white">
                  <select
                    value={form.method}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        method: e.target.value as HttpMethod,
                      }))
                    }
                    className="border-r border-[#dadce0] bg-white px-2 py-1.5 text-[13px] outline-none"
                  >
                    {HTTP_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={form.url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, url: e.target.value }))
                    }
                    placeholder="https://api.example.com/endpoint"
                    className="flex-1 px-3 py-1.5 text-[13px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={runOnceMut.isPending || !form.url.trim()}
                    className="bg-[#006CC2] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#0058a3] disabled:opacity-60"
                  >
                    {runOnceMut.isPending ? "Sending…" : "Send"}
                  </button>
                </div>
                <AdvancedOptions
                  request={form.request}
                  auth={form.auth}
                  onRequestChange={(r) =>
                    setForm((f) => ({ ...f, request: r }))
                  }
                  onAuthChange={(a) => setForm((f) => ({ ...f, auth: a }))}
                />
              </div>

              <div className="mt-4">
                <label className="text-[12px] font-medium text-[#202124]">
                  Name <span className="text-[#d93025]">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Give your test a name"
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <TextField
                  label="Environment"
                  value={form.environment}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, environment: v }))
                  }
                  placeholder="prod"
                />
                <TextField
                  label="Team"
                  value={form.team}
                  onChange={(v) => setForm((f) => ({ ...f, team: v }))}
                  placeholder="payments"
                />
                <TextField
                  label="Tags (comma-separated)"
                  value={form.tags.join(", ")}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      tags: v
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="critical, public-api"
                />
              </div>
            </Section>

            <Section
              n={3}
              title="Assertions"
              open={openSection.assertions}
              onToggle={() => toggle("assertions")}
            >
              <AssertionsEditor
                assertions={form.assertions}
                onChange={(a) =>
                  setForm((f) => ({ ...f, assertions: a }))
                }
              />
            </Section>

            <Section
              n={4}
              title="Locations"
              open={openSection.locations}
              onToggle={() => toggle("locations")}
            >
              <LocationsPicker
                selected={form.locations}
                onChange={(locs) =>
                  setForm((f) => ({ ...f, locations: locs }))
                }
              />
            </Section>

            <Section
              n={5}
              title="Retry Conditions"
              open={openSection.retry}
              onToggle={() => toggle("retry")}
            >
              <RetryConditionsEditor
                retry={form.retry}
                onChange={(r) => setForm((f) => ({ ...f, retry: r }))}
              />
            </Section>

            <Section
              n={6}
              title="Scheduling & Alert Conditions"
              open={openSection.schedule}
              onToggle={() => toggle("schedule")}
            >
              <SchedulingEditor
                frequencySeconds={form.frequencySeconds}
                alertCondition={form.alertCondition}
                totalLocations={form.locations.length || 28}
                onFrequencyChange={(s) =>
                  setForm((f) => ({ ...f, frequencySeconds: s }))
                }
                onAlertChange={(a) =>
                  setForm((f) => ({ ...f, alertCondition: a }))
                }
              />
            </Section>

            <Section
              n={7}
              title="Downtimes"
              open={openSection.downtimes}
              onToggle={() => toggle("downtimes")}
            >
              <div className="space-y-2">
                <select
                  disabled
                  className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] text-[#5f6368] outline-none"
                >
                  <option>Select downtimes...</option>
                </select>
                <p className="text-[12px] text-[#5f6368]">
                  Schedule downtimes in Settings → Downtimes to pause this
                  test during planned maintenance windows.
                </p>
              </div>
            </Section>

            <Section
              n={8}
              title="Monitor"
              open={openSection.monitor}
              onToggle={() => toggle("monitor")}
            >
              <MonitorEditor
                message={form.monitorMessage}
                onChange={(m) =>
                  setForm((f) => ({ ...f, monitorMessage: m }))
                }
              />
            </Section>
          </div>

          <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-[#dadce0] bg-white px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/synthetics/tests")}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={createMut.isPending || patchMut.isPending}
            >
              {mode === "create" ? "Save Test" : "Save Changes"}
            </Button>
          </div>
        </div>

        <aside className="flex w-[360px] flex-col border-l border-[#dadce0] bg-white">
          <div className="flex border-b border-[#dadce0] bg-white">
            {(["snippets", "preview", "variables"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={
                  "flex-1 px-3 py-2 text-[12px] font-medium capitalize " +
                  (tab === t
                    ? "border-b-2 border-[#006CC2] text-[#202124]"
                    : "text-[#5f6368] hover:bg-[#f1f3f4]")
                }
              >
                {t === "preview" ? "Response Preview" : t}
                {t === "variables" && (
                  <span className="ml-1 text-[#5f6368]">0</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {tab === "snippets" && (
              <SnippetsPanel
                onApply={(snip) =>
                  setForm((f) => ({
                    ...f,
                    auth:
                      snip === "basic"
                        ? { type: "basic", username: "", password: "" }
                        : snip === "bearer"
                          ? { type: "bearer", token: "" }
                          : snip === "api_key"
                            ? {
                                type: "api_key",
                                keyName: "X-API-Key",
                                keyValue: "",
                                keyLocation: "header",
                              }
                            : f.auth,
                    frequencySeconds:
                      snip === "uptime" ? 60 : f.frequencySeconds,
                    assertions:
                      snip === "latency"
                        ? [
                            {
                              type: "response_time",
                              operator: "less_than",
                              expected: 2000,
                            },
                            ...f.assertions.filter(
                              (a) => a.type !== "response_time",
                            ),
                          ]
                        : f.assertions,
                    locations:
                      snip === "multi_region"
                        ? [
                            "aws:us-east-1",
                            "aws:eu-west-1",
                            "aws:ap-southeast-1",
                          ]
                        : f.locations,
                  }))
                }
              />
            )}
            {tab === "preview" && (
              <ResponsePreview
                results={previewResults}
                pending={runOnceMut.isPending}
              />
            )}
            {tab === "variables" && (
              <div className="p-4 text-[12px] text-[#5f6368]">
                Variables let you reuse values across requests. Coming soon.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="relative mb-1 pl-9">
      <div className="absolute left-3 top-0 h-full w-px bg-[#dadce0]" />
      <button
        type="button"
        onClick={onToggle}
        className="absolute left-0 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#632ca6] bg-white text-[11px] font-semibold text-[#632ca6]"
      >
        {n}
      </button>
      <div className="rounded-md bg-white">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-2 px-2 py-3 text-left transition-colors hover:bg-[#f8f9fa]"
        >
          {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
          <span className="text-[14px] font-medium">{title}</span>
        </button>
        {open && <div className="px-2 pb-4">{children}</div>}
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[#202124]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[#1a73e8]"
      />
    </div>
  );
}

function AdvancedOptions({
  request,
  auth,
  onRequestChange,
  onAuthChange,
}: {
  request: SyntheticRequest;
  auth: AuthConfig;
  onRequestChange: (r: SyntheticRequest) => void;
  onAuthChange: (a: AuthConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<
    "headers" | "query" | "body" | "auth" | "options"
  >("headers");

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[12px] text-[#1a73e8] hover:underline"
      >
        {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
        Advanced Options
      </button>
      {open && (
        <div className="mt-3 rounded-md border border-[#dadce0] bg-white">
          <div className="flex border-b border-[#dadce0]">
            {(["headers", "query", "body", "auth", "options"] as const).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={
                    "border-b-2 px-3 py-1.5 text-[12px] capitalize " +
                    (tab === t
                      ? "border-[#006CC2] text-[#202124]"
                      : "border-transparent text-[#5f6368] hover:bg-[#f8f9fa]")
                  }
                >
                  {t === "auth" ? "Authentication" : t}
                </button>
              ),
            )}
          </div>
          <div className="p-3">
            {tab === "headers" && (
              <KVEditor
                label="Headers"
                rows={request.headers}
                onChange={(headers) =>
                  onRequestChange({ ...request, headers })
                }
              />
            )}
            {tab === "query" && (
              <KVEditor
                label="Query parameters"
                rows={request.query}
                onChange={(query) => onRequestChange({ ...request, query })}
              />
            )}
            {tab === "body" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[12px] font-medium text-[#202124]">
                    Body type
                  </label>
                  <select
                    value={request.bodyType ?? "raw"}
                    onChange={(e) =>
                      onRequestChange({
                        ...request,
                        bodyType: e.target.value as "raw" | "json",
                      })
                    }
                    className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
                  >
                    <option value="raw">raw</option>
                    <option value="json">json</option>
                    <option value="form">form</option>
                  </select>
                </div>
                <textarea
                  value={request.body ?? ""}
                  onChange={(e) =>
                    onRequestChange({ ...request, body: e.target.value })
                  }
                  placeholder='{"key": "value"}'
                  rows={5}
                  className="w-full resize-y rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 font-mono text-[12px] outline-none focus:border-[#1a73e8]"
                />
              </div>
            )}
            {tab === "auth" && (
              <AuthEditor auth={auth} onChange={onAuthChange} />
            )}
            {tab === "options" && (
              <div className="space-y-2">
                <div>
                  <label className="text-[12px] font-medium text-[#202124]">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    max={60_000}
                    value={request.timeoutMs ?? 15_000}
                    onChange={(e) =>
                      onRequestChange({
                        ...request,
                        timeoutMs: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-[140px] rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthEditor({
  auth,
  onChange,
}: {
  auth: AuthConfig;
  onChange: (a: AuthConfig) => void;
}) {
  const types: { value: AuthType; label: string }[] = [
    { value: "none", label: "None" },
    { value: "basic", label: "Basic" },
    { value: "bearer", label: "Bearer Token" },
    { value: "api_key", label: "API / App Key" },
    { value: "digest", label: "Digest" },
    { value: "ntlm", label: "NTLM" },
    { value: "hmac", label: "HMAC" },
    { value: "oauth2", label: "OAuth 2.0" },
    { value: "aws_sigv4", label: "AWS Signature v4" },
  ];

  return (
    <div className="space-y-2">
      <div>
        <label className="text-[12px] font-medium text-[#202124]">
          Authentication type
        </label>
        <select
          value={auth.type}
          onChange={(e) => onChange({ type: e.target.value as AuthType })}
          className="mt-1 block w-[200px] rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {auth.type === "basic" && (
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="Username"
            value={auth.username ?? ""}
            onChange={(v) => onChange({ ...auth, username: v })}
          />
          <TextField
            label="Password"
            value={auth.password ?? ""}
            onChange={(v) => onChange({ ...auth, password: v })}
          />
        </div>
      )}
      {auth.type === "bearer" && (
        <TextField
          label="Token"
          value={auth.token ?? ""}
          onChange={(v) => onChange({ ...auth, token: v })}
        />
      )}
      {auth.type === "api_key" && (
        <div className="grid grid-cols-3 gap-2">
          <TextField
            label="Key name"
            value={auth.keyName ?? ""}
            onChange={(v) => onChange({ ...auth, keyName: v })}
          />
          <TextField
            label="Key value"
            value={auth.keyValue ?? ""}
            onChange={(v) => onChange({ ...auth, keyValue: v })}
          />
          <div>
            <label className="text-[12px] font-medium text-[#202124]">
              Location
            </label>
            <select
              value={auth.keyLocation ?? "header"}
              onChange={(e) =>
                onChange({
                  ...auth,
                  keyLocation: e.target.value as "header" | "query",
                })
              }
              className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
            >
              <option value="header">Header</option>
              <option value="query">Query</option>
            </select>
          </div>
        </div>
      )}
      {auth.type !== "none" &&
        auth.type !== "basic" &&
        auth.type !== "bearer" &&
        auth.type !== "api_key" && (
          <div className="rounded-md bg-[#fef7e0] px-2 py-1.5 text-[12px] text-[#a36b00]">
            <Info size={12} className="mr-1 inline" />
            {auth.type === "digest"
              ? "Digest"
              : auth.type === "ntlm"
                ? "NTLM"
                : auth.type === "hmac"
                  ? "HMAC"
                  : auth.type === "oauth2"
                    ? "OAuth 2.0"
                    : "AWS Signature v4"}{" "}
            authentication is recognized but not yet evaluated in this clone.
          </div>
        )}
    </div>
  );
}

function KVEditor({
  label,
  rows,
  onChange,
}: {
  label: string;
  rows: SyntheticHeader[];
  onChange: (rows: SyntheticHeader[]) => void;
}) {
  const update = (i: number, patch: Partial<SyntheticHeader>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { key: "", value: "" }]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[12px] font-medium text-[#202124]">{label}</label>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[12px] text-[#1a73e8] hover:underline"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      <div className="space-y-1">
        {rows.length === 0 && (
          <div className="text-[12px] text-[#9aa0a6]">None</div>
        )}
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="text"
              value={row.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="key"
              className="flex-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none focus:border-[#1a73e8]"
            />
            <input
              type="text"
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="value"
              className="flex-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none focus:border-[#1a73e8]"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded p-1 text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#d93025]"
            >
              <Trash size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssertionsEditor({
  assertions,
  onChange,
}: {
  assertions: SyntheticAssertion[];
  onChange: (a: SyntheticAssertion[]) => void;
}) {
  const update = (i: number, patch: Partial<SyntheticAssertion>) =>
    onChange(assertions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const remove = (i: number) =>
    onChange(assertions.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...assertions,
      { type: "status_code", operator: "is", expected: 200 },
    ]);

  return (
    <div>
      <div className="space-y-2">
        {assertions.length === 0 && (
          <div className="rounded-md border border-dashed border-[#dadce0] bg-[#f8f9fa] px-3 py-4 text-center text-[12px] text-[#9aa0a6]">
            No assertions yet — add at least one to determine the test outcome.
          </div>
        )}
        {assertions.map((a, i) => (
          <div
            key={i}
            className="flex items-center gap-1 rounded-md border border-[#dadce0] bg-[#f8f9fa] p-2"
          >
            <select
              value={a.type}
              onChange={(e) =>
                update(i, { type: e.target.value as AssertionType })
              }
              className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
            >
              {ASSERTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {a.type === "header" && (
              <input
                type="text"
                value={a.target ?? ""}
                onChange={(e) => update(i, { target: e.target.value })}
                placeholder="header name"
                className="w-[140px] rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
              />
            )}
            <select
              value={a.operator}
              onChange={(e) =>
                update(i, { operator: e.target.value as AssertionOperator })
              }
              className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={a.expected == null ? "" : String(a.expected)}
              onChange={(e) => {
                const v = e.target.value;
                const numeric = v !== "" && !Number.isNaN(Number(v));
                update(i, {
                  expected: numeric ? Number(v) : v,
                });
              }}
              placeholder="expected"
              className="flex-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none focus:border-[#1a73e8]"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded p-1 text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#d93025]"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-3 py-1 text-[12px] text-[#1a73e8] hover:bg-[#f1f3f4]"
      >
        <Plus size={12} />
        Add assertion
      </button>
    </div>
  );
}

function LocationsPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (s: string[]) => void;
}) {
  const grouped = useMemo(() => {
    const out: Record<string, typeof LOCATIONS[number][]> = {
      Americas: [],
      EMEA: [],
      "Asia Pacific": [],
    };
    for (const l of LOCATIONS) out[l.region].push(l);
    return out;
  }, []);

  const allSelected = selected.length === ALL_LOCATION_IDS.length;
  const toggleAll = () =>
    onChange(allSelected ? [] : [...ALL_LOCATION_IDS]);

  const toggleRegion = (region: string) => {
    const ids = grouped[region].map((l) => l.id);
    const allOn = ids.every((i) => selected.includes(i));
    if (allOn) {
      onChange(selected.filter((s) => !ids.includes(s)));
    } else {
      const next = new Set(selected);
      ids.forEach((i) => next.add(i));
      onChange([...next]);
    }
  };

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] hover:bg-[#f1f3f4]"
        >
          <Checkbox checked={allSelected} />
          <span className="font-medium">All Locations ({LOCATIONS.length})</span>
        </button>
        <div className="flex items-center gap-2 text-[12px] text-[#5f6368]">
          <Checkbox checked={allSelected} />
          <span>Managed Locations ({LOCATIONS.length})</span>
        </div>
      </div>
      {REGIONS.map((region) => {
        const ids = grouped[region].map((l) => l.id);
        const allOn = ids.length > 0 && ids.every((i) => selected.includes(i));
        const someOn = !allOn && ids.some((i) => selected.includes(i));
        return (
          <div key={region}>
            <button
              type="button"
              onClick={() => toggleRegion(region)}
              className="mb-1 flex items-center gap-2 text-[12px] text-[#202124] hover:underline"
            >
              <Checkbox checked={allOn} indeterminate={someOn} />
              <span className="font-medium">
                {region} ({ids.length})
              </span>
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              {grouped[region].map((loc) => {
                const on = selected.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => toggle(loc.id)}
                    className={
                      "flex items-center gap-2 rounded-md border px-2 py-1 text-left text-[12px] transition-colors " +
                      (on
                        ? "border-[#006CC2] bg-[#e6f1f9] text-[#006CC2]"
                        : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]")
                    }
                  >
                    <Checkbox checked={on} />
                    {loc.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Checkbox({
  checked,
  indeterminate,
}: {
  checked: boolean;
  indeterminate?: boolean;
}) {
  const bg = checked || indeterminate ? "#006CC2" : "white";
  return (
    <span
      className={
        "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border " +
        (checked || indeterminate ? "border-[#006CC2]" : "border-[#bdc1c6]")
      }
      style={{ backgroundColor: bg }}
    >
      {checked && !indeterminate && (
        <span className="text-[9px] leading-none text-white">✓</span>
      )}
      {indeterminate && (
        <span className="block h-[2px] w-2 rounded-sm bg-white" />
      )}
    </span>
  );
}

function RetryConditionsEditor({
  retry,
  onChange,
}: {
  retry: RetryConfig;
  onChange: (r: RetryConfig) => void;
}) {
  return (
    <div className="space-y-2 text-[13px] text-[#202124]">
      <div className="flex items-center gap-2">
        <span>If the test fails, retry up to</span>
        <input
          type="number"
          min={0}
          max={5}
          value={retry.count}
          onChange={(e) =>
            onChange({ ...retry, count: Number(e.target.value) })
          }
          className="w-16 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
        />
        <span>time(s) before failing the location, with</span>
        <input
          type="number"
          min={0}
          max={60_000}
          step={100}
          value={retry.intervalMs}
          onChange={(e) =>
            onChange({ ...retry, intervalMs: Number(e.target.value) })
          }
          className="w-24 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
        />
        <span>ms between attempts.</span>
      </div>
      <p className="text-[12px] text-[#5f6368]">
        Retries help reduce noise from transient network issues. Use 0 to
        fail immediately on the first error.
      </p>
    </div>
  );
}

function SchedulingEditor({
  frequencySeconds,
  alertCondition,
  totalLocations,
  onFrequencyChange,
  onAlertChange,
}: {
  frequencySeconds: number;
  alertCondition: AlertCondition;
  totalLocations: number;
  onFrequencyChange: (s: number) => void;
  onAlertChange: (a: AlertCondition) => void;
}) {
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  return (
    <div className="space-y-3">
      <div className="flex gap-4 border-b border-[#dadce0]">
        {(["basic", "advanced"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={
              "border-b-2 px-2 pb-2 text-[13px] capitalize " +
              (mode === m
                ? "border-[#006CC2] text-[#202124]"
                : "border-transparent text-[#5f6368] hover:text-[#202124]")
            }
          >
            {m}
          </button>
        ))}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-1 rounded-md bg-[#f8f9fa] p-1">
          {FREQUENCY_OPTIONS.map((opt) => {
            const active = opt.value === frequencySeconds;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFrequencyChange(opt.value)}
                className={
                  "rounded-md px-3 py-1 text-[13px] " +
                  (active
                    ? "border border-[#006CC2] bg-white text-[#202124] shadow-sm"
                    : "text-[#5f6368] hover:bg-white")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[13px] text-[#202124]">
        <span>An alert is triggered if your test fails for</span>
        <input
          type="number"
          min={0}
          value={alertCondition.failingMinutes}
          onChange={(e) =>
            onAlertChange({
              ...alertCondition,
              failingMinutes: Number(e.target.value),
            })
          }
          className="w-16 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-right text-[13px] outline-none"
        />
        <span>minutes from any</span>
        <input
          type="number"
          min={1}
          max={Math.max(totalLocations, 1)}
          value={alertCondition.fromLocations}
          onChange={(e) =>
            onAlertChange({
              ...alertCondition,
              fromLocations: Number(e.target.value),
            })
          }
          className="w-16 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-right text-[13px] outline-none"
        />
        <span>of {totalLocations} locations</span>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-[#e8f0fe] px-3 py-2 text-[12px] text-[#1967d2]">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          A notification is sent and the test is set to "alert" status if it
          fails in at least one location.
        </span>
      </div>
    </div>
  );
}

function MonitorEditor({
  message,
  onChange,
}: {
  message: string;
  onChange: (m: string) => void;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  return (
    <div>
      <div className="flex items-center justify-between border-b border-[#dadce0]">
        <div className="flex gap-3">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "border-b-2 px-2 pb-2 text-[12px] capitalize " +
                (tab === t
                  ? "border-[#006CC2] text-[#202124]"
                  : "border-transparent text-[#5f6368] hover:text-[#202124]")
              }
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-[12px] text-[#1a73e8] hover:underline"
        >
          <Info size={12} />
          Use Message Template Variables
        </button>
      </div>
      <input
        type="text"
        placeholder='It will default to "[Synthetics] test name" filled with the synthetics name'
        className="mt-2 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[12px] outline-none focus:border-[#1a73e8]"
      />
      <div className="mt-2 flex gap-1 rounded-md border border-[#dadce0] bg-[#f8f9fa] px-2 py-1 text-[12px] text-[#5f6368]">
        <span className="font-mono px-1 hover:bg-[#e8eaed] rounded cursor-pointer">H</span>
        <span className="font-mono px-1 font-bold hover:bg-[#e8eaed] rounded cursor-pointer">B</span>
        <span className="font-mono px-1 italic hover:bg-[#e8eaed] rounded cursor-pointer">I</span>
        <span className="font-mono px-1 line-through hover:bg-[#e8eaed] rounded cursor-pointer">S</span>
        <span className="border-l border-[#dadce0] mx-1" />
        <span className="font-mono px-1 hover:bg-[#e8eaed] rounded cursor-pointer">@</span>
        <span className="font-mono px-1 hover:bg-[#e8eaed] rounded cursor-pointer">{`{{`}</span>
      </div>
      {tab === "edit" ? (
        <textarea
          value={message}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="mt-2 w-full resize-y rounded-md border border-[#dadce0] bg-white px-3 py-2 font-mono text-[11px] leading-[16px] outline-none focus:border-[#1a73e8]"
        />
      ) : (
        <pre className="mt-2 whitespace-pre-wrap rounded-md border border-[#dadce0] bg-[#f8f9fa] px-3 py-2 font-mono text-[11px] leading-[16px] text-[#202124]">
          {message}
        </pre>
      )}
    </div>
  );
}

function SnippetsPanel({
  onApply,
}: {
  onApply: (snip: string) => void;
}) {
  return (
    <div className="p-3">
      <div className="mb-3 flex items-start justify-between rounded-md bg-gradient-to-br from-[#7a3edb] to-[#4f29c5] p-3 text-white">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[14px] font-semibold">✨ Snippets</span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold">
              NEW
            </span>
          </div>
          <p className="text-[11px] leading-[15px]">
            Speed up test creation with Snippets that pre-fill sections of
            your test based on common configurations.
          </p>
        </div>
      </div>

      <SnippetGroup
        icon={<ShieldCheck size={14} className="text-[#f9ab00]" weight="fill" />}
        label="Authentication"
        count={4}
        items={[
          {
            id: "basic",
            title: "Basic Authentication in HTTP Test",
            sub: "Test your API endpoints using Basic Auth",
          },
          {
            id: "hmac",
            title: "HMAC Authentication in HTTP Test using JavaScript",
            sub: "Test API endpoints requiring HMAC Authentication using JavaScript",
          },
          {
            id: "bearer",
            title: "Bearer Token Authentication in HTTP Test",
            sub: "Test API endpoints requiring Bearer Token Authentication",
          },
          {
            id: "api_key",
            title: "API / App Key Authentication in HTTP Test",
            sub: "Test API endpoints requiring API / App Key Authentication",
          },
        ]}
        onApply={onApply}
      />

      <SnippetGroup
        icon={<Lightning size={14} className="text-[#7a3edb]" weight="fill" />}
        label="Performance"
        count={3}
        items={[
          {
            id: "uptime",
            title: "High Uptime / Availability",
            sub: "Configure a test with the shortest frequency available e.g. 1m",
          },
          {
            id: "grpc",
            title: "gRPC Health Check",
            sub: "Determine if your gRPC servers and services are responsive, running, and capable of handling remote procedure calls",
          },
          {
            id: "latency",
            title: "Latency / Response Time",
            sub: "Test for overall response time latency with a breakdown of network timing (DNS, Connection, SSL, Time to first Byte, Download)",
          },
        ]}
        onApply={onApply}
      />

      <SnippetGroup
        icon={<Heartbeat size={14} className="text-[#34a853]" weight="fill" />}
        label="Regions"
        count={1}
        items={[
          {
            id: "multi_region",
            title: "Multi-Region Check",
            sub: "Test your API against a location in each of the three primary geographic regions (AMER, APAC and EMEA)",
          },
        ]}
        onApply={onApply}
      />
    </div>
  );
}

function SnippetGroup({
  icon,
  label,
  count,
  items,
  onApply,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  items: { id: string; title: string; sub: string }[];
  onApply: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full items-center gap-1.5 text-left"
      >
        {icon}
        <span className="text-[13px] font-medium text-[#202124]">{label}</span>
        <span className="text-[12px] text-[#5f6368]">{count} snippets</span>
        {open ? <CaretDown size={11} /> : <CaretRight size={11} />}
      </button>
      {open && (
        <div className="space-y-1">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onApply(it.id)}
              className="block w-full rounded-md border border-[#dadce0] bg-white p-2 text-left hover:bg-[#f8f9fa]"
            >
              <div className="text-[12px] font-medium text-[#202124]">
                {it.title}
              </div>
              <div className="mt-0.5 text-[11px] text-[#5f6368]">{it.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResponsePreview({
  results,
  pending,
}: {
  results: SyntheticResult[] | null;
  pending: boolean;
}) {
  if (pending) {
    return (
      <div className="p-4 text-[12px] text-[#5f6368]">Running probe…</div>
    );
  }
  if (!results) {
    return (
      <div className="p-4 text-[12px] text-[#5f6368]">
        Click <strong>Send</strong> to preview the response.
      </div>
    );
  }
  if (results.length === 0) {
    return <div className="p-4 text-[12px] text-[#5f6368]">No results.</div>;
  }
  const r = results[0];
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <span
          className={
            "rounded px-2 py-0.5 text-[12px] font-semibold " +
            (r.status === "OK"
              ? "bg-[#E6F4EA] text-[#1A8341]"
              : "bg-[#FCE8E6] text-[#D93025]")
          }
        >
          {r.status}
        </span>
        <span className="font-mono text-[12px] text-[#5f6368]">
          {r.statusCode ?? "—"} · {r.responseTimeMs ?? "—"} ms
        </span>
      </div>
      {r.errorMessage && (
        <div className="rounded-md bg-[#fce8e6] px-2 py-1.5 text-[12px] text-[#d93025]">
          {r.errorMessage}
        </div>
      )}
      <div className="rounded-md border border-[#dadce0] p-2">
        <div className="mb-1 text-[11px] font-semibold text-[#5f6368]">
          Timings
        </div>
        <TimingBar
          label="DNS"
          ms={r.timings.dnsMs}
          total={r.responseTimeMs ?? 1}
        />
        <TimingBar
          label="Connect"
          ms={r.timings.connectionMs}
          total={r.responseTimeMs ?? 1}
        />
        <TimingBar
          label="SSL"
          ms={r.timings.sslMs}
          total={r.responseTimeMs ?? 1}
        />
        <TimingBar
          label="TTFB"
          ms={r.timings.ttfbMs}
          total={r.responseTimeMs ?? 1}
        />
        <TimingBar
          label="Download"
          ms={r.timings.downloadMs}
          total={r.responseTimeMs ?? 1}
        />
      </div>
      {r.assertionResults.length > 0 && (
        <div className="rounded-md border border-[#dadce0] p-2">
          <div className="mb-1 text-[11px] font-semibold text-[#5f6368]">
            Assertions ({r.assertionResults.filter((a) => a.passed).length} /{" "}
            {r.assertionResults.length})
          </div>
          {r.assertionResults.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[12px]"
            >
              <span>
                {a.type}
                {a.target ? ` (${a.target})` : ""} {a.operator}{" "}
                <code className="rounded bg-[#f1f3f4] px-1">
                  {String(a.expected ?? "")}
                </code>
              </span>
              <span
                className={
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold " +
                  (a.passed
                    ? "bg-[#E6F4EA] text-[#1A8341]"
                    : "bg-[#FCE8E6] text-[#D93025]")
                }
              >
                {a.passed ? "PASS" : "FAIL"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimingBar({
  label,
  ms,
  total,
}: {
  label: string;
  ms: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, (ms / total) * 100) : 0;
  return (
    <div className="mb-1 flex items-center gap-2">
      <div className="w-[60px] text-[11px] text-[#5f6368]">{label}</div>
      <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-[#f1f3f4]">
        <div
          className="absolute left-0 top-0 h-full bg-[#34a853]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-[50px] text-right font-mono text-[11px] text-[#5f6368]">
        {ms} ms
      </div>
    </div>
  );
}

function SyntheticsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="#5f6368" strokeWidth="2" />
      <path
        d="M9 12l2 2 4-4"
        stroke="#5f6368"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
