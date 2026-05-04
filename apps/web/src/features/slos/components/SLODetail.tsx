"use client";

import {
  ArrowLeft,
  Bell,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useCreateBurnRateAlert,
  useDeleteBurnRateAlert,
  useDeleteSLO,
  useSLO,
  useSLOAlerts,
  useSLOBurnRate,
  useSLOHistory,
} from "../hooks";
import { statusBg, statusColor, statusLabel } from "../types";
import type {
  BurnRateAlert,
  BurnRateReading,
  SLO,
  SLOHistoryPoint,
} from "../types";

export function SLODetail({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: slo, isLoading } = useSLO(id);
  const { data: history } = useSLOHistory(id);
  const { data: burnReadings } = useSLOBurnRate(id);
  const { data: alerts = [] } = useSLOAlerts(id);
  const deleteSloMut = useDeleteSLO();
  const [alertsOpen, setAlertsOpen] = useState(params.get("alerts") === "create");

  if (isLoading || !slo) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
        Loading SLO…
      </div>
    );
  }

  const status = slo.evaluation?.status ?? "no_data";
  const sliPct = slo.evaluation?.sliPct;
  const budget = slo.evaluation?.errorBudgetRemainingPct;

  const onDelete = () => {
    if (!confirm(`Delete SLO "${slo.name}"?`)) return;
    deleteSloMut.mutate(slo.id, {
      onSuccess: () => router.push("/slo/manage"),
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-auto bg-white text-[#202124]">
      <header className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/slo/manage")}
            className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-medium">{slo.name}</h1>
              <span
                className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[12px] font-medium"
                style={{
                  backgroundColor: statusBg(status),
                  color: statusColor(status),
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: statusColor(status) }}
                />
                {statusLabel(status)}
              </span>
            </div>
            {slo.description ? (
              <p className="text-[12px] text-[#5f6368]">{slo.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAlertsOpen(true)}
            className="gap-1"
          >
            <Bell size={14} />
            Burn rate alerts
            {alerts.length > 0 ? (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#e6f1f9] px-1 text-[11px] text-[#006CC2]">
                {alerts.length}
              </span>
            ) : null}
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="gap-1 text-[#d93025]">
            <Trash size={14} /> Delete
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <KpiCard
          label="SLI (last window)"
          value={fmtPct(sliPct, 3)}
          accent={statusColor(status)}
        />
        <KpiCard
          label={`Target (${slo.timeWindowDays}d)`}
          value={fmtPct(slo.targetPct, 3)}
          accent="#006CC2"
        />
        <KpiCard
          label="Error budget remaining"
          value={fmtPct(budget, 1)}
          accent={statusColor(status)}
        />
      </div>

      <section className="px-6 pb-4">
        <h2 className="mb-2 text-[14px] font-medium">Error budget remaining</h2>
        <BudgetChart
          slo={slo}
          history={history?.points ?? []}
        />
      </section>

      <section className="px-6 pb-6">
        <BurnRatePanel
          alerts={alerts}
          readings={burnReadings?.alerts ?? []}
        />
      </section>

      {alertsOpen ? (
        <BurnRateAlertModal
          sloId={slo.id}
          onClose={() => setAlertsOpen(false)}
          existingAlerts={alerts}
          targetPct={slo.targetPct}
        />
      ) : null}
    </div>
  );
}

function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-[#dadce0] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {label}
      </p>
      <p className="mt-1 text-[28px] font-semibold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function BudgetChart({
  slo,
  history,
}: {
  slo: SLO;
  history: SLOHistoryPoint[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const height = 240;
  const padding = { top: 16, right: 24, bottom: 28, left: 44 };
  const innerW = Math.max(0, width - padding.left - padding.right);
  const innerH = height - padding.top - padding.bottom;

  const points = useMemo(
    () => history.filter((p) => p.errorBudgetRemainingPct != null),
    [history],
  );

  const fromMs = points[0]?.t ?? Date.now() - slo.timeWindowDays * 86400_000;
  const toMs = points[points.length - 1]?.t ?? Date.now();
  const span = Math.max(1, toMs - fromMs);

  const x = (ms: number) => ((ms - fromMs) / span) * innerW;
  const y = (pct: number) => innerH - (Math.min(100, Math.max(0, pct)) / 100) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t)} ${y(p.errorBudgetRemainingPct as number)}`)
    .join(" ");

  const fill = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t)} ${y(p.errorBudgetRemainingPct as number)}`)
    .concat(`L ${innerW} ${innerH}`)
    .concat(`L 0 ${innerH}`)
    .concat("Z")
    .join(" ");

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div ref={containerRef} className="rounded-md border border-[#dadce0] bg-white p-3">
      {points.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-[13px] text-[#9aa0a6]">
          No data in the last {slo.timeWindowDays} day window. Check that the
          metric you queried has points in this range.
        </div>
      ) : (
        <svg width={width} height={height} role="img" aria-label="Error budget remaining">
          <g transform={`translate(${padding.left},${padding.top})`}>
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={0}
                  x2={innerW}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="#f1f3f4"
                />
                <text
                  x={-8}
                  y={y(t) + 4}
                  textAnchor="end"
                  className="text-[10px] fill-[#9aa0a6]"
                >
                  {t}%
                </text>
              </g>
            ))}
            <line
              x1={0}
              x2={innerW}
              y1={y(0)}
              y2={y(0)}
              stroke="#dadce0"
              strokeWidth="1"
            />
            <path
              d={fill}
              fill={statusColor(slo.evaluation?.status ?? "no_data") + "22"}
            />
            <path
              d={path}
              fill="none"
              stroke={statusColor(slo.evaluation?.status ?? "no_data")}
              strokeWidth="1.5"
            />
            <text
              x={0}
              y={innerH + 18}
              className="text-[10px] fill-[#9aa0a6]"
            >
              {fmtTime(fromMs)}
            </text>
            <text
              x={innerW}
              y={innerH + 18}
              textAnchor="end"
              className="text-[10px] fill-[#9aa0a6]"
            >
              {fmtTime(toMs)}
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BurnRatePanel({
  alerts,
  readings,
}: {
  alerts: BurnRateAlert[];
  readings: BurnRateReading[];
}) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[#dadce0] bg-[#fafbfc] p-6 text-center">
        <p className="text-[13px] text-[#5f6368]">
          No burn rate alerts configured. Burn rate alerts page when the SLO is
          consuming the error budget faster than expected.
        </p>
      </div>
    );
  }

  const grouped = new Map<string, BurnRateReading[]>();
  for (const r of readings) {
    const list = grouped.get(r.alertId) ?? [];
    list.push(r);
    grouped.set(r.alertId, list);
  }

  return (
    <div className="rounded-md border border-[#dadce0] bg-white">
      <div className="border-b border-[#dadce0] px-4 py-2 text-[13px] font-medium">
        Burn rate alerts
      </div>
      <table className="w-full text-[13px]">
        <thead className="border-b border-[#dadce0] text-[11px] uppercase tracking-wide text-[#5f6368]">
          <tr>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-2 py-2 text-left">Severity</th>
            <th className="px-2 py-2 text-left">Short window</th>
            <th className="px-2 py-2 text-left">Long window</th>
            <th className="px-2 py-2 text-left">Threshold</th>
            <th className="px-2 py-2 text-left">Realised burn</th>
            <th className="px-2 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => {
            const r = grouped.get(a.id) ?? [];
            const shortR = r.find((x) => x.window === "short");
            const longR = r.find((x) => x.window === "long");
            const firing = (shortR?.firing ?? false) || (longR?.firing ?? false);
            return (
              <tr key={a.id} className="border-b border-[#f1f3f4]">
                <td className="px-4 py-2.5 font-medium">{a.name}</td>
                <td className="px-2 py-2.5">
                  <span
                    className="inline-flex items-center rounded px-2 py-0.5 text-[12px]"
                    style={{
                      backgroundColor:
                        a.severity === "alert" ? "#fce8e6" : "#fef7e0",
                      color: a.severity === "alert" ? "#d93025" : "#f9ab00",
                    }}
                  >
                    {a.severity === "alert" ? "Alert" : "Warn"}
                  </span>
                </td>
                <td className="px-2 py-2.5">{a.shortWindowMin}m</td>
                <td className="px-2 py-2.5">{a.longWindowMin}m</td>
                <td className="px-2 py-2.5">×{a.burnThreshold}</td>
                <td className="px-2 py-2.5">
                  <div className="flex flex-col leading-tight">
                    <span>
                      short:{" "}
                      {shortR?.burnRate != null
                        ? `×${shortR.burnRate.toFixed(2)}`
                        : "—"}
                    </span>
                    <span className="text-[11px] text-[#5f6368]">
                      long:{" "}
                      {longR?.burnRate != null
                        ? `×${longR.burnRate.toFixed(2)}`
                        : "—"}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[12px]"
                    style={{
                      backgroundColor: firing ? "#fce8e6" : "#e6f4ea",
                      color: firing ? "#d93025" : "#137333",
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: firing ? "#d93025" : "#137333",
                      }}
                    />
                    {firing ? "Firing" : "OK"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BurnRateAlertModal({
  sloId,
  onClose,
  existingAlerts,
  targetPct,
}: {
  sloId: string;
  onClose: () => void;
  existingAlerts: BurnRateAlert[];
  targetPct: number;
}) {
  const createMut = useCreateBurnRateAlert(sloId);
  const deleteMut = useDeleteBurnRateAlert(sloId);
  const [name, setName] = useState("Fast burn (1h)");
  const [shortMin, setShortMin] = useState(5);
  const [longMin, setLongMin] = useState(60);
  const [threshold, setThreshold] = useState(14.4);
  const [severity, setSeverity] = useState<"warn" | "alert">("alert");

  const errorBudgetPct = (100 - targetPct) / 100;
  const monthlySloHours = errorBudgetPct * 30 * 24;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="w-[640px] max-w-[92vw] rounded-md bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-[#dadce0] px-5 py-3">
          <h3 className="text-[14px] font-medium">Burn rate alerts</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            ×
          </button>
        </header>

        <div className="px-5 py-4">
          <p className="mb-4 text-[12px] text-[#5f6368]">
            Burn rate is the multiple of the allowed error budget being consumed
            right now. With a {targetPct}% target, your allowed budget is roughly{" "}
            <strong>{monthlySloHours.toFixed(1)}</strong> hours per 30 days.
          </p>

          {existingAlerts.length > 0 ? (
            <div className="mb-4 rounded-md border border-[#dadce0]">
              <div className="border-b border-[#dadce0] px-3 py-2 text-[12px] font-medium text-[#5f6368]">
                Configured alerts
              </div>
              {existingAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between border-b border-[#f1f3f4] px-3 py-2 text-[12px] last:border-b-0"
                >
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-[11px] text-[#5f6368]">
                      {a.shortWindowMin}m / {a.longWindowMin}m · ×{a.burnThreshold} ·{" "}
                      {a.severity}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate(a.id)}
                    className="rounded p-1 text-[#9aa0a6] hover:bg-[#fce8e6] hover:text-[#d93025]"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-md border border-[#dadce0] bg-[#fafbfc] p-3">
            <div className="mb-2 text-[12px] font-medium text-[#5f6368]">
              New alert
            </div>
            <div className="space-y-2 text-[13px]">
              <FieldRow label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none"
                />
              </FieldRow>
              <FieldRow label="Severity">
                <select
                  value={severity}
                  onChange={(e) =>
                    setSeverity(e.target.value as "warn" | "alert")
                  }
                  className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none"
                >
                  <option value="warn">Warn</option>
                  <option value="alert">Alert</option>
                </select>
              </FieldRow>
              <FieldRow label="Short window">
                <input
                  type="number"
                  min={1}
                  value={shortMin}
                  onChange={(e) => setShortMin(Number(e.target.value))}
                  className="w-24 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none"
                />
                <span>min</span>
              </FieldRow>
              <FieldRow label="Long window">
                <input
                  type="number"
                  min={1}
                  value={longMin}
                  onChange={(e) => setLongMin(Number(e.target.value))}
                  className="w-24 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none"
                />
                <span>min</span>
              </FieldRow>
              <FieldRow label="Burn threshold">
                <input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-24 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 outline-none"
                />
                <span className="text-[12px] text-[#5f6368]">
                  multiple of allowed budget burn
                </span>
              </FieldRow>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#dadce0] px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!name.trim() || createMut.isPending}
            onClick={() =>
              createMut.mutate(
                {
                  name: name.trim(),
                  short_window_min: shortMin,
                  long_window_min: longMin,
                  burn_threshold: threshold,
                  severity,
                  enabled: true,
                },
                { onSuccess: () => setName("") },
              )
            }
            className="gap-1"
          >
            <Plus size={14} /> Add alert
          </Button>
        </footer>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 text-[#5f6368]">{label}</label>
      <div className="flex flex-1 items-center gap-2">{children}</div>
    </div>
  );
}
