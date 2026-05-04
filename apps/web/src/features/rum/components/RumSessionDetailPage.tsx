"use client";

import {
  ArrowLeft,
  Browser,
  Bug,
  Cursor,
  CursorClick,
  Eye,
  GlobeHemisphereWest,
  Keyboard,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Spinner,
  User,
  Warning,
  WindowsLogo,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRumSession } from "../hooks";
import type { RumTimelineEvent } from "../types";

const EVENT_COLORS: Record<RumTimelineEvent["type"], string> = {
  view: "#1a73e8",
  action: "#0f9d58",
  error: "#db4437",
  resource: "#a142f4",
  long_task: "#f4b400",
};

const EVENT_LABEL: Record<RumTimelineEvent["type"], string> = {
  view: "View",
  action: "Action",
  error: "Error",
  resource: "Resource",
  long_task: "Long Task",
};

export function RumSessionDetailPage({ sessionId }: { sessionId: string }) {
  const { data: session, isLoading, error } = useRumSession(sessionId);

  const [playing, setPlaying] = useState(false);
  const [cursorMs, setCursorMs] = useState(0);
  const animFrame = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const cursorStartRef = useRef<number>(0);

  const durationMs = session?.durationMs ?? 0;

  useEffect(() => {
    if (!playing) {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      return;
    }
    startedAtRef.current = performance.now();
    cursorStartRef.current = cursorMs;
    const tick = () => {
      const elapsed = performance.now() - startedAtRef.current;
      const next = cursorStartRef.current + elapsed * 4;
      if (next >= durationMs) {
        setCursorMs(durationMs);
        setPlaying(false);
        return;
      }
      setCursorMs(next);
      animFrame.current = requestAnimationFrame(tick);
    };
    animFrame.current = requestAnimationFrame(tick);
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [playing, durationMs]);

  const activeView = useMemo(() => {
    if (!session) return null;
    let lastView: RumTimelineEvent | null = null;
    for (const e of session.timeline) {
      if (e.type === "view" && e.tOffsetMs <= cursorMs) lastView = e;
    }
    return lastView;
  }, [session, cursorMs]);

  const visibleEvents = useMemo(() => {
    if (!session) return [];
    return session.timeline.filter((e) => e.tOffsetMs <= cursorMs);
  }, [session, cursorMs]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f8f9fb] text-[13px] text-[#5f6368]">
        <Spinner size={20} className="mr-2 animate-spin" /> Loading session…
      </div>
    );
  }
  if (error || !session) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f8f9fb] text-[13px] text-[#5f6368]">
        Session not found.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <header className="flex items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2.5">
        <Link
          href="/rum/session-replay"
          className="inline-flex h-7 items-center gap-1 rounded border border-[#bdc1c6] bg-white px-2 text-[12.5px] hover:bg-[#f1f3f4]"
        >
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="ml-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8]">
            <User size={14} />
          </div>
          <div>
            <div className="text-[13px] font-semibold">
              {session.userName ?? "Anonymous user"}
            </div>
            <div className="text-[11.5px] text-[#5f6368]">
              {session.userEmail ?? `Session ${session.id.slice(0, 8)}…`}
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3 text-[12px] text-[#5f6368]">
          <span className="inline-flex items-center gap-1">
            <Eye size={12} /> {session.viewCount} views
          </span>
          <span className="inline-flex items-center gap-1">
            <Cursor size={12} /> {session.actionCount} actions
          </span>
          <span className="inline-flex items-center gap-1 text-[#c5221f]">
            <Warning size={12} weight="fill" /> {session.errorCount} errors
          </span>
          <span>{fmtDuration(session.durationMs)}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center overflow-hidden bg-[#1c1d1f] p-6">
            <div className="flex h-full max-h-[640px] w-full max-w-[1100px] flex-col overflow-hidden rounded-md border border-[#3c4043] bg-white shadow-2xl">
              <BrowserChrome url={activeView?.viewUrl ?? "about:blank"} />
              <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-[#fafbff] to-[#f1f5fc]">
                <ReplayCanvas
                  view={activeView}
                  events={visibleEvents}
                  cursorMs={cursorMs}
                />
              </div>
            </div>
          </div>

          <PlayerBar
            durationMs={durationMs}
            cursorMs={cursorMs}
            onSeek={setCursorMs}
            playing={playing}
            onPlayToggle={() => setPlaying((p) => !p)}
            timeline={session.timeline}
          />
        </main>

        <aside className="w-[360px] flex-shrink-0 overflow-y-auto border-l border-[#e8eaed] bg-white">
          <SessionMeta session={session} />
          <EventsList
            events={session.timeline}
            cursorMs={cursorMs}
            onSelect={setCursorMs}
          />
        </aside>
      </div>
    </div>
  );
}

function BrowserChrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#e8eaed] bg-[#f1f3f4] px-3 py-1.5">
      <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
      <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
      <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      <div className="ml-2 flex h-6 flex-1 items-center rounded bg-white px-2 text-[12px] text-[#5f6368]">
        {url}
      </div>
    </div>
  );
}

