"use client";

import {
  Bell,
  CaretDown,
  CaretRight,
  Code,
  Cube,
  DotsThreeVertical,
  Gauge,
  Gear,
  Plus,
  SidebarSimple,
  SpeakerSlash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MuteDuration } from "../api";
import {
  useDeleteMonitors,
  useMonitors,
  useMuteMonitors,
  useResolveMonitors,
  useUnmuteMonitors,
} from "../hooks";
import type { Monitor, MonitorPack, MonitorStatus } from "../types";
import {
  ConfirmationModal,
  MuteDurationPopover,
} from "./MonitorActionModals";

type StatusFilter = "Triggered" | "Alert" | "Warn" | "No Data" | "OK";

type MutedFilter = "True" | "False";

type DraftFilter = "Published" | "Draft";

const STATUS_FILTERS: { id: StatusFilter; label: string; nested?: boolean }[] = [
  { id: "Triggered", label: "Triggered" },
  { id: "Alert", label: "Alert", nested: true },
  { id: "Warn", label: "Warn", nested: true },
  { id: "No Data", label: "No Data", nested: true },
  { id: "OK", label: "OK" },
];

const MUTED_FILTERS: MutedFilter[] = ["True", "False"];
const DRAFT_FILTERS: DraftFilter[] = ["Published", "Draft"];

const STATUS_DOT: Record<StatusFilter, string> = {
  Triggered: "bg-transparent",
  Alert: "bg-[#d93025]",
  Warn: "bg-[#f9ab00]",
  "No Data": "bg-[#9aa0a6]",
  OK: "bg-[#137333]",
};

type ActionState =
  | { kind: "none" }
  | { kind: "mute"; duration: MuteDuration; ids: string[] }
  | { kind: "unmute"; ids: string[] }
  | { kind: "delete"; ids: string[] }
  | { kind: "resolve"; ids: string[] };

