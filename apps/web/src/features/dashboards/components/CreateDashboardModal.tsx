"use client";

import { CaretDown, ClockCounterClockwise, DesktopTower, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { suggestDefaultName, useDashboardsStore } from "../store";
import type { DashboardKind } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateDashboardModal({ open, onClose }: Props) {
  const router = useRouter();
  const create = useDashboardsStore((s) => s.create);
  const [name, setName] = useState("");
  const [placeholder, setPlaceholder] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setPlaceholder(suggestDefaultName());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (kind: DashboardKind) => {
    const dashboard = create({ name: name || placeholder, kind });
    onClose();
    router.push(`/dashboard/${dashboard.id}`);
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[760px] rounded-md border border-[#dadce0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#dadce0] px-6 py-4">
          <h2 className="text-[18px] font-semibold text-[#202124]">
            Create a Dashboard
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Close"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 px-6 py-5">
          <Field label="Dashboard Name">
            <input
              type="text"
              value={name}
              placeholder={placeholder}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
            />
          </Field>
          <Field label="Team">
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-between rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-left text-[13px] text-[#9aa0a6]"
            >
              Select up to 5 Teams
              <CaretDown size={10} weight="bold" />
            </button>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-5 px-6 pb-6">
          <DashboardOption
            primary
            title="Snap widgets into place on a grid"
            preview={<GridPreview />}
            actionLabel="New Dashboard"
            onSelect={() => submit("dashboard")}
          />
          <div className="flex flex-col gap-3">
            <DashboardOption
              title="Automatic layout that fits your browser"
              preview={<TimeboardPreview />}
              actionLabel="New Timeboard"
              icon={<ClockCounterClockwise size={14} weight="bold" />}
              onSelect={() => submit("timeboard")}
            />
            <DashboardOption
              title="Pixel-level precision on a scrollable canvas"
              preview={<ScreenboardPreview />}
              actionLabel="New Screenboard"
              icon={<DesktopTower size={14} weight="bold" />}
              onSelect={() => submit("screenboard")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] text-[#5f6368]">{label}</label>
      {children}
    </div>
  );
}

function DashboardOption({
  title,
  preview,
  actionLabel,
  onSelect,
  icon,
  primary,
}: {
  title: string;
  preview: React.ReactNode;
  actionLabel: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <div className="flex flex-col rounded-md border border-[#dadce0] p-5">
        <div className="flex flex-1 items-center justify-center pb-6">{preview}</div>
        <p className="text-center text-[13px] text-[#202124]">{title}</p>
        <button
          type="button"
          onClick={onSelect}
          className="mt-4 w-full rounded-md bg-[#1a73e8] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1765cc]"
        >
          {actionLabel}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col rounded-md border border-[#dadce0] p-4">
      <div className="flex items-center gap-4">
        <div className="shrink-0">{preview}</div>
        <p className="flex-1 text-[13px] text-[#202124]">{title}</p>
      </div>
      <Button onClick={onSelect} className="mt-3 justify-center">
        {icon}
        {actionLabel}
      </Button>
    </div>
  );
}

function GridPreview() {
  return (
    <div className="grid grid-cols-[140px_70px] gap-2">
      <div className="row-span-2 h-[110px] rounded-md border-2 border-[#c4b5fd] bg-[#f5f3ff]" />
      <div className="h-[40px] rounded-md border-2 border-[#c4b5fd] bg-[#f5f3ff]" />
      <div className="h-[28px] rounded-md border-2 border-[#c4b5fd] bg-[#f5f3ff]" />
      <div className="col-span-2 h-[36px] rounded-md border-2 border-[#c4b5fd] bg-[#f5f3ff]" />
    </div>
  );
}

function TimeboardPreview() {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-5 w-9 rounded border border-[#bdc1c6] bg-white"
        />
      ))}
    </div>
  );
}

function ScreenboardPreview() {
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <div className="h-3 w-12 rounded-sm border border-[#bdc1c6]" />
        <div className="h-3 w-7 rounded-sm border border-[#bdc1c6]" />
        <div className="h-3 w-10 rounded-sm border border-[#bdc1c6]" />
        <div className="h-3 w-5 rounded-sm border border-[#bdc1c6]" />
      </div>
      <div className="h-4 w-[120px] rounded-sm border border-[#bdc1c6]" />
      <div className="h-4 w-[100px] rounded-sm border border-[#bdc1c6]" />
    </div>
  );
}