function ReplayCanvas({
  view,
  events,
  cursorMs,
}: {
  view: RumTimelineEvent | null;
  events: RumTimelineEvent[];
  cursorMs: number;
}) {
  // The "stub" replay: we render a stylized representation of the active view
  // — title, key metrics, latest action/error pulse — instead of a real DOM
  // recording. Datadog's player would normally show the rrweb-recorded DOM
  // here.
  const lastAction = [...events].reverse().find((e) => e.type === "action");
  const lastError = [...events].reverse().find((e) => e.type === "error");

  if (!view) {
    return (
      <div className="text-center text-[13px] text-[#9aa0a6]">
        Replay starts at the first view event.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-10 py-8 text-center">
      <div className="text-[12.5px] uppercase tracking-wide text-[#9aa0a6]">
        Currently viewing
      </div>
      <div className="mt-1 text-[28px] font-semibold text-[#202124]">
        {view.viewPath}
      </div>
      <div className="mt-1 text-[13px] text-[#5f6368]">
        {(view.attributes["view.title"] as string | undefined) ?? "Untitled"}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 text-[12px]">
        <Metric label="Loading" value={fmtMs(view.loadingTimeMs)} />
        <Metric label="LCP" value={fmtMs(view.lcpMs)} />
        <Metric label="FCP" value={fmtMs(view.fcpMs)} />
        <Metric label="INP" value={fmtMs(view.inpMs)} />
        <Metric label="CLS" value={view.cls != null ? view.cls.toFixed(3) : "—"} />
        <Metric label="Time on view" value={fmtMs(view.timeSpentMs)} />
      </div>

      {lastAction && lastAction.tOffsetMs > cursorMs - 4000 && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#0f9d58] bg-[#e6f4ea] px-3 py-1 text-[12px] text-[#0f9d58]">
          <CursorClick size={12} weight="fill" /> {lastAction.actionName}
        </div>
      )}
      {lastError && lastError.tOffsetMs > cursorMs - 6000 && (
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#db4437] bg-[#fce8e6] px-3 py-1 text-[12px] text-[#db4437]">
          <Bug size={12} weight="fill" /> {lastError.errorMessage}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-[180px] flex-col items-center rounded border border-[#e8eaed] bg-white px-3 py-2">
      <span className="text-[10.5px] uppercase tracking-wide text-[#9aa0a6]">{label}</span>
      <span className="mt-0.5 text-[15px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function PlayerBar({
  durationMs,
  cursorMs,
  onSeek,
  playing,
  onPlayToggle,
  timeline,
}: {
  durationMs: number;
  cursorMs: number;
  onSeek: (ms: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  timeline: RumTimelineEvent[];
}) {
  return (
    <div className="border-t border-[#e8eaed] bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onSeek(Math.max(0, cursorMs - 5000))}
          className="rounded p-1.5 hover:bg-[#f1f3f4]"
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          onClick={onPlayToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1a73e8] text-white hover:bg-[#0058a3]"
        >
          {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
        </button>
        <button
          type="button"
          onClick={() => onSeek(Math.min(durationMs, cursorMs + 5000))}
          className="rounded p-1.5 hover:bg-[#f1f3f4]"
        >
          <SkipForward size={14} />
        </button>

        <div className="text-[12px] tabular-nums text-[#5f6368]">
          {fmtDuration(cursorMs)} / {fmtDuration(durationMs)}
        </div>

        <div className="relative flex-1">
          <div className="h-1.5 rounded-full bg-[#e8eaed]" />
          <div
            className="absolute top-0 left-0 h-1.5 rounded-full bg-[#1a73e8]"
            style={{ width: `${(cursorMs / Math.max(1, durationMs)) * 100}%` }}
          />
          {timeline.map((e, i) => {
            if (e.type === "view") return null;
            const left = (e.tOffsetMs / Math.max(1, durationMs)) * 100;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSeek(e.tOffsetMs)}
                style={{ left: `${left}%`, backgroundColor: EVENT_COLORS[e.type] }}
                className="absolute -top-0.5 h-2.5 w-1 -translate-x-1/2 rounded-sm"
                title={EVENT_LABEL[e.type]}
              />
            );
          })}
          <input
            type="range"
            min={0}
            max={durationMs}
            value={cursorMs}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 h-1.5 w-full cursor-pointer opacity-0"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-[#5f6368]">
        {Object.entries(EVENT_LABEL).map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: EVENT_COLORS[k as RumTimelineEvent["type"]] }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SessionMeta({
  session,
}: {
  session: NonNullable<ReturnType<typeof useRumSession>["data"]>;
}) {
  return (
    <div className="border-b border-[#e8eaed] px-4 py-4">
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <Meta label="User" value={session.userName ?? "Anonymous"} />
        <Meta label="Email" value={session.userEmail ?? "—"} />
        <Meta
          label="Country"
          value={
            <span className="inline-flex items-center gap-1">
              <GlobeHemisphereWest size={11} /> {session.city ? `${session.city}, ` : ""}
              {session.country ?? "—"}
            </span>
          }
        />
        <Meta
          label="Browser"
          value={
            <span className="inline-flex items-center gap-1">
              <Browser size={11} /> {session.browser ?? "—"}
            </span>
          }
        />
        <Meta
          label="OS"
          value={
            <span className="inline-flex items-center gap-1">
              <WindowsLogo size={11} /> {session.os ?? "—"}
            </span>
          }
        />
        <Meta
          label="Device"
          value={
            <span className="inline-flex items-center gap-1">
              <Keyboard size={11} /> {session.deviceType ?? "—"}
            </span>
          }
        />
        <Meta label="Version" value={session.version ?? "—"} />
        <Meta label="Duration" value={fmtDuration(session.durationMs)} />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] uppercase tracking-wide text-[#9aa0a6]">{label}</span>
      <span className="text-[#202124]">{value}</span>
    </div>
  );
}

function EventsList({
  events,
  cursorMs,
  onSelect,
}: {
  events: RumTimelineEvent[];
  cursorMs: number;
  onSelect: (offset: number) => void;
}) {
  return (
    <div>
      <div className="px-4 py-2 text-[10.5px] font-medium uppercase tracking-wide text-[#5f6368]">
        Events ({events.length})
      </div>
      <ul>
        {events.map((e, i) => {
          const active =
            cursorMs >= e.tOffsetMs &&
            (i === events.length - 1 || cursorMs < events[i + 1].tOffsetMs);
          return (
            <li
              key={i}
              className={`border-b border-[#f1f3f4] last:border-b-0 ${
                active ? "bg-[#e8f0fe]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(e.tOffsetMs)}
                className="flex w-full items-start gap-2 px-4 py-2 text-left hover:bg-[#f8f9fb]"
              >
                <span
                  className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: EVENT_COLORS[e.type] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="font-medium text-[#202124]">
                      {EVENT_LABEL[e.type]}
                    </span>
                    <span className="text-[11px] tabular-nums text-[#9aa0a6]">
                      {fmtDuration(e.tOffsetMs)}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-[#5f6368]">
                    {eventDescription(e)}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function eventDescription(e: RumTimelineEvent): string {
  if (e.type === "view") return e.viewPath ?? "view";
  if (e.type === "action") return e.actionName ?? "action";
  if (e.type === "error") return e.errorMessage ?? "error";
  if (e.type === "resource")
    return `${e.resourceMethod ?? ""} ${e.resourceUrl ?? ""} (${
      e.resourceStatus ?? "—"
    })`;
  if (e.type === "long_task")
    return `${e.longTaskDurationMs ?? "?"}ms long task`;
  return "";
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms} ms`;
}

function fmtDuration(ms: number): string {
  if (!ms || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
