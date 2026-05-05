"use client";

import { CaretDown, CaretRight, Plus, Trash, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useCreateSyntheticTest,
  usePatchSyntheticTest,
  useRunOnce,
} from "../hooks";
import {
  FREQUENCY_OPTIONS,
  LOCATIONS,
  type AssertionOperator,
  type AssertionType,
  type HttpMethod,
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
};

type FormState = {
  name: string;
  method: HttpMethod;
  url: string;
  request: SyntheticRequest;
  assertions: SyntheticAssertion[];
  locations: string[];
  frequencySeconds: number;
  tags: string[];
  environment: string;
  team: string;
  enabled: boolean;
};

function defaultForm(): FormState {
  return {
    name: "",
    method: "GET",
    url: "",
    request: { headers: [], query: [], bodyType: "raw", body: "", timeoutMs: 15_000 },
    assertions: [
      { type: "status_code", operator: "is", expected: 200 },
      { type: "response_time", operator: "less_than", expected: 2000 },
    ],
    locations: ["aws:us-east-1"],
    frequencySeconds: 300,
    tags: [],
    environment: "",
    team: "",
    enabled: true,
  };
}

function toForm(test: SyntheticTest): FormState {
  return {
    name: test.name,
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
    locations: test.locations ?? [],
    frequencySeconds: test.frequencySeconds,
    tags: test.tags ?? [],
    environment: test.environment ?? "",
    team: test.team ?? "",
    enabled: test.enabled,
  };
}

export function SyntheticTestEditor({ initial, mode }: EditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() =>
    initial ? toForm(initial) : defaultForm(),
  );
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    request: true,
    define: true,
    assertions: true,
    locations: true,
    retry: false,
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
      method: form.method,
      url: form.url,
      request: form.request,
      assertions: form.assertions,
      locations: form.locations,
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
      subtype: "http" as const,
      method: form.method,
      url: form.url.trim(),
      request: form.request,
      assertions: form.assertions,
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
          <span className="text-[14px] font-medium text-[#202124]">
            {mode === "create" ? "New API Test" : form.name || "Edit Test"}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="mx-auto w-full max-w-[920px] p-6">
            <Section
              n={1}
              title="Request Type"
              open={openSection.request}
              onToggle={() => toggle("request")}
            >
              <div className="flex flex-wrap gap-1">
                {(["HTTP", "gRPC", "SSL", "DNS", "WebSocket", "TCP", "UDP", "ICMP"] as const).map(
                  (label, i) => (
                    <button
                      key={label}
                      type="button"
                      disabled={i !== 0}
                      className={
                        "rounded-md border px-3 py-1.5 text-[13px] " +
                        (i === 0
                          ? "border-[#006CC2] bg-[#e6f1f9] text-[#006CC2]"
                          : "border-[#bdc1c6] bg-white text-[#bdc1c6] disabled:cursor-not-allowed")
                      }
                    >
                      {label}
                    </button>
                  ),
                )}
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
                      setForm((f) => ({ ...f, method: e.target.value as HttpMethod }))
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
                  onChange={(r) =>
                    setForm((f) => ({ ...f, request: r }))
                  }
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
                  onChange={(v) => setForm((f) => ({ ...f, environment: v }))}
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
                onChange={(a) => setForm((f) => ({ ...f, assertions: a }))}
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
                onChange={(locs) => setForm((f) => ({ ...f, locations: locs }))}
              />
              <div className="mt-4">
                <label className="text-[12px] font-medium text-[#202124]">
                  Frequency
                </label>
                <select
                  value={form.frequencySeconds}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      frequencySeconds: Number(e.target.value),
                    }))
                  }
                  className="mt-1 block w-[240px] rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none"
                >
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </Section>

            <Section
              n={5}
              title="Retry Conditions"
              open={openSection.retry}
              onToggle={() => toggle("retry")}
            >
              <div className="text-[12px] text-[#5f6368]">
                Retry once after 30s by default. Configurable retries are
                coming soon.
              </div>
            </Section>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#dadce0] bg-white py-3">
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
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {tab === "snippets" && <SnippetsPanel />}
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
    <section className="mb-4 rounded-md border border-[#dadce0] bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 border-b border-transparent px-4 py-3 text-left transition-colors hover:bg-[#f8f9fa]"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#632ca6] text-[11px] font-semibold text-[#632ca6]">
          {n}
        </span>
        {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
        <span className="text-[14px] font-medium">{title}</span>
      </button>
      {open && <div className="border-t border-[#dadce0] p-4">{children}</div>}
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
  onChange,
}: {
  request: SyntheticRequest;
  onChange: (r: SyntheticRequest) => void;
}) {
  const [open, setOpen] = useState(false);

  const setHeaders = (headers: SyntheticHeader[]) =>
    onChange({ ...request, headers });
  const setQuery = (query: SyntheticHeader[]) =>
    onChange({ ...request, query });

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
        <div className="mt-3 space-y-3 rounded-md border border-[#dadce0] bg-white p-3">
          <KVEditor
            label="Headers"
            rows={request.headers}
            onChange={setHeaders}
          />
          <KVEditor
            label="Query parameters"
            rows={request.query}
            onChange={setQuery}
          />
          <div>
            <label className="text-[12px] font-medium text-[#202124]">
              Body type
            </label>
            <select
              value={request.bodyType ?? "raw"}
              onChange={(e) =>
                onChange({ ...request, bodyType: e.target.value as "raw" | "json" })
              }
              className="ml-2 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
            >
              <option value="raw">raw</option>
              <option value="json">json</option>
            </select>
            <textarea
              value={request.body ?? ""}
              onChange={(e) => onChange({ ...request, body: e.target.value })}
              placeholder='{"key": "value"}'
              rows={4}
              className="mt-2 w-full resize-y rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 font-mono text-[12px] outline-none focus:border-[#1a73e8]"
            />
          </div>
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
                onChange({ ...request, timeoutMs: Number(e.target.value) })
              }
              className="ml-2 w-[120px] rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none"
            />
          </div>
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
              aria-label="Remove"
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
          <div className="text-[12px] text-[#9aa0a6]">No assertions yet.</div>
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
              aria-label="Remove"
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
  const toggle = (id: string) =>
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  return (
    <div className="grid grid-cols-2 gap-2">
      {LOCATIONS.map((loc) => {
        const on = selected.includes(loc.id);
        return (
          <button
            key={loc.id}
            type="button"
            onClick={() => toggle(loc.id)}
            className={
              "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-[13px] transition-colors " +
              (on
                ? "border-[#006CC2] bg-[#e6f1f9] text-[#006CC2]"
                : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]")
            }
          >
            <span
              className={
                "flex h-3.5 w-3.5 items-center justify-center rounded-sm border " +
                (on ? "border-[#006CC2] bg-[#006CC2]" : "border-[#bdc1c6]")
              }
            >
              {on && <span className="text-[9px] text-white">✓</span>}
            </span>
            {loc.label}
          </button>
        );
      })}
    </div>
  );
}

