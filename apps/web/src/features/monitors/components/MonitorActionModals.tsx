"use client";

import { X } from "@phosphor-icons/react";
import { useEffect } from "react";
import type { MuteDuration } from "../api";

export const MUTE_DURATION_OPTIONS: { id: MuteDuration; label: string }[] = [
  { id: "1h", label: "1h" },
  { id: "4h", label: "4h" },
  { id: "12h", label: "12h" },
  { id: "1d", label: "1d" },
  { id: "1w", label: "1w" },
  { id: "forever", label: "Forever" },
];

type ConfirmationModalProps = {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmationModal({
  open,
  title,
  body,
  confirmLabel,
  confirmVariant = "primary",
  busy,
  error,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const confirmClasses =
    confirmVariant === "danger"
      ? "bg-[#d93025] text-white hover:bg-[#b1271b] disabled:bg-[#f4b4ae]"
      : "bg-[#1a73e8] text-white hover:bg-[#1765cc] disabled:bg-[#a8c7fa]";

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-[480px] rounded-md border border-[#dadce0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#dadce0] px-5 py-3">
          <h2 className="text-[16px] font-medium text-[#202124]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-50"
            aria-label="Close"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="px-5 py-4 text-[13px] text-[#202124]">{body}</div>

        {error && (
          <div className="mx-5 mb-3 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#991b1b]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-[#dadce0] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-[#bdc1c6] bg-white px-4 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors ${confirmClasses}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type MuteDurationPopoverProps = {
  open: boolean;
  onSelect: (duration: MuteDuration) => void;
  onClose: () => void;
};

export function MuteDurationPopover({
  open,
  onSelect,
  onClose,
}: MuteDurationPopoverProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[440px] rounded-md border border-[#dadce0] bg-white p-3 shadow-lg">
      <p className="px-1 pb-2 text-[12px] text-[#5f6368]">
        Mute selected monitors for…
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {MUTE_DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          disabled
          className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1 text-[13px] text-[#9aa0a6]"
          title="Custom durations coming soon"
        >
          Custom
        </button>
      </div>
    </div>
  );
}
