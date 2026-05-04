"use client";

import { ArrowSquareOut, Bug, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { useApmIssues } from "../hooks";
import type { ApmIssue } from "../types";

export function ApmHomeIssues() {
  const { data: issues, isLoading } = useApmIssues(3600);
  const list = issues ?? [];
  const maxErrors = Math.max(1, ...list.map((i) => i.errorCount));

  return (
    <section className="rounded-lg border border-[#e8eaed] bg-white">
      <header className="flex items-center gap-3 border-b border-[#e8eaed] px-4 py-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-[#f1f3f4] px-2 py-1 text-[12.5px] text-[#202124]">
          <Bug size={12} className="text-[#5f6368]" />
          <span className="font-medium">Issues</span>
        </div>
        <span className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] font-semibold text-[#5f6368]">
          1h
        </span>
        <span className="text-[12.5px] text-[#5f6368]">Past 1 Hour</span>
        <Link
          href="/apm/traces"
          className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-[#1a73e8] hover:underline"
        >
          Open in Error Tracking
          <ArrowSquareOut size={11} weight="bold" />
        </Link>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-[#e8eaed] text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
              <th className="px-4 py-2 text-left">Issue Details</th>
              <th className="w-[200px] px-4 py-2 text-right">Error Count</th>
              <th className="w-[140px] px-4 py-2 text-right">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[#5f6368]">
                  Loading issues…
                </td>
              </tr>
            )}
            {!isLoading && list.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-[12.5px] text-[#5f6368]">
                    <MagnifyingGlass size={28} className="text-[#a142f4]" />
                    No issues in the last hour.
                  </div>
                </td>
              </tr>
            )}
            {!isLoading &&
              list.map((iss) => (
                <IssueRow key={iss.id} issue={iss} maxErrors={maxErrors} />
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IssueRow({
  issue,
  maxErrors,
}: {
  issue: ApmIssue;
  maxErrors: number;
}) {
  const pct = Math.min(100, Math.max(4, (issue.errorCount / maxErrors) * 100));
  return (
    <tr className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fb]">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-[#fce8e6] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#d93025]">
            Error
          </span>
          <span className="font-mono text-[12.5px] text-[#7c3aed]">
            {issue.resource}
          </span>
          {issue.httpStatus ? (
            <span className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#5f6368]">
              {issue.httpStatus}
            </span>
          ) : null}
          <span className="rounded-md bg-[#fef7e0] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#202124]">
            {issue.service}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2 text-[#202124]">
          <span className="font-semibold">{issue.errorCount}</span>
          <div className="h-1 w-[120px] rounded-full bg-[#f1f3f4]">
            <div
              className="h-full rounded-full bg-[#d93025]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right text-[12.5px] text-[#5f6368]">
        {issue.lastSeenMs ? formatRelative(issue.lastSeenMs) : "—"}
      </td>
    </tr>
  );
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
