"use client";

import { ArrowLeft, Shield } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StatusKind } from "@/lib/severity";
import { useDetectionRule, usePatchSignal, useSecuritySignal } from "../hooks";
import type { ArchiveReason } from "../types";

const ARCHIVE_REASONS: { id: ArchiveReason; label: string; tone: string }[] = [
  { id: "tp_malicious", label: "True Positive — Malicious", tone: "#d32f2f" },
  { id: "tp_benign", label: "True Positive — Benign", tone: "#1e88e5" },
  { id: "fp_other", label: "False Positive", tone: "#5f6368" },
];

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SignalDetail({ signalId }: { signalId: string }) {
  const router = useRouter();
  const { data: signal, isLoading } = useSecuritySignal(signalId);
  const { data: rule } = useDetectionRule(signal?.ruleId);
  const patch = usePatchSignal();
  const [showArchiveMenu, setShowArchiveMenu] = useState(false);

  if (isLoading || !signal) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
        Loading signal…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Shield}
        title={signal.title}
        breadcrumbs={[
          { label: "Security", href: "/security" },
          { label: "Signals", href: "/security/signals" },
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push("/security/signals")}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <ArrowLeft size={12} />
              Back
            </button>
            {signal.status !== "under_review" && (
              <button
                type="button"
                onClick={() =>
                  patch.mutate({ id: signal.id, status: "under_review" })
                }
                className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
              >
                Under review
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowArchiveMenu((v) => !v)}
                className="rounded-md bg-[#1a73e8] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#6d28d9]"
              >
                Archive ▾
              </button>
              {showArchiveMenu && (
                <div className="absolute right-0 z-10 mt-1 w-[260px] rounded-md border border-[#dadce0] bg-white py-1 shadow-lg">
                  {ARCHIVE_REASONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        patch.mutate({
                          id: signal.id,
                          status: "archived",
                          archive_reason: r.id,
                        });
                        setShowArchiveMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: r.tone }}
                      />
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        }
      />

      <div className="flex items-center gap-3 border-b border-[#dadce0] bg-white px-6 py-3">
        <SeverityBadge severity={signal.severity} size="md" />
        <StatusPill status={signal.status as StatusKind} size="md" />
        {signal.archiveReason && (
          <span className="rounded bg-[#f1f3f4] px-2 py-1 text-[11px] text-[#5f6368]">
            {ARCHIVE_REASONS.find((r) => r.id === signal.archiveReason)?.label}
          </span>
        )}
        <span className="text-[12px] text-[#5f6368]">
          Detected {fmtTime(signal.createdMs)}
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 space-y-5">
              <Card title="Detection rule">
                {rule ? (
                  <a
                    href={`/security/rules/${rule.id}`}
                    className="block text-[13.5px] text-[#1a73e8] hover:underline"
                  >
                    {rule.name}
                  </a>
                ) : (
                  <span className="italic text-[#9aa0a6]">Loading rule…</span>
                )}
                {rule?.description && (
                  <p className="mt-2 text-[12.5px] text-[#5f6368]">
                    {rule.description}
                  </p>
                )}
              </Card>

              <Card title="Evidence">
                <pre className="overflow-x-auto rounded-md bg-[#f8f9fb] p-3 font-mono text-[12px] text-[#202124]">
{JSON.stringify(signal.evidence, null, 2)}
                </pre>
              </Card>

              {signal.mitreTactics.length > 0 && (
                <Card title="MITRE ATT&CK tactics">
                  <ul className="space-y-1.5 text-[13px]">
                    {signal.mitreTactics.map((t) => (
                      <li
                        key={t}
                        className="rounded bg-[#e8f0fe] px-2 py-1 font-mono text-[12px] text-[#1a73e8]"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            <div className="space-y-5">
              <Card title="Affected">
                <dl className="space-y-2 text-[12.5px]">
                  <Row label="Service" value={signal.affectedService} link={signal.affectedService ? `/apm/services/${signal.affectedService}` : undefined} />
                  <Row label="Host" value={signal.affectedHost} />
                  <Row label="User" value={signal.affectedUser} />
                </dl>
              </Card>
              <Card title="Pivot">
                <ul className="space-y-1.5 text-[13px]">
                  {signal.affectedService && (
                    <li>
                      <a
                        href={`/logs?service=${signal.affectedService}`}
                        className="text-[#1a73e8] hover:underline"
                      >
                        View related logs →
                      </a>
                    </li>
                  )}
                  {signal.affectedService && (
                    <li>
                      <a
                        href={`/apm/services/${signal.affectedService}`}
                        className="text-[#1a73e8] hover:underline"
                      >
                        View service →
                      </a>
                    </li>
                  )}
                  <li>
                    <a
                      href="/incidents"
                      className="text-[#1a73e8] hover:underline"
                    >
                      Declare incident →
                    </a>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#dadce0] bg-white p-4">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  link,
}: {
  label: string;
  value: string | null | undefined;
  link?: string;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-[#5f6368]">{label}</dt>
      <dd className="font-medium text-[#202124]">
        {value ? (
          link ? (
            <a href={link} className="text-[#1a73e8] hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-[#9aa0a6]">—</span>
        )}
      </dd>
    </div>
  );
}
