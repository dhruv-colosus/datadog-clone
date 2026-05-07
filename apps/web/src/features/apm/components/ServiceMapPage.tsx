"use client";

import {
  BracketsCurly,
  Buildings,
  CaretDown,
  Database,
  DeviceMobile,
  Faders,
  GearSix,
  GitFork,
  Globe,
  Lightning,
  ListBullets,
  MagnifyingGlass,
  MapTrifold,
  Plus,
  Question,
  Stack,
  Star,
  TreeStructure,
  Users,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TimeRangePicker } from "@/components/ui/TimeRangePicker";
import { useApmServiceMap } from "../hooks";
import { useApmHomeStore, useApmTracesStore } from "../store";
import type {
  ApmServiceMapEdge,
  ApmServiceMapNode,
  ApmServiceType,
} from "../types";
import { ApmHeader } from "./ApmHeader";

type LayoutMode = "cluster" | "flow";

const HEALTH_FILL: Record<string, string> = {
  ok: "#34a853",
  warning: "#fbbc04",
  critical: "#ea4335",
};

const HEALTH_GLOW: Record<string, string> = {
  ok: "rgba(52, 168, 83, 0.55)",
  warning: "rgba(251, 188, 4, 0.55)",
  critical: "rgba(234, 67, 53, 0.55)",
};

// Topology tier — entry points on the left, leaves on the right.
const TIER_BY_SERVICE: Record<string, number> = {
  caddy: 0,
  web: 1,
  api: 2,
  auth: 3,
  payments: 3,
  worker: 4,
  postgres: 5,
  redis: 5,
};

const MIN_R = 30;
const MAX_R = 70;

type Position = {
  x: number;
  y: number;
  r: number;
  node: ApmServiceMapNode;
};

type Layout = {
  positions: Map<string, Position>;
  width: number;
  height: number;
};

function radiusFor(rps: number, minRps: number, maxRps: number): number {
  const range = maxRps - minRps;
  if (range <= 0) return (MIN_R + MAX_R) / 2;
  // sqrt scaling so low-rps nodes don't disappear
  const t = Math.sqrt(Math.max(0, rps - minRps) / range);
  return MIN_R + t * (MAX_R - MIN_R);
}

function flowLayout(
  nodes: ApmServiceMapNode[],
  radii: Map<string, number>,
): Layout {
  const COL_GAP = 240;
  const ROW_GAP = 50;
  const PAD_X = 110;
  const PAD_Y = 80;

  const byTier = new Map<number, ApmServiceMapNode[]>();
  for (const n of nodes) {
    const t = TIER_BY_SERVICE[n.service] ?? 3;
    const list = byTier.get(t) ?? [];
    list.push(n);
    byTier.set(t, list);
  }
  for (const [, list] of byTier) {
    list.sort((a, b) => a.service.localeCompare(b.service));
  }

  const tiers = Array.from(byTier.keys()).sort((a, b) => a - b);
  const colHeight = (list: ApmServiceMapNode[]): number => {
    let h = 0;
    list.forEach((n, i) => {
      const r = radii.get(n.service) ?? MIN_R;
      h += r * 2;
      if (i < list.length - 1) h += ROW_GAP;
    });
    return h;
  };
  const heights = tiers.map((t) => colHeight(byTier.get(t)!));
  const maxColH = Math.max(...heights, 1);

  const positions = new Map<string, Position>();
  let maxX = 0;
  let maxY = 0;

  tiers.forEach((tier, ti) => {
    const list = byTier.get(tier)!;
    const colH = colHeight(list);
    let yCursor = PAD_Y + (maxColH - colH) / 2;
    list.forEach((n) => {
      const r = radii.get(n.service) ?? MIN_R;
      const x = PAD_X + ti * COL_GAP + r;
      const y = yCursor + r;
      positions.set(n.service, { x, y, r, node: n });
      yCursor += r * 2 + ROW_GAP;
      maxX = Math.max(maxX, x + r + 130);
      maxY = Math.max(maxY, y + r);
    });
  });

  return {
    positions,
    width: maxX + PAD_X,
    height: maxY + PAD_Y,
  };
}