function SnippetsPanel() {
  return (
    <div className="px-3 py-3">
      <div className="rounded-md bg-gradient-to-br from-[#7a3edb] to-[#4f29c5] p-4 text-white">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[14px] font-semibold">✨ Snippets</div>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">
            NEW
          </span>
        </div>
        <p className="text-[12px]">
          Speed up test creation with Snippets that pre-fill sections of your
          test based on common configurations.
        </p>
      </div>

      <SnippetGroup
        label="Authentication"
        items={[
          {
            title: "Basic Authentication in HTTP Test",
            sub: "Test your API endpoints using Basic Auth",
          },
          {
            title: "Bearer Token Authentication",
            sub: "Test API endpoints requiring Bearer Token Authentication",
          },
        ]}
      />

      <SnippetGroup
        label="Performance"
        items={[
          {
            title: "High Uptime / Availability",
            sub: "Configure a test with the shortest frequency available e.g. 1m",
          },
          {
            title: "Latency / Response Time",
            sub: "Test for overall response time latency",
          },
        ]}
      />
    </div>
  );
}

function SnippetGroup({
  label,
  items,
}: {
  label: string;
  items: { title: string; sub: string }[];
}) {
  return (
    <div className="mt-4">
      <div className="mb-1 text-[12px] font-medium text-[#202124]">{label}</div>
      <div className="space-y-1">
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-md border border-[#dadce0] p-3 text-left hover:bg-[#f8f9fa]"
          >
            <div className="text-[12px] font-medium text-[#202124]">
              {it.title}
            </div>
            <div className="text-[11px] text-[#5f6368]">{it.sub}</div>
          </div>
        ))}
      </div>
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
        <TimingBar label="DNS" ms={r.timings.dnsMs} total={r.responseTimeMs ?? 1} />
        <TimingBar
          label="Connect"
          ms={r.timings.connectionMs}
          total={r.responseTimeMs ?? 1}
        />
        <TimingBar label="SSL" ms={r.timings.sslMs} total={r.responseTimeMs ?? 1} />
        <TimingBar label="TTFB" ms={r.timings.ttfbMs} total={r.responseTimeMs ?? 1} />
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
            <div key={i} className="flex items-center justify-between text-[12px]">
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
