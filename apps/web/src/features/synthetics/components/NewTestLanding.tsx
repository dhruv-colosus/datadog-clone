"use client";

import { Heartbeat, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function NewTestLanding() {
  const router = useRouter();

  return (
    <div className="flex h-full w-full flex-col bg-[#f8f9fa] text-[#202124]">
      <header className="flex h-12 items-center border-b border-[#dadce0] bg-white px-6">
        <div className="flex items-center gap-2 text-[13px] text-[#5f6368]">
          <Link href="/synthetics/tests" className="hover:underline">
            <SyntheticsIcon />
          </Link>
          <span>/</span>
          <Heartbeat size={16} className="text-[#632ca6]" />
          <span className="text-[14px] font-medium text-[#202124]">
            New API Test
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[280px] flex-col gap-2 border-r border-[#dadce0] bg-white p-4">
          <button
            type="button"
            onClick={() => router.push("/synthetics/tests/new/scratch")}
            className="flex items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px] text-[#202124] shadow-sm hover:border-[#a8b3be] hover:bg-[#f1f3f4]"
          >
            <Plus size={14} />
            Start from scratch
          </button>
          <div className="mt-4 px-2 text-[10px] font-semibold tracking-wider text-[#80868b]">
            FEATURES
          </div>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-[#5f6368] hover:bg-[#f1f3f4] disabled:cursor-not-allowed"
          >
            <ChartIcon />
            Availability
          </button>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-[#5f6368] hover:bg-[#f1f3f4] disabled:cursor-not-allowed"
          >
            <ShieldIcon />
            Security Checks
          </button>
        </aside>

        <div className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-[820px]">
            <div className="mb-4">
              <input
                type="text"
                placeholder="Find a template..."
                disabled
                className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-[#9aa0a6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => router.push("/synthetics/tests/new/scratch")}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#1a73e8] bg-[#f1f8ff] px-6 py-12 text-center transition-colors hover:bg-[#e6f1f9]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white shadow">
                  <Plus size={28} className="text-[#1a73e8]" />
                </div>
                <div className="text-[15px] font-semibold text-[#202124]">
                  Start from Scratch
                </div>
                <div className="text-[12px] text-[#5f6368]">
                  Create a blank API test
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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

function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3v18h18M7 14l4-4 4 4 4-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l8 4v6c0 4-3 7-8 8-5-1-8-4-8-8V7l8-4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
