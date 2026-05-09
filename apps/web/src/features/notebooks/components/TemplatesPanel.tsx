"use client";

import {
  BookOpen,
  Broadcast,
  ChartLine,
  DotsThreeVertical,
  MagnifyingGlass,
  Notebook as NotebookIcon,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { notebookSlug } from "../api";
import {
  useCreateNotebook,
  useCreateNotebookTemplate,
  useDeleteNotebookTemplate,
  useInstantiateNotebookTemplate,
  useNotebookTemplates,
} from "../hooks";
import { cellsForTemplate, type TemplateKey } from "../templates";
import type { NotebookTemplate } from "../types";

type FeaturedTemplate = {
  key: TemplateKey | "logs_analysis" | "runbook" | "incident_report";
  label: string;
  description: string;
  icon: typeof NotebookIcon;
  iconBg: string;
  available: boolean;
};

const FEATURED: FeaturedTemplate[] = [
  {
    key: "blank",
    label: "Get started with Notebooks",
    description: "Explore visualization, analysis, rich text features and more.",
    icon: BookOpen,
    iconBg: "linear-gradient(135deg, #b794f4 0%, #9f7aea 100%)",
    available: true,
  },
  {
    key: "incident_report",
    label: "Incident Postmortem",
    description: "Improve system resilience through reflection and analysis.",
    icon: Broadcast,
    iconBg: "linear-gradient(135deg, #f687b3 0%, #ed64a6 100%)",
    available: true,
  },
  {
    key: "logs_analysis",
    label: "Logs Analysis",
    description:
      "Analyze logs with SQL queries, transformations, and visualizations.",
    icon: MagnifyingGlass,
    iconBg: "linear-gradient(135deg, #38b2ac 0%, #319795 100%)",
    available: true,
  },
  {
    key: "runbook",
    label: "Runbook",
    description:
      "Create runbooks with live data and rich text to help responders quickly resolve issues.",
    icon: NotebookIcon,
    iconBg: "linear-gradient(135deg, #4299e1 0%, #3182ce 100%)",
    available: true,
  },
  {
    key: "postmortem",
    label: "SLO Performance Review",
    description:
      "Review the performance of your SLOs and find areas of improvement.",
    icon: ChartLine,
    iconBg: "linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)",
    available: true,
  },
];

export function TemplatesPanel() {
  const router = useRouter();
  const { data: templates, isLoading } = useNotebookTemplates();
  const createTemplateMut = useCreateNotebookTemplate();
  const createNotebookMut = useCreateNotebook();
  const instantiateMut = useInstantiateNotebookTemplate();

  const customTemplates = useMemo(() => templates ?? [], [templates]);

  const handleNewTemplate = async () => {
    const t = await createTemplateMut.mutateAsync({
      name: "",
      cells: [],
    });
    router.push(`/notebook/template/${t.id}`);
  };

  const handleOpenTemplate = (t: NotebookTemplate) => {
    router.push(`/notebook/template/${t.id}`);
  };

  const handleUseFeatured = async (t: FeaturedTemplate) => {
    if (t.key === "logs_analysis") {
      const nb = await createNotebookMut.mutateAsync({
        name: "Logs Analysis",
        cells: [
          {
            id: `c_${Math.random().toString(36).slice(2, 10)}`,
            kind: "markdown",
            html: "<h1>Logs Analysis</h1><p>Use SQL queries below to slice your logs by service, status, and time.</p>",
          },
          {
            id: `c_${Math.random().toString(36).slice(2, 10)}`,
            kind: "markdown",
            html: "<h3>Query</h3><pre><code>SELECT service, count(*) FROM logs WHERE status = 'error' GROUP BY service ORDER BY 2 DESC LIMIT 20;</code></pre>",
          },
        ],
      });
      router.push(`/notebook/${nb.id}/${notebookSlug(nb.name)}`);
      return;
    }
    if (t.key === "runbook") {
      const nb = await createNotebookMut.mutateAsync({
        name: "Runbook",
        cells: [
          {
            id: `c_${Math.random().toString(36).slice(2, 10)}`,
            kind: "markdown",
            html: "<h1>Runbook: How to troubleshoot</h1>",
          },
          {
            id: `c_${Math.random().toString(36).slice(2, 10)}`,
            kind: "markdown",
            html: "<h3>Step 1</h3><p>Check the dashboard for error spikes.</p>",
          },
          {
            id: `c_${Math.random().toString(36).slice(2, 10)}`,
            kind: "markdown",
            html: "<h3>Step 2</h3><p>Tail the service logs and identify failing endpoints.</p>",
          },
          {
            id: `c_${Math.random().toString(36).slice(2, 10)}`,
            kind: "markdown",
            html: "<h3>Step 3</h3><p>Roll back the most recent deploy if errors started after deploy.</p>",
          },
        ],
      });
      router.push(`/notebook/${nb.id}/${notebookSlug(nb.name)}`);
      return;
    }
    const cells = cellsForTemplate(t.key as TemplateKey);
    const name =
      t.key === "blank" ? "Get started with Notebooks" : t.label;
    const nb = await createNotebookMut.mutateAsync({ name, cells });
    router.push(`/notebook/${nb.id}/${notebookSlug(nb.name)}`);
  };

  const handleUseCustom = async (t: NotebookTemplate) => {
    const r = await instantiateMut.mutateAsync(t.id);
    router.push(`/notebook/${r.id}/${notebookSlug(r.name)}`);
  };

  return (
    <div className="px-6 pb-12 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-semibold text-[#202124]">
            Custom Templates
          </h2>
          <p className="mt-1 text-[13px] text-[#5f6368]">
            Shared across your organization.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleNewTemplate}
          disabled={createTemplateMut.isPending}
        >
          <Plus size={12} weight="bold" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && (
          <div className="col-span-full text-[13px] text-[#5f6368]">
            Loading templates…
          </div>
        )}
        {!isLoading && customTemplates.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-[#dadce0] p-8 text-center text-[13px] text-[#5f6368]">
            No custom templates yet — click{" "}
            <span className="font-medium text-[#006CC2]">New Template</span> to
            create one.
          </div>
        )}
        {customTemplates.map((t) => (
          <CustomTemplateCard
            key={t.id}
            template={t}
            onOpen={() => handleOpenTemplate(t)}
            onUse={() => handleUseCustom(t)}
          />
        ))}
      </div>

      <div className="mt-12">
        <h2 className="text-[20px] font-semibold text-[#202124]">Featured</h2>
        <p className="mt-1 text-[13px] text-[#5f6368]">
          Get the most from Datadog with ready-made templates.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2">
          {FEATURED.map((f) => (
            <FeaturedCard
              key={f.key}
              tpl={f}
              onUse={() => handleUseFeatured(f)}
              disabled={createNotebookMut.isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomTemplateCard({
  template,
  onOpen,
  onUse,
}: {
  template: NotebookTemplate;
  onOpen: () => void;
  onUse: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const deleteMut = useDeleteNotebookTemplate();

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const initials = template.author.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2);

  return (
    <div
      ref={ref}
      className="group relative cursor-pointer rounded-lg border border-[#dadce0] bg-white p-4 transition-shadow hover:shadow-md"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between">
        <h3 className="pr-8 text-[15px] font-semibold text-[#202124]">
          {template.name}
        </h3>
        <button
          type="button"
          aria-label="Template actions"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="absolute right-3 top-3 rounded p-1 text-[#5f6368] opacity-0 transition-opacity hover:bg-[#f1f3f4] group-hover:opacity-100"
        >
          <DotsThreeVertical size={14} weight="bold" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-3 top-9 z-20 w-40 overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onUse();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <Plus size={12} weight="bold" />
              Use template
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                if (confirm(`Delete template "${template.name}"?`)) {
                  deleteMut.mutate(template.id);
                }
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#d93025] hover:bg-[#fce8e6]"
            >
              <Trash size={12} />
              Delete template
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: template.author.avatarColor }}
        >
          {initials}
        </span>
        <span className="text-[13px] text-[#202124]">
          {template.author.name}
        </span>
      </div>
    </div>
  );
}

function FeaturedCard({
  tpl,
  onUse,
  disabled,
}: {
  tpl: FeaturedTemplate;
  onUse: () => void;
  disabled?: boolean;
}) {
  const Icon = tpl.icon;
  return (
    <button
      type="button"
      onClick={onUse}
      disabled={disabled || !tpl.available}
      className="flex w-full flex-col items-start gap-3 rounded-lg border border-[#dadce0] bg-white p-4 text-left transition-shadow hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex w-full items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: tpl.iconBg }}
        >
          <Icon size={20} weight="fill" className="text-white" />
        </span>
        <div className="flex-1">
          <div className="text-[15px] font-semibold text-[#202124]">
            {tpl.label}
          </div>
        </div>
      </div>
      <div className="border-t border-[#e8eaed] pt-3 text-[13px] text-[#5f6368] w-full">
        {tpl.description}
      </div>
    </button>
  );
}
