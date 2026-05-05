"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHosts, type HostDto } from "./api";
import type { Host, HostApp } from "./types";

export const infraKeys = {
  all: ["infra"] as const,
  hosts: (env?: string) => ["infra", "hosts", env ?? "all"] as const,
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFor(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function sparkline(seed: number, length = 18, base = 4, amp = 6): number[] {
  const r = rngFor(seed);
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    out.push(Math.max(0, base + (r() - 0.4) * amp));
  }
  return out;
}

const KNOWN_APPS: ReadonlySet<HostApp> = new Set<HostApp>([
  "container",
  "docker",
  "ntp",
  "system",
  "agent",
  "kubernetes",
  "redis",
  "postgres",
  "nginx",
]);

function normalizeApps(apps: string[]): HostApp[] {
  return apps.filter((a): a is HostApp => KNOWN_APPS.has(a as HostApp));
}

/**
 * Synthesize the UI-only fields the API doesn't return (sparklines, kernel
 * descriptors, filesystem mounts, tags). Deterministic per host id so the
 * Host List, Host Map, and detail panel all see identical values.
 */
export function enrichHost(dto: HostDto): Host {
  const seed = hashSeed(dto.id);
  const r = rngFor(seed);
  const cpu = dto.cpuPercent;
  const iowait = Math.round(r() * 200) / 100;
  const load15 = Math.round(r() * 250) / 100;
  const tags: { key: string; value: string }[] = [
    { key: "host", value: dto.hostname },
  ];
  if (dto.availabilityZone)
    tags.push({ key: "availability-zone", value: dto.availabilityZone });
  if (dto.region) tags.push({ key: "region", value: dto.region });
  if (dto.service) tags.push({ key: "service", value: dto.service });
  if (dto.env) tags.push({ key: "env", value: dto.env });
  if (dto.team) tags.push({ key: "team", value: dto.team });

  return {
    id: dto.id,
    hostname: dto.hostname,
    status: dto.status,
    os: dto.os,
    agentVersion: dto.agentVersion,
    cpuPercent: cpu,
    cpuSparkline: sparkline(seed, 18, cpu / 12 + 1, 4),
    iowaitPercent: iowait,
    iowaitSparkline: sparkline(seed + 1, 18, 0.2, 0.6),
    load15,
    apps: normalizeApps(dto.apps),
    availabilityZone: dto.availabilityZone,
    region: dto.region ?? "",
    service: dto.service,
    ipAddress: dto.ipAddress,
    ipv6Address: dto.ipv6Address,
    macAddress: dto.macAddress,
    cpuCores: dto.cpuCores,
    logicalCores: dto.cpuCores,
    memoryGB: dto.memoryGB,
    filesystemGB: dto.filesystemGB,
    swapTotalGB: 0,
    cpuModelName: "Intel Xeon",
    cpuVendor: "GenuineIntel",
    cpuMhz: 2400,
    cpuCacheKb: 4096,
    cpuFamily: 6,
    cpuModel: 79,
    cpuStepping: 1,
    kernelName: "Linux",
    kernelRelease: dto.kernelRelease,
    kernelVersion: dto.kernelVersion,
    machine: "x86_64",
    processor: "x86_64",
    hardwarePlatform: "x86_64",
    dockerSwarm: "inactive",
    dockerVersion: dto.dockerVersion,
    filesystemMounts: [
      { fs: "/dev/vda1", mount: "/", size: `${dto.filesystemGB.toFixed(2)}G` },
      { fs: "tmpfs", mount: "/run", size: `${(dto.memoryGB / 10).toFixed(2)}G` },
      { fs: "tmpfs", mount: "/dev/shm", size: `${(dto.memoryGB / 2).toFixed(2)}G` },
    ],
    tags,
    containers: [],
  };
}

export function useHosts(env?: string) {
  const query = useQuery({
    queryKey: infraKeys.hosts(env),
    queryFn: () => fetchHosts(env),
    staleTime: 30_000,
  });

  const hosts = useMemo<Host[]>(
    () => (query.data ? query.data.map(enrichHost) : []),
    [query.data],
  );

  return { ...query, hosts };
}

export function useHost(id: string | null, env?: string) {
  const { hosts, isLoading, isError } = useHosts(env);
  const host = useMemo(
    () => (id ? hosts.find((h) => h.id === id) ?? null : null),
    [hosts, id],
  );
  return { host, isLoading, isError };
}
