"use client";

import { Shield, Question } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getLibraryPatterns,
  listScrubberRules,
  patchScrubberRule,
} from "../api";
import type { ScrubberRule } from "../types";

const STRATEGY_LABEL: Record<string, string> = {
  redact: "[REDACTED]",
  hash: "<hash:abc123>",
  partial_redact: "ab****cd",
};

export function ScrubberRulesPage() {
  const qc = useQueryClient();
  const { data: rules, isLoading } = useQuery({
    queryKey: ["scrubber-rules"],
    queryFn: listScrubberRules,
  });
  const { data: library } = useQuery({
    queryKey: ["scrubber-library"],
    queryFn: getLibraryPatterns,
  });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      patchScrubberRule(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scrubber-rules"] }),
  });
  const updateStrategy = useMutation({
    mutationFn: ({
      id,
      strategy,
    }: {
      id: string;
      strategy: "redact" | "hash" | "partial_redact";
    }) => patchScrubberRule(id, { replacement_strategy: strategy }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scrubber-rules"] }),
  });

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Shield}
        title="Sensitive Data Scanner"
        breadcrumbs={[{ label: "Security", href: "/security" }]}
        subtitle="Scrub sensitive patterns from log messages and attributes"
        actions={
          <>
            <a
              href="/security/data-security/findings"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              View findings
            </a>
            <button
              type="button"
              aria-label="Help"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              <Question size={14} weight="bold" />
            </button>
          </>
        }
      />

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading && <div className="text-[13px] text-[#5f6368]">Loading…</div>}
        {rules && (
          <section className="rounded-lg border border-[#dadce0] bg-white">
            <table className="min-w-full text-[13px]">
              <thead className="border-b border-[#dadce0] bg-[#f8f9fb] text-[10.5px] uppercase tracking-wide text-[#5f6368]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Pattern</th>
                  <th className="px-4 py-2 text-left font-medium">Replacement</th>
                  <th className="px-4 py-2 text-left font-medium">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <Row
                    key={r.id}
                    rule={r}
                    libraryLabel={
                      library?.patterns.find((p) => p.id === r.libraryPatternId)
                        ?.label ?? r.libraryPatternId ?? "custom regex"
                    }
                    onToggle={(enabled) => toggle.mutate({ id: r.id, enabled })}
                    onChangeStrategy={(strategy) =>
                      updateStrategy.mutate({ id: r.id, strategy })
                    }
                  />
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}

function Row({
  rule,
  libraryLabel,
  onToggle,
  onChangeStrategy,
}: {
  rule: ScrubberRule;
  libraryLabel: string;
  onToggle: (enabled: boolean) => void;
  onChangeStrategy: (s: "redact" | "hash" | "partial_redact") => void;
}) {
  return (
    <tr className="border-b border-[#f1f3f4] last:border-b-0">
      <td className="px-4 py-2.5">
        <div className="font-medium text-[#202124]">{rule.name}</div>
        {rule.description && (
          <div className="mt-0.5 text-[11.5px] text-[#5f6368]">
            {rule.description}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 font-mono text-[11.5px] text-[#1a73e8]">
          {libraryLabel}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <select
          value={rule.replacementStrategy}
          onChange={(e) =>
            onChangeStrategy(
              e.target.value as "redact" | "hash" | "partial_redact",
            )
          }
          className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px]"
        >
          <option value="redact">Redact — {STRATEGY_LABEL.redact}</option>
          <option value="partial_redact">
            Partial — {STRATEGY_LABEL.partial_redact}
          </option>
          <option value="hash">Hash — {STRATEGY_LABEL.hash}</option>
        </select>
      </td>
      <td className="px-4 py-2.5">
        <label className="inline-flex cursor-pointer items-center">
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
