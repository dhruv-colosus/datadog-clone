"use client";

import {
  BookOpen,
  ClockCounterClockwise,
  DotsThreeVertical,
  ListBullets,
  Notebook as NotebookIcon,
  Plus,
  Star,
  Trash,
  Users,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/features/auth/store";
import { notebookSlug } from "../api";
import {
  useCreateNotebook,
  useCreateNotebookTemplate,
  useDeleteNotebook,
  useNotebooks,
  usePatchNotebook,
} from "../hooks";
import { cellsForTemplate, TEMPLATES, type TemplateKey } from "../templates";
import type { Notebook } from "../types";
import { TemplatesPanel } from "./TemplatesPanel";

type SidebarTab =
  | "my"
  | "team"
  | "recents"
  | "favorites"
  | "all"
  | "deleted"
  | "templates";

const SIDEBAR_GROUPS: {
  group: "primary" | "all" | "templates";
  items: { id: SidebarTab; label: string; icon: typeof BookOpen }[];
}[] = [
  {
    group: "primary",
    items: [
      { id: "my", label: "My Notebooks", icon: NotebookIcon },
      { id: "team", label: "My Team's Notebooks", icon: BookOpen },
      { id: "recents", label: "Recents", icon: ClockCounterClockwise },
      { id: "favorites", label: "Favorites", icon: Star },
    ],
  },
  {
    group: "all",
    items: [
      { id: "all", label: "All Notebooks", icon: BookOpen },
      { id: "deleted", label: "Recently Deleted", icon: Trash },
    ],
  },
  {
    group: "templates",
    items: [{ id: "templates", label: "Templates", icon: ListBullets }],
  },
];

export function NotebooksList() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: notebooks, isLoading } = useNotebooks();
  const createMut = useCreateNotebook();
  const [activeTab, setActiveTab] = useState<SidebarTab>("my");

  const filtered = useMemo(() => {
    let list = notebooks ?? [];
    if (activeTab === "favorites") list = list.filter((n) => n.favorite);
    if (activeTab === "recents") list = list.slice(0, 20);
    if (activeTab === "my" && user?.id != null)
      list = list.filter((n) => n.ownerId === user.id);
    if (activeTab === "deleted") list = [];
    return list;
  }, [notebooks, activeTab, user?.id]);

  const onCreateFromTemplate = async (key: TemplateKey) => {
    const firstName = (user?.name || "").trim().split(/\s+/)[0] || "Notebook";
    const meta = TEMPLATES.find((t) => t.key === key);
    const name =
      key === "blank" || !meta
        ? defaultNotebookName(firstName)
        : meta.defaultName;
    const cells = cellsForTemplate(key);
    const nb = await createMut.mutateAsync({ name, cells });
    router.push(`/notebook/${nb.id}/${notebookSlug(nb.name)}`);
  };

  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <Header
        onCreateFromTemplate={onCreateFromTemplate}
        templatesActive={activeTab === "templates"}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} onSelect={setActiveTab} />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {activeTab === "templates" ? (
              <TemplatesPanel />
            ) : (
              <>
                <GetStartedPanel
                  onCreate={onCreateFromTemplate}
                  creating={createMut.isPending}
                />

                <div className="px-6 pb-12 pt-2">
                  <h2 className="text-[20px] font-semibold text-[#202124]">
                    {sectionTitle(activeTab)}
                  </h2>
                  <NotebookTable
                    loading={isLoading}
                    notebooks={filtered}
                    onOpen={(n) =>
                      router.push(`/notebook/${n.id}/${notebookSlug(n.name)}`)
                    }
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function sectionTitle(tab: SidebarTab): string {
  switch (tab) {
    case "my":
      return "Created by me";
    case "team":
      return "My Team's Notebooks";
    case "recents":
      return "Recents";
    case "favorites":
      return "Favorites";
    case "all":
      return "All Notebooks";
    case "deleted":
      return "Recently Deleted";
    case "templates":
      return "Templates";
  }
}

function Header({
  onCreateFromTemplate,
  templatesActive,
}: {
  onCreateFromTemplate: (key: TemplateKey) => void;
  templatesActive: boolean;
}) {
  const router = useRouter();
  const createTemplateMut = useCreateNotebookTemplate();
  const handleNewTemplate = async () => {
    const t = await createTemplateMut.mutateAsync({ name: "", cells: [] });
    router.push(`/notebook/template/${t.id}`);
  };
  return (
    <div className="flex items-center justify-between border-b border-[#dadce0] px-6 py-3">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <NotebookIcon size={18} className="text-[#202124]" weight="fill" />
          <h1 className="text-[16px] font-medium">Notebooks</h1>
        </div>
        <nav className="flex items-center gap-1 text-[13px]">
          <TabLink label="List" active />
          <TabLink label="Reports" />
        </nav>
      </div>
      {templatesActive ? (
        <Button
          variant="primary"
          onClick={handleNewTemplate}
          disabled={createTemplateMut.isPending}
        >
          <Plus size={12} weight="bold" />
          New Template
        </Button>
      ) : (
        <NewNotebookMenu onPick={onCreateFromTemplate} />
      )}
    </div>
  );
}

function NewNotebookMenu({
  onPick,
}: {
  onPick: (key: TemplateKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handlePick = (key: TemplateKey) => {
    setOpen(false);
    onPick(key);
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="primary"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={12} weight="bold" />
        New Notebook
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-md border border-[#dadce0] bg-white py-1 shadow-xl">
          <DropdownItem onClick={() => handlePick("blank")}>
            Blank Notebook
          </DropdownItem>
          <div className="border-t border-[#f1f3f4]" />
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f6368]">
            Start with template
          </div>
          <DropdownItem onClick={() => handlePick("postmortem")}>
            Postmortem
          </DropdownItem>
          <DropdownItem disabled title="Coming soon">
            Runbook
          </DropdownItem>
          <DropdownItem disabled title="Coming soon">
            Incident Report
          </DropdownItem>
          <div className="border-t border-[#f1f3f4]" />
          <DropdownItem disabled title="Coming soon">
            All Templates
          </DropdownItem>
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex w-full items-center px-3 py-2 text-left text-[13px] ${
        disabled
          ? "cursor-not-allowed text-[#9aa0a6]"
          : "text-[#202124] hover:bg-[#f1f3f4]"
      }`}
    >
      {children}
    </button>
  );
}

function TabLink({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      className={`relative px-3 py-1.5 text-[13px] ${
        active ? "text-[#202124]" : "text-[#5f6368] hover:text-[#202124]"
      }`}
    >
      {label}
      {active && (
        <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-[#006CC2]" />
      )}
    </button>
  );
}

function Sidebar({
  activeTab,
  onSelect,
}: {
  activeTab: SidebarTab;
  onSelect: (tab: SidebarTab) => void;
}) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-2 border-r border-[#dadce0] bg-white py-4">
      {SIDEBAR_GROUPS.map((group, i) => (
        <div key={i} className="flex flex-col gap-0.5 px-2">
          {i > 0 && <div className="my-2 border-t border-[#e8eaed]" />}
          {group.items.map((item) => {
            const active = item.id === activeTab;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                  active
                    ? "bg-[#006CC2] text-white"
                    : "text-[#202124] hover:bg-[#f1f3f4]"
                }`}
              >
                <Icon
                  size={14}
                  weight={active ? "fill" : "regular"}
                  className={active ? "text-white" : "text-[#5f6368]"}
                />
                {item.label}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

function GetStartedPanel({
  onCreate,
  creating,
}: {
  onCreate: (key: TemplateKey) => void;
  creating: boolean;
}) {
  return (
    <div className="px-6 pt-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_3fr]">
        <div>
          <h2 className="text-[20px] font-semibold text-[#202124]">
            Get started fast
          </h2>
          <p className="mt-1 text-[13px] text-[#5f6368]">
            Browse through our templates
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={() => onCreate("blank")}
              disabled={creating}
            >
              <Plus size={12} weight="bold" className="text-[#006CC2]" />
              <span className="text-[#006CC2]">Blank Notebook</span>
            </Button>
            <Button>View All Templates ›</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <TemplateCard
            label="Postmortem"
            description="Analyze root cause & learnings"
            preview={<PostmortemPreview />}
            onClick={() => onCreate("postmortem")}
            disabled={creating}
          />
          <TemplateCard
            label="Runbook"
            description="Step-by-step procedures for incidents"
            preview={<RunbookPreview />}
            disabled
          />
          <TemplateCard
            label="Incident Report"
            description="Analyze incidents over time"
            preview={<IncidentPreview />}
            disabled
          />
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  label,
  description,
  preview,
  onClick,
  disabled,
}: {
  label: string;
  description: string;
  preview: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const interactive = !!onClick && !disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col rounded-lg border-2 border-[#cfe3f5] bg-white p-3 text-left transition-shadow ${
        interactive
          ? "cursor-pointer hover:shadow-md hover:border-[#006CC2]"
          : "cursor-not-allowed opacity-70"
      }`}
      title={disabled ? "Coming soon" : undefined}
    >
      <div className="h-[140px] w-full overflow-hidden rounded-md bg-[#f0f7fc] p-3">
        {preview}
      </div>
      <div className="mt-3">
        <div className="text-[14px] font-semibold text-[#202124]">{label}</div>
        <div className="mt-0.5 text-[12px] text-[#5f6368]">{description}</div>
      </div>
    </button>
  );
}

function PostmortemPreview() {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[#5f6368]">
        <div className="rounded border border-[#e0e0e0] bg-white px-1.5 py-1">
          Incident Property
        </div>
        <div className="rounded border border-[#e0e0e0] bg-white px-1.5 py-1">
          Details
        </div>
        <div className="rounded border border-[#e0e0e0] bg-white px-1.5 py-1">
          <div className="h-1 w-3/4 rounded-sm bg-[#dadce0]" />
        </div>
        <div className="rounded border border-[#e0e0e0] bg-white px-1.5 py-1">
          <div className="h-1 w-3/4 rounded-sm bg-[#dadce0]" />
        </div>
      </div>
      <div className="rounded bg-white px-1.5 py-1 text-[10px] text-[#5f6368]">
        What Happened?
      </div>
      <div className="space-y-1 px-1.5">
        <div className="h-1 w-full rounded-sm bg-[#dadce0]" />
        <div className="h-1 w-5/6 rounded-sm bg-[#dadce0]" />
        <div className="h-1 w-3/4 rounded-sm bg-[#dadce0]" />
      </div>
    </div>
  );
}

function RunbookPreview() {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-[10px] font-medium text-[#202124]">
        How to troubleshoot
      </div>
      {["Step 1", "Step 2", "Step 3"].map((s) => (
        <div key={s} className="space-y-1">
          <div className="text-[9px] font-medium text-[#5f6368]">{s}</div>
          <div className="h-1 w-full rounded-sm bg-[#dadce0]" />
          <div className="h-1 w-3/4 rounded-sm bg-[#dadce0]" />
        </div>
      ))}
    </div>
  );
}

function IncidentPreview() {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-[10px] font-medium text-[#202124]">Summary</div>
      <div className="space-y-1">
        <div className="h-1 w-full rounded-sm bg-[#dadce0]" />
        <div className="h-1 w-5/6 rounded-sm bg-[#dadce0]" />
      </div>
      <div className="text-[10px] font-medium text-[#202124]">Analysis</div>
      <div className="rounded border border-[#e0e0e0] bg-white p-2">
        <div className="text-[9px] text-[#5f6368]">Total incidents</div>
        <div className="text-[20px] font-bold text-[#202124]">3</div>
      </div>
    </div>
  );
}

function NotebookTable({
  loading,
  notebooks,
  onOpen,
}: {
  loading: boolean;
  notebooks: Notebook[];
  onOpen: (n: Notebook) => void;
}) {
  return (
    <div className="mt-4 rounded-md border border-[#dadce0]">
      <div className="flex items-center justify-between border-b border-[#dadce0] bg-[#f8f9fa] px-4 py-2 text-[12px] text-[#5f6368]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#202124]">
            {notebooks.length} {notebooks.length === 1 ? "result" : "results"}
          </span>
          <span className="h-3 w-px bg-[#dadce0]" />
          <button
            type="button"
            disabled
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[#9aa0a6]"
          >
            <Trash size={12} />
            Delete
          </button>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 text-[#5f6368] hover:text-[#202124]"
        >
          <span className="text-[10px]">↑↓</span>
          Favorite
        </button>
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[#dadce0] text-[11px] uppercase tracking-wide text-[#5f6368]">
            <th className="w-10 px-3 py-2 text-left">
              <input type="checkbox" disabled />
            </th>
            <th className="w-8 px-1 py-2"></th>
            <th className="w-8 px-1 py-2"></th>
            <th className="px-3 py-2 text-left font-medium">Details</th>
            <th className="w-[180px] px-3 py-2 text-left font-medium">
              Author
            </th>
            <th className="w-[120px] px-3 py-2 text-left font-medium">Team</th>
            <th className="w-[160px] px-3 py-2 text-left font-medium">
              Modified
            </th>
            <th className="w-12 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={8}
                className="px-6 py-12 text-center text-[13px] text-[#5f6368]"
              >
                Loading…
              </td>
            </tr>
          )}
          {!loading && notebooks.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-6 py-12 text-center text-[13px] text-[#5f6368]"
              >
                No notebooks yet — click{" "}
                <span className="font-medium text-[#006CC2]">New Notebook</span>{" "}
                to create one.
              </td>
            </tr>
          )}
          {!loading &&
            notebooks.map((n) => (
              <NotebookRow key={n.id} notebook={n} onOpen={() => onOpen(n)} />
            ))}
        </tbody>
      </table>
    </div>
  );
}

function NotebookRow({
  notebook,
  onOpen,
}: {
  notebook: Notebook;
  onOpen: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const patchMut = usePatchNotebook(notebook.id);
  const deleteMut = useDeleteNotebook();

  const toggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    patchMut.mutate({ favorite: !notebook.favorite });
  };

  return (
    <tr
      className="group cursor-pointer border-b border-[#e8eaed] last:border-b-0 hover:bg-[#f8f9fa]"
      onClick={onOpen}
    >
      <td className="px-3 py-2">
        <input type="checkbox" onClick={(e) => e.stopPropagation()} />
      </td>
      <td className="px-1 py-2">
        <button
          type="button"
          onClick={toggleFav}
          className="rounded p-1 text-[#5f6368] hover:text-[#f59e0b]"
          aria-label="Favorite"
        >
          <Star
            size={14}
            weight={notebook.favorite ? "fill" : "regular"}
            className={notebook.favorite ? "text-[#f59e0b]" : ""}
          />
        </button>
      </td>
      <td className="px-1 py-2 text-[#9aa0a6]">
        <NotebookIcon size={14} />
      </td>
      <td className="px-3 py-2 text-[#202124]">
        <span className="hover:text-[#006CC2]">{notebook.name}</span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: notebook.author.avatarColor }}
            aria-hidden
          >
            {notebook.author.name
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)}
          </span>
          <span className="truncate text-[#202124]">{notebook.author.name}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-[#5f6368]">
        {notebook.access === "org" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-medium text-[#137333]">
            <Users size={12} weight="fill" />
            Org
          </span>
        ) : (
          <Users size={14} className="text-[#bdc1c6]" />
        )}
      </td>
      <td className="px-3 py-2 text-[#5f6368]">
        <div>{relativeTime(notebook.modifiedMs)}</div>
        <div className="text-[11px] text-[#9aa0a6]">
          created {shortDate(notebook.createdMs)}
        </div>
      </td>
      <td className="relative px-3 py-2 text-right">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="rounded p-1 text-[#5f6368] hover:bg-[#e8eaed]"
          aria-label="Row actions"
        >
          <DotsThreeVertical size={14} weight="bold" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-3 z-20 mt-1 w-32 overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                deleteMut.mutate(notebook.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <Trash size={12} />
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return shortDate(ms);
}

function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
}

function defaultNotebookName(firstName: string): string {
  const d = new Date();
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate().toString().padStart(2, "0");
  const year = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${firstName} ${month} ${day} ${year} ${hh}:${mm}`;
}