export function MonitorsList() {
  const { data: monitors = [], isLoading, error } = useMonitors();
  const muteMutation = useMuteMonitors();
  const unmuteMutation = useUnmuteMonitors();
  const deleteMutation = useDeleteMonitors();
  const resolveMutation = useResolveMonitors();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<
    "List" | "Triggered" | "Downtimes" | "Quality"
  >("List");
  const [showControls, setShowControls] = useState(true);

  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(
    new Set(),
  );
  const [mutedFilters, setMutedFilters] = useState<Set<MutedFilter>>(new Set());
  const [draftFilters, setDraftFilters] = useState<Set<DraftFilter>>(new Set());
  const [mutedElapsed, setMutedElapsed] = useState("30d");
  const [mutedLeft, setMutedLeft] = useState("1h");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedPacks, setExpandedPacks] = useState<Set<MonitorPack>>(
    new Set(["rum", "host"]),
  );

  const [muteOpen, setMuteOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionState>({
    kind: "none",
  });
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = monitors;
    if (statusFilters.size > 0) {
      list = list.filter((m) => {
        if (statusFilters.has("Triggered")) {
          if (
            m.status === "Alert" ||
            m.status === "Warn" ||
            m.status === "No Data"
          ) {
            return true;
          }
        }
        return statusFilters.has(m.status as StatusFilter);
      });
    }
    if (mutedFilters.size === 1) {
      const wantMuted = mutedFilters.has("True");
      list = list.filter((m) => m.muted === wantMuted);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    return list;
  }, [monitors, statusFilters, mutedFilters, search]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter | "True" | "False", number> = {
      Triggered: 0,
      Alert: 0,
      Warn: 0,
      "No Data": 0,
      OK: 0,
      True: 0,
      False: 0,
    };
    for (const m of monitors) {
      if (m.status === "Alert" || m.status === "Warn" || m.status === "No Data") {
        c.Triggered += 1;
      }
      c[m.status as StatusFilter] += 1;
      if (m.muted) c.True += 1;
      else c.False += 1;
    }
    return c;
  }, [monitors]);

  const grouped = useMemo(() => {
    const map = new Map<MonitorPack, Monitor[]>();
    for (const m of filtered) {
      const list = map.get(m.pack) ?? [];
      list.push(m);
      map.set(m.pack, list);
    }
    return map;
  }, [filtered]);

  // Drop selections that no longer match the latest list (e.g. after delete).
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(monitors.map((m) => m.id));
      let changed = false;
      const next = new Set(prev);
      for (const id of next) {
        if (!ids.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [monitors]);

  const togglePack = (pack: MonitorPack) =>
    setExpandedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(pack)) next.delete(pack);
      else next.add(pack);
      return next;
    });

  const toggleStatus = (id: StatusFilter) =>
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleMuted = (id: MutedFilter) =>
    setMutedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleDraft = (id: DraftFilter) =>
    setDraftFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((m) => selected.has(m.id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const m of filtered) next.delete(m.id);
        return next;
      }
      const next = new Set(prev);
      for (const m of filtered) next.add(m.id);
      return next;
    });

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedMonitors = useMemo(
    () => monitors.filter((m) => selected.has(m.id)),
    [monitors, selected],
  );
  const allSelectedAreMuted =
    selectedMonitors.length > 0 && selectedMonitors.every((m) => m.muted);

  const closeAction = () => {
    setPendingAction({ kind: "none" });
    setActionError(null);
  };

  const onMuteSelect = (duration: MuteDuration) => {
    setMuteOpen(false);
    setPendingAction({ kind: "mute", duration, ids: selectedIds });
    setActionError(null);
  };

  const onUnmuteRequest = () => {
    if (selectedIds.length === 0) return;
    setPendingAction({ kind: "unmute", ids: selectedIds });
    setActionError(null);
  };

  const onDeleteRequest = () => {
    if (selectedIds.length === 0) return;
    setPendingAction({ kind: "delete", ids: selectedIds });
    setActionError(null);
  };

  const onResolveRequest = () => {
    if (selectedIds.length === 0) return;
    setPendingAction({ kind: "resolve", ids: selectedIds });
    setActionError(null);
  };

  const runAction = async () => {
    if (pendingAction.kind === "none") return;
    setActionError(null);
    try {
      if (pendingAction.kind === "mute") {
        await muteMutation.mutateAsync({
          ids: pendingAction.ids,
          duration: pendingAction.duration,
        });
      } else if (pendingAction.kind === "unmute") {
        await unmuteMutation.mutateAsync(pendingAction.ids);
      } else if (pendingAction.kind === "delete") {
        await deleteMutation.mutateAsync(pendingAction.ids);
        setSelected(new Set());
      } else if (pendingAction.kind === "resolve") {
        await resolveMutation.mutateAsync(pendingAction.ids);
      }
      closeAction();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const busy =
    muteMutation.isPending ||
    unmuteMutation.isPending ||
    deleteMutation.isPending ||
    resolveMutation.isPending;

  return (
    <div
      data-testid="monitors-manage-page"
      className="flex h-full w-full flex-col bg-white text-[#202124]"
    >
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <LiveMonitoringBanner total={monitors.length} />

      <div className="border-b border-[#dadce0] bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter monitors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
          />
          <button
            type="button"
            className="rounded-md border border-[#bdc1c6] bg-white p-1.5 text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="JSON view"
          >
            <Code size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showControls && (
          <FilterSidebar
            counts={counts}
            statusFilters={statusFilters}
            mutedFilters={mutedFilters}
            draftFilters={draftFilters}
            mutedElapsed={mutedElapsed}
            mutedLeft={mutedLeft}
            onToggleStatus={toggleStatus}
            onToggleMuted={toggleMuted}
            onToggleDraft={toggleDraft}
            onMutedElapsedChange={setMutedElapsed}
            onMutedLeftChange={setMutedLeft}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-[#dadce0] bg-white px-6 py-2">
            <button
              type="button"
              onClick={() => setShowControls((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] text-[#1a73e8] hover:underline"
            >
              <SidebarSimple size={14} weight="bold" />
              {showControls ? "Hide Controls" : "Show Controls"}
            </button>
            <span className="text-[#bdc1c6]">|</span>
            <p className="text-[13px] text-[#202124]">
              Showing <span className="font-semibold">1–{grouped.size}</span> of{" "}
              <span className="font-semibold">{grouped.size}</span> monitor packs
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
                aria-label="Settings"
              >
                <Gear size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#dadce0] bg-white text-[11px] uppercase tracking-wide text-[#5f6368]">
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="w-[88px] px-3 py-2 text-left font-medium">
                    Priority
                  </th>
                  <th className="w-[100px] px-3 py-2 text-left font-medium">
                    Status
                  </th>
                  <th className="w-[120px] px-3 py-2 text-left font-medium">
                    Muted Left
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="w-[200px] px-3 py-2 text-left font-medium">
                    Tags
                  </th>
                </tr>
                <tr className="border-b border-[#dadce0] bg-white">
                  <th colSpan={6} className="px-3 py-2">
                    <BulkActionBar
                      selectedCount={selected.size}
                      muteOpen={muteOpen}
                      onMuteToggle={() => setMuteOpen((v) => !v)}
                      onMuteSelect={onMuteSelect}
                      onMuteClose={() => setMuteOpen(false)}
                      allSelectedMuted={allSelectedAreMuted}
                      onUnmute={onUnmuteRequest}
                      onResolve={onResolveRequest}
                      onDelete={onDeleteRequest}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && monitors.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-[13px] text-[#5f6368]"
                    >
                      Loading monitors…
                    </td>
                  </tr>
                )}
                {error && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-[13px] text-[#991b1b]"
                    >
                      {error instanceof Error ? error.message : "Failed to load"}
                    </td>
                  </tr>
                )}
                {Array.from(grouped.entries()).map(([pack, items]) => (
                  <PackGroup
                    key={pack}
                    pack={pack}
                    items={items}
                    expanded={expandedPacks.has(pack)}
                    onToggle={() => togglePack(pack)}
                    selected={selected}
                    onToggleSelect={toggleSelect}
                  />
                ))}
                {!isLoading && !error && grouped.size === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-[13px] text-[#5f6368]"
                    >
                      No monitors match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={pendingAction.kind === "mute"}
        title="Mute these monitors?"
        body={
          pendingAction.kind === "mute" ? (
            <>
              Mute{" "}
              <strong>
                {pendingAction.ids.length} monitor
                {pendingAction.ids.length === 1 ? "" : "s"}
              </strong>{" "}
              for{" "}
              <strong>
                {pendingAction.duration === "forever"
                  ? "forever"
                  : pendingAction.duration}
              </strong>
              ?
            </>
          ) : null
        }
        confirmLabel="Mute"
        busy={busy}
        error={actionError}
        onConfirm={runAction}
        onClose={closeAction}
      />

      <ConfirmationModal
        open={pendingAction.kind === "unmute"}
        title={
          pendingAction.kind === "unmute" && pendingAction.ids.length === 1
            ? "Unmute this monitor?"
            : "Unmute these monitors?"
        }
        body={
          pendingAction.kind === "unmute" ? (
            pendingAction.ids.length === 1 ? (
              <>
                Are you sure you want to <strong>unmute</strong> this monitor?
              </>
            ) : (
              <>
                Are you sure you want to <strong>unmute</strong>{" "}
                {pendingAction.ids.length} monitors?
              </>
            )
          ) : null
        }
        confirmLabel="Unmute"
        busy={busy}
        error={actionError}
        onConfirm={runAction}
        onClose={closeAction}
      />

      <ConfirmationModal
        open={pendingAction.kind === "delete"}
        title={
          pendingAction.kind === "delete" && pendingAction.ids.length === 1
            ? "Delete this monitor?"
            : "Delete these monitors?"
        }
        body={
          pendingAction.kind === "delete" ? (
            <>
              This will permanently delete{" "}
              <strong>
                {pendingAction.ids.length} monitor
                {pendingAction.ids.length === 1 ? "" : "s"}
              </strong>
              . This action cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        busy={busy}
        error={actionError}
        onConfirm={runAction}
        onClose={closeAction}
      />

      <ConfirmationModal
        open={pendingAction.kind === "resolve"}
        title="Resolve these monitors?"
        body={
          pendingAction.kind === "resolve" ? (
            <>
              Mark{" "}
              <strong>
                {pendingAction.ids.length} monitor
                {pendingAction.ids.length === 1 ? "" : "s"}
              </strong>{" "}
              as <strong>OK</strong>?
            </>
          ) : null
        }
        confirmLabel="Resolve"
        busy={busy}
        error={actionError}
        onConfirm={runAction}
        onClose={closeAction}
      />
    </div>
  );
}

function Header({
  activeTab,
  onTabChange,
}: {
  activeTab: "List" | "Triggered" | "Downtimes" | "Quality";
  onTabChange: (
    tab: "List" | "Triggered" | "Downtimes" | "Quality",
  ) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Gauge size={18} className="text-[#202124]" />
            <h1 className="text-[16px] font-medium">Monitors</h1>
          </div>
          <nav className="flex items-center gap-1 text-[13px]">
            {(["List", "Triggered", "Downtimes", "Quality"] as const).map(
              (label) => (
                <TabLink
                  key={label}
                  label={label}
                  active={activeTab === label}
                  onClick={() => onTabChange(label)}
                />
              ),
            )}
            <button
              type="button"
              className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-[#5f6368] hover:text-[#202124]"
            >
              Analytics
              <span aria-hidden>↗</span>
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button>
            <Gear size={12} />
            Settings
          </Button>
          <Button>Browse Templates</Button>
          <div className="flex">
            <Link
              href="/monitor/create"
              className="inline-flex h-7 items-center gap-1 rounded-l-md border border-transparent bg-[#1a73e8] px-2 text-[13px] font-normal text-white transition-colors hover:bg-[#1765cc]"
            >
              <Plus size={12} weight="bold" />
              New Monitor
            </Link>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-r-md border border-l border-l-white/20 border-transparent bg-[#1a73e8] text-white hover:bg-[#1765cc]"
              aria-label="More create options"
            >
              <CaretDown size={10} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-[#dadce0] bg-[#f8f9fa] px-6 py-1.5 text-[13px] text-[#5f6368]">
        <span aria-hidden>▷</span>
        <span className="text-[#1a73e8]">Views</span>
        <span className="text-[#dadce0]">|</span>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-[#202124] hover:bg-[#e8eaed]"
        >
          My View
        </button>
        <button
          type="button"
          className="rounded p-1 text-[#5f6368] hover:bg-[#e8eaed]"
          aria-label="View options"
        >
          <DotsThreeVertical size={12} weight="bold" />
        </button>
      </div>
    </>
  );
}

function TabLink({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-1.5 text-[13px] ${
        active ? "text-[#202124]" : "text-[#5f6368] hover:text-[#202124]"
      }`}
    >
      {label}
      {active && (
        <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-[#1a73e8]" />
      )}
    </button>
  );
}

function LiveMonitoringBanner({ total }: { total: number }) {
  return (
    <div className="relative overflow-hidden border-b border-[#dadce0] bg-[#f3f4f6] px-6 py-5">
      <div className="absolute inset-0 opacity-40" aria-hidden>
        <Waves />
      </div>
      <div className="relative flex items-start justify-between gap-6">
        <div>
          <span className="inline-block rounded-sm bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#137333]">
            Live Monitoring
          </span>
          <p className="mt-3 text-[14px] text-[#202124]">
            <span className="font-semibold">{total} monitors</span> added with no
            alerts. Continue to tailor your coverage or add supplementary monitors
          </p>
          <div className="mt-2 flex items-center gap-4 text-[12px]">
            <button
              type="button"
              className="text-[#1a73e8] underline-offset-2 hover:underline"
            >
              How does this work?
            </button>
            <button
              type="button"
              className="text-[#5f6368] underline-offset-2 hover:underline"
            >
              Turn off automatic monitors
            </button>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-[#1a73e8] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#6d28d9]"
        >
          <Bell size={14} weight="fill" />
          Next, Set Up Notifications
        </button>
      </div>
    </div>
  );
}

function Waves() {
  return (
    <svg
      viewBox="0 0 800 100"
      className="h-full w-full"
      preserveAspectRatio="none"
    >
      {Array.from({ length: 90 }).map((_, i) => {
        const x = i * 9 + 4;
        const h = 20 + Math.abs(Math.sin(i / 6)) * 60;
        return (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={50 - h / 2}
            y2={50 + h / 2}
            stroke="#bcd4ff"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function FilterSidebar({
  counts,
  statusFilters,
  mutedFilters,
  draftFilters,
  mutedElapsed,
  mutedLeft,
  onToggleStatus,
  onToggleMuted,
  onToggleDraft,
  onMutedElapsedChange,
  onMutedLeftChange,
}: {
  counts: Record<StatusFilter | "True" | "False", number>;
  statusFilters: Set<StatusFilter>;
  mutedFilters: Set<MutedFilter>;
  draftFilters: Set<DraftFilter>;
  mutedElapsed: string;
  mutedLeft: string;
  onToggleStatus: (id: StatusFilter) => void;
  onToggleMuted: (id: MutedFilter) => void;
  onToggleDraft: (id: DraftFilter) => void;
  onMutedElapsedChange: (v: string) => void;
  onMutedLeftChange: (v: string) => void;
}) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-[#dadce0] bg-white">
      <div className="flex items-center justify-between border-b border-[#dadce0] px-4 py-3">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#202124]"
        >
          <CaretRight size={10} weight="bold" />
          My Teams
        </button>
        <Toggle on={false} />
      </div>

      <FilterGroup title="Status">
        {STATUS_FILTERS.map((f) => (
          <FilterRow
            key={f.id}
            label={f.label}
            count={counts[f.id]}
            checked={statusFilters.has(f.id)}
            onToggle={() => onToggleStatus(f.id)}
            indent={f.nested}
            dotClass={f.nested ? STATUS_DOT[f.id] : undefined}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Muted">
        <FilterRow
          label="True"
          count={counts.True}
          checked={mutedFilters.has("True")}
          onToggle={() => onToggleMuted("True")}
        />
        <div className="px-2 pb-2">
          <DurationField
            label="Muted elapsed"
            value={mutedElapsed}
            suffix="or more"
            onChange={onMutedElapsedChange}
          />
          <div className="h-2" />
          <DurationField
            label="Muted left"
            value={mutedLeft}
            suffix="or less"
            onChange={onMutedLeftChange}
          />
        </div>
        <FilterRow
          label="False"
          count={counts.False}
          checked={mutedFilters.has("False")}
          onToggle={() => onToggleMuted("False")}
        />
      </FilterGroup>

      <FilterGroup title="Draft Status">
        {DRAFT_FILTERS.map((f) => (
          <FilterRow
            key={f}
            label={f}
            count={f === "Published" ? counts.OK + counts.Triggered : 0}
            checked={draftFilters.has(f)}
            onToggle={() => onToggleDraft(f)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Priority" />
    </aside>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-[#dadce0]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-[13px] font-medium text-[#202124]"
      >
        <span className="text-[#5f6368]">
          {open ? <CaretDown size={10} weight="bold" /> : <CaretRight size={10} weight="bold" />}
        </span>
        {title}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function FilterRow({
  label,
  count,
  checked,
  onToggle,
  indent,
  dotClass,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
  indent?: boolean;
  dotClass?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 px-4 py-1.5 text-[13px] hover:bg-[#f1f3f4] ${
        indent ? "pl-8" : ""
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {dotClass && (
        <span className={`inline-block h-2.5 w-1 rounded-sm ${dotClass}`} />
      )}
      <span className="flex-1 text-[#202124]">{label}</span>
      <span className="text-[#5f6368]">{count}</span>
    </label>
  );
}

function DurationField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: string;
  suffix: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-[12px] text-[#5f6368]">
      <input type="checkbox" />
      <span className="flex-1 text-[#202124]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 rounded-md border border-[#bdc1c6] bg-white px-2 py-0.5 text-center text-[12px] text-[#202124] outline-none focus:border-[#1a73e8]"
      />
      <span className="text-[#5f6368]">{suffix}</span>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
        on ? "bg-[#1a73e8]" : "bg-[#bdc1c6]"
      }`}
    >
      <span
        className={`h-3 w-3 rounded-full bg-white transition-transform ${
          on ? "translate-x-3" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function BulkActionBar({
  selectedCount,
  muteOpen,
  onMuteToggle,
  onMuteSelect,
  onMuteClose,
  allSelectedMuted,
  onUnmute,
  onResolve,
  onDelete,
}: {
  selectedCount: number;
  muteOpen: boolean;
  onMuteToggle: () => void;
  onMuteSelect: (d: MuteDuration) => void;
  onMuteClose: () => void;
  allSelectedMuted: boolean;
  onUnmute: () => void;
  onResolve: () => void;
  onDelete: () => void;
}) {
  const disabled = selectedCount === 0;
  const muteWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!muteOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!muteWrapRef.current) return;
      if (!muteWrapRef.current.contains(e.target as Node)) onMuteClose();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [muteOpen, onMuteClose]);

  return (
    <div className="flex items-center gap-2 text-[13px] text-[#5f6368]">
      {selectedCount > 0 ? (
        <span className="text-[#202124]">
          <span className="font-semibold">{selectedCount}</span> monitor
          {selectedCount === 1 ? "" : "s"} selected
        </span>
      ) : null}
      <div className="relative" ref={muteWrapRef}>
        <Button
          disabled={disabled}
          size="sm"
          onClick={onMuteToggle}
          aria-expanded={muteOpen}
        >
          Mute <CaretDown size={10} weight="bold" />
        </Button>
        <MuteDurationPopover
          open={muteOpen && !disabled}
          onSelect={onMuteSelect}
          onClose={onMuteClose}
        />
      </div>
      {allSelectedMuted && (
        <Button disabled={disabled} size="sm" onClick={onUnmute}>
          <SpeakerSlash size={12} />
          Unmute
        </Button>
      )}
      <Button disabled={disabled} size="sm" onClick={onResolve}>
        Resolve
      </Button>
      <Button disabled={disabled} size="sm" onClick={onDelete}>
        Delete
      </Button>
      <Button disabled={disabled} size="sm">
        Edit Tags <CaretDown size={10} weight="bold" />
      </Button>
      <Button disabled={disabled} size="sm">
        Edit Recipients{" "}
        <span className="rounded-sm bg-[#e8f0fe] px-1 text-[10px] font-semibold text-[#1a73e8]">
          NEW
        </span>
      </Button>
      <Button disabled={disabled} size="sm">
        Edit Teams <CaretDown size={10} weight="bold" />
      </Button>
      <Button disabled={disabled} size="sm">
        Export to Terraform{" "}
        <span className="rounded-sm bg-[#e8f0fe] px-1 text-[10px] font-semibold text-[#1a73e8]">
          NEW
        </span>
      </Button>
    </div>
  );
}

function PackGroup({
  pack,
  items,
  expanded,
  onToggle,
  selected,
  onToggleSelect,
}: {
  pack: MonitorPack;
  items: Monitor[];
  expanded: boolean;
  onToggle: () => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const PackIcon = pack === "rum" ? Gauge : Cube;
  const iconColor = pack === "rum" ? "text-[#1a73e8]" : "text-[#1a73e8]";
  const allSelected = items.every((m) => selected.has(m.id));
  const someSelected = items.some((m) => selected.has(m.id));

  return (
    <>
      <tr className="border-b border-[#dadce0] bg-[#f0f5ff]">
        <td colSpan={6} className="px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className="text-[#5f6368]"
              aria-label={expanded ? "Collapse pack" : "Expand pack"}
            >
              {expanded ? (
                <CaretDown size={10} weight="bold" />
              ) : (
                <CaretRight size={10} weight="bold" />
              )}
            </button>
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = !allSelected && someSelected;
              }}
              onChange={() => {
                items.forEach((m) => {
                  if (allSelected) onToggleSelect(m.id);
                  else if (!selected.has(m.id)) onToggleSelect(m.id);
                });
              }}
            />
            <PackIcon size={14} className={iconColor} weight="fill" />
            <span className="text-[13px] font-medium text-[#202124] capitalize">
              {pack} Monitors
            </span>
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-medium text-[#5f6368]">
              {items.length}
            </span>
          </div>
        </td>
      </tr>
      {expanded &&
        items.map((monitor) => (
          <MonitorRow
            key={monitor.id}
            monitor={monitor}
            selected={selected.has(monitor.id)}
            onToggleSelect={() => onToggleSelect(monitor.id)}
          />
        ))}
    </>
  );
}

function MonitorRow({
  monitor,
  selected,
  onToggleSelect,
}: {
  monitor: Monitor;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <tr
      className={`border-b border-[#dadce0] hover:bg-[#f8f9fa] ${
        selected ? "bg-[#e8f0fe]" : ""
      }`}
    >
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} />
      </td>
      <td className="px-3 py-2 text-[#5f6368]">-</td>
      <td className="px-3 py-2">
        <StatusPill status={monitor.status} />
      </td>
      <td className="px-3 py-2 text-[#5f6368]">{formatMutedLeft(monitor)}</td>
      <td className="px-3 py-2">
        <Link
          href={`/monitor/${monitor.id}`}
          className="text-[#202124] hover:text-[#1a73e8]"
        >
          {monitor.name}
        </Link>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {monitor.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-sm bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] text-[#5f6368]"
            >
              {t}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: MonitorStatus }) {
  const styles: Record<MonitorStatus, string> = {
    OK: "bg-[#34a853] text-white",
    Alert: "bg-[#d93025] text-white",
    Warn: "bg-[#f9ab00] text-white",
    "No Data": "bg-[#9aa0a6] text-white",
  };
  const label = status === "No Data" ? "NO DATA" : status.toUpperCase();
  return (
    <span
      className={`inline-flex h-5 min-w-[80px] items-center justify-center rounded-sm px-2 text-[11px] font-semibold tracking-wide ${styles[status]}`}
    >
      {label}
    </span>
  );
}

function formatMutedLeft(monitor: Monitor): string {
  if (!monitor.muted) return "";
  if (!monitor.mutedUntilMs) return "Forever";
  const ms = monitor.mutedUntilMs - Date.now();
  if (ms <= 0) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) {
    const whole = Math.floor(hours);
    const frac = hours - whole;
    if (frac >= 0.7) return `${whole}¾h`;
    if (frac >= 0.45) return `${whole}½h`;
    if (frac >= 0.2) return `${whole}¼h`;
    return `${whole}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
