"use client";

import {
  CaretDown,
  CaretRight,
  Check,
  Question,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAllTagKeys, useAllTagValues } from "@/features/metrics/hooks";
import {
  TEMPLATE_VAR_WILDCARD,
  type TemplateVariable,
} from "../../types";

type Props = {
  variable: TemplateVariable;
  onSave: (patch: Partial<TemplateVariable>) => void;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Side-card editor for a single template variable. Mirrors the Datadog UI
 * shown in the second screenshot: Filter/Group toggle, tag combobox, default
 * value, preview values.
 *
 * v1: Group is disabled (visual only); "Apply to Widgets" is also disabled —
 * the model fields exist so the editor grows additively in v2.
 */
export function EditVariablePanel({
  variable,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<TemplateVariable>(variable);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const tagKeysQuery = useAllTagKeys();
  const tagValuesQuery = useAllTagValues(draft.tagKey);

  const allTagKeys = tagKeysQuery.data ?? [];
  const tagValues = useMemo<string[]>(() => tagValuesQuery.data ?? [], [
    tagValuesQuery.data,
  ]);

  // Keep draft.name in sync with tagKey when they were equal — typical case
  // (user picks "host" and the variable is referenced as $host).
  const setTagKey = (next: string) => {
    setDraft((d) => ({
      ...d,
      tagKey: next,
      name: d.name === d.tagKey ? next : d.name,
    }));
  };

  return (
    <div className="w-[360px] overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-[#f1f3f4] px-3 py-2">
        <div className="flex items-center gap-2 text-[13px] font-medium text-[#202124]">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#ede9fe] text-[#6d28d9]">
            <span aria-hidden="true" className="text-[11px]">≡</span>
          </span>
          Edit{" "}
          <span className="rounded bg-[#f1f3f4] px-1.5 py-0.5 font-mono text-[12px] text-[#6d28d9]">
            ${draft.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete variable"
            className="rounded p-1 text-[#5f6368] hover:bg-[#fef2f2] hover:text-[#dc2626]"
          >
            <Trash size={14} />
          </button>
          <Button
            variant="primary"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            <Check size={12} weight="bold" />
            Save
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </header>

      <div className="px-3 py-3 text-[#202124]">
        <Section title="Setup" defaultOpen>
          <Field label="Select Type" required>
            <SegmentedToggle
              value={draft.type}
              onChange={(t) => setDraft((d) => ({ ...d, type: t }))}
            />
            {draft.type === "group" && (
              <p className="mt-1 text-[11px] text-[#92400e]">
                Group support is coming soon — falls back to filter at runtime.
              </p>
            )}
          </Field>

          <Field label="Choose a Tag to Filter" required>
            <TagCombobox
              value={draft.tagKey}
              options={allTagKeys}
              loading={tagKeysQuery.isLoading}
              onChange={setTagKey}
            />
            <div className="mt-1 flex items-center gap-1 text-[11px] text-[#5f6368]">
              <span>Used in queries as</span>
              <code className="rounded bg-[#f1f3f4] px-1.5 py-0.5 font-mono text-[#6d28d9]">
                ${draft.name}
              </code>
              <Question size={11} className="text-[#9aa0a6]" />
            </div>
          </Field>

          <Field label="Apply to Widgets">
            <div className="rounded-md border border-dashed border-[#dadce0] bg-[#f8f9fa] px-2 py-1.5 text-[12px] text-[#9aa0a6]">
              All widgets
              <span className="ml-2 text-[10px] uppercase">v2</span>
            </div>
          </Field>

          <Field label="Default value">
            <DefaultValueSelect
              value={draft.defaultValue}
              options={tagValues}
              loading={tagValuesQuery.isLoading}
              onChange={(v) =>
                setDraft((d) => ({ ...d, defaultValue: v }))
              }
            />
            <p className="mt-1 text-[11px] text-[#5f6368]">
              Automatically set this value when opening this dashboard.
            </p>
          </Field>
        </Section>

        <button
          type="button"
          onClick={() => setPreviewExpanded((v) => !v)}
          className="mt-2 flex w-full items-center gap-1 border-t border-[#f1f3f4] py-2 text-left text-[12px] font-medium text-[#202124]"
        >
          {previewExpanded ? (
            <CaretDown size={10} weight="bold" />
          ) : (
            <CaretRight size={10} weight="bold" />
          )}
          Preview Values
        </button>
        {previewExpanded && (
          <div className="rounded-md border border-[#f1f3f4] bg-[#f8f9fa] px-2 py-1.5">
            {tagValuesQuery.isLoading && (
              <p className="text-[11px] text-[#5f6368]">Loading…</p>
            )}
            {!tagValuesQuery.isLoading && tagValues.length === 0 && (
              <p className="text-[11px] text-[#5f6368]">No values reported</p>
            )}
            <ul className="flex max-h-[120px] flex-wrap gap-1 overflow-auto">
              {tagValues.slice(0, 30).map((v) => (
                <li
                  key={v}
                  className="rounded border border-[#dadce0] bg-white px-1.5 py-0.5 text-[11px] font-mono text-[#202124]"
                >
                  {v}
                </li>
              ))}
              {tagValues.length > 30 && (
                <li className="px-1.5 py-0.5 text-[11px] text-[#5f6368]">
                  +{tagValues.length - 30} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 py-1 text-left text-[13px] font-medium text-[#202124]"
      >
        {open ? (
          <CaretDown size={10} weight="bold" />
        ) : (
          <CaretRight size={10} weight="bold" />
        )}
        {title}
      </button>
      {open && <div className="space-y-3 pt-1">{children}</div>}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#202124]">
        {label}
        {required && <span className="ml-0.5 text-[#dc2626]">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SegmentedToggle({
  value,
  onChange,
}: {
  value: "filter" | "group";
  onChange: (v: "filter" | "group") => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[#dadce0] bg-white">
      <button
        type="button"
        onClick={() => onChange("filter")}
        className={`px-4 py-1 text-[12px] ${
          value === "filter"
            ? "bg-[#e8f0fe] font-medium text-[#1a73e8]"
            : "text-[#5f6368]"
        }`}
      >
        Filter
      </button>
      <button
        type="button"
        onClick={() => onChange("group")}
        className={`border-l border-[#dadce0] px-4 py-1 text-[12px] ${
          value === "group"
            ? "bg-[#e8f0fe] font-medium text-[#1a73e8]"
            : "text-[#5f6368]"
        }`}
        title="Group support is a v2 feature; selecting it falls back to filter behaviour at runtime."
      >
        Group
      </button>
    </div>
  );
}

function TagCombobox({
  value,
  options,
  loading,
  onChange,
}: {
  value: string;
  options: string[];
  loading: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-md border bg-white px-2 py-1.5 text-left text-[12px] ${
          open ? "border-[#1a73e8]" : "border-[#dadce0]"
        }`}
      >
        <span className="font-mono text-[#202124]">{value || "—"}</span>
        <div className="flex items-center gap-1 text-[#5f6368]">
          {value && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear tag"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="rounded-full p-0.5 hover:bg-[#f1f3f4]"
            >
              <X size={10} weight="bold" />
            </span>
          )}
          <CaretDown size={10} weight="bold" />
        </div>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[200px] overflow-auto rounded-md border border-[#dadce0] bg-white shadow-lg">
          <div className="border-b border-[#f1f3f4] p-1.5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags…"
              autoFocus
              className="w-full rounded border border-[#dadce0] px-2 py-1 text-[12px] outline-none focus:border-[#1a73e8]"
            />
          </div>
          {loading && (
            <div className="px-3 py-1.5 text-[12px] text-[#5f6368]">
              Loading…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-3 py-1.5 text-[12px] text-[#5f6368]">
              No tags
            </div>
          )}
          <ul>
            {filtered.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`flex w-full items-center px-3 py-1 text-left text-[12px] font-mono hover:bg-[#f1f3f4] ${
                    opt === value ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#202124]"
                  }`}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DefaultValueSelect({
  value,
  options,
  loading,
  onChange,
}: {
  value: string;
  options: string[];
  loading: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-md border border-[#dadce0] bg-white px-2 py-1.5 pr-7 text-[12px] text-[#202124] outline-none focus:border-[#1a73e8]"
      >
        <option value={TEMPLATE_VAR_WILDCARD}>* (All)</option>
        {loading && <option disabled>Loading…</option>}
        {options.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <CaretDown
        size={10}
        weight="bold"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#5f6368]"
      />
    </div>
  );
}
