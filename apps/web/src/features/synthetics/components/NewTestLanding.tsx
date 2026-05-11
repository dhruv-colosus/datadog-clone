"use client";

import {
  Browser,
  ChartLineUp,
  Globe,
  Heartbeat,
  Lightning,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  API_TEMPLATES,
  BROWSER_TEMPLATES,
  type ApiTemplate,
  type BrowserTemplate,
} from "../types";

type Mode = "api" | "browser";

export function NewTestLanding({ mode: initialMode = "api" }: { mode?: Mode } = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [search, setSearch] = useState("");

  const goScratchApi = () => router.push("/synthetics/tests/new/scratch?type=api");
  const goScratchBrowser = () =>
    router.push("/synthetics/tests/new/scratch?type=browser");

  const onScratch = mode === "api" ? goScratchApi : goScratchBrowser;

  return (
    <div className="flex h-full w-full flex-col bg-[#f8f9fa] text-[#202124]">
      <header className="flex h-12 items-center border-b border-[#dadce0] bg-white px-6">
        <div className="flex items-center gap-2 text-[13px] text-[#5f6368]">
          <Link href="/synthetics/tests" className="hover:underline">
            <SyntheticsIcon />
          </Link>
          <span>/</span>
          {mode === "api" ? (
            <Heartbeat size={16} className="text-[#632ca6]" />
          ) : (
            <Browser size={16} className="text-[#632ca6]" />
          )}
          <span className="text-[14px] font-medium text-[#202124]">
            {mode === "api" ? "New API Test" : "New Browser Test"}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[260px] flex-col gap-1 border-r border-[#dadce0] bg-white p-3">
          <button
            type="button"
            onClick={() => setMode("api")}
            className={
              "flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors " +
              (mode === "api"
                ? "border border-[#bdc1c6] bg-white text-[#202124] shadow-sm"
                : "border border-transparent text-[#202124] hover:bg-[#f1f3f4]")
            }
          >
            <Heartbeat size={16} className="text-[#632ca6]" weight="bold" />
            <span>API Test</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("browser")}
            className={
              "flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors " +
              (mode === "browser"
                ? "border border-[#bdc1c6] bg-white text-[#202124] shadow-sm"
                : "border border-transparent text-[#202124] hover:bg-[#f1f3f4]")
            }
          >
            <Browser size={16} className="text-[#632ca6]" weight="bold" />
            <span>Browser Test</span>
          </button>

          <div className="mt-4 px-2 text-[10px] font-semibold tracking-wider text-[#80868b]">
            FEATURES
          </div>
          <FeatureItem
            icon={<ChartLineUp size={14} />}
            label="Availability"
            active={false}
          />
          <FeatureItem
            icon={<ShieldCheck size={14} />}
            label="Security Checks"
            active={false}
          />
          <FeatureItem
            icon={<Globe size={14} />}
            label="Multi-Region"
            active={false}
          />
          <FeatureItem
            icon={<Lightning size={14} />}
            label="Performance"
            active={false}
          />
        </aside>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-[920px] p-8">
            <div className="relative mb-5">
              <MagnifyingGlass
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa0a6]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a template..."
                className="w-full rounded-md border border-[#bdc1c6] bg-white py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
              />
            </div>

            {mode === "api" ? (
              <ApiTemplatesGrid
                search={search}
                onScratch={goScratchApi}
                onPick={(tpl) =>
                  router.push(
                    `/synthetics/tests/new/scratch?type=api&template=${tpl.id}`,
                  )
                }
              />
            ) : (
              <BrowserTemplatesGrid
                search={search}
                onScratch={goScratchBrowser}
                onPick={(tpl) =>
                  router.push(
                    `/synthetics/tests/new/scratch?type=browser&template=${tpl.id}`,
                  )
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      className={
        "flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed " +
        (active
          ? "bg-[#f1f3f4] text-[#202124]"
          : "text-[#5f6368] hover:bg-[#f1f3f4]")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function ApiTemplatesGrid({
  search,
  onScratch,
  onPick,
}: {
  search: string;
  onScratch: () => void;
  onPick: (tpl: ApiTemplate) => void;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return API_TEMPLATES;
    const q = search.toLowerCase();
    return API_TEMPLATES.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <ScratchCard onClick={onScratch} label="Create a blank API test" />
      {filtered.map((tpl) => (
        <ApiTemplateCard key={tpl.id} tpl={tpl} onClick={() => onPick(tpl)} />
      ))}
    </div>
  );
}

function BrowserTemplatesGrid({
  search,
  onScratch,
  onPick,
}: {
  search: string;
  onScratch: () => void;
  onPick: (tpl: BrowserTemplate) => void;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return BROWSER_TEMPLATES;
    const q = search.toLowerCase();
    return BROWSER_TEMPLATES.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <ScratchCard onClick={onScratch} label="Create a blank Browser test" />
      {filtered.map((tpl) => (
        <BrowserTemplateCard
          key={tpl.id}
          tpl={tpl}
          onClick={() => onPick(tpl)}
        />
      ))}
    </div>
  );
}

function ScratchCard({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#1a73e8] bg-[#f1f8ff] px-6 py-10 text-center transition-colors hover:bg-[#e6f1f9]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white shadow">
        <Plus size={28} className="text-[#1a73e8]" />
      </div>
      <div className="text-[15px] font-semibold text-[#202124]">
        Start from Scratch
      </div>
      <div className="text-[12px] text-[#5f6368]">{label}</div>
    </button>
  );
}

function categoryIcon(category: ApiTemplate["category"]) {
  if (category === "security") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[#7a3edb] to-[#4f29c5]">
        <ShieldCheck size={20} weight="fill" className="text-white" />
      </div>
    );
  }
  if (category === "performance") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[#e84df0] to-[#7a3edb]">
        <Lightning size={20} weight="fill" className="text-white" />
      </div>
    );
  }
  if (category === "protocol") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[#e84df0] to-[#7a3edb]">
        <ChartLineUp size={20} weight="fill" className="text-white" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[#1a73e8] to-[#1967d2]">
      <Heartbeat size={20} weight="fill" className="text-white" />
    </div>
  );
}

function ApiTemplateCard({
  tpl,
  onClick,
}: {
  tpl: ApiTemplate;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-lg border border-[#dadce0] bg-white p-5 text-left transition-shadow hover:border-[#bdc1c6] hover:shadow-sm"
    >
      <div className="flex w-full items-start justify-end">
        {categoryIcon(tpl.category)}
      </div>
      <div className="text-[14px] font-semibold text-[#202124]">{tpl.title}</div>
      <p className="text-[12px] leading-[18px] text-[#5f6368]">
        {tpl.description}
      </p>
    </button>
  );
}

function browserCategoryIcon(category: BrowserTemplate["category"]) {
  if (category === "device") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[#1a73e8] to-[#1967d2]">
        <Browser size={20} weight="fill" className="text-white" />
      </div>
    );
  }
  if (category === "region") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[#34a853] to-[#1a8341]">
        <Globe size={20} weight="fill" className="text-white" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-[#7a3edb] to-[#4f29c5]">
      <Lightning size={20} weight="fill" className="text-white" />
    </div>
  );
}

function BrowserTemplateCard({
  tpl,
  onClick,
}: {
  tpl: BrowserTemplate;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-lg border border-[#dadce0] bg-white p-5 text-left transition-shadow hover:border-[#bdc1c6] hover:shadow-sm"
    >
      <div className="flex w-full items-start justify-end">
        {browserCategoryIcon(tpl.category)}
      </div>
      <div className="text-[14px] font-semibold text-[#202124]">{tpl.title}</div>
      <p className="text-[12px] leading-[18px] text-[#5f6368]">
        {tpl.description}
      </p>
    </button>
  );
}

function SyntheticsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke="#5f6368" strokeWidth="2" />
      <path
        d="M9 12l2 2 4-4"
        stroke="#5f6368"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
