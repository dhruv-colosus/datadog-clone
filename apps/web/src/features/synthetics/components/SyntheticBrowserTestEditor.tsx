"use client";

import {
  Browser,
  CaretDown,
  CaretRight,
  Cursor,
  Globe,
  Keyboard,
  Lightning,
  ListChecks,
  Plus,
  Record,
  Tag,
  Timer,
  Trash,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  useCreateSyntheticTest,
  usePatchSyntheticTest,
} from "../hooks";
import {
  ALL_LOCATION_IDS,
  BROWSER_TEMPLATES,
  BROWSERS,
  DEVICES,
  LOCATIONS,
  REGIONS,
  type BrowserConfig,
  type BrowserStep,
  type BrowserStepType,
  type SyntheticTest,
} from "../types";

const STEP_TYPES: {
  value: BrowserStepType;
  label: string;
  needsTarget: boolean;
  needsValue: boolean;
  needsMs?: boolean;
  group: "navigate" | "interact" | "assert" | "data";
}[] = [
  { value: "goto", label: "Go to URL", needsTarget: true, needsValue: false, group: "navigate" },
  { value: "click", label: "Click", needsTarget: true, needsValue: false, group: "interact" },
  { value: "type", label: "Type text", needsTarget: true, needsValue: true, group: "interact" },
  { value: "hover", label: "Hover", needsTarget: true, needsValue: false, group: "interact" },
  { value: "scroll", label: "Scroll", needsTarget: true, needsValue: false, group: "interact" },
  { value: "select", label: "Select option", needsTarget: true, needsValue: true, group: "interact" },
  { value: "press", label: "Press key", needsTarget: false, needsValue: true, group: "interact" },
  { value: "wait", label: "Wait", needsTarget: false, needsValue: false, needsMs: true, group: "interact" },
  { value: "assert_contains", label: "Assert page contains", needsTarget: false, needsValue: true, group: "assert" },
  { value: "assert_url", label: "Assert current URL", needsTarget: false, needsValue: true, group: "assert" },
  { value: "assert_element", label: "Assert element present", needsTarget: true, needsValue: false, group: "assert" },
];

const STEP_ICON: Record<BrowserStepType, React.ReactNode> = {
  goto: <Globe size={12} />,
  click: <Cursor size={12} />,
  type: <Keyboard size={12} />,
  hover: <Cursor size={12} />,
  scroll: <Cursor size={12} />,
  select: <ListChecks size={12} />,
  press: <Keyboard size={12} />,
  wait: <Timer size={12} />,
  assert_contains: <ListChecks size={12} />,
  assert_url: <ListChecks size={12} />,
  assert_element: <ListChecks size={12} />,
};

type EditorProps = {
  initial?: SyntheticTest;
  mode: "create" | "edit";
  templateId?: string | null;
};

type FormState = {
  name: string;
  startingUrl: string;
  browsers: string[];
  devices: string[];
  steps: BrowserStep[];
  locations: string[];
  frequencySeconds: number;
  tags: string[];
  environment: string;
  team: string;
  enabled: boolean;
};

function newId(): string {
  return `step-${Math.random().toString(36).slice(2, 9)}`;
}

function defaultForm(): FormState {
  return {
    name: "",
    startingUrl: "https://",
    browsers: ["chrome", "firefox"],
    devices: ["laptop_large"],
    steps: [],
    locations: ["aws:us-east-1"],
    frequencySeconds: 300,
    tags: [],
    environment: "",
    team: "",
    enabled: true,
  };
}

function fromTemplate(id: string): FormState {
  const base = defaultForm();
  const tpl = BROWSER_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return base;
  if (id === "large-screen") {
    return { ...base, devices: ["laptop_large"], browsers: ["chrome", "firefox", "edge"], name: tpl.title };
  }
  if (id === "tablet") {
    return { ...base, devices: ["tablet"], browsers: ["chrome"], name: tpl.title };
  }
  if (id === "mobile") {
    return { ...base, devices: ["mobile_small"], browsers: ["chrome"], name: tpl.title };
  }
  if (id === "multi-region") {
    return {
      ...base,
      locations: ["aws:us-east-1", "aws:eu-west-1", "aws:ap-southeast-1"],
      name: tpl.title,
    };
  }
  return { ...base, name: tpl.title };
}

