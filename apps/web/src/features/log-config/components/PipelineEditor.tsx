"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Faders,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getPipeline, testPipeline, updatePipeline } from "../api";
import type { Processor, ProcessorType } from "../types";

const PROCESSOR_TYPES: { id: ProcessorType; label: string; description: string }[] = [
  {
    id: "grok-parser",
    label: "Grok parser",
    description: "Extract attributes from a message using grok patterns.",
  },
  {
    id: "date-remapper",
    label: "Date remapper",
    description: "Reinterpret an attribute as the log timestamp.",
  },
  {
    id: "status-remapper",
    label: "Status remapper",
    description: "Map an attribute to a Syslog severity level.",
  },
  {
    id: "service-remapper",
    label: "Service remapper",
    description: "Override the service field from an attribute.",
  },
  {
    id: "message-remapper",
    label: "Message remapper",
    description: "Use a different attribute as the log message.",
  },
  {
    id: "attribute-remapper",
    label: "Attribute remapper",
    description: "Move/copy an attribute, optionally cast type.",
  },
  {
    id: "url-parser",
    label: "URL parser",
    description: "Extract host/path/query from a URL attribute.",
  },
  {
    id: "category-processor",
    label: "Category processor",
    description: "Set an attribute based on rule cases.",
  },
  {
    id: "trace-id-remapper",
    label: "Trace ID remapper",
    description: "Use an attribute as the trace ID for correlation.",
  },
];