function clusterLayout(
  nodes: ApmServiceMapNode[],
  radii: Map<string, number>,
): Layout {
  if (nodes.length === 0) return { positions: new Map(), width: 800, height: 500 };

  // Place busiest service in the center; rest on rings around it.
  const sorted = [...nodes].sort((a, b) => b.rps - a.rps);
  const center = sorted[0];
  const rest = sorted.slice(1);

  const cx = 600;
  const cy = 380;
  const positions = new Map<string, Position>();
  positions.set(center.service, {
    x: cx,
    y: cy,
    r: radii.get(center.service) ?? MIN_R,
    node: center,
  });

  const ringSize = Math.min(rest.length, 7);
  const ring1 = rest.slice(0, ringSize);
  const ring2 = rest.slice(ringSize);

  const placeRing = (group: ApmServiceMapNode[], ringR: number) => {
    const n = group.length;
    if (n === 0) return;
    group.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * ringR;
      const y = cy + Math.sin(angle) * ringR;
      positions.set(node.service, {
        x,
        y,
        r: radii.get(node.service) ?? MIN_R,
        node,
      });
    });
  };
  placeRing(ring1, 240);
  if (ring2.length) placeRing(ring2, 380);

  // Re-anchor so the bounding box starts at a comfortable padding.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x - p.r - 20);
    minY = Math.min(minY, p.y - p.r - 20);
    maxX = Math.max(maxX, p.x + p.r + 130);
    maxY = Math.max(maxY, p.y + p.r + 20);
  }
  const PAD = 80;
  const dx = PAD - minX;
  const dy = PAD - minY;
  for (const p of positions.values()) {
    p.x += dx;
    p.y += dy;
  }

  return {
    positions,
    width: maxX - minX + PAD * 2,
    height: maxY - minY + PAD * 2,
  };
}

function edgeEndpoints(
  a: Position,
  b: Position,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x1: a.x + ux * (a.r + 4),
    y1: a.y + uy * (a.r + 4),
    x2: b.x - ux * (b.r + 4),
    y2: b.y - uy * (b.r + 4),
  };
}

function edgeHealthColor(
  edge: ApmServiceMapEdge,
  byName: Map<string, ApmServiceMapNode>,
): { stroke: string; key: "ok" | "warning" | "critical" | "muted" } {
  if (edge.calls === 0) return { stroke: "#dadce0", key: "muted" };
  const errRate = edge.errorRate ?? edge.errors / edge.calls;
  if (errRate > 0.05) return { stroke: HEALTH_FILL.critical, key: "critical" };
  const callee = byName.get(edge.callee);
  if (callee?.healthState === "warning")
    return { stroke: HEALTH_FILL.warning, key: "warning" };
  if (callee?.healthState === "critical")
    return { stroke: HEALTH_FILL.critical, key: "critical" };
  return { stroke: HEALTH_FILL.ok, key: "ok" };
}

function ServiceIcon({
  type,
  size,
}: {
  type: ApmServiceType;
  size: number;
}) {
  const color = "#202124";
  if (type === "db") return <Database size={size} color={color} weight="regular" />;
  if (type === "cache") return <Lightning size={size} color={color} weight="regular" />;
  if (type === "custom") return <GearSix size={size} color={color} weight="regular" />;
  return <Globe size={size} color={color} weight="regular" />;
}

