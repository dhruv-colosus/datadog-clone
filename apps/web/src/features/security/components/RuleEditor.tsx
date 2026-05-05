"use client";

import { ArrowLeft, Plus, Shield, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import {
  useCreateRule,
  useDeleteRule,
  useDetectionRule,
  usePreviewRule,
  useUpdateRule,
} from "../hooks";
import type {
  RuleCase,
  RuleSource,
  RuleType,
  SecuritySeverity,
} from "../types";

type Tab = "details" | "version" | "permissions";

const TYPES: { id: RuleType; label: string }[] = [
  { id: "log_signature", label: "Log signature" },
  { id: "threshold", label: "Threshold" },
  { id: "new_term", label: "New term" },
  { id: "anomaly", label: "Anomaly" },
];

const SOURCES: { id: RuleSource; label: string }[] = [
  { id: "logs", label: "Logs" },
  { id: "spans", label: "Spans" },
  { id: "audit", label: "Audit" },
];

const SEVS: SecuritySeverity[] = ["critical", "high", "medium", "low", "info"];

type Props = {
  ruleId?: string;
  isNew?: boolean;
};

export function RuleEditor({ ruleId, isNew = false }: Props) {
  const router = useRouter();
  const { data: existing, isLoading } = useDetectionRule(isNew ? undefined : ruleId);
  const createMut = useCreateRule();
  const updateMut = useUpdateRule();
  const deleteMut = useDeleteRule();
  const preview = usePreviewRule(isNew ? undefined : ruleId);

  const [tab, setTab] = useState<Tab>("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ruleType, setRuleType] = useState<RuleType>("log_signature");
  const [source, setSource] = useState<RuleSource>("logs");
  const [query, setQuery] = useState("");
  const [cases, setCases] = useState<RuleCase[]>([]);
  const [severityDefault, setSeverityDefault] = useState<SecuritySeverity>("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [tagsText, setTagsText] = useState("");
  const [mitre, setMitre] = useState<string[]>([]);
  const [mitreText, setMitreText] = useState("");

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setRuleType(existing.ruleType);
      setSource(existing.source);
      setQuery(existing.query);
      setCases(existing.cases);
      setSeverityDefault(existing.severityDefault);
      setTags(existing.tags);
      setTagsText(existing.tags.join(", "));
      setMitre(existing.mitreTactics);
      setMitreText(existing.mitreTactics.join(", "));
    }
  }, [existing]);

  const onSave = async () => {
    const payload = {
      name,
      description: description || null,
      rule_type: ruleType,
      source,
      query,
      cases,
      severity_default: severityDefault,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      mitre_tactics: mitreText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    if (isNew) {
      const created = await createMut.mutateAsync(payload);
      router.push(`/security/rules/${created.id}`);
    } else if (ruleId) {
      await updateMut.mutateAsync({ id: ruleId, payload });
    }
  };

  const onDelete = async () => {
    if (!ruleId) return;
    if (!confirm("Delete this detection rule? This cannot be undone.")) return;
    await deleteMut.mutateAsync(ruleId);
    router.push("/security/rules");
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
        Loading rule…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Shield}
        title={isNew ? "New detection rule" : name || "Detection rule"}
        breadcrumbs={[
          { label: "Security", href: "/security" },
          { label: "Rules", href: "/security/rules" },
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push("/security/rules")}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <ArrowLeft size={12} />
              Back
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md border border-[#d32f2f] bg-white px-3 py-1.5 text-[12.5px] text-[#d32f2f] hover:bg-[#fde7e7]"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              disabled={createMut.isPending || updateMut.isPending || !name.trim()}
              onClick={onSave}
              className="rounded-md bg-[#1a73e8] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {createMut.isPending || updateMut.isPending
                ? "Saving…"
                : "Save rule"}
            </button>
          </>
        }
      />

      <div className="border-b border-[#dadce0] bg-white px-6">
        <div className="flex gap-1">
          {(["details", "version", "permissions"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative px-3 py-2 text-[13px] transition-colors ${
                tab === t ? "font-medium text-[#1a73e8]" : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              {t === "details"
                ? "Rule Details"
                : t === "version"
                  ? "Version History"
                  : "Permissions"}
              {tab === t && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1a73e8]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {tab === "details" && (
            <div className="grid grid-cols-3 gap-5">
              <div className="col-span-2 space-y-5">
                <Card title="Identity">
                  <div className="space-y-3">
                    <Field label="Name *">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px]"
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px]"
                      />
                    </Field>
                  </div>
                </Card>

                <Card title="Detection logic">
                  <div className="space-y-3">
                    <Field label="Rule type">
                      <div className="flex gap-2">
                        {TYPES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setRuleType(t.id)}
                            className={`rounded-md border px-3 py-1.5 text-[12.5px] ${
                              ruleType === t.id
                                ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
                                : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Source">
                      <select
                        value={source}
                        onChange={(e) => setSource(e.target.value as RuleSource)}
                        className="w-full max-w-[240px] rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                      >
                        {SOURCES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Query">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder='e.g. service:auth status:error "failed login"'
                        className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 font-mono text-[12.5px]"
                      />
                    </Field>
                  </div>
                </Card>

                <Card title="Cases">
                  <ul className="space-y-2">
                    {cases.map((c, i) => (
                      <li
                        key={i}
                        className="flex gap-2 rounded-md border border-[#dadce0] bg-[#f8f9fb] p-2"
                      >
                        <input
                          value={c.name}
                          onChange={(e) =>
                            setCases((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], name: e.target.value };
                              return next;
                            })
                          }
                          placeholder="Case name"
                          className="w-[140px] rounded border border-[#bdc1c6] bg-white px-2 py-1 text-[12.5px]"
                        />
                        <input
                          value={c.condition}
                          onChange={(e) =>
                            setCases((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], condition: e.target.value };
                              return next;
                            })
                          }
                          placeholder="count > 10 in 1m"
                          className="flex-1 rounded border border-[#bdc1c6] bg-white px-2 py-1 font-mono text-[12.5px]"
                        />
                        <select
                          value={c.severity}
                          onChange={(e) =>
                            setCases((prev) => {
                              const next = [...prev];
                              next[i] = {
                                ...next[i],
                                severity: e.target.value as SecuritySeverity,
                              };
                              return next;
                            })
                          }
                          className="w-[110px] rounded border border-[#bdc1c6] bg-white px-2 py-1 text-[12.5px]"
                        >
                          {SEVS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setCases((prev) => prev.filter((_, j) => j !== i))
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() =>
                      setCases((prev) => [
                        ...prev,
                        {
                          name: `Case ${prev.length + 1}`,
                          condition: "count > 0",
                          severity: severityDefault,
                        },
                      ])
                    }
                    className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
                  >
                    <Plus size={11} weight="bold" />
                    Add case
                  </button>
                </Card>
              </div>

              <div className="space-y-5">
                <Card title="Defaults">
                  <Field label="Default severity">
                    <select
                      value={severityDefault}
                      onChange={(e) =>
                        setSeverityDefault(e.target.value as SecuritySeverity)
                      }
                      className="w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                    >
                      {SEVS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2">
                      <SeverityBadge severity={severityDefault} />
                    </div>
                  </Field>
                </Card>
                <Card title="Tags">
                  <input
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="comma, separated, tags"
                    className="w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-[13px]"
                  />
                </Card>
                <Card title="MITRE ATT&CK">
                  <input
                    value={mitreText}
                    onChange={(e) => setMitreText(e.target.value)}
                    placeholder="TA0006:Credential Access"
                    className="w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 font-mono text-[12px]"
                  />
                </Card>
                <Card title="Live preview">
                  {preview.data ? (
                    <>
                      <div className="text-[12.5px]">
                        <strong>{preview.data.matchCount}</strong> matches in last hour
                      </div>
                      <ul className="mt-2 max-h-[260px] space-y-1 overflow-y-auto text-[11.5px]">
                        {preview.data.matches.slice(0, 8).map((m, i) => (
                          <li
                            key={i}
                            className="rounded bg-[#f8f9fb] px-2 py-1 font-mono text-[#5f6368]"
                          >
                            {String(m.message ?? m.operation ?? JSON.stringify(m)).slice(0, 80)}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <span className="text-[12px] italic text-[#9aa0a6]">
                      Save the rule to see preview matches.
                    </span>
                  )}
                </Card>
              </div>
            </div>
          )}
          {tab === "version" && (
            <Card title="Version history">
              <p className="text-[12.5px] text-[#5f6368]">
                Version diffs (red = removed, green = added) will appear here once
                the rule has been edited multiple times. This demo doesn't track
                history yet.
              </p>
            </Card>
          )}
          {tab === "permissions" && (
            <Card title="Permissions">
              <p className="text-[12.5px] text-[#5f6368]">
                Per-team rule permissions and approval workflows configure here.
                The demo allows any signed-in user to edit rules.
              </p>
            </Card>
          )}
        </main>
      </div>
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
    <label className="block">
      <div className="mb-1 text-[12px] font-medium text-[#5f6368]">{label}</div>
      {children}
    </label>
  );
}
