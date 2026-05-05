"use client";

import {
  ArrowSquareOut,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Code,
  Globe,
  MagicWand,
  Moon,
  Sun,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createDashboard, patchDashboard } from "../api";
import { useDashboardsStore } from "../store";
import type {
  DashboardShareSettings,
  ShareTheme,
  ShareTimeframePreset,
} from "../types";

type Props = {
  open: boolean;
  dashboardId: string;
  onClose: () => void;
  onShared?: (result: { url: string }) => void;
};

type ShareType = "invite" | "public" | "embed";

const TIMEFRAME_OPTIONS: { value: ShareTimeframePreset; label: string }[] = [
  { value: "5m", label: "Past 5 Minutes" },
  { value: "15m", label: "Past 15 Minutes" },
  { value: "30m", label: "Past 30 Minutes" },
  { value: "1h", label: "Past 1 Hour" },
  { value: "4h", label: "Past 4 Hours" },
  { value: "1d", label: "Past 1 Day" },
  { value: "2d", label: "Past 2 Days" },
  { value: "1w", label: "Past 1 Week" },
  { value: "1mo", label: "Past 1 Month" },
];

const TIMEFRAME_SHORT: Record<ShareTimeframePreset, string> = {
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "2d": "2d",
  "1w": "1w",
  "1mo": "1mo",
};