function toForm(test: SyntheticTest): FormState {
  const bc = test.browserConfig ?? ({} as BrowserConfig);
  return {
    name: test.name,
    startingUrl: bc.startingUrl || test.url || "https://",
    browsers: bc.browsers?.length ? bc.browsers : ["chrome"],
    devices: bc.devices?.length ? bc.devices : ["laptop_large"],
    steps: bc.steps ?? [],
    locations: test.locations ?? [],
    frequencySeconds: test.frequencySeconds,
    tags: test.tags ?? [],
    environment: test.environment ?? "",
    team: test.team ?? "",
    enabled: test.enabled,
  };
}

export function SyntheticBrowserTestEditor({
  initial,
  mode,
  templateId,
}: EditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => {
    if (initial) return toForm(initial);
    if (templateId) return fromTemplate(templateId);
    return defaultForm();
  });
  const [openSection, setOpenSection] = useState<Record<string, boolean>>({
    details: true,
    browsers: true,
    locations: true,
    steps: true,
    schedule: true,
  });
  const [recording, setRecording] = useState(false);

  const createMut = useCreateSyntheticTest();
  const patchMut = usePatchSyntheticTest(initial?.id ?? "");

  const toggle = (k: string) =>
    setOpenSection((p) => ({ ...p, [k]: !p[k] }));

  const handleSave = async (startRecording = false) => {
    if (!form.startingUrl.trim() || !form.name.trim()) {
      alert("Starting URL and Name are required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      test_type: "browser" as const,
      subtype: "http" as const,
      method: "GET" as const,
      url: form.startingUrl.trim(),
      request: {
        headers: [],
        query: [],
        bodyType: "raw" as const,
        body: "",
        timeoutMs: 60_000,
      },
      assertions: [],
      browser_config: {
        startingUrl: form.startingUrl.trim(),
        browsers: form.browsers,
        devices: form.devices,
        steps: form.steps,
      },
      auth: { type: "none" as const },
      retry: { count: 0, intervalMs: 300 },
      alert_condition: { failingMinutes: 0, fromLocations: 1 },
      monitor_message: "",
      downtimes: [],
      locations: form.locations,
      frequency_seconds: form.frequencySeconds,
      tags: form.tags,
      environment: form.environment.trim() || null,
      team: form.team.trim() || null,
      enabled: form.enabled,
    };
    if (mode === "create") {
      const created = await createMut.mutateAsync(payload);
      if (startRecording) setRecording(true);
      router.push(`/synthetics/tests/${created.id}`);
    } else if (initial) {
      await patchMut.mutateAsync(payload);
      router.push(`/synthetics/tests/${initial.id}`);
    }
  };

  const addStep = (type: BrowserStepType) => {
    setForm((f) => ({
      ...f,
      steps: [
        ...f.steps,
        {
          id: newId(),
          type,
          target: type === "goto" ? f.startingUrl : "",
          value: "",
          ms: type === "wait" ? 1000 : null,
        },
      ],
    }));
  };

  const updateStep = (id: string, patch: Partial<BrowserStep>) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const removeStep = (id: string) => {
    setForm((f) => ({ ...f, steps: f.steps.filter((s) => s.id !== id) }));
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    setForm((f) => {
      const idx = f.steps.findIndex((s) => s.id === id);
      if (idx < 0) return f;
      const next = [...f.steps];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return f;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { ...f, steps: next };
    });
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#f8f9fa] text-[#202124]">
      <header className="flex h-12 items-center border-b border-[#dadce0] bg-white px-6">
        <div className="flex items-center gap-2 text-[13px] text-[#5f6368]">
          <Link href="/synthetics/tests" className="hover:underline">
            <SyntheticsIcon />
          </Link>
          <span>/</span>
          <Browser size={16} className="text-[#632ca6]" />
          <span className="text-[14px] font-medium text-[#202124]">
            {mode === "create" ? "New Browser Test" : form.name || "Edit Test"}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="mx-auto w-full max-w-[920px] px-6 pb-24 pt-6">
            <Section
              n={1}
              title="Test Details"
              open={openSection.details}
              onToggle={() => toggle("details")}
            >
              <div>
                <label className="text-[12px] font-medium text-[#202124]">
                  Starting URL <span className="text-[#d93025]">*</span>
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={form.startingUrl}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        startingUrl: e.target.value,
                      }))
                    }
                    placeholder="https://"
                    className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[#1a73e8]"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-mono text-[#5f6368]">{"{{"}</span>
                </div>
                <button
                  type="button"
                  className="mt-2 flex items-center gap-1 text-[12px] text-[#1a73e8] hover:underline"
                >
                  <CaretRight size={12} /> Advanced Options
                </button>
              </div>

              <div className="mt-4">
                <label className="text-[12px] font-medium text-[#202124]">
                  Name <span className="text-[#d93025]">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Give your test a name"
                  className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[#1a73e8]"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <TextField
                  label="Environment"
                  value={form.environment}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, environment: v }))
                  }
                  placeholder="Select or add env tags"
                />
                <TextField
                  label="Team"
                  value={form.team}
                  onChange={(v) => setForm((f) => ({ ...f, team: v }))}
                  placeholder="Select Teams"
                />
                <TextField
                  label="Additional Tags"
                  value={form.tags.join(", ")}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      tags: v
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="Select or add related tags"
                />
              </div>

              {!form.environment && (
                <div className="mt-3 flex items-start gap-3 rounded-md border border-[#dadce0] bg-[#f8f9fa] p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e8f0fe]">
                    <Tag size={14} className="text-[#1a73e8]" />
                  </div>
                  <div className="flex-1 text-[12px] text-[#5f6368]">
                    <div className="font-medium text-[#202124]">
                      You don't have any Environment (env) tags.
                    </div>
                    Environment tags can help you organize your tests and your
                    services.
                    <button
                      type="button"
                      className="ml-2 text-[#1a73e8] hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </Section>

            <Section
              n={2}
              title="Browsers & Devices"
              open={openSection.browsers}
              onToggle={() => toggle("browsers")}
            >
              <BrowsersAndDevicesMatrix
                browsers={form.browsers}
                devices={form.devices}
                onToggleCell={(browserId, deviceId) => {
                  setForm((f) => {
                    const browsers = f.browsers.includes(browserId)
                      ? f.browsers
                      : [...f.browsers, browserId];
                    const devices = f.devices.includes(deviceId)
                      ? f.devices
                      : [...f.devices, deviceId];
                    return { ...f, browsers, devices };
                  });
                }}
                onToggleBrowser={(b) =>
                  setForm((f) => ({
                    ...f,
                    browsers: f.browsers.includes(b)
                      ? f.browsers.filter((x) => x !== b)
                      : [...f.browsers, b],
                  }))
                }
                onToggleDevice={(d) =>
                  setForm((f) => ({
                    ...f,
                    devices: f.devices.includes(d)
                      ? f.devices.filter((x) => x !== d)
                      : [...f.devices, d],
                  }))
                }
              />
            </Section>

            <Section
              n={3}
              title="Locations"
              open={openSection.locations}
              onToggle={() => toggle("locations")}
            >
              <LocationsPicker
                selected={form.locations}
                onChange={(locs) =>
                  setForm((f) => ({ ...f, locations: locs }))
                }
              />
            </Section>

            <Section
              n={4}
              title="Recorded Steps"
              open={openSection.steps}
              onToggle={() => toggle("steps")}
            >
              <StepsEditor
                steps={form.steps}
                onAdd={addStep}
                onUpdate={updateStep}
                onRemove={removeStep}
                onMove={moveStep}
                recording={recording}
                onToggleRecording={() => setRecording((r) => !r)}
              />
            </Section>

            <Section
              n={5}
              title="Scheduling"
              open={openSection.schedule}
              onToggle={() => toggle("schedule")}
            >
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] font-medium text-[#202124]">
                    Frequency
                  </label>
                  <select
                    value={form.frequencySeconds}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        frequencySeconds: Number(e.target.value),
                      }))
                    }
                    className="mt-1 block w-[240px] rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none"
                  >
                    <option value={300}>5 minutes</option>
                    <option value={600}>10 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={1800}>30 minutes</option>
                    <option value={3600}>1 hour</option>
                    <option value={21600}>6 hours</option>
                    <option value={86400}>1 day</option>
                    <option value={604800}>1 week</option>
                  </select>
                </div>
                <p className="text-[12px] text-[#5f6368]">
                  Browser tests are typically scheduled less frequently than
                  API tests because they run a full browser session.
                </p>
              </div>
            </Section>
          </div>

          <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-[#dadce0] bg-white px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/synthetics/tests")}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={createMut.isPending || patchMut.isPending}
              className="gap-1"
            >
              <Record size={12} />
              Save & Start Recording
            </Button>
          </div>
        </div>

        <aside className="flex w-[360px] flex-col border-l border-[#dadce0] bg-white">
          <BrowserSnippetsPanel
            onApply={(snip) =>
              setForm((f) => {
                if (snip === "large_screen")
                  return { ...f, devices: ["laptop_large"], browsers: ["chrome", "firefox", "edge"] };
                if (snip === "tablet")
                  return { ...f, devices: ["tablet"] };
                if (snip === "mobile")
                  return { ...f, devices: ["mobile_small"] };
                if (snip === "multi_region")
                  return {
                    ...f,
                    locations: [
                      "aws:us-east-1",
                      "aws:eu-west-1",
                      "aws:ap-southeast-1",
                    ],
                  };
                return f;
              })
            }
          />
        </aside>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="relative mb-1 pl-9">
      <div className="absolute left-3 top-0 h-full w-px bg-[#dadce0]" />
      <button
        type="button"
        onClick={onToggle}
        className="absolute left-0 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#632ca6] bg-white text-[11px] font-semibold text-[#632ca6]"
      >
        {n}
      </button>
      <div className="rounded-md bg-white">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-2 px-2 py-3 text-left transition-colors hover:bg-[#f8f9fa]"
        >
          {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
          <span className="text-[14px] font-medium">{title}</span>
        </button>
        {open && <div className="px-2 pb-4">{children}</div>}
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[#202124]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[#1a73e8]"
      />
    </div>
  );
}

function BrowserLogo({ id }: { id: string }) {
  if (id === "chrome") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4" fill="#1a73e8" />
        <path
          d="M12 8h8.5a10 10 0 0 0-15.5-3.5z"
          fill="#ea4335"
        />
        <path
          d="M3 9.5a10 10 0 0 0 4.5 12.5l3.5-6.5z"
          fill="#34a853"
        />
        <path
          d="M16.5 14a10 10 0 0 1-9.5 8.5L13 13z"
          fill="#fbbc04"
        />
      </svg>
    );
  }
  if (id === "edge") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#0078d4" />
        <path d="M7 16c1-3 4-4 7-3" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "firefox") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#ff7139" />
        <circle cx="13" cy="11" r="4" fill="#ffcb05" />
      </svg>
    );
  }
  return null;
}

