"use client";

import {
  Buildings,
  CaretRight,
  Check,
  CheckCircle,
  Copy,
  Gear,
  Link as LinkIcon,
  Lock,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { NotebookAccess } from "../types";

type Props = {
  open: boolean;
  current: NotebookAccess;
  shareUrl: string;
  orgName?: string;
  saving?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSave: (access: NotebookAccess) => void | Promise<void>;
};

type ChoiceKey = "private" | "org" | "custom";

export function ManageNotebookAccessModal({
  open,
  current,
  shareUrl,
  orgName = "TechBrig",
  saving = false,
  errorMessage,
  onClose,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<ChoiceKey>(current);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(current);
      setCopied(false);
      setCopyError(null);
    }
  }, [open, current]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (saving) return;
    // "custom" isn't persisted yet — fall back to org so the choice is meaningful.
    const next: NotebookAccess = selected === "custom" ? "org" : selected;
    void onSave(next);
  };

  const handleCopy = async () => {
    setCopyError(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers / non-secure contexts.
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Couldn't copy — copy the URL manually.");
    }
  };

  const linkBlocked = selected === "private";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-notebook-access-title"
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[560px] rounded-md border border-[#dadce0] bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h2
            id="manage-notebook-access-title"
            className="text-[18px] font-semibold text-[#202124]"
          >
            Manage notebook access
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="space-y-2 px-6 pb-2 pt-3">
          <AccessRow
            iconBg="#1a73e8"
            icon={<Lock size={16} weight="fill" className="text-white" />}
            title="Private to me"
            subtitle="Only I have access"
            selected={selected === "private"}
            onClick={() => setSelected("private")}
          />
          <AccessRow
            iconBg="#0f9d58"
            icon={
              <Buildings size={16} weight="fill" className="text-white" />
            }
            title={`My org (${orgName})`}
            subtitle="Everyone in my org can view and edit"
            selected={selected === "org"}
            onClick={() => setSelected("org")}
          />
          <AccessRow
            iconBg="#3c4043"
            icon={<Gear size={16} weight="fill" className="text-white" />}
            title="Custom"
            subtitle="Customize access across teams, roles, or users"
            selected={selected === "custom"}
            trailing={
              <CaretRight size={14} weight="bold" className="text-[#9aa0a6]" />
            }
            onClick={() => setSelected("custom")}
          />
        </div>

        <div className="px-6 pb-2 pt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#5f6368]">
            <LinkIcon size={12} weight="bold" />
            Notebook link
          </div>
          <div
            className={`flex items-stretch overflow-hidden rounded-md border ${
              linkBlocked ? "border-[#e8eaed]" : "border-[#bdc1c6]"
            }`}
          >
            <input
              type="text"
              value={shareUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Notebook URL"
              className={`min-w-0 flex-1 bg-white px-3 py-1.5 text-[13px] outline-none ${
                linkBlocked ? "text-[#9aa0a6]" : "text-[#202124]"
              }`}
            />
            <button
              type="button"
              onClick={handleCopy}
              disabled={linkBlocked}
              title={
                linkBlocked
                  ? "Switch to My org to share this link with teammates"
                  : "Copy notebook link"
              }
              className={`flex shrink-0 items-center gap-1.5 border-l px-3 text-[12px] font-medium transition-colors ${
                linkBlocked
                  ? "cursor-not-allowed border-[#e8eaed] bg-[#f8f9fa] text-[#9aa0a6]"
                  : copied
                    ? "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]"
                    : "border-[#bdc1c6] bg-[#f8f9fa] text-[#1a73e8] hover:bg-[#e8f0fe]"
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle size={12} weight="fill" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={12} weight="bold" />
                  Copy link
                </>
              )}
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-[#5f6368]">
            {linkBlocked
              ? "Only you can open this link. Set access to My org or Custom to share it."
              : selected === "org"
                ? `Anyone signed in to ${orgName} can open this link.`
                : "Specific teammates you grant access to can open this link."}
          </p>
          {copyError && (
            <p className="mt-1 text-[11.5px] text-[#991b1b]">{copyError}</p>
          )}
        </div>

        {errorMessage && (
          <div className="mx-6 mt-3 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#991b1b]">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-8 items-center justify-center rounded-md border border-[#dadce0] bg-white px-4 text-[13px] font-medium text-[#202124] hover:bg-[#f1f3f4] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-8 min-w-[72px] items-center justify-center rounded-md bg-[#1a73e8] px-4 text-[13px] font-medium text-white hover:bg-[#1765cc] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccessRow({
  iconBg,
  icon,
  title,
  subtitle,
  selected,
  trailing,
  onClick,
}: {
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  trailing?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
        selected
          ? "border-[#1a73e8] bg-[#f8fbff]"
          : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
      }`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-[#202124]">
          {title}
        </div>
        <div className="truncate text-[12px] text-[#5f6368]">{subtitle}</div>
      </div>
      {selected ? (
        <Check
          size={18}
          weight="bold"
          className="shrink-0 text-[#1a73e8]"
          aria-hidden
        />
      ) : (
        trailing
      )}
    </button>
  );
}