export function ShareDashboardModal({
  open,
  dashboardId,
  onClose,
  onShared,
}: Props) {
  const dashboard = useDashboardsStore((s) =>
    s.dashboards.find((d) => d.id === dashboardId),
  );
  const setPublicShare = useDashboardsStore((s) => s.setPublicShare);
  const setServerId = useDashboardsStore((s) => s.setServerId);

  const [shareType, setShareType] = useState<ShareType>("public");
  const [acknowledged, setAcknowledged] = useState(false);
  const [shareName, setShareName] = useState("");
  const [defaultTimeframe, setDefaultTimeframe] =
    useState<ShareTimeframePreset>("4h");
  const [allowTimeframeChange, setAllowTimeframeChange] = useState(false);
  const [theme, setTheme] = useState<ShareTheme>("auto");
  const [confirmation, setConfirmation] = useState<{
    url: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  // Seed form state only when the modal opens. We intentionally do NOT
  // depend on `dashboard.share.public` — otherwise a successful submit
  // (which mutates that value via setPublicShare) would re-run this effect
  // and wipe the confirmation banner before it ever paints.
  useEffect(() => {
    if (!open) return;
    const existing = dashboard?.share?.public;
    setShareType("public");
    setAcknowledged(!!existing?.enabled);
    setShareName(existing?.shareName ?? "");
    setDefaultTimeframe(existing?.defaultTimeframe ?? "4h");
    setAllowTimeframeChange(existing?.allowTimeframeChange ?? false);
    setTheme(existing?.theme ?? "auto");
    setConfirmation(null);
    setIsSubmitting(false);
    setErrorMessage(null);
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const buildPublicUrl = (id: string): string => {
    if (typeof window === "undefined") {
      return `/public/p/dashboard/${id}`;
    }
    return `${window.location.origin}/public/p/dashboard/${id}`;
  };

  const publicUrl = useMemo(() => {
    return buildPublicUrl(dashboard?.serverId ?? dashboardId);
  }, [dashboard?.serverId, dashboardId]);

  if (!open || !dashboard) return null;

  const tzLabel = formatTzOffset(new Date().getTimezoneOffset());
  const timeframeOption = TIMEFRAME_OPTIONS.find(
    (t) => t.value === defaultTimeframe,
  );

  const canShare = shareType === "public" && acknowledged;

  const submit = async () => {
    if (!canShare || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    const settings: DashboardShareSettings = {
      enabled: true,
      shareName: shareName.trim() || undefined,
      defaultTimeframe,
      allowTimeframeChange,
      theme,
    };
    try {
      let serverId = dashboard.serverId;
      if (!serverId) {
        const created = await createDashboard({
          name: dashboard.name,
          kind: dashboard.kind,
          widgets: dashboard.widgets ?? [],
          layout: [],
          template_vars: [],
          tags: dashboard.teams ?? [],
          share: { public: settings },
        });
        serverId = created.id;
        setServerId(dashboardId, serverId);
      } else {
        await patchDashboard(serverId, { share: { public: settings } });
      }

      setPublicShare(dashboardId, settings);
      const url = buildPublicUrl(serverId);

      // Best-effort auto-copy. Don't block close on clipboard permission.
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // clipboard may be unavailable; the toast still has a Copy button
      }

      if (onShared) {
        onShared({ url });
        onClose();
      } else {
        // Fallback path: no parent toast wired — keep the in-modal banner.
        setConfirmation({ url });
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        requestAnimationFrame(() => {
          bannerRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to share dashboard";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(confirmation.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — clipboard may be unavailable
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[820px] flex-col rounded-md border border-[#dadce0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#dadce0] px-6 py-4">
          <h2 className="text-[18px] font-semibold text-[#202124]">
            Share Dashboard
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

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="mb-5 text-[13px] text-[#202124]">
            Create a shareable URL that grants access to people{" "}
            <span className="font-semibold">without</span> a Datadog account.
          </p>

          <Step number={1} title="Select a Share Type">
            <div className="grid grid-cols-3 gap-3">
              <ShareTypeCard
                disabled
                selected={false}
                icon={<UsersThree size={22} weight="regular" />}
                title="Invite only"
                subtitle="Only specified emails can view"
              />
              <ShareTypeCard
                selected={shareType === "public"}
                icon={<Globe size={22} weight="regular" />}
                title="Public"
                subtitle="Anyone with the link can view"
                onClick={() => setShareType("public")}
              />
              <ShareTypeCard
                disabled
                selected={false}
                icon={<Code size={22} weight="regular" />}
                title="Embed"
                subtitle="Add to your own app or website"
              />
            </div>

            {shareType === "public" && (
              <div className="mt-3 rounded-md border border-[#fcd34d] bg-[#fef3c7] px-4 py-3 text-[13px] text-[#202124]">
                <div className="flex items-start gap-2">
                  <Warning
                    size={16}
                    weight="fill"
                    className="mt-0.5 shrink-0 text-[#f59e0b]"
                  />
                  <div>
                    <p>
                      Anyone on the internet will be able to access this
                      dashboard. Certain widget types and sensitive data are
                      not available on shared dashboards.
                    </p>
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[#1a73e8]"
                      />
                      <span>I understand</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </Step>

          <Step number={2} title="Configure dashboard">
            <FieldRow label="Name">
              <input
                type="text"
                value={shareName}
                placeholder={dashboard.name}
                onChange={(e) => setShareName(e.target.value)}
                className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none placeholder:text-[#9aa0a6] focus:border-[#1a73e8]"
              />
            </FieldRow>

            <FieldRow label="Default timeframe">
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute -top-2 left-3 bg-white px-1 text-[10px] uppercase tracking-wide text-[#1a73e8]">
                    UTC{tzLabel}
                  </span>
                  <select
                    value={defaultTimeframe}
                    onChange={(e) =>
                      setDefaultTimeframe(
                        e.target.value as ShareTimeframePreset,
                      )
                    }
                    className="w-full appearance-none rounded-md border border-[#bdc1c6] bg-white py-1.5 pl-12 pr-8 text-[13px] outline-none focus:border-[#1a73e8]"
                  >
                    {TIMEFRAME_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute left-3 top-1/2 inline-flex h-5 -translate-y-1/2 items-center justify-center rounded bg-[#f1f3f4] px-1.5 text-[11px] text-[#5f6368]">
                    {TIMEFRAME_SHORT[defaultTimeframe]}
                  </span>
                  <CaretDown
                    size={10}
                    weight="bold"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5f6368]"
                  />
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-[#202124]">
                  <Toggle
                    checked={allowTimeframeChange}
                    onChange={setAllowTimeframeChange}
                  />
                  Allow viewers to change timeframe
                </label>
              </div>
            </FieldRow>

            <FieldRow label="Default theme">
              <div className="inline-flex rounded-md border border-[#bdc1c6] p-0.5">
                <ThemeOption
                  active={theme === "auto"}
                  icon={<MagicWand size={12} weight="regular" />}
                  label="Auto"
                  onClick={() => setTheme("auto")}
                />
                <ThemeOption
                  active={theme === "light"}
                  icon={<Sun size={12} weight="regular" />}
                  label="Light"
                  onClick={() => setTheme("light")}
                />
                <ThemeOption
                  active={theme === "dark"}
                  icon={<Moon size={12} weight="regular" />}
                  label="Dark"
                  onClick={() => setTheme("dark")}
                />
              </div>
            </FieldRow>
            <p className="ml-[148px] mt-1 text-[12px] text-[#9aa0a6]">
              Default timeframe uses {timeframeOption?.label.toLowerCase()}.
            </p>
          </Step>

          {confirmation && (
            <div
              ref={bannerRef}
              className="mt-4 flex items-center justify-between rounded-md border border-[#a7f3d0] bg-[#ecfdf5] px-4 py-2 text-[13px] text-[#202124]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle
                  size={18}
                  weight="fill"
                  className="shrink-0 text-[#10b981]"
                />
                <span className="truncate">
                  Dashboard successfully shared
                  {copied ? " — link copied" : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[#1a73e8]">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="hover:underline"
                >
                  {copied ? "Copied!" : "Copy URL"}
                </button>
                <span className="text-[#bdc1c6]">|</span>
                <a
                  href={confirmation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <ArrowSquareOut size={12} weight="bold" />
                  Open Dashboard
                </a>
              </div>
            </div>
          )}
          {errorMessage && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-[#fecaca] bg-[#fef2f2] px-4 py-2 text-[13px] text-[#991b1b]">
              <Warning
                size={16}
                weight="fill"
                className="mt-0.5 shrink-0 text-[#dc2626]"
              />
              <span className="min-w-0 break-words">{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#dadce0] bg-[#f8f9fa] px-6 py-3">
          <span className="text-[12px] text-[#9aa0a6]">
            {canShare
              ? ""
              : "Check “I understand” to enable sharing."}
          </span>
          <div className="flex items-center gap-2">
            <Button onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={submit}
              disabled={!canShare || isSubmitting}
              className="inline-flex h-7 min-w-[140px] items-center justify-center gap-2 rounded-md bg-[#1a73e8] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#1765cc] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <CircleNotch
                    size={12}
                    weight="bold"
                    className="animate-spin"
                  />
                  Sharing…
                </>
              ) : (
                "Share Dashboard"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pb-6 pl-12 last:pb-0">
      <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#1a73e8] text-[13px] font-semibold text-white">
        {number}
      </div>
      <div className="absolute left-4 top-8 h-[calc(100%-2rem)] w-px bg-[#e8eaed] last:hidden" />
      <h3 className="mb-3 mt-1 text-[15px] font-semibold text-[#202124]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ShareTypeCard({
  selected,
  disabled,
  icon,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  const base =
    "flex flex-col items-center justify-center gap-1.5 rounded-md border px-3 py-4 text-center transition-colors";
  const state = disabled
    ? "border-[#dadce0] bg-white text-[#9aa0a6] cursor-not-allowed"
    : selected
      ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
      : "border-[#dadce0] bg-white text-[#202124] hover:border-[#a8b3be]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${state}`}
    >
      <span className={selected ? "text-[#1a73e8]" : ""}>{icon}</span>
      <span className="flex items-center gap-1 text-[13px] font-semibold">
        {selected && (
          <span className="text-[#1a73e8]">
            <CheckCircle size={14} weight="fill" />
          </span>
        )}
        {title}
      </span>
      <span
        className={`text-[12px] ${
          disabled
            ? "text-[#9aa0a6]"
            : selected
              ? "text-[#1a73e8]"
              : "text-[#5f6368]"
        }`}
      >
        {subtitle}
      </span>
    </button>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 grid grid-cols-[140px_1fr] items-start gap-3 last:mb-0">
      <span className="pt-1.5 text-[13px] text-[#5f6368]">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-[#1a73e8]" : "bg-[#bdc1c6]"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function ThemeOption({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded px-3 py-1 text-[13px] transition-colors ${
        active
          ? "bg-[#e8f0fe] text-[#1a73e8]"
          : "text-[#5f6368] hover:bg-[#f1f3f4]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function formatTzOffset(offsetMinutes: number): string {
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const mm = (abs % 60).toString().padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