function BrowsersAndDevicesMatrix({
  browsers,
  devices,
  onToggleCell,
  onToggleBrowser,
  onToggleDevice,
}: {
  browsers: string[];
  devices: string[];
  onToggleCell: (browser: string, device: string) => void;
  onToggleBrowser: (b: string) => void;
  onToggleDevice: (d: string) => void;
}) {
  return (
    <div>
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            <th className="w-[120px]" />
            {BROWSERS.map((b) => (
              <th key={b.id} className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => onToggleBrowser(b.id)}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-[#202124] hover:underline"
                >
                  <Checkbox checked={browsers.includes(b.id)} />
                  <BrowserLogo id={b.id} />
                  {b.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DEVICES.map((d) => (
            <tr key={d.id}>
              <td className="py-2">
                <button
                  type="button"
                  onClick={() => onToggleDevice(d.id)}
                  className="text-[13px] text-[#202124] hover:underline"
                >
                  {d.label}
                </button>
              </td>
              {BROWSERS.map((b) => {
                const on =
                  browsers.includes(b.id) && devices.includes(d.id);
                return (
                  <td key={b.id} className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleCell(b.id, d.id)}
                      className="inline-flex"
                    >
                      <Checkbox checked={on} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LocationsPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (s: string[]) => void;
}) {
  const grouped = useMemo(() => {
    const out: Record<string, typeof LOCATIONS[number][]> = {
      Americas: [],
      EMEA: [],
      "Asia Pacific": [],
    };
    for (const l of LOCATIONS) out[l.region].push(l);
    return out;
  }, []);

  const allSelected = selected.length === ALL_LOCATION_IDS.length;
  const toggleAll = () =>
    onChange(allSelected ? [] : [...ALL_LOCATION_IDS]);

  const toggleRegion = (region: string) => {
    const ids = grouped[region].map((l) => l.id);
    const allOn = ids.every((i) => selected.includes(i));
    if (allOn) onChange(selected.filter((s) => !ids.includes(s)));
    else {
      const next = new Set(selected);
      ids.forEach((i) => next.add(i));
      onChange([...next]);
    }
  };

  const toggle = (id: string) =>
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={toggleAll}
        className="flex items-center gap-2 text-[13px] text-[#202124] hover:underline"
      >
        <Checkbox checked={allSelected} />
        <span className="font-medium">All Locations ({LOCATIONS.length})</span>
      </button>

      <div className="flex items-center gap-2">
        <Checkbox checked={allSelected} />
        <span className="text-[13px] font-medium">
          Managed Locations ({LOCATIONS.length})
        </span>
        <div className="ml-auto flex items-center gap-1">
          <BrowserLogo id="chrome" />
          <BrowserLogo id="firefox" />
          <BrowserLogo id="edge" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {REGIONS.map((region) => {
          const ids = grouped[region].map((l) => l.id);
          const allOn = ids.length > 0 && ids.every((i) => selected.includes(i));
          const someOn = !allOn && ids.some((i) => selected.includes(i));
          return (
            <button
              key={region}
              type="button"
              onClick={() => toggleRegion(region)}
              className="flex items-center gap-2 rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4]"
            >
              <Checkbox checked={allOn} indeterminate={someOn} />
              <span>
                {region} ({ids.length})
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {LOCATIONS.map((loc) => {
          const on = selected.includes(loc.id);
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => toggle(loc.id)}
              className={
                "flex items-center gap-2 rounded-md border px-2 py-1 text-left text-[12px] transition-colors " +
                (on
                  ? "border-[#006CC2] bg-[#e6f1f9] text-[#006CC2]"
                  : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]")
              }
            >
              <Checkbox checked={on} />
              {loc.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  indeterminate,
}: {
  checked: boolean;
  indeterminate?: boolean;
}) {
  const bg = checked || indeterminate ? "#006CC2" : "white";
  return (
    <span
      className={
        "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border " +
        (checked || indeterminate ? "border-[#006CC2]" : "border-[#bdc1c6]")
      }
      style={{ backgroundColor: bg }}
    >
      {checked && !indeterminate && (
        <span className="text-[9px] leading-none text-white">✓</span>
      )}
      {indeterminate && (
        <span className="block h-[2px] w-2 rounded-sm bg-white" />
      )}
    </span>
  );
}

function StepsEditor({
  steps,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  recording,
  onToggleRecording,
}: {
  steps: BrowserStep[];
  onAdd: (t: BrowserStepType) => void;
  onUpdate: (id: string, patch: Partial<BrowserStep>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  recording: boolean;
  onToggleRecording: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between rounded-md bg-[#f8f9fa] p-2">
        <div className="flex items-center gap-2 text-[12px] text-[#5f6368]">
          <span
            className={
              "h-2 w-2 rounded-full " +
              (recording ? "animate-pulse bg-[#d93025]" : "bg-[#bdc1c6]")
            }
          />
          {recording
            ? "Recording — open the test in a browser tab to capture steps."
            : "Recording paused — add steps manually or click record."}
        </div>
        <button
          type="button"
          onClick={onToggleRecording}
          className={
            "flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] " +
            (recording
              ? "border-[#d93025] bg-white text-[#d93025] hover:bg-[#fce8e6]"
              : "border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4]")
          }
        >
          <Record size={12} weight={recording ? "fill" : "regular"} />
          {recording ? "Stop" : "Start Recording"}
        </button>
      </div>

      <div className="space-y-1.5">
        {steps.length === 0 && (
          <div className="rounded-md border border-dashed border-[#dadce0] bg-[#f8f9fa] px-3 py-4 text-center text-[12px] text-[#9aa0a6]">
            No steps yet — start recording, or add the first step manually.
          </div>
        )}
        {steps.map((s, i) => (
          <StepRow
            key={s.id}
            index={i}
            step={s}
            onUpdate={(patch) => onUpdate(s.id, patch)}
            onRemove={() => onRemove(s.id)}
            onUp={() => onMove(s.id, -1)}
            onDown={() => onMove(s.id, 1)}
            isFirst={i === 0}
            isLast={i === steps.length - 1}
          />
        ))}
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#80868b]">
          Add step
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {STEP_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onAdd(t.value)}
              className="flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2 py-1.5 text-left text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              {STEP_ICON[t.value]}
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepRow({
  index,
  step,
  onUpdate,
  onRemove,
  onUp,
  onDown,
  isFirst,
  isLast,
}: {
  index: number;
  step: BrowserStep;
  onUpdate: (patch: Partial<BrowserStep>) => void;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const meta = STEP_TYPES.find((t) => t.value === step.type);
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#dadce0] bg-white p-2">
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#f1f3f4] text-[11px] font-semibold text-[#5f6368]">
        {index + 1}
      </span>
      <span className="flex items-center gap-1.5 rounded bg-[#f1f3f4] px-2 py-0.5 text-[12px] text-[#5f6368]">
        {STEP_ICON[step.type]}
        {meta?.label ?? step.type}
      </span>
      {meta?.needsTarget && (
        <input
          type="text"
          value={step.target ?? ""}
          onChange={(e) => onUpdate({ target: e.target.value })}
          placeholder={
            step.type === "goto"
              ? "https://example.com"
              : "CSS selector e.g. #login"
          }
          className="flex-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none focus:border-[#1a73e8]"
        />
      )}
      {meta?.needsValue && (
        <input
          type="text"
          value={step.value ?? ""}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder={
            step.type === "assert_contains" ? "expected text" : "value"
          }
          className="flex-1 rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none focus:border-[#1a73e8]"
        />
      )}
      {meta?.needsMs && (
        <input
          type="number"
          value={step.ms ?? 0}
          onChange={(e) => onUpdate({ ms: Number(e.target.value) })}
          placeholder="ms"
          className="w-[100px] rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] outline-none focus:border-[#1a73e8]"
        />
      )}
      <div className="ml-auto flex items-center">
        <button
          type="button"
          onClick={onUp}
          disabled={isFirst}
          className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-30"
          title="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onDown}
          disabled={isLast}
          className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-30"
          title="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-[#5f6368] hover:bg-[#fce8e6] hover:text-[#d93025]"
        >
          <Trash size={12} />
        </button>
      </div>
    </div>
  );
}

function BrowserSnippetsPanel({
  onApply,
}: {
  onApply: (snip: string) => void;
}) {
  return (
    <div className="overflow-auto p-3">
      <div className="mb-2 flex">
        <button
          type="button"
          className="border-b-2 border-[#006CC2] px-3 py-1.5 text-[12px] font-medium text-[#202124]"
        >
          Snippets
        </button>
        <button
          type="button"
          className="border-b-2 border-transparent px-3 py-1.5 text-[12px] text-[#5f6368]"
        >
          Variables <span className="ml-1">0</span>
        </button>
      </div>

      <SnippetGroup
        icon={<Browser size={14} className="text-[#1a73e8]" weight="fill" />}
        label="Devices"
        count={3}
        items={[
          {
            id: "large_screen",
            title: "Large Screen Check",
            sub: "Test your website on a large screen across browsers",
          },
          {
            id: "tablet",
            title: "Tablet Check",
            sub: "Test your website on a tablet sized screen across browsers",
          },
          {
            id: "mobile",
            title: "Mobile Screen Check",
            sub: "Test your website on a mobile sized screen across browsers",
          },
        ]}
        onApply={onApply}
      />

      <SnippetGroup
        icon={<Globe size={14} className="text-[#34a853]" weight="fill" />}
        label="Regions"
        count={1}
        items={[
          {
            id: "multi_region",
            title: "Multi-Region Check",
            sub: "Test your website against a location in each of the three primary geographic regions (AMER, APAC and EMEA)",
          },
        ]}
        onApply={onApply}
      />

      <SnippetGroup
        icon={<Lightning size={14} className="text-[#7a3edb]" weight="fill" />}
        label="Network"
        count={1}
        items={[
          {
            id: "block_ads",
            title: "Block Ad Networks",
            sub: "Test your website while blocking common third-party ad networks",
          },
        ]}
        onApply={onApply}
      />
    </div>
  );
}

function SnippetGroup({
  icon,
  label,
  count,
  items,
  onApply,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  items: { id: string; title: string; sub: string }[];
  onApply: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex w-full items-center gap-1.5 text-left"
      >
        {icon}
        <span className="text-[13px] font-medium text-[#202124]">{label}</span>
        <span className="text-[12px] text-[#5f6368]">{count} snippets</span>
        {open ? <CaretDown size={11} /> : <CaretRight size={11} />}
      </button>
      {open && (
        <div className="space-y-1">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onApply(it.id)}
              className="block w-full rounded-md border border-[#dadce0] bg-white p-2 text-left hover:bg-[#f8f9fa]"
            >
              <div className="text-[12px] font-medium text-[#202124]">
                {it.title}
              </div>
              <div className="mt-0.5 text-[11px] text-[#5f6368]">{it.sub}</div>
            </button>
          ))}
        </div>
      )}
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