export function ServiceMapPage() {
  const router = useRouter();
  const env = useApmHomeStore((s) => s.envFilter);
  const setEnv = useApmHomeStore((s) => s.setEnvFilter);
  const range = useApmTracesStore((s) => s.timeRange);
  const setRange = useApmTracesStore((s) => s.setTimeRange);
  const lookback = Math.max(
    60,
    Math.min(86400, Math.round((range.toMs - range.fromMs) / 1000)),
  );
  const { data, isLoading } = useApmServiceMap(env, lookback);
  const [hovered, setHovered] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("cluster");
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "tier" | "team" | "type">("none");
  const [myTeamsOnly, setMyTeamsOnly] = useState(false);

  const filteredNodes = useMemo(() => {
    const all = data?.nodes ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (n) =>
        n.service.toLowerCase().includes(q) ||
        (n.team ?? "").toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q),
    );
  }, [data, search]);

  const filteredEdges = useMemo(() => {
    if (!data) return [];
    const present = new Set(filteredNodes.map((n) => n.service));
    return data.edges.filter(
      (e) => present.has(e.caller) && present.has(e.callee),
    );
  }, [data, filteredNodes]);

  const radii = useMemo(() => {
    const map = new Map<string, number>();
    if (!filteredNodes.length) return map;
    const rpsValues = filteredNodes.map((n) => n.rps);
    const minRps = Math.min(...rpsValues);
    const maxRps = Math.max(...rpsValues);
    for (const n of filteredNodes) {
      map.set(n.service, radiusFor(n.rps, minRps, maxRps));
    }
    return map;
  }, [filteredNodes]);

  const layout = useMemo(() => {
    if (!filteredNodes.length) return null;
    return layoutMode === "cluster"
      ? clusterLayout(filteredNodes, radii)
      : flowLayout(filteredNodes, radii);
  }, [filteredNodes, layoutMode, radii]);

  const nodesByName = useMemo(() => {
    const m = new Map<string, ApmServiceMapNode>();
    for (const n of filteredNodes) m.set(n.service, n);
    return m;
  }, [filteredNodes]);

  const connectedToHover = useMemo(() => {
    if (!hovered) return null;
    const set = new Set<string>([hovered]);
    for (const e of filteredEdges) {
      if (e.caller === hovered) set.add(e.callee);
      if (e.callee === hovered) set.add(e.caller);
    }
    return set;
  }, [hovered, filteredEdges]);

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] pt-2 text-[#202124]">
      <ApmHeader>
        <TimeRangePicker value={range} onChange={setRange} />
        <button
          type="button"
          aria-label="Help"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          <Question size={14} weight="bold" />
        </button>
      </ApmHeader>

      <div className="flex flex-1 min-h-0">
      <CatalogSidebar nodes={filteredNodes} totalServices={data?.nodes.length ?? 0} />
      <div className="flex flex-1 min-w-0 flex-col">

      {/* Top toolbar */}
      <div className="flex items-center gap-2 border-b border-[#e8eaed] bg-white px-4 py-2">
        <div className="flex h-8 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2">
          <MagnifyingGlass size={13} className="text-[#5f6368]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or tags"
            className="w-[300px] bg-transparent text-[12.5px] text-[#202124] placeholder:text-[#5f6368] focus:outline-none"
          />
        </div>

        <ViewToggle
          value="map"
          onList={() => router.push("/apm/home")}
        />

        <button
          type="button"
          onClick={() => setMyTeamsOnly((v) => !v)}
          className={`inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-[12.5px] ${
            myTeamsOnly
              ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
              : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]"
          }`}
        >
          <Users size={12} />
          My Teams
          <span
            aria-hidden
            className={`ml-1 inline-flex h-3.5 w-7 items-center rounded-full px-0.5 transition-colors ${
              myTeamsOnly ? "bg-[#1a73e8]" : "bg-[#dadce0]"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                myTeamsOnly ? "translate-x-3" : "translate-x-0"
              }`}
            />
          </span>
        </button>

        <EnvSelect value={env} onChange={setEnv} />

        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-[#bdc1c6] bg-white px-2.5 text-[12.5px] text-[#1a73e8] hover:bg-[#f1f3f4]"
        >
          <Plus size={12} weight="bold" />
          Filter
        </button>
      </div>

      {/* Sub-toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-2">
        <div className="text-[12.5px] text-[#202124]">
          <span className="font-semibold">{filteredNodes.length}</span> APM service
          {filteredNodes.length === 1 ? "" : "s"}
        </div>
        <span className="text-[#dadce0]">|</span>

        <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[#5f6368]">
          Group By
          <div className="relative">
            <select
              value={groupBy}
              onChange={(e) =>
                setGroupBy(e.target.value as "none" | "tier" | "team" | "type")
              }
              className="h-7 appearance-none rounded-md border border-[#bdc1c6] bg-white pl-2 pr-7 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <option value="none">None</option>
              <option value="tier">Tier</option>
              <option value="team">Team</option>
              <option value="type">Type</option>
            </select>
            <CaretDown
              size={10}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#5f6368]"
            />
          </div>
        </label>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11.5px] text-[#5f6368]">
            Edges colored by{" "}
            <span className="underline decoration-dotted underline-offset-2">
              Service Health
            </span>
            :
            <LegendDot color={HEALTH_FILL.critical} label="Critical" />
            <LegendDot color={HEALTH_FILL.warning} label="Warning" />
            <LegendDot color={HEALTH_FILL.ok} label="Ok" />
          </div>

          <div className="flex items-center gap-1.5 text-[11.5px] text-[#5f6368]">
            Map layout:
            <div className="inline-flex h-7 overflow-hidden rounded-md border border-[#bdc1c6]">
              <button
                type="button"
                onClick={() => setLayoutMode("cluster")}
                className={`px-2.5 text-[12px] ${
                  layoutMode === "cluster"
                    ? "bg-[#1a73e8] text-white"
                    : "bg-white text-[#202124] hover:bg-[#f1f3f4]"
                }`}
              >
                Cluster
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("flow")}
                className={`px-2.5 text-[12px] ${
                  layoutMode === "flow"
                    ? "bg-[#1a73e8] text-white"
                    : "bg-white text-[#202124] hover:bg-[#f1f3f4]"
                }`}
              >
                Flow
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Map settings"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#bdc1c6] bg-white text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <Faders size={12} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-auto">
        {isLoading && (
          <div className="px-6 py-10 text-[13px] text-[#5f6368]">
            Loading service map…
          </div>
        )}
        {!isLoading && !filteredNodes.length && (
          <div className="px-6 py-10 text-[13px] text-[#5f6368]">
            No services emitted spans in the selected window for env:{env}.
          </div>
        )}
        {layout && (
          <div className="flex min-h-full min-w-full items-center justify-center p-6">
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="block max-w-full"
          >
            <defs>
              {(["ok", "warning", "critical"] as const).map((k) => (
                <filter
                  key={k}
                  id={`glow-${k}`}
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feFlood floodColor={HEALTH_GLOW[k]} result="c" />
                  <feComposite in="c" in2="b" operator="in" result="g" />
                  <feMerge>
                    <feMergeNode in="g" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
              {(
                [
                  ["ok", HEALTH_FILL.ok],
                  ["warning", HEALTH_FILL.warning],
                  ["critical", HEALTH_FILL.critical],
                  ["muted", "#dadce0"],
                ] as const
              ).map(([k, color]) => (
                <marker
                  key={k}
                  id={`arrow-${k}`}
                  markerUnits="userSpaceOnUse"
                  markerWidth="9"
                  markerHeight="9"
                  refX="8"
                  refY="4.5"
                  orient="auto"
                >
                  <path d="M0,1 L0,8 L8,4.5 z" fill={color} />
                </marker>
              ))}
            </defs>

            {/* edges */}
            {filteredEdges.map((edge) => {
              const a = layout.positions.get(edge.caller);
              const b = layout.positions.get(edge.callee);
              if (!a || !b) return null;
              const { stroke, key } = edgeHealthColor(edge, nodesByName);
              const muted =
                connectedToHover &&
                !(
                  connectedToHover.has(edge.caller) &&
                  connectedToHover.has(edge.callee)
                );
              const { x1, y1, x2, y2 } = edgeEndpoints(a, b);
              return (
                <g
                  key={`${edge.caller}-${edge.callee}`}
                  opacity={muted ? 0.15 : 1}
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={stroke}
                    strokeWidth={
                      edge.calls === 0
                        ? 1
                        : 1 + Math.min(1.2, Math.log10(1 + edge.calls) * 0.6)
                    }
                    markerEnd={`url(#arrow-${key})`}
                  />
                </g>
              );
            })}

            {/* nodes */}
            {Array.from(layout.positions.values()).map(
              ({ x, y, r, node }) => {
                const health = node.healthState ?? "ok";
                const muted =
                  connectedToHover && !connectedToHover.has(node.service);
                const iconSize = Math.round(r * 0.9);
                return (
                  <g
                    key={node.service}
                    transform={`translate(${x},${y})`}
                    onMouseEnter={() => setHovered(node.service)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() =>
                      router.push(`/apm/services/${node.service}`)
                    }
                    opacity={muted ? 0.3 : 1}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Health glow ring */}
                    <circle
                      r={r + 4}
                      fill="none"
                      stroke={HEALTH_FILL[health]}
                      strokeWidth={5}
                      filter={`url(#glow-${health})`}
                    />
                    {/* Inner white body */}
                    <circle
                      r={r}
                      fill={node.inferred ? "#f1f3f4" : "#ffffff"}
                      stroke="#dadce0"
                      strokeWidth={1}
                    />
                    {/* Icon centered */}
                    <foreignObject
                      x={-iconSize / 2}
                      y={-iconSize / 2}
                      width={iconSize}
                      height={iconSize}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <ServiceIcon type={node.type} size={iconSize - 6} />
                      </div>
                    </foreignObject>
                    {/* Service name to the right */}
                    <text
                      x={r + 10}
                      y={4}
                      fill="#202124"
                      fontSize={Math.min(15, 11 + r / 12)}
                      fontWeight="500"
                    >
                      {node.service}
                    </text>
                    {/* RPS / err sub-label */}
                    <text
                      x={r + 10}
                      y={20}
                      fill="#5f6368"
                      fontSize="10.5"
                    >
                      {node.rps.toFixed(2)} req/s
                      {node.errorRate > 0.001 && (
                        <tspan
                          dx={6}
                          fill={
                            node.errorRate > 0.05
                              ? HEALTH_FILL.critical
                              : "#5f6368"
                          }
                        >
                          · {(node.errorRate * 100).toFixed(1)}% err
                        </tspan>
                      )}
                    </text>
                  </g>
                );
              },
            )}
          </svg>
          </div>
        )}

        {/* Node-size legend (bottom-right, floating) */}
        {layout && (
          <div className="pointer-events-none absolute bottom-4 right-4 rounded-md border border-[#dadce0] bg-white/95 px-3 py-2 text-[11px] shadow-sm">
            <div className="mb-1.5 font-semibold text-[#202124]">
              Node Size{" "}
              <span className="font-normal text-[#5f6368]">
                | Requests (req/s)
              </span>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex flex-col items-center">
                <svg width={22} height={22}>
                  <circle
                    cx={11}
                    cy={11}
                    r={6}
                    fill="white"
                    stroke="#bdc1c6"
                    strokeWidth={1}
                  />
                </svg>
              </div>
              <div className="flex flex-col items-center">
                <svg width={44} height={44}>
                  <circle
                    cx={22}
                    cy={22}
                    r={18}
                    fill="white"
                    stroke="#bdc1c6"
                    strokeWidth={1}
                  />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      </div>
    </div>
  );
}

