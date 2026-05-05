"use client";

import { X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDeclareFromMonitor, useDeclareIncident } from "../hooks";
import type { IncidentSeverity } from "../types";

const SERVICES = [
  "web",
  "api",
  "auth",
  "payments",
  "worker",
  "caddy",
  "postgres",
  "redis",
];

const SEVERITIES: IncidentSeverity[] = [
  "SEV-1",
  "SEV-2",
  "SEV-3",
  "SEV-4",
  "SEV-5",
];

const SEV_DESC: Record<IncidentSeverity, string> = {
  "SEV-1": "Critical — major customer-facing outage",
  "SEV-2": "High — significant degradation",
  "SEV-3": "Medium — partial impact, mitigated",
  "SEV-4": "Low — minor issue, low impact",
  "SEV-5": "Info — observational",
};

const SEV_COLOR: Record<IncidentSeverity, string> = {
  "SEV-1": "#d32f2f",
  "SEV-2": "#ff9800",
  "SEV-3": "#fdd835",
  "SEV-4": "#1e88e5",
  "SEV-5": "#9e9e9e",
};

type Props = {
  onClose: () => void;
  prefill?: {
    title?: string;
    affectedServices?: string[];
    monitorId?: string;
    severity?: IncidentSeverity;
  };
};

export function DeclareIncidentModal({ onClose, prefill }: Props) {
  const router = useRouter();
  const declare = useDeclareIncident();
  const declareFromMonitor = useDeclareFromMonitor();

  const [title, setTitle] = useState(prefill?.title ?? "");
  const [severity, setSeverity] = useState<IncidentSeverity>(
    prefill?.severity ?? "SEV-3",
  );
  const [services, setServices] = useState<Set<string>>(
    new Set(prefill?.affectedServices ?? []),
  );
  const [customerImpact, setCustomerImpact] = useState("");
  const [hasCustomerImpact, setHasCustomerImpact] = useState(false);
  const [notify, setNotify] = useState("");

  const onSubmit = async () => {
    const payload = {
      title,
      severity,
      affected_services: Array.from(services),
      customer_impact: hasCustomerImpact ? customerImpact : null,
    };
    let inc;
    if (prefill?.monitorId) {
      inc = await declareFromMonitor.mutateAsync({
        monitorId: prefill.monitorId,
        overrides: payload,
      });
    } else {
      inc = await declare.mutateAsync(payload);
    }
    onClose();
    router.push(`/incidents/${inc.id}`);
  };

  const submitting = declare.isPending || declareFromMonitor.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-[640px] overflow-hidden rounded-lg border border-[#dadce0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#dadce0] px-5 py-3">
          <h2 className="text-[16px] font-semibold text-[#202124]">
            Declare incident
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="block text-[12px] font-medium text-[#5f6368]">
              Title <span className="text-[#d32f2f]">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, descriptive title for the incident"
              className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#5f6368]">
              Severity <span className="text-[#d32f2f]">*</span>
            </label>
            <div className="mt-1 grid grid-cols-5 gap-1.5">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={`rounded-md border px-2 py-2 text-[12px] font-medium transition-colors ${
                    severity === s
                      ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
                      : "border-[#dadce0] bg-white text-[#202124] hover:border-[#a8b3be]"
                  }`}
                >
                  <div
                    className="mx-auto mb-1 h-1.5 w-6 rounded"
                    style={{ background: SEV_COLOR[s] }}
                  />
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-[#5f6368]">
              {SEV_DESC[severity]}
            </p>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#5f6368]">
              Affected services
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {SERVICES.map((s) => {
                const on = services.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setServices((prev) => {
                        const next = new Set(prev);
                        if (next.has(s)) next.delete(s);
                        else next.add(s);
                        return next;
                      })
                    }
                    className={`rounded-md border px-2 py-1 font-mono text-[12px] ${
                      on
                        ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
                        : "border-[#dadce0] bg-white text-[#202124] hover:border-[#a8b3be]"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#202124]">
              <input
                type="checkbox"
                checked={hasCustomerImpact}
                onChange={(e) => setHasCustomerImpact(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#1a73e8]"
              />
              Has customer impact
            </label>
            {hasCustomerImpact && (
              <textarea
                value={customerImpact}
                onChange={(e) => setCustomerImpact(e.target.value)}
                placeholder="Describe the user-facing impact"
                rows={2}
                className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px]"
              />
            )}
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#5f6368]">
              Notify
            </label>
            <input
              value={notify}
              onChange={(e) => setNotify(e.target.value)}
              placeholder="@platform-oncall, @sre-team"
              className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px]"
            />
            <p className="mt-1 text-[11px] text-[#5f6368]">
              Comma-separated list. Demo: notifications are not actually sent.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#dadce0] bg-[#f8f9fb] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !title.trim()}
            onClick={onSubmit}
            className="rounded-md bg-[#1a73e8] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#6d28d9] disabled:opacity-60"
          >
            {submitting ? "Declaring…" : "Declare incident"}
          </button>
        </div>
      </div>
    </div>
  );
}
