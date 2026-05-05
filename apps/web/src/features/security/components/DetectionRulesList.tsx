"use client";

import { MagnifyingGlass, Plus, Shield } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { useDetectionRules, useUpdateRule } from "../hooks";
import type { DetectionRule } from "../types";

const TYPE_LABEL: Record<string, string> = {
  log_signature: "Log signature",
  threshold: "Threshold",
  new_term: "New term",
  anomaly: "Anomaly",
};

export function DetectionRulesList() {
  const router = useRouter();
  const { data: rules, isLoading } = useDetectionRules();
  const update = useUpdateRule();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!rules) return [];
    if (!search.trim()) return rules;
    const q = search.toLowerCase();
    return rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [rules, search]);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Shield}
        title="Detection rules"
        breadcrumbs={[{ label: "Security", href: "/security" }]}
        subtitle="Rules that scan logs, spans, and audit events to produce signals"
        actions={
          <>
            <a
              href="/security/signals"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              View signals
            </a>
            <button
              type="button"
              onClick={() => router.push("/security/rules/new")}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#6d28d9]"
            >
              <Plus size={13} weight="bold" />
              New rule
            </button>
          </>
        }
      />

      <div className="flex items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2">
        <div className="flex h-8 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2">
          <MagnifyingGlass size={13} className="text-[#5f6368]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules"
            className="w-[280px] bg-transparent text-[12.5px] outline-none placeholder:text-[#5f6368]"
          />
        </div>
        <span className="ml-auto text-[12px] text-[#5f6368]">
          {filtered.length} of {rules?.length ?? 0} rules
        </span>
      </div>

      <main className="flex-1 overflow-y-auto">
        <table className="min-w-full text-[13px]">
          <thead className="sticky top-0 z-10 bg-[#f1f3f4] text-[11px] uppercase tracking-wide text-[#5f6368]">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Severity</th>
              <th className="px-4 py-2 text-left font-medium">Source</th>
              <th className="px-4 py-2 text-left font-medium">Tags</th>
              <th className="px-4 py-2 text-left font-medium">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#5f6368]">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[#5f6368]">
                  <Shield size={32} className="mx-auto mb-2 opacity-40" />
                  No rules match your search.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <Row
                key={r.id}
                rule={r}
                onClick={() => router.push(`/security/rules/${r.id}`)}
                onToggle={(enabled) =>
                  update.mutate({ id: r.id, payload: { enabled } })
                }
              />
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}

function Row({
  rule,
  onClick,
  onToggle,
}: {
  rule: DetectionRule;
  onClick: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <tr className="border-b border-[#f1f3f4] hover:bg-[#f8f9fa]">
      <td className="cursor-pointer px-4 py-2.5" onClick={onClick}>
        <div className="font-medium text-[#202124]">{rule.name}</div>
        {rule.description && (
          <div className="mt-0.5 line-clamp-1 text-[12px] text-[#5f6368]">
            {rule.description}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 text-[#5f6368]">
        {TYPE_LABEL[rule.ruleType]}
      </td>
      <td className="px-4 py-2.5">
        <SeverityBadge severity={rule.severityDefault} />
      </td>
      <td className="px-4 py-2.5">
        <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 font-mono text-[12px] text-[#202124]">
          {rule.source}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {rule.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#5f6368]"
            >
              {t}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-2.5">
        <label
          className="inline-flex cursor-pointer items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative inline-block h-4 w-7 rounded-full bg-[#bdc1c6] transition-colors peer-checked:bg-[#1a73e8]">
            <span className="absolute left-0.5 top-0.5 inline-block h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
          </span>
        </label>
      </td>
    </tr>
  );
}
