"use client";

import {
  ArrowsCounterClockwise,
  BracketsCurly,
  Buildings,
  Cube,
  CaretDown,
  CaretRight,
  Database,
  DeviceMobile,
  DotsThree,
  DownloadSimple,
  Faders,
  GearSix,
  GitFork,
  ListBullets,
  MagnifyingGlass,
  MapTrifold,
  Megaphone,
  Pause,
  Plus,
  PushPin,
  Stack,
  Star,
  StackSimple,
  TreeStructure,
  Users,
  Wrench,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApmServiceMap, useApmServices } from "@/features/apm/hooks";
import { useApmHomeStore, useApmTracesStore } from "@/features/apm/store";
import type { ApmService } from "@/features/apm/types";
import { ServiceMapCanvas } from "./components/ServiceMapCanvas";

type ViewMode = "list" | "map";
type CatalogFilterTab =
  | "ownership"
  | "reliability"
  | "performance"
  | "security"
  | "costs"
  | "delivery";

const FILTER_TABS: Array<{ value: CatalogFilterTab; label: string; icon: React.ReactNode }> = [
  { value: "ownership", label: "Ownership", icon: <Users size={12} /> },
  { value: "reliability", label: "Reliability", icon: <ArrowsCounterClockwise size={12} /> },
  { value: "performance", label: "Performance", icon: <ChartLineDot /> },
  { value: "security", label: "Security", icon: <ShieldHex /> },
  { value: "costs", label: "Costs", icon: <CoinIcon /> },
  { value: "delivery", label: "Delivery", icon: <GitFork size={12} /> },
];

