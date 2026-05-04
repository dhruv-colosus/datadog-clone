"use client";

import {
  CaretDown,
  CaretRight,
  ListBullets,
  MagnifyingGlass,
  Plus,
  SidebarSimple,
  Star,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDeleteSLO, useSLOs } from "../hooks";
import { statusBg, statusColor, statusLabel } from "../types";
import type { SLO, SLOStatus, SLOType } from "../types";

const TYPE_LABEL: Record<SLOType, string> = {
  metric: "Metric",
  monitor: "Monitor",
  time_slice: "Time Slice",
};

type StatusKey = "breached" | "warn" | "ok" | "no_data";

const STATUS_KEYS: StatusKey[] = ["breached", "warn", "ok", "no_data"];

const STATUS_CARD_LABEL: Record<StatusKey, string> = {
  breached: "BREACHED",
  warn: "WARN",
  ok: "OK",
  no_data: "NO DATA",
};

function fmtPct(n: number | null | undefined, digits = 3): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

function fmtBudget(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function fmtWindow(days: number): string {
  if (days === 1) return "1 Day";
  if (days === 7) return "7 Days";
  if (days === 30) return "30 Days";
  if (days === 90) return "90 Days";
  return `${days} Days`;
}

function fmtAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export function SLOsList() {
  const router = useRouter();
  const { data: slos = [], isLoading } = useSLOs();
  const deleteMut = useDeleteSLO();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<SLOStatus>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<SLOType>>(new Set());
  const [showControls, setShowControls] = useState(true);
  const [groupTab, setGroupTab] = useState<"Primary" | "Daily" | "Weekly" | "Monthly">(
    "Primary",
  );

  const counts = useMemo(() => {
    const c = { breached: 0, warn: 0, ok: 0, no_data: 0, total: slos.length };
    for (const slo of slos) {
      const s = slo.evaluation?.status ?? "no_data";
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [slos]);

  const filtered = useMemo(() => {
    let list = slos;
    if (statusFilter.size > 0) {
      list = list.filter((s) =>
        statusFilter.has(s.evaluation?.status ?? "no_data"),
      );
    }
    if (typeFilter.size > 0) {
      list = list.filter((s) => typeFilter.has(s.type));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [slos, statusFilter, typeFilter, search]);

  const toggleStatus = (s: SLOStatus) =>
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const toggleType = (t: SLOType) =>
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <div className="flex h-full w-full flex-col bg-white text-[#202124]">
      <Header />

      <div className="border-b border-[#dadce0] bg-white px-6 py-2.5">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-1.5">
            <SidebarSimple size={14} />
            Views
          </Button>
          <span className="text-[13px] text-[#5f6368]">My View</span>
          <Button variant="outline" size="sm" className="gap-1">
            <Plus size={14} />
            Save
          </Button>
        </div>
      </div>

      <div className="border-b border-[#dadce0] bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aa0a6]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Enter your query"
              className="w-full rounded-md border border-[#bdc1c6] bg-white py-1.5 pl-8 pr-3 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
            />
          </div>
          <span className="rounded-md bg-[#f1f3f4] px-3 py-1.5 text-[13px] text-[#5f6368]">
            Group by
          </span>
          <input
            type="text"
            placeholder="Search for a tag"
            className="w-[260px] rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showControls ? (
          <FilterSidebar
            counts={counts}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            onToggleStatus={toggleStatus}
            onToggleType={toggleType}
          />
        ) : null}

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="grid grid-cols-5 gap-3 border-b border-[#dadce0] bg-white px-6 py-4">
            {STATUS_KEYS.map((k) => (
              <StatusCard
                key={k}
                label={STATUS_CARD_LABEL[k]}
                value={counts[k]}
                color={statusColor(k)}
                bg={statusBg(k)}
                active={statusFilter.has(k)}
                onClick={() => toggleStatus(k)}
              />
            ))}
            <StatusCard
              label="TOTAL"
              value={counts.total}
              color="#202124"
              bg="#f1f3f4"
              active={false}
              onClick={() => undefined}
            />
          </div>

          <div className="flex items-center justify-between border-b border-[#dadce0] px-6 py-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowControls((v) => !v)}
                className="flex items-center gap-1.5 text-[13px] text-[#1a73e8] hover:underline"
              >
                <SidebarSimple size={14} />
                {showControls ? "Hide" : "Show"} Controls
              </button>
              <span className="text-[13px] text-[#5f6368]">
                Showing <strong>{filtered.length}</strong> of{" "}
                <strong>{slos.length}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md p-1.5 text-[#5f6368] hover:bg-[#f1f3f4]"
                aria-label="List view"
              >
                <ListBullets size={14} />
              </button>
              {(["Primary", "Daily", "Weekly", "Monthly"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setGroupTab(t)}
                  className={
                    "rounded-md px-3 py-1 text-[13px] " +
                    (groupTab === t
                      ? "bg-[#006CC2] text-white"
                      : "text-[#5f6368] hover:bg-[#f1f3f4]")
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
                Loading SLOs…
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                hasAny={slos.length > 0}
                onCreate={() => router.push("/slo/create")}
              />
            ) : (
              <SLOTable
                slos={filtered}
                onOpen={(s) => router.push(`/slo/${s.id}`)}
                onDelete={(s) => deleteMut.mutate(s.id)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex h-12 items-center justify-between border-b border-[#dadce0] bg-white px-6">
      <div className="flex items-center gap-3">
        <SLOIcon />
        <h1 className="text-[15px] font-medium text-[#202124]">SLOs</h1>
        <div className="ml-2 flex items-center gap-1">
          <span className="border-b-2 border-[#006CC2] px-3 py-3 text-[13px] font-medium text-[#202124]">
            List
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] text-[#1a73e8] hover:bg-[#f1f3f4]"
        >
          Learn More <CaretDown size={12} />
        </button>
        <Link href="/slo/create">
          <Button variant="primary" size="sm" className="gap-1">
            <Plus size={14} />
            New SLO
          </Button>
        </Link>
      </div>
    </header>
  );
}

function SLOIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="#632ca6" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="#632ca6" />
    </svg>
  );
}

function StatusCard({
  label,
  value,
  color,
  bg,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-4 py-3 text-left transition-colors " +
        (active
          ? "border-[#006CC2] ring-2 ring-[#006CC2]/20"
          : "border-[#dadce0] hover:border-[#a8b3be]")
      }
      style={{ backgroundColor: bg }}
    >
      <div className="text-[11px] font-semibold tracking-wider" style={{ color }}>
        {label}
      </div>
      <div className="mt-2 text-[24px] font-semibold" style={{ color }}>
        {value === 0 ? "—" : value}
      </div>
    </button>
  );
}

function FilterSidebar({
  counts,
  statusFilter,
  typeFilter,
  onToggleStatus,
  onToggleType,
}: {
  counts: { breached: number; warn: number; ok: number; no_data: number; total: number };
  statusFilter: Set<SLOStatus>;
  typeFilter: Set<SLOType>;
  onToggleStatus: (s: SLOStatus) => void;
  onToggleType: (t: SLOType) => void;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    teams: true,
    creator: true,
    type: true,
    state: true,
    burn: true,
    env: true,
    service: true,
    team: true,
    tags: true,
  });
  const toggle = (k: string) =>
    setOpenSections((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <aside className="w-[280px] shrink-0 overflow-auto border-r border-[#dadce0] bg-white py-3 pr-2 text-[13px]">
      <Section
        id="teams"
        title="My Teams"
        open={openSections.teams}
        onToggle={toggle}
        toggle={
          <label className="ml-auto inline-flex items-center">
            <input type="checkbox" className="peer hidden" />
            <span className="block h-4 w-7 rounded-full bg-[#dadce0] peer-checked:bg-[#006CC2] relative after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-3" />
          </label>
        }
      />
      <Section
        id="creator"
        title="Creator"
        open={openSections.creator}
        onToggle={toggle}
      >
        <div className="px-4 py-1 italic text-[#9aa0a6]">No matching values found</div>
      </Section>

      <Section
        id="type"
        title="Type"
        open={openSections.type}
        onToggle={toggle}
      >
        <FilterRow
          label="Metric"
          checked={typeFilter.has("metric")}
          onChange={() => onToggleType("metric")}
        />
        <FilterRow
          label="Monitor"
          checked={typeFilter.has("monitor")}
          onChange={() => onToggleType("monitor")}
        />
        <FilterRow
          label="Time Slice"
          checked={typeFilter.has("time_slice")}
          onChange={() => onToggleType("time_slice")}
        />
      </Section>

      <Section
        id="state"
        title="State"
        open={openSections.state}
        onToggle={toggle}
      >
        <FilterRow
          label="Breached"
          count={counts.breached}
          checked={statusFilter.has("breached")}
          onChange={() => onToggleStatus("breached")}
        />
        <FilterRow
          label="Warn"
          count={counts.warn}
          checked={statusFilter.has("warn")}
          onChange={() => onToggleStatus("warn")}
        />
        <FilterRow
          label="OK"
          count={counts.ok}
          checked={statusFilter.has("ok")}
          onChange={() => onToggleStatus("ok")}
        />
        <FilterRow
          label="No Data"
          count={counts.no_data}
          checked={statusFilter.has("no_data")}
          onChange={() => onToggleStatus("no_data")}
        />
      </Section>

      <Section
        id="burn"
        title="Burn Rate"
        open={openSections.burn}
        onToggle={toggle}
      >
        <div className="px-4 py-1 italic text-[#9aa0a6]">No matching values found</div>
      </Section>

      <Section id="env" title="Env" open={openSections.env} onToggle={toggle}>
        <div className="px-4 py-1 italic text-[#9aa0a6]">No matching values found</div>
      </Section>

      <Section
        id="service"
        title="Service"
        open={openSections.service}
        onToggle={toggle}
      >
        <div className="px-4 py-1 italic text-[#9aa0a6]">No matching values found</div>
      </Section>

      <Section id="team" title="Team" open={openSections.team} onToggle={toggle}>
        <div className="px-4 py-1 italic text-[#9aa0a6]">No matching values found</div>
      </Section>

      <Section id="tags" title="Tags" open={openSections.tags} onToggle={toggle}>
        <div className="px-4 py-1 italic text-[#9aa0a6]">No matching values found</div>
      </Section>
    </aside>
  );
}

function Section({
  id,
  title,
  open,
  onToggle,
  toggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: (id: string) => void;
  toggle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[#dadce0]">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center gap-1 px-4 py-2 text-left font-medium text-[#202124] hover:bg-[#f8f9fa]"
      >
        {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
        <span>{title}</span>
        {toggle}
      </button>
      {open ? <div className="pb-2">{children}</div> : null}
    </div>
  );
}

function FilterRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between px-4 py-1 hover:bg-[#f8f9fa]">
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-3.5 w-3.5 accent-[#006CC2]"
        />
        <span className="text-[#202124]">{label}</span>
      </span>
      {count != null ? (
        <span className="text-[12px] text-[#5f6368]">{count}</span>
      ) : null}
    </label>
  );
}

function SLOTable({
  slos,
  onOpen,
  onDelete,
}: {
  slos: SLO[];
  onOpen: (slo: SLO) => void;
  onDelete: (slo: SLO) => void;
}) {
  return (
    <table className="w-full text-[13px]">
      <thead className="sticky top-0 z-10 border-b border-[#dadce0] bg-white text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
        <tr>
          <th className="px-4 py-2 text-left">Type</th>
          <th className="px-2 py-2 text-left">Name</th>
          <th className="px-2 py-2 text-left">Time</th>
          <th className="px-2 py-2 text-left">Target</th>
          <th className="px-2 py-2 text-left">Status</th>
          <th className="px-2 py-2 text-left">Error Budget Left</th>
          <th className="px-2 py-2 text-left">Tags</th>
          <th className="px-2 py-2 text-left">Teams</th>
          <th className="w-10 px-2 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {slos.map((slo) => (
          <tr
            key={slo.id}
            className="cursor-pointer border-b border-[#f1f3f4] hover:bg-[#f8f9fa]"
            onClick={() => onOpen(slo)}
          >
            <td className="px-4 py-2.5">
              <span className="inline-flex items-center gap-1 rounded bg-[#f1f3f4] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[#5f6368]">
                {TYPE_LABEL[slo.type]}
              </span>
            </td>
            <td className="px-2 py-2.5">
              <div className="flex flex-col">
                <span className="font-medium text-[#1a73e8]">{slo.name}</span>
                {slo.description ? (
                  <span className="line-clamp-1 text-[12px] text-[#5f6368]">
                    {slo.description}
                  </span>
                ) : null}
                <span className="text-[11px] text-[#9aa0a6]">
                  Updated {fmtAgo(slo.modifiedMs)}
                </span>
              </div>
            </td>
            <td className="px-2 py-2.5 text-[#5f6368]">
              {fmtWindow(slo.timeWindowDays)}
            </td>
            <td className="px-2 py-2.5">
              <div className="flex flex-col">
                <span className="font-medium">{fmtPct(slo.targetPct)}</span>
                <span className="text-[11px] text-[#5f6368]">
                  SLI {fmtPct(slo.evaluation?.sliPct ?? null, 3)}
                </span>
              </div>
            </td>
            <td className="px-2 py-2.5">
              <StatusBadge status={slo.evaluation?.status ?? "no_data"} />
            </td>
            <td className="px-2 py-2.5">
              <BudgetBar
                pct={slo.evaluation?.errorBudgetRemainingPct ?? null}
                status={slo.evaluation?.status ?? "no_data"}
              />
            </td>
            <td className="px-2 py-2.5">
              <div className="flex flex-wrap gap-1">
                {slo.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#5f6368]"
                  >
                    {t}
                  </span>
                ))}
                {slo.tags.length > 3 ? (
                  <span className="text-[11px] text-[#9aa0a6]">
                    +{slo.tags.length - 3}
                  </span>
                ) : null}
              </div>
            </td>
            <td className="px-2 py-2.5">
              <div className="flex flex-wrap gap-1">
                {slo.teams.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="rounded bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#5f6368]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </td>
            <td className="px-2 py-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete SLO "${slo.name}"?`)) onDelete(slo);
                }}
                className="rounded p-1 text-[#9aa0a6] hover:bg-[#fce8e6] hover:text-[#d93025]"
                aria-label="Delete"
              >
                <Trash size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusBadge({ status }: { status: SLOStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[12px] font-medium"
      style={{ backgroundColor: statusBg(status), color: statusColor(status) }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: statusColor(status) }}
      />
      {statusLabel(status)}
    </span>
  );
}

function BudgetBar({ pct, status }: { pct: number | null; status: SLOStatus }) {
  const display = pct == null ? "—" : `${pct.toFixed(1)}%`;
  const width = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded bg-[#f1f3f4]">
        <div
          className="h-full transition-all"
          style={{
            width: `${width}%`,
            backgroundColor: statusColor(status),
          }}
        />
      </div>
      <span className="text-[12px] text-[#5f6368]">{display}</span>
    </div>
  );
}

function EmptyState({
  hasAny,
  onCreate,
}: {
  hasAny: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-[32px]">
        <MagnifyingGlass size={32} className="text-[#a142f4]" />
      </div>
      <p className="text-[14px] font-medium text-[#5f6368]">
        {hasAny ? "No matching results found" : "No SLOs yet"}
      </p>
      {!hasAny ? (
        <Button variant="primary" size="sm" onClick={onCreate} className="gap-1">
          <Plus size={14} />
          Create your first SLO
        </Button>
      ) : null}
    </div>
  );
}