export function PipelineEditor({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: pipeline, isLoading } = useQuery({
    queryKey: ["log-pipelines", pipelineId],
    queryFn: () => getPipeline(pipelineId),
  });

  const [name, setName] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [sampleInput, setSampleInput] = useState(
    JSON.stringify(
      {
        message: "192.0.2.1 - - [10/Oct/2026:13:55:36] \"GET /home\" 200 1024",
        attributes: {},
      },
      null,
      2,
    ),
  );
  const [testOutput, setTestOutput] = useState<string>("");

  useEffect(() => {
    if (pipeline) {
      setName(pipeline.name);
      setFilterQuery(pipeline.filterQuery);
      setProcessors(pipeline.processors);
    }
  }, [pipeline]);

  const update = useMutation({
    mutationFn: () =>
      updatePipeline(pipelineId, {
        name,
        filter_query: filterQuery,
        processors,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["log-pipelines"] }),
  });

  const test = useMutation({
    mutationFn: () =>
      testPipeline(pipelineId, JSON.parse(sampleInput) as Record<string, unknown>),
    onSuccess: (res) => setTestOutput(JSON.stringify(res, null, 2)),
    onError: (e: Error) => setTestOutput(`Error: ${e.message}`),
  });

  const addProcessor = (type: ProcessorType) => {
    const defaults: Record<ProcessorType, Record<string, unknown>> = {
      "grok-parser": { source: "message", patterns: ["%{GREEDYDATA:msg}"] },
      "date-remapper": { source: "timestamp", format: "iso" },
      "status-remapper": { source: "level" },
      "service-remapper": { source: "service" },
      "message-remapper": { source: "message" },
      "attribute-remapper": { source: "from", target: "to" },
      "url-parser": { source: "http.url" },
      "category-processor": { target: "category", cases: [] },
      "trace-id-remapper": { source: "trace_id" },
    };
    setProcessors((prev) => [
      ...prev,
      { type, enabled: true, config: defaults[type] },
    ]);
    setShowPicker(false);
  };

  const moveProcessor = (idx: number, dir: -1 | 1) => {
    const next = [...processors];
    const t = idx + dir;
    if (t < 0 || t >= next.length) return;
    [next[idx], next[t]] = [next[t], next[idx]];
    setProcessors(next);
  };

  if (isLoading || !pipeline) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Faders}
        title={name || "Pipeline"}
        breadcrumbs={[
          { label: "Logs", href: "/logs" },
          { label: "Pipelines", href: "/logs/pipelines" },
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push("/logs/pipelines")}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <ArrowLeft size={12} />
              Back
            </button>
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate()}
              className="rounded-md bg-[#1a73e8] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 space-y-5">
              <Card title="Identity">
                <Field label="Name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px]"
                  />
                </Field>
                <Field label="Filter — applied before processors">
                  <input
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder='e.g. service:api status:error'
                    className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 font-mono text-[12.5px]"
                  />
                </Field>
              </Card>

              <Card title={`Processors (${processors.length})`}>
                <ul className="space-y-2">
                  {processors.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-md border border-[#dadce0] bg-[#f8f9fb] p-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveProcessor(i, -1)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-30"
                        >
                          <ArrowUp size={11} weight="bold" />
                        </button>
                        <button
                          type="button"
                          disabled={i === processors.length - 1}
                          onClick={() => moveProcessor(i, 1)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-30"
                        >
                          <ArrowDown size={11} weight="bold" />
                        </button>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[13px]">
                          {PROCESSOR_TYPES.find((t) => t.id === p.type)?.label ?? p.type}
                        </div>
                        <textarea
                          value={JSON.stringify(p.config, null, 2)}
                          onChange={(e) => {
                            try {
                              const cfg = JSON.parse(e.target.value);
                              setProcessors((prev) => {
                                const next = [...prev];
                                next[i] = { ...next[i], config: cfg };
                                return next;
                              });
                            } catch {
                              // accept invalid JSON visually but don't update
                            }
                          }}
                          rows={3}
                          className="mt-1 w-full rounded border border-[#dadce0] bg-white px-2 py-1 font-mono text-[11.5px]"
                        />
                      </div>
                      <label className="inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) =>
                            setProcessors((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], enabled: e.target.checked };
                              return next;
                            })
                          }
                          className="peer sr-only"
                        />
                        <span className="relative inline-block h-4 w-7 rounded-full bg-[#bdc1c6] transition-colors peer-checked:bg-[#1a73e8]">
                          <span className="absolute left-0.5 top-0.5 inline-block h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setProcessors((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-[#5f6368] hover:bg-[#fde7e7] hover:text-[#d32f2f]"
                      >
                        <Trash size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
                >
                  <Plus size={11} weight="bold" />
                  Add processor
                </button>
              </Card>
            </div>

            <div className="space-y-5">
              <Card title="Test pipeline">
                <Field label="Sample log (JSON)">
                  <textarea
                    value={sampleInput}
                    onChange={(e) => setSampleInput(e.target.value)}
                    rows={6}
                    className="w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 font-mono text-[11.5px]"
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => test.mutate()}
                  className="mt-1 rounded-md bg-[#1a73e8] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#6d28d9]"
                >
                  Run pipeline
                </button>
                {testOutput && (
                  <pre className="mt-3 max-h-[260px] overflow-auto rounded bg-[#f8f9fb] p-2 font-mono text-[11.5px]">
                    {testOutput}
                  </pre>
                )}
              </Card>
            </div>
          </div>
        </main>
      </div>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[640px] max-h-[80vh] overflow-y-auto rounded-lg border border-[#dadce0] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#dadce0] px-4 py-3">
              <h3 className="text-[15px] font-semibold text-[#202124]">
                Add processor
              </h3>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-[12px] text-[#5f6368] hover:text-[#202124]"
              >
                Cancel
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2 p-4">
              {PROCESSOR_TYPES.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => addProcessor(t.id)}
                    className="block w-full rounded-md border border-[#dadce0] bg-white p-3 text-left hover:border-[#1a73e8] hover:bg-[#e8f0fe]"
                  >
                    <div className="text-[13px] font-medium text-[#202124]">
                      {t.label}
                    </div>
                    <div className="mt-1 text-[11.5px] text-[#5f6368]">
                      {t.description}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#dadce0] bg-white p-4">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-2 block">
      <div className="mb-1 text-[12px] font-medium text-[#5f6368]">{label}</div>
      {children}
    </label>
  );
}