function ChartLineDot() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 12 L6 8 L9 10 L14 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ShieldHex() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5 L13 4 V8 C13 11 8 14.5 8 14.5 C8 14.5 3 11 3 8 V4 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function CoinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5.5 V10.5 M6.4 7 H9.5 C10 7 10 8 9.5 8 H6.5 C6 8 6 9 6.5 9 H9.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function formatRequestRate(rps: number): string {
  if (rps < 0.1) return "< 0.1";
  if (rps < 10) return rps.toFixed(1);
  return Math.round(rps).toString();
}
function formatErrorPct(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(0)}%`;
}
function formatDeploy(min: number | null): string {
  if (min === null) return "—";
  if (min < 60) return `${min}m ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / (60 * 24))}d ago`;
}

export function SoftwareCatalogPage() {
  const env = useApmHomeStore((s) => s.envFilter);
  const setEnv = useApmHomeStore((s) => s.setEnvFilter);
  const range = useApmTracesStore((s) => s.timeRange);
  const lookback = Math.max(
    60,
    Math.min(86400, Math.round((range.toMs - range.fromMs) / 1000)),
  );

  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<CatalogFilterTab>("performance");
  const [myTeamsOnly, setMyTeamsOnly] = useState(false);

  const { data: services, isLoading: servicesLoading } = useApmServices(env);
  const { data: serviceMap } = useApmServiceMap(env, lookback);

  const filteredServices = useMemo<ApmService[]>(() => {
    const list = services ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.team ?? "").toLowerCase().includes(q),
    );
  }, [services, search]);

  const counts = useMemo(() => {
    const all = services ?? [];
    const datastores = all.filter((s) => s.type === "db").length;
    const queues = all.filter((s) => s.type === "cache").length;
    return {
      services: all.length,
      datastores,
      queues,
      inferred:
        (serviceMap?.nodes ?? []).filter((n) => n.inferred).length,
    };
  }, [services, serviceMap]);

  return (
    <div
      data-testid="software-page"
      className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]"
    >
      <IdpHeaderBar />
      <SubHeader />
      <div className="flex flex-1 min-h-0">
        <CatalogSidebar counts={counts} />
        <div className="flex flex-1 min-w-0 flex-col">
          <TopFilterBar
            search={search}
            onSearch={setSearch}
            view={view}
            onViewChange={setView}
            myTeamsOnly={myTeamsOnly}
            onToggleMyTeams={() => setMyTeamsOnly((v) => !v)}
            env={env}
            onEnvChange={setEnv}
          />
          <FilterTabs value={filterTab} onChange={setFilterTab} />
          {view === "list" ? (
            <CatalogListView
              services={filteredServices}
              isLoading={servicesLoading}
            />
          ) : (
            <CatalogMapView env={env} serviceCount={filteredServices.length} />
          )}
          <PortalFooter />
        </div>
      </div>
    </div>
  );
}

/* ----- Header strip (top of page) ----- */

function IdpHeaderBar() {
  const tabs = ["Overview", "Catalog", "Scorecards", "Self-Service Actions"];
  return (
    <div className="flex items-center gap-1 border-b border-[#e8eaed] bg-white px-4">
      <Link
        href="/software"
        className="mr-2 inline-flex h-11 items-center gap-1.5 text-[13px] font-medium text-[#5f6368] hover:text-[#202124]"
      >
        <Cube size={14} weight="bold" />
        Internal Developer Portal
      </Link>
      <div className="flex h-11 items-center gap-1">
        {tabs.map((label) => {
          const active = label === "Catalog";
          const isNew = label === "Self-Service Actions";
          return (
            <span
              key={label}
              className={`relative inline-flex h-11 items-center gap-1.5 px-3 text-[13px] ${
                active
                  ? "font-semibold text-[#202124]"
                  : "cursor-default text-[#5f6368]"
              }`}
            >
              {label}
              {isNew && (
                <span className="absolute -top-0.5 right-0 rounded bg-purple-600/20 px-1 text-[8.5px] font-semibold uppercase tracking-wide text-purple-700">
                  New
                </span>
              )}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1a73e8]" />
              )}
            </span>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]"
        >
          <Megaphone size={12} weight="fill" />
          Give Feedback
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
        >
          <GearSix size={12} weight="bold" />
          Manage
        </button>
      </div>
    </div>
  );
}

function SubHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-1.5">
      <button
        type="button"
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]"
      >
        <StackSimple size={12} weight="fill" />
        Views
      </button>
      <span className="text-[12.5px] text-[#202124]">My View</span>
      <button
        type="button"
        aria-label="View options"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
      >
        <DotsThree size={14} weight="bold" />
      </button>
    </div>
  );
}

/* ----- Left sidebar rail ----- */

function CatalogSidebar({
  counts,
}: {
  counts: { services: number; datastores: number; queues: number; inferred: number };
}) {
  return (
    <aside className="w-[240px] shrink-0 overflow-y-auto border-r border-[#e8eaed] bg-white py-2 text-[13px] text-[#202124]">
      <SidebarRow icon={<Users size={15} />} label="Teams" count={0} />
      <SidebarRow icon={<Cube size={15} />} label="Infrastructure" count={2} />

      <div className="mt-3 flex items-center justify-between px-3 pb-1">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[13px] font-bold text-[#202124] hover:text-[#1a73e8]"
        >
          <CaretDown size={10} weight="bold" />
          Software <span className="font-normal text-[#5f6368]">(10)</span>
        </button>
        <button
          type="button"
          aria-label="Software settings"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#1a73e8] hover:bg-[#e8f0fe]"
        >
          <GearSix size={14} weight="fill" />
        </button>
      </div>

      <SidebarRow icon={<Star size={15} />} label="My Entities" count={0} indent />
      <SidebarRow icon={<TreeStructure size={15} />} label="Systems" count={0} indent />
      <SidebarRow
        icon={<GitFork size={15} />}
        label="Services"
        count={counts.services}
        indent
        active
      />
      <SidebarRow icon={<Stack size={15} />} label="Queues" count={counts.queues} indent />
      <SidebarRow icon={<Database size={15} />} label="Datastores" count={counts.datastores} indent />
      <SidebarRow icon={<Wrench size={15} />} label="Inferred Services" count={counts.inferred} indent />
      <SidebarRow icon={<Buildings size={15} />} label="External Providers" count={0} indent />
      <SidebarRow icon={<DeviceMobile size={15} />} label="Frontend Apps" count={0} indent />
      <SidebarRow icon={<GitFork size={15} weight="duotone" />} label="Repositories" count={18} indent />
      <SidebarRow icon={<BracketsCurly size={15} />} label="APIs" count={0} indent />
      <SidebarRow icon={<BracketsCurly size={15} />} label="Endpoints" count={296} indent />
    </aside>
  );
}

function SidebarRow({
  icon,
  label,
  count,
  active,
  indent,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active?: boolean;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] leading-5 ${
        active ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#202124] hover:bg-[#f1f3f4]"
      } ${indent ? "pl-7" : ""}`}
    >
      <span className={active ? "text-[#1a73e8]" : "text-[#5f6368]"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span
        className={`text-[12px] tabular-nums ${
          active ? "text-[#1a73e8]" : "text-[#5f6368]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/* ----- Top filter bar ----- */

function TopFilterBar({
  search,
  onSearch,
  view,
  onViewChange,
  myTeamsOnly,
  onToggleMyTeams,
  env,
  onEnvChange,
}: {
  search: string;
  onSearch: (s: string) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  myTeamsOnly: boolean;
  onToggleMyTeams: () => void;
  env: string;
  onEnvChange: (e: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2.5">
      <div className="flex h-8 max-w-[640px] flex-1 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2">
        <MagnifyingGlass size={13} className="text-[#5f6368]" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by name or tags"
          className="w-full bg-transparent text-[12.5px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
        />
      </div>
      <TimeBadge />
      <ViewToggle value={view} onChange={onViewChange} />
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
      >
        <CaretRight size={11} className="text-[#5f6368]" />
        My Teams
      </button>
      <button
        type="button"
        onClick={onToggleMyTeams}
        aria-pressed={myTeamsOnly}
        aria-label="Toggle My Teams filter"
        className="inline-flex h-8 items-center"
      >
        <span
          className={`inline-flex h-4 w-7 items-center rounded-full px-0.5 transition-colors ${
            myTeamsOnly ? "bg-[#1a73e8]" : "bg-[#dadce0]"
          }`}
        >
          <span
            className={`h-3 w-3 rounded-full bg-white transition-transform ${
              myTeamsOnly ? "translate-x-3" : "translate-x-0"
            }`}
          />
        </span>
      </button>
      <EnvSelect value={env} onChange={onEnvChange} />
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-[#bdc1c6] bg-white px-2.5 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]"
      >
        <Plus size={12} weight="bold" />
        Filter
      </button>
    </div>
  );
}

function TimeBadge() {
  return (
    <div className="ml-auto flex items-center gap-2">
      <div className="relative inline-flex h-8 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white pl-2 pr-1 text-[12.5px] text-[#202124]">
        <span className="text-[10px] text-[#5f6368]">UTC+05:30</span>
        <span className="ml-1 inline-flex h-5 items-center rounded bg-[#e8f0fe] px-1 text-[11px] font-semibold text-[#1a73e8]">
          1h
        </span>
        <span>Past 1 Hour</span>
        <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
        <span className="mx-1 h-4 w-px bg-[#dadce0]" />
        <button
          type="button"
          aria-label="Pin time range"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <PushPin size={11} weight="bold" />
        </button>
        <button
          type="button"
          aria-label="Pause"
          className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#1a73e8] text-white"
        >
          <Pause size={10} weight="fill" />
        </button>
      </div>
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex h-8 overflow-hidden rounded-md border border-[#bdc1c6]">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`inline-flex items-center gap-1.5 px-2.5 text-[12.5px] ${
          value === "list"
            ? "bg-[#e8f0fe] text-[#1a73e8]"
            : "bg-white text-[#202124] hover:bg-[#f1f3f4]"
        }`}
      >
        <ListBullets size={12} />
        List
      </button>
      <button
        type="button"
        onClick={() => onChange("map")}
        className={`inline-flex items-center gap-1.5 px-2.5 text-[12.5px] ${
          value === "map"
            ? "bg-[#e8f0fe] text-[#1a73e8]"
            : "bg-white text-[#202124] hover:bg-[#f1f3f4]"
        }`}
      >
        <MapTrifold size={12} />
        Map
      </button>
    </div>
  );
}

function EnvSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="absolute -top-1.5 left-2 z-10 bg-white px-1 text-[10px] text-[#5f6368]">
        Env
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 appearance-none rounded-md border border-[#bdc1c6] bg-white pl-2.5 pr-7 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
      >
        <option value="prod">prod</option>
        <option value="staging">staging</option>
        <option value="dev">dev</option>
      </select>
      <CaretDown
        size={10}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#5f6368]"
      />
    </label>
  );
}

/* ----- Filter (Ownership / Reliability / Performance / etc) tabs ----- */

function FilterTabs({
  value,
  onChange,
}: {
  value: CatalogFilterTab;
  onChange: (v: CatalogFilterTab) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-[#e8eaed] bg-white px-4">
      {FILTER_TABS.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`relative inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px] ${
              active
                ? "font-semibold text-[#1a73e8]"
                : "text-[#5f6368] hover:text-[#202124]"
            }`}
          >
            <span className={active ? "text-[#1a73e8]" : "text-[#5f6368]"}>
              {tab.icon}
            </span>
            {tab.label}
            {active && (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1a73e8]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ----- List view ----- */

function CatalogListView({
  services,
  isLoading,
}: {
  services: ApmService[];
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-2 text-[12.5px] text-[#202124]">
        <span>
          <span className="font-semibold">{services.length}</span> Service
          {services.length === 1 ? "" : "s"}
        </span>
        <span className="text-[#dadce0]">|</span>
        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[#5f6368]">
          Group By
          <div className="relative">
            <select
              defaultValue="none"
              className="h-7 appearance-none rounded-md border border-[#bdc1c6] bg-white pl-2 pr-7 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <option value="none">None</option>
              <option value="team">Team</option>
              <option value="type">Type</option>
            </select>
            <CaretDown
              size={10}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#5f6368]"
            />
          </div>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]"
          >
            <Plus size={12} weight="bold" />
            Service
          </button>
          <button
            type="button"
            aria-label="Export"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <DownloadSimple size={13} />
          </button>
          <button
            type="button"
            aria-label="Configure columns"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <Faders size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <table className="min-w-[1100px] w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#e8eaed] text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">
              <th className="w-10 px-3 py-2 text-left">
                <span className="inline-flex items-center gap-1">↓<span aria-hidden>²</span></span>
              </th>
              <th className="w-8 px-1 py-2 text-left">
                <Star size={12} weight="fill" className="text-[#5f6368]" />
              </th>
              <th className="w-[80px] px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="w-[120px] px-3 py-2 text-left">Health</th>
              <th className="w-[150px] px-3 py-2 text-left">Last Deploy</th>
              <th className="w-[140px] px-3 py-2 text-left">Requests</th>
              <th className="w-[160px] px-3 py-2 text-left">Error Rate</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[#5f6368]">
                  Loading services…
                </td>
              </tr>
            )}
            {!isLoading && services.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[#5f6368]">
                  No services match the current filters.
                </td>
              </tr>
            )}
            {!isLoading && services.map((s) => <CatalogRow key={s.id} service={s} />)}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end border-t border-[#e8eaed] bg-white px-4 py-2 text-[12px] text-[#5f6368]">
        Entries per page:&nbsp;
        <select
          defaultValue="50"
          className="h-7 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124]"
        >
          <option>25</option>
          <option>50</option>
          <option>100</option>
        </select>
      </div>
    </div>
  );
}

function CatalogRow({ service }: { service: ApmService }) {
  const [starred, setStarred] = useState(Boolean(service.starred));
  const typeColor: Record<ApmService["type"], string> = {
    web: "#1a73e8",
    db: "#7c4dff",
    cache: "#f9a825",
    custom: "#5f6368",
  };
  return (
    <tr className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fb]">
      <td className="px-3 py-2.5"></td>
      <td className="px-1 py-2.5">
        <button
          type="button"
          onClick={() => setStarred((v) => !v)}
          aria-label={starred ? "Unstar service" : "Star service"}
          className="text-[#bdc1c6] hover:text-[#fbbc04]"
        >
          <Star
            size={14}
            weight={starred ? "fill" : "regular"}
            className={starred ? "text-[#fbbc04]" : ""}
          />
        </button>
      </td>
      <td className="px-3 py-2.5">
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: typeColor[service.type] ?? "#5f6368" }}
          title={service.type}
        >
          {service.type === "db" ? (
            <Database size={11} weight="fill" />
          ) : service.type === "cache" ? (
            <Stack size={11} weight="fill" />
          ) : (
            <span className="block h-2 w-2 rounded-full bg-white" />
          )}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <Link
          href={`/apm/services/${service.id}`}
          className="font-semibold text-[#202124] hover:text-[#1a73e8]"
        >
          {service.name}
        </Link>
      </td>
      <td className="px-3 py-2.5">
        <HealthDot health={service.health} />
      </td>
      <td className="px-3 py-2.5 text-[#1a73e8]">
        {service.lastDeployMinutesAgo === null ? (
          <span className="text-[#5f6368]">—</span>
        ) : (
          <span className="hover:underline">
            {formatDeploy(service.lastDeployMinutesAgo)}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-[#202124]">
        {formatRequestRate(service.requestsPerSec)}{" "}
        <span className="text-[12px] text-[#5f6368]">req/s</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={
              service.errorRate && service.errorRate > 0.001
                ? "text-[#d93025]"
                : "text-[#202124]"
            }
          >
            {formatErrorPct(service.errorRate)}
          </span>
          <div className="h-1 w-24 rounded-full bg-[#e8eaed]">
            <div
              className="h-full rounded-full bg-[#34a853]"
              style={{
                width: `${Math.min(100, Math.max(2, (service.errorRate ?? 0) * 100))}%`,
                background:
                  service.errorRate && service.errorRate > 0.05
                    ? "#d93025"
                    : "#34a853",
              }}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}

function HealthDot({ health }: { health: ApmService["health"] }) {
  const color =
    health === "critical"
      ? "#ea4335"
      : health === "warn"
        ? "#fbbc04"
        : "#34a853";
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />;
}

/* ----- Map view ----- */

function CatalogMapView({
  env,
  serviceCount,
}: {
  env: string;
  serviceCount: number;
}) {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <ServiceMapCanvas env={env} totalServices={serviceCount} />
    </div>
  );
}

/* ----- Footer ----- */

function PortalFooter() {
  return (
    <footer className="flex items-center justify-center gap-3 border-t border-[#e8eaed] bg-white px-4 py-2 text-[11.5px] text-[#5f6368]">
      <span>Copyright Datadog, Inc. 2026 - 35.112301602</span>
      <span>·</span>
      <span className="text-[#1a73e8] hover:underline cursor-pointer">Master Subscription Agreement</span>
      <span>·</span>
      <span className="text-[#1a73e8] hover:underline cursor-pointer">Privacy Policy</span>
      <span>·</span>
      <span className="text-[#1a73e8] hover:underline cursor-pointer">Cookie Policy</span>
      <span>·</span>
      <span className="text-[#1a73e8] hover:underline cursor-pointer">Datadog Status →</span>
      <span className="ml-2 inline-flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-[#34a853]" />
        All Systems Operational
      </span>
    </footer>
  );
}