function CatalogSidebar({
  nodes,
  totalServices,
}: {
  nodes: ApmServiceMapNode[];
  totalServices: number;
}) {
  const datastores = nodes.filter((n) => n.type === "db").length;
  const queues = nodes.filter((n) => n.type === "cache").length;
  const inferred = nodes.filter((n) => n.inferred).length;
  const teams = new Set(nodes.map((n) => n.team).filter(Boolean)).size;
  return (
    <aside className="w-[260px] shrink-0 border-r border-[#e8eaed] bg-white py-3 text-[13px] text-[#202124]">
      <SidebarRow icon={<Users size={16} />} label="Teams" count={teams} />

      <div className="mt-4 flex items-center justify-between px-4 pb-1.5">
        <span className="text-[15px] font-bold text-[#202124]">Software</span>
        <button
          type="button"
          aria-label="Software settings"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#1a73e8] hover:bg-[#e8f0fe]"
        >
          <GearSix size={15} weight="fill" />
        </button>
      </div>

      <SidebarRow icon={<Star size={16} />} label="My Entities" count={0} />
      <SidebarRow
        icon={<TreeStructure size={16} />}
        label="Systems"
        count={0}
      />
      <SidebarRow
        icon={<GitFork size={16} />}
        label="Services"
        count={totalServices}
        active
      />
      <SidebarRow
        icon={<Database size={16} />}
        label="Datastores"
        count={datastores}
      />
      <SidebarRow icon={<Stack size={16} />} label="Queues" count={queues} />
      <SidebarRow
        icon={<DeviceMobile size={16} />}
        label="Frontend Apps"
        count={0}
      />
      <SidebarRow
        icon={<Buildings size={16} />}
        label="External Providers"
        count={0}
      />
      <SidebarRow
        icon={<GearSix size={16} />}
        label="Inferred Services"
        count={inferred}
      />
      <SidebarRow
        icon={<GitFork size={16} weight="duotone" />}
        label="Repositories"
        count={0}
      />

      <div className="mt-2">
        <SidebarRow
          icon={<BracketsCurly size={16} />}
          label="APIs"
          count={0}
        />
        <div className="relative">
          <span
            aria-hidden
            className="absolute left-[22px] top-0 bottom-0 w-px bg-[#e0e3e7]"
          />
          <SidebarRow
            icon={<BracketsCurly size={16} />}
            label="Endpoints"
            count={294}
            indent
          />
        </div>
      </div>
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
      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] leading-5 ${
        active
          ? "bg-[#1a73e8] text-white"
          : "text-[#202124] hover:bg-[#f1f3f4]"
      } ${indent ? "pl-9" : ""}`}
    >
      <span className={active ? "text-white" : "text-[#5f6368]"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span
        className={`text-[12px] tabular-nums ${
          active ? "text-white" : "text-[#5f6368]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ViewToggle({
  value,
  onList,
}: {
  value: "list" | "map";
  onList: () => void;
}) {
  return (
    <div className="inline-flex h-8 overflow-hidden rounded-md border border-[#bdc1c6]">
      <button
        type="button"
        onClick={onList}
        className={`inline-flex items-center gap-1.5 px-2.5 text-[12.5px] ${
          value === "list"
            ? "bg-[#1a73e8] text-white"
            : "bg-white text-[#202124] hover:bg-[#f1f3f4]"
        }`}
      >
        <ListBullets size={12} />
        List
      </button>
      <button
        type="button"
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full border"
        style={{ borderColor: color, backgroundColor: "transparent" }}
      />
      {label}
    </span>
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
      <span className="absolute -top-1.5 left-2 bg-white px-1 text-[10px] text-[#5f6368]">
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
