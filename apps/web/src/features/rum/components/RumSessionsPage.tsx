"use client";

import {
  ArrowDown,
  Browser,
  Bug,
  Cursor,
  CursorClick,
  Eye,
  FileText,
  GlobeHemisphereWest,
  MagnifyingGlass,
  Plus,
  User,
  Warning,
  WindowsLogo,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRumApplications, useRumSessions } from "../hooks";
import type { RumSessionListItem } from "../types";
import { RumHeader } from "./RumHeader";

const SESSION_TABS = [
  { key: "Search Recordings", href: "/rum/session-replay" },
  { key: "Playlists", href: "/rum/session-replay?tab=playlists" },
  { key: "Heatmaps", href: "/rum/session-replay?tab=heatmaps" },
];

export function RumSessionsPage() {
  const range = useMemo(() => {
    const to = Date.now();
    return { fromMs: to - 24 * 60 * 60 * 1000, toMs: to };
  }, []);

  const { data: apps = [] } = useRumApplications();
  const app = apps[0];

  const [minActions, setMinActions] = useState<number | null>(4);
  const [minTimeSpent, setMinTimeSpent] = useState<number | null>(45);
  const [minViews, setMinViews] = useState<number | null>(null);
  const [minErrors, setMinErrors] = useState<number | null>(null);
  const [minFrustrations, setMinFrustrations] = useState<number | null>(null);
  const [hasError, setHasError] = useState<boolean | null>(null);
  const [country, setCountry] = useState<string>("");
  const [browser, setBrowser] = useState<string>("");
  const [device, setDevice] = useState<string>("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<typeof SESSION_TABS[number]["key"]>(
    "Search Recordings",
  );

  const sessions = useRumSessions({
    appId: app?.id,
    range,
    limit: 100,
    minActions: minActions ?? undefined,
    minTimeSpentSeconds: minTimeSpent ?? undefined,
    minViews: minViews ?? undefined,
    minErrors: minErrors ?? undefined,
    minFrustrations: minFrustrations ?? undefined,
    country: country || undefined,
    browser: browser || undefined,
    device: device || undefined,
    hasError: hasError ?? undefined,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions.data ?? [];
    const q = search.toLowerCase();
    return (sessions.data ?? []).filter(
      (s) =>
        (s.userName ?? "").toLowerCase().includes(q) ||
        (s.userEmail ?? "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }, [sessions.data, search]);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <RumHeader range={range} />

      <div className="border-b border-[#e8eaed] bg-white px-4">
        <div className="flex items-center gap-1">
          {SESSION_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`relative inline-flex h-10 items-center px-3 text-[13px] ${
                activeTab === t.key
                  ? "font-semibold text-[#202124]"
                  : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              {t.key}
              {activeTab === t.key && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#1a73e8]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-6 py-5">
          <FilterPanel
            search={search}
            onSearch={setSearch}
            minViews={minViews}
            setMinViews={setMinViews}
            minActions={minActions}
            setMinActions={setMinActions}
            minErrors={minErrors}
            setMinErrors={setMinErrors}
            minFrustrations={minFrustrations}
            setMinFrustrations={setMinFrustrations}
            minTimeSpent={minTimeSpent}
            setMinTimeSpent={setMinTimeSpent}
            hasError={hasError}
            setHasError={setHasError}
            country={country}
            setCountry={setCountry}
            browser={browser}
            setBrowser={setBrowser}
            device={device}
            setDevice={setDevice}
          />

          <SessionsList
            isLoading={sessions.isLoading}
            sessions={filtered}
          />
        </div>
      </div>
    </div>
  );
}

function FilterPanel(props: {
  search: string;
  onSearch: (v: string) => void;
  minViews: number | null;
  setMinViews: (v: number | null) => void;
  minActions: number | null;
  setMinActions: (v: number | null) => void;
  minErrors: number | null;
  setMinErrors: (v: number | null) => void;
  minFrustrations: number | null;
  setMinFrustrations: (v: number | null) => void;
  minTimeSpent: number | null;
  setMinTimeSpent: (v: number | null) => void;
  hasError: boolean | null;
  setHasError: (v: boolean | null) => void;
  country: string;
  setCountry: (v: string) => void;
  browser: string;
  setBrowser: (v: string) => void;
  device: string;
  setDevice: (v: string) => void;
}) {
  return (
    <section className="rounded-md border border-[#e8eaed] bg-white p-4 shadow-[0_1px_0_rgba(60,64,67,0.06)]">
      <div className="mb-3 text-[10.5px] font-medium uppercase tracking-wide text-[#5f6368]">
        Filter for sessions with attributes
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-[280px] flex-col gap-1">
          <label className="text-[10px] tracking-wide text-[#5f6368]">User search</label>
          <div className="flex h-7 items-center gap-1.5 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px]">
            <MagnifyingGlass size={12} className="text-[#5f6368]" />
            <input
              value={props.search}
              onChange={(e) => props.onSearch(e.target.value)}
              placeholder="Search for sessions by user"
              className="flex-1 outline-none placeholder:text-[#9aa0a6]"
            />
          </div>
        </div>

        <NumericFilter label="View Count" value={props.minViews} onChange={props.setMinViews} />
        <NumericFilter label="Action Count" value={props.minActions} onChange={props.setMinActions} />
        <NumericFilter label="Error Count" value={props.minErrors} onChange={props.setMinErrors} />
        <NumericFilter
          label="Session Frustration Count"
          value={props.minFrustrations}
          onChange={props.setMinFrustrations}
        />

        <div className="flex w-[120px] flex-col gap-1">
          <label className="text-[10px] tracking-wide text-[#5f6368]">Is Active</label>
          <select
            className="h-7 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px]"
            value={props.hasError === null ? "all" : props.hasError ? "true" : "false"}
            onChange={(e) =>
              props.setHasError(
                e.target.value === "all" ? null : e.target.value === "true",
              )
            }
          >
            <option value="all">All</option>
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        </div>

        <div className="flex w-[140px] flex-col gap-1">
          <label className="text-[10px] tracking-wide text-[#5f6368]">Env</label>
          <select className="h-7 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px]" disabled>
            <option>All</option>
          </select>
        </div>

        <NumericFilter
          label="Time Spent (seconds)"
          value={props.minTimeSpent}
          onChange={props.setMinTimeSpent}
          unit="s"
          step={5}
        />

        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]"
        >
          <Plus size={12} weight="bold" /> Filter
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <ChoiceFilter
          label="Country"
          value={props.country}
          options={[
            "United States",
            "United Kingdom",
            "Germany",
            "France",
            "India",
            "Japan",
            "Canada",
            "Brazil",
            "Australia",
            "Netherlands",
            "Singapore",
          ]}
          onChange={props.setCountry}
        />
        <ChoiceFilter
          label="Browser"
          value={props.browser}
          options={["Chrome", "Safari", "Edge", "Firefox", "Opera", "Samsung Internet"]}
          onChange={props.setBrowser}
        />
        <ChoiceFilter
          label="Device"
          value={props.device}
          options={["desktop", "mobile", "tablet"]}
          onChange={props.setDevice}
        />
      </div>

      <div className="mt-5 border-t border-[#e8eaed] pt-3 text-[10.5px] font-medium uppercase tracking-wide text-[#5f6368]">
        Where users did
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#dadce0] bg-[#f8f9fb] text-[12px]">
          1
        </span>
        <button className="inline-flex h-7 flex-1 items-center justify-between rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#5f6368]">
          Select a view or action event
          <ArrowDown size={10} />
        </button>
      </div>
      <div className="mt-2 text-[12.5px] text-[#1a73e8]">
        <Plus size={11} className="mr-1 inline" />
        Then did
      </div>
    </section>
  );
}

function NumericFilter({
  label,
  value,
  onChange,
  unit,
  step = 1,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  step?: number;
}) {
  return (
    <div className="flex w-[140px] flex-col gap-1">
      <label className="text-[10px] tracking-wide text-[#5f6368]">{label}</label>
      <div className="flex h-7 items-center rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px]">
        <span className="mr-1 text-[#5f6368]">≥</span>
        <input
          type="number"
          step={step}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          className="w-full outline-none"
          placeholder="—"
        />
        {unit && <span className="ml-1 text-[#5f6368]">{unit}</span>}
      </div>
    </div>
  );
}

function ChoiceFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex w-[180px] flex-col gap-1">
      <label className="text-[10px] tracking-wide text-[#5f6368]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function SessionsList({
  isLoading,
  sessions,
}: {
  isLoading: boolean;
  sessions: RumSessionListItem[];
}) {
  if (isLoading) {
    return (
      <div className="rounded border border-dashed border-[#dadce0] bg-white py-16 text-center text-[13px] text-[#5f6368]">
        Loading sessions…
      </div>
    );
  }
  if (sessions.length === 0) {
    return (
      <div className="rounded border border-dashed border-[#dadce0] bg-white py-16 text-center text-[#5f6368]">
        <CursorClick size={32} weight="duotone" className="mx-auto text-[#a142f4]" />
        <div className="mt-2 text-[13px]">No sessions match these filters.</div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-[#e8eaed] bg-white shadow-[0_1px_0_rgba(60,64,67,0.06)]">
      <div className="border-b border-[#e8eaed] bg-[#f8f9fb] px-3 py-2 text-[11px] uppercase tracking-wide text-[#5f6368]">
        {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
      </div>
      <ul>
        {sessions.map((s) => (
          <li
            key={s.id}
            className="border-b border-[#f1f3f4] last:border-b-0 hover:bg-[#f8f9fb]"
          >
            <Link
              href={`/rum/session-replay/${encodeURIComponent(s.id)}`}
              className="block px-4 py-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8]">
                    {s.userName ? (
                      <span className="text-[13px] font-semibold">
                        {initials(s.userName)}
                      </span>
                    ) : (
                      <User size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-medium text-[#202124]">
                        {s.userName ?? "Anonymous"}
                      </span>
                      {s.userEmail && (
                        <span className="text-[12.5px] text-[#5f6368]">
                          {s.userEmail}
                        </span>
                      )}
                      {s.errorCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-sm bg-[#fce8e6] px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-[#c5221f]">
                          <Warning size={10} weight="fill" />
                          {s.errorCount} error{s.errorCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {s.frustrationCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-sm bg-[#fef7e0] px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-[#a56b00]">
                          {s.frustrationCount}× frustration
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-[#5f6368]">
                      <span className="inline-flex items-center gap-1">
                        <FileText size={12} /> {s.entryPath ?? "—"} → {s.finalPath ?? "—"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <GlobeHemisphereWest size={12} />
                        {s.city ? `${s.city}, ` : ""}
                        {s.country ?? "—"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Browser size={12} /> {s.browser ?? "—"} {s.browserVersion ?? ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <WindowsLogo size={12} /> {s.os ?? "—"} · {s.deviceType ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-start gap-4 text-[12px] text-[#5f6368]">
                  <Stat label="Views" value={s.viewCount} icon={<Eye size={11} />} />
                  <Stat label="Actions" value={s.actionCount} icon={<Cursor size={11} />} />
                  <Stat label="Time" value={fmtDuration(s.timeSpentMs)} />
                  <Stat label="Started" value={fmtRelative(s.startedAtMs)} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end">
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-[#9aa0a6]">
        {icon}
        {label}
      </span>
      <span className="text-[13px] font-medium tabular-nums text-[#202124]">
        {value}
      </span>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function fmtDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtRelative(ms: number | null): string {
  if (ms == null) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
