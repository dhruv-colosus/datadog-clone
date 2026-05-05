"use client";

import {
  ChartLine,
  ClockCounterClockwise,
  DesktopTower,
  DotsThreeVertical,
  Funnel,
  MagnifyingGlass,
  Plus,
  SidebarSimple,
  Star,
  Trash,
  Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { deleteDashboard, fetchDashboards } from "../api";
import { useDashboardsStore } from "../store";
import type { Dashboard } from "../types";
import { CreateDashboardModal } from "./CreateDashboardModal";
import { DashboardIcon } from "./DashboardIcon";

type PresetList = {
  id: string;
  label: string;
  filter: (d: Dashboard) => boolean;
};

const PRESET_LISTS: PresetList[] = [
  { id: "all-custom", label: "All Custom", filter: (d) => !d.icon },
  { id: "all-hosts", label: "All Hosts", filter: () => false },
  { id: "all-integrations", label: "All Integrations", filter: (d) => !!d.icon },
  {
    id: "created-by-you",
    label: "Created By You",
    filter: (d) => d.author.name === "Vedanta Neogi",
  },
  {
    id: "frequently-viewed-by-you",
    label: "Frequently Viewed By You",
    filter: (d) => d.popularity >= 4,
  },
  { id: "recently-deleted", label: "Recently Deleted", filter: () => false },
];

export function DashboardsList() {
  const dashboards = useDashboardsStore((s) => s.dashboards);
  const setDashboards = useDashboardsStore((s) => s.setDashboards);
  const removeLocal = useDashboardsStore((s) => s.remove);
  const [search, setSearch] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchDashboards()
      .then((list) => {
        if (cancelled) return;
        setDashboards(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load dashboards");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setDashboards]);

  const handleDelete = async (id: string) => {
    const target = dashboards.find((d) => d.id === id);
    removeLocal(id);
    const serverId = target?.serverId ?? id;
    try {
      await deleteDashboard(serverId);
    } catch {
      // Server delete failed; refetch to restore truth.
      fetchDashboards()
        .then(setDashboards)
        .catch(() => undefined);
    }
  };

  const filtered = useMemo(() => {
    let list = dashboards;
    if (activePreset) {
      const preset = PRESET_LISTS.find((p) => p.id === activePreset);
      if (preset) list = list.filter(preset.filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [dashboards, activePreset, search]);

  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <Header onNewDashboard={() => setCreateOpen(true)} />

      <div className="border-b border-[#dadce0] px-6 py-3">
        <div className="relative">
          <MagnifyingGlass
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368]"
          />
          <input
            type="text"
            placeholder="Search dashboards"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-[#bdc1c6] bg-white py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showControls && (
          <ControlsSidebar
            activePreset={activePreset}
            onPresetChange={setActivePreset}
            onHide={() => setShowControls(false)}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#dadce0] px-6 py-3">
            {!showControls && (
              <button
                type="button"
                onClick={() => setShowControls(true)}
                className="flex items-center gap-1.5 text-[13px] text-[#1a73e8] hover:underline"
              >
                <SidebarSimple size={14} weight="bold" />
                Show Controls
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button disabled>
                Edit Teams
                <span className="text-[#9aa0a6]">▾</span>
              </Button>
              <Button disabled>
                Add to <span className="text-[#9aa0a6]">▾</span>
              </Button>
              <Button disabled>
                <Trash size={12} />
                Delete
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="px-6 py-4">
              <h2 className="text-[20px] font-semibold text-[#202124]">
                {activePreset
                  ? PRESET_LISTS.find((p) => p.id === activePreset)?.label
                  : "All Dashboards"}
              </h2>
              <div className="mt-1 text-[13px] text-[#5f6368]">
                {loading ? (
                  "Loading…"
                ) : loadError ? (
                  <span className="text-[#b91c1c]">{loadError}</span>
                ) : (
                  <>
                    <span className="font-semibold">{filtered.length}</span> total
                  </>
                )}
              </div>
            </div>

            <DashboardTable
              dashboards={filtered}
              onDelete={handleDelete}
              loading={loading && dashboards.length === 0}
            />
          </div>
        </div>
      </div>

      <CreateDashboardModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

function Header({ onNewDashboard }: { onNewDashboard: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-[#dadce0] px-6 py-3">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <ChartLine size={18} className="text-[#202124]" />
          <h1 className="text-[16px] font-medium">Dashboards</h1>
        </div>
        <nav className="flex items-center gap-1 text-[13px]">
          <TabLink label="List" active />
          <TabLink label="Shared Dashboards" />
          <TabLink label="Reports" />
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <Button>
          <Plus size={12} weight="bold" />
          New List
        </Button>
        <Button variant="primary" onClick={onNewDashboard}>
          <Plus size={12} weight="bold" />
          New Dashboard
        </Button>
      </div>
    </div>
  );
}

function TabLink({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
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

function ControlsSidebar({
  activePreset,
  onPresetChange,
  onHide,
}: {
  activePreset: string | null;
  onPresetChange: (id: string | null) => void;
  onHide: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [myTeamsOpen, setMyTeamsOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(true);

  const presets = filter
    ? PRESET_LISTS.filter((p) =>
        p.label.toLowerCase().includes(filter.toLowerCase()),
      )
    : PRESET_LISTS;

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#dadce0] bg-white">
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={onHide}
          className="flex items-center gap-1.5 text-[13px] text-[#1a73e8] hover:underline"
        >
          <SidebarSimple size={14} weight="bold" />
          Hide Controls
        </button>
      </div>

      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setMyTeamsOpen((v) => !v)}
          className="flex w-full items-center justify-between py-1.5 text-[13px] text-[#202124]"
        >
          <span className="flex items-center gap-1.5">
            <span className={`text-[#5f6368] ${myTeamsOpen ? "rotate-90" : ""} transition-transform`}>
              ▸
            </span>
            <span className="font-medium">My Teams</span>
          </span>
          <Toggle on={myTeamsOpen} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Funnel
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5f6368]"
          />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter"
            className="w-full rounded-md border border-[#bdc1c6] bg-white py-1.5 pl-7 pr-3 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
          />
        </div>
      </div>

      <div className="px-4 pb-2">
        <button
          type="button"
          onClick={() => setPresetsOpen((v) => !v)}
          className="flex items-center gap-1.5 py-1 text-[13px] font-medium text-[#202124]"
        >
          <span className={`text-[#5f6368] ${presetsOpen ? "rotate-90" : ""} transition-transform`}>
            ▸
          </span>
          Preset Lists
        </button>
      </div>

      {presetsOpen && (
        <ul className="flex flex-col px-2 pb-4">
          {presets.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                onClick={() =>
                  onPresetChange(activePreset === preset.id ? null : preset.id)
                }
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                  activePreset === preset.id
                    ? "bg-[#e8f0fe] text-[#1a73e8]"
                    : "text-[#202124] hover:bg-[#f1f3f4]"
                }`}
              >
                <Star
                  size={14}
                  weight={activePreset === preset.id ? "fill" : "regular"}
                  className={
                    activePreset === preset.id ? "text-[#1a73e8]" : "text-[#5f6368]"
                  }
                />
                {preset.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
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

function DashboardTable({
  dashboards,
  onDelete,
  loading = false,
}: {
  dashboards: Dashboard[];
  onDelete: (id: string) => void;
  loading?: boolean;
}) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-t border-[#dadce0] bg-[#f8f9fa] text-[11px] uppercase tracking-wide text-[#5f6368]">
          <th className="w-8 px-3 py-2 text-left font-medium">
            <input type="checkbox" disabled />
          </th>
          <th className="px-3 py-2 text-left font-medium">Name</th>
          <th className="w-[180px] px-3 py-2 text-left font-medium">Author</th>
          <th className="w-[100px] px-3 py-2 text-left font-medium">Teams</th>
          <th className="w-[140px] px-3 py-2 text-left font-medium">Modified</th>
          <th className="w-[120px] px-3 py-2 text-left font-medium">Popularity</th>
          <th className="w-12 px-3 py-2"></th>
          <th className="w-12 px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {dashboards.length === 0 && (
          <tr>
            <td
              colSpan={8}
              className="px-6 py-12 text-center text-[13px] text-[#5f6368]"
            >
              {loading ? "Loading dashboards…" : "No dashboards yet."}
            </td>
          </tr>
        )}
        {dashboards.map((d) => (
          <DashboardRow key={d.id} dashboard={d} onDelete={onDelete} />
        ))}
      </tbody>
    </table>
  );
}

function DashboardRow({
  dashboard,
  onDelete,
}: {
  dashboard: Dashboard;
  onDelete: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isScreenboard = dashboard.kind === "screenboard";
  const KindIcon = isScreenboard ? DesktopTower : ClockCounterClockwise;

  return (
    <tr className="group border-b border-[#dadce0] hover:bg-[#f8f9fa]">
      <td className="px-3 py-2">
        <input type="checkbox" />
      </td>
      <td className="px-3 py-2">
        <Link
          href={`/dashboard/${dashboard.id}`}
          className="flex items-center gap-2 text-[#202124] hover:text-[#1a73e8]"
        >
          <DashboardIcon icon={dashboard.icon} />
          <span className="truncate">{dashboard.name}</span>
        </Link>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: dashboard.author.avatarColor }}
            aria-hidden
          >
            {dashboard.author.name
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)}
          </span>
          <span className="truncate text-[#202124]">{dashboard.author.name}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-[#5f6368]">
        {dashboard.teams.length === 0 ? (
          <Users size={14} className="text-[#bdc1c6]" />
        ) : (
          dashboard.teams.join(", ")
        )}
      </td>
      <td className="px-3 py-2 text-[#5f6368]">{formatModified(dashboard.modifiedMs)}</td>
      <td className="px-3 py-2">
        <PopularityBars value={dashboard.popularity} />
      </td>
      <td className="px-3 py-2 text-[#bdc1c6]">
        <KindIcon size={16} />
      </td>
      <td className="relative px-3 py-2 text-right">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded p-1 text-[#5f6368] hover:bg-[#e8eaed]"
          aria-label="Row actions"
        >
          <DotsThreeVertical size={14} weight="bold" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-3 z-20 mt-1 w-32 overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              type="button"
              onClick={() => {
                onDelete(dashboard.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <Trash size={12} />
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function PopularityBars({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, value));
  return (
    <div className="flex items-end gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-sm ${
            i <= filled ? "bg-[#1a73e8]" : "bg-[#dadce0]"
          }`}
          style={{ height: 4 + i * 2 }}
        />
      ))}
    </div>
  );
}

function formatModified(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const h12 = ((hours + 11) % 12) + 1;
  return sameYear
    ? `${month} ${day}, ${h12}:${minutes} ${ampm}`
    : `${month} ${day}, ${d.getFullYear()}`;
}
