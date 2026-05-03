"use client";

import {
  CaretDown,
  Copy,
  Heart,
  Pencil,
  Star,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { TimeRangePicker } from "@/components/ui/TimeRangePicker";
import { useApmService } from "../hooks";
import { useApmServiceDetailStore, useApmTracesStore } from "../store";
import { ApmHeader } from "./ApmHeader";
import { ServiceResourcesTab } from "./ServiceResourcesTab";
import { ServiceSidebar } from "./ServiceSidebar";
import { ServiceSummaryTab } from "./ServiceSummaryTab";
import { ServiceTypeIcon } from "./ServiceTypeIcon";

export function ServiceDetailPage({ serviceId }: { serviceId: string }) {
  const { data: service, isLoading } = useApmService(serviceId);
  const tab = useApmServiceDetailStore((s) => s.tab);
  const setTab = useApmServiceDetailStore((s) => s.setTab);
  const range = useApmTracesStore((s) => s.timeRange);
  const setRange = useApmTracesStore((s) => s.setTimeRange);

  useEffect(() => {
    setTab("summary");
  }, [serviceId, setTab]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col bg-white">
        <ApmHeader />
        <div className="px-6 py-10 text-[13px] text-[#5f6368]">Loading…</div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="flex h-full flex-col bg-white">
        <ApmHeader />
        <div className="px-6 py-10">
          <p className="text-[14px] font-semibold text-[#202124]">
            Service not found
          </p>
          <p className="mt-2 text-[13px] text-[#5f6368]">
            We couldn&apos;t find a service named{" "}
            <code className="rounded bg-[#f1f3f4] px-1 py-0.5">{serviceId}</code>
            .
          </p>
          <Link
            href="/apm/home"
            className="mt-4 inline-block text-[13px] text-[#1a73e8] hover:underline"
          >
            ← Back to APM home
          </Link>
        </div>
      </div>
    );
  }

  const healthLabel =
    service.health === "ok"
      ? "OK"
      : service.health === "warn"
      ? "WARN"
      : "CRITICAL";
  const healthColor =
    service.health === "ok"
      ? "bg-[#34a853] text-white"
      : service.health === "warn"
      ? "bg-[#fbbc04] text-[#202124]"
      : "bg-[#d93025] text-white";

  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <ApmHeader>
        <Button>
          <Pencil size={12} />
          Service Config
          <CaretDown size={10} weight="bold" />
        </Button>
      </ApmHeader>

      <div className="flex flex-wrap items-center gap-3 border-b border-[#e8eaed] bg-white px-4 py-2 text-[12.5px]">
        <FieldDropdown label="operation" value="All client operations" />
        <FieldDropdown label="env" value={service.env} />
        <FieldDropdown label="version" value="All" />
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md text-[#1a73e8] hover:bg-[#f1f3f4] px-2"
        >
          <Pencil size={11} />
          Edit
        </button>
        <div className="ml-auto flex items-center gap-2">
          <TimeRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-label="Star service"
          className="text-[#bdc1c6] hover:text-[#fbbc04]"
        >
          <Star size={14} />
        </button>
        <ServiceTypeIcon type={service.type} size={18} />
        <span className="text-[20px] font-semibold text-[#202124]">
          {service.name}
        </span>
        <LangBadge language={service.language} />
        <button
          type="button"
          aria-label="Switch service"
          className="ml-1 text-[#5f6368] hover:bg-[#f1f3f4] rounded p-0.5"
        >
          <CaretDown size={11} weight="bold" />
        </button>
        <button
          type="button"
          aria-label="Copy service name"
          className="text-[#5f6368] hover:bg-[#f1f3f4] rounded p-1"
        >
          <Copy size={13} />
        </button>
        <span className="ml-2 text-[11px] uppercase tracking-wide text-[#5f6368]">
          | Health
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${healthColor}`}
        >
          <Heart size={11} weight="fill" />
          {healthLabel}
        </span>
      </div>

      <div className="flex border-y border-[#e8eaed] bg-[#fafbfc]">
        <Link
          href="#"
          className="ml-auto inline-flex h-9 items-center px-4 text-[12.5px] text-[#1a73e8] hover:underline"
        >
          No Monitors
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ServiceSidebar />
        {tab === "summary" && <ServiceSummaryTab service={service} />}
        {tab === "resources" && <ServiceResourcesTab service={service} />}
        {tab !== "summary" && tab !== "resources" && (
          <EmptyTabState tab={tab} />
        )}
      </div>
    </div>
  );
}

function EmptyTabState({ tab }: { tab: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-[#f8f9fb] text-[#5f6368]">
      <span className="text-[13px] font-semibold capitalize">{tab}</span>
      <span className="text-[12.5px]">
        This view will populate once data is available.
      </span>
    </div>
  );
}

function LangBadge({ language }: { language: string }) {
  const colors: Record<string, string> = {
    python: "bg-[#3776ab] text-white",
    node: "bg-[#43853d] text-white",
    go: "bg-[#00add8] text-white",
    java: "bg-[#e76f00] text-white",
    ruby: "bg-[#cc342d] text-white",
  };
  const cls = colors[language] ?? "bg-[#5f6368] text-white";
  return (
    <span
      className={`inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}
    >
      {language[0].toUpperCase()}
    </span>
  );
}

function FieldDropdown({ label, value }: { label: string; value: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2.5 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
    >
      <span className="text-[10px] uppercase tracking-wide text-[#5f6368]">
        {label}
      </span>
      <span>{value}</span>
      <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
    </button>
  );
}
