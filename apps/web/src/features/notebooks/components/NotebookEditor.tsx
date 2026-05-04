"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowsCounterClockwise,
  Books,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  CaretRight,
  ChartLine,
  Code as CodeIcon,
  Copy,
  Database,
  DotsThreeOutline,
  DotsThreeVertical,
  Funnel,
  Link as LinkIcon,
  Lock,
  MagnifyingGlassMinus,
  Megaphone,
  Pause,
  Pencil,
  PushPin,
  Question,
  Star,
  Table as TableIcon,
  TextH,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import {
  rangeFromPreset,
  TimeRangePicker,
  type TimeRange,
} from "@/components/ui/TimeRangePicker";
import { WidgetEditorModal } from "@/features/dashboards/components/WidgetEditorModal";
import type { Widget, WidgetType } from "@/features/dashboards/types";
import { notebookSlug, patchNotebook } from "../api";
import {
  useDeleteNotebook,
  useNotebook,
  usePatchNotebook,
} from "../hooks";
import {
  emptyMarkdownCell,
  newCellId,
  type MarkdownCell as MarkdownCellModel,
  type NotebookCell,
  type WidgetCell,
} from "../types";
import { CellMenu, type AddCellKind } from "./CellMenu";
import { MarkdownCell } from "./MarkdownCell";
import { WidgetCellView } from "./WidgetCellView";
import { downloadNotebookPdf } from "../pdf";

type Props = {
  notebookId: string;
};

type WidgetEditorState =
  | { mode: "closed" }
  | { mode: "create"; type: WidgetType; insertAfterCellId?: string }
  | { mode: "edit"; cellId: string; widget: Widget };

export function NotebookEditor({ notebookId }: Props) {
  const router = useRouter();
  const { data: notebook, isLoading, isError } = useNotebook(notebookId);
  const patchMut = usePatchNotebook(notebookId);
  const deleteMut = useDeleteNotebook();

  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [name, setName] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>(() =>
    rangeFromPreset("1h"),
  );
  const [editor, setEditor] = useState<WidgetEditorState>({ mode: "closed" });
  const [moreOpen, setMoreOpen] = useState(false);
  const [focusCellId, setFocusCellId] = useState<string | null>(null);

  // Hydrate ONCE from server. After that, local state is authoritative —
  // re-hydrating on every save would clobber in-flight edits.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!notebook || hydrated) return;
    setCells(notebook.cells.length ? notebook.cells : [emptyMarkdownCell()]);
    setName(notebook.name);
    setFavorite(notebook.favorite);
    setHydrated(true);
  }, [notebook, hydrated]);

  // Refs mirror current state so the unmount cleanup reads fresh values
  // (a closure over [cells, name, favorite] would capture stale state).
  const cellsRef = useRef(cells);
  const nameRef = useRef(name);
  const favoriteRef = useRef(favorite);
  const dirtyRef = useRef(false);
  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  useEffect(() => {
    favoriteRef.current = favorite;
  }, [favorite]);

  // Debounced autosave — only fires once we've hydrated, never on the empty initial state.
  useEffect(() => {
    if (!hydrated || !notebook) return;
    const same =
      JSON.stringify(cells) === JSON.stringify(notebook.cells) &&
      name === notebook.name &&
      favorite === notebook.favorite;
    if (same) {
      dirtyRef.current = false;
      return;
    }
    dirtyRef.current = true;
    const t = window.setTimeout(() => {
      patchMut.mutate({ cells, name, favorite });
      dirtyRef.current = false;
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, cells, name, favorite]);

  // Flush on tab close / refresh / route change. Uses the API directly with refs
  // so it sees the latest state, not the stale closure.
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      // sendBeacon-friendly: fire-and-forget; we don't need the response.
      patchNotebook(notebookId, {
        cells: cellsRef.current,
        name: nameRef.current,
        favorite: favoriteRef.current,
      }).catch(() => {
        /* swallow — best-effort */
      });
      dirtyRef.current = false;
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [notebookId]);

  const updateCell = useCallback(
    (id: string, patch: Partial<NotebookCell>) => {
      setCells((cs) =>
        cs.map((c) => (c.id === id ? ({ ...c, ...patch } as NotebookCell) : c)),
      );
    },
    [],
  );

  const removeCell = useCallback((id: string) => {
    setCells((cs) => {
      const next = cs.filter((c) => c.id !== id);
      return next.length ? next : [emptyMarkdownCell()];
    });
  }, []);

  // Insert a new cell of the chosen kind after `afterId` (or at the end).
  // Returns the new cell's id so callers can request focus on it.
  const insertAfter = useCallback(
    (afterId: string | undefined, kind: AddCellKind): string | null => {
      const buildMarkdown = (heading: boolean): MarkdownCellModel => ({
        id: newCellId(),
        kind: "markdown",
        html: heading ? "<h1></h1>" : "",
      });

      if (kind === "markdown" || kind === "heading") {
        const cell = buildMarkdown(kind === "heading");
        setCells((cs) => {
          if (!afterId) return [...cs, cell];
          const idx = cs.findIndex((c) => c.id === afterId);
          if (idx === -1) return [...cs, cell];
          const next = [...cs];
          next.splice(idx + 1, 0, cell);
          return next;
        });
        return cell.id;
      }

      if (kind === "sql" || kind === "datasource") {
        const note: MarkdownCellModel = {
          id: newCellId(),
          kind: "markdown",
          html: `<pre><code>-- ${kind === "sql" ? "SQL block" : "Data source"} (coming soon)</code></pre>`,
        };
        setCells((cs) => {
          if (!afterId) return [...cs, note];
          const idx = cs.findIndex((c) => c.id === afterId);
          if (idx === -1) return [...cs, note];
          const next = [...cs];
          next.splice(idx + 1, 0, note);
          return next;
        });
        return note.id;
      }

      // Open widget editor for timeseries / table.
      const widgetType: WidgetType = kind === "table" ? "table" : "timeseries";
      setEditor({
        mode: "create",
        type: widgetType,
        insertAfterCellId: afterId,
      });
      return null;
    },
    [],
  );

  const handleSplit = useCallback(
    (afterId: string) => {
      const newId = insertAfter(afterId, "markdown");
      if (newId) setFocusCellId(newId);
    },
    [insertAfter],
  );

  const handleSaveWidget = (widget: Widget) => {
    setCells((cs) => {
      if (editor.mode === "edit") {
        return cs.map((c) =>
          c.id === editor.cellId && c.kind === "widget"
            ? ({ ...c, widget } as WidgetCell)
            : c,
        );
      }
      const insertAfterCellId =
        editor.mode === "create" ? editor.insertAfterCellId : undefined;
      const newCell: WidgetCell = {
        id: newCellId(),
        kind: "widget",
        widget,
      };
      if (!insertAfterCellId) return [...cs, newCell];
      const idx = cs.findIndex((c) => c.id === insertAfterCellId);
      if (idx === -1) return [...cs, newCell];
      const next = [...cs];
      next.splice(idx + 1, 0, newCell);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!confirm("Delete this notebook?")) return;
    // Avoid the unmount flush re-creating the row we're about to delete.
    dirtyRef.current = false;
    await deleteMut.mutateAsync(notebookId);
    router.push("/notebook/list");
  };

  // Sync the URL slug if the name changes.
  useEffect(() => {
    if (!notebook) return;
    if (name === notebook.name) return;
    const slug = notebookSlug(name);
    const url = `/notebook/${notebookId}/${slug}`;
    if (typeof window !== "undefined" && window.location.pathname !== url) {
      window.history.replaceState(null, "", url);
    }
  }, [name, notebook, notebookId]);

  // Drag-and-drop reordering.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setCells((cs) => {
      const from = cs.findIndex((c) => c.id === active.id);
      const to = cs.findIndex((c) => c.id === over.id);
      if (from === -1 || to === -1) return cs;
      const next = [...cs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-[14px] text-[#5f6368]">
        Loading notebook…
      </div>
    );
  }

  if (isError || !notebook) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white text-[14px] text-[#5f6368]">
        <p>Notebook not found.</p>
        <button
          type="button"
          onClick={() => router.push("/notebook/list")}
          className="mt-2 text-[#006CC2] hover:underline"
        >
          Back to notebooks
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-white text-[#202124]">
      <Header
        name={name}
        favorite={favorite}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onToggleFavorite={() => setFavorite((v) => !v)}
        moreOpen={moreOpen}
        onMoreToggle={() => setMoreOpen((v) => !v)}
        onMoreClose={() => setMoreOpen(false)}
        onDownloadPdf={() => downloadNotebookPdf(name || "notebook")}
        onDelete={handleDelete}
      />

      <main className="relative flex-1 overflow-auto">
        <div
          id="notebook-print-area"
          className="mx-auto max-w-[1100px] px-12 py-6"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3 text-[12px] text-[#5f6368] print:hidden">
            <Button>
              <Funnel size={12} weight="bold" />
              Add Variable
            </Button>
            <Question size={14} className="text-[#5f6368]" />
          </div>

          <div className="mb-3 flex items-center gap-3 text-[12px] text-[#5f6368]">
            <button
              type="button"
              onClick={() => setFavorite((v) => !v)}
              className="flex items-center gap-1 hover:text-[#202124]"
            >
              <Star
                size={14}
                weight={favorite ? "fill" : "regular"}
                className={favorite ? "text-[#f59e0b]" : ""}
              />
              Favorite
            </button>
            <button
              type="button"
              className="flex items-center gap-1 hover:text-[#202124]"
            >
              <Books size={14} />
              Team
            </button>
            <button
              type="button"
              className="flex items-center gap-1 hover:text-[#202124]"
            >
              <Books size={14} />
              Type
            </button>
          </div>

          <div className="mb-2 flex items-center gap-2">
            <h1
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) =>
                setName((e.currentTarget.textContent || "").trim() || name)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.currentTarget as HTMLHeadingElement).blur();
                }
              }}
              className="flex-1 truncate text-[28px] font-bold text-[#202124] outline-none focus:border-b focus:border-[#006CC2]"
            >
              {name}
            </h1>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(name)}
              className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
              aria-label="Copy title"
            >
              <Copy size={14} />
            </button>
          </div>

          <div className="mb-6 flex items-center gap-3 text-[12px] text-[#5f6368]">
            <span className="flex items-center gap-1.5">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: notebook.author.avatarColor }}
              >
                {notebook.author.name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="rounded bg-[#f1f3f4] px-2 py-0.5 text-[#202124]">
                {notebook.author.name}
              </span>
            </span>
            <span className="text-[#dadce0]">|</span>
            <span>Updated {relative(notebook.modifiedMs)}</span>
            <span className="text-[#dadce0]">|</span>
            <span>Unrestricted access</span>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={cells.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {cells.map((cell, i) => (
                  <SortableCell
                    key={cell.id}
                    cell={cell}
                    isLast={i === cells.length - 1}
                    autoFocus={cell.id === focusCellId}
                    onAutoFocusConsumed={() => setFocusCellId(null)}
                    timeRange={timeRange}
                    onChange={(patch) => updateCell(cell.id, patch)}
                    onRemove={() => removeCell(cell.id)}
                    onAddAfter={(kind) => {
                      const id = insertAfter(cell.id, kind);
                      if (id) setFocusCellId(id);
                    }}
                    onSplit={() => handleSplit(cell.id)}
                    onEditWidget={(w) =>
                      setEditor({
                        mode: "edit",
                        cellId: cell.id,
                        widget: w,
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <GetStartedRow
            onPick={(k) => {
              const id = insertAfter(undefined, k);
              if (id) setFocusCellId(id);
            }}
          />
        </div>

        <SidePanel />
      </main>

      <WidgetEditorModal
        open={editor.mode !== "closed"}
        initialType={
          editor.mode === "create"
            ? editor.type
            : editor.mode === "edit"
              ? editor.widget.type
              : "timeseries"
        }
        editingWidget={editor.mode === "edit" ? editor.widget : undefined}
        onClose={() => setEditor({ mode: "closed" })}
        onSave={(widget) => {
          handleSaveWidget(widget);
        }}
      />
    </div>
  );
}

type SortableCellProps = {
  cell: NotebookCell;
  isLast: boolean;
  autoFocus: boolean;
  onAutoFocusConsumed: () => void;
  timeRange: TimeRange;
  onChange: (patch: Partial<NotebookCell>) => void;
  onRemove: () => void;
  onAddAfter: (kind: AddCellKind) => void;
  onSplit: () => void;
  onEditWidget: (w: Widget) => void;
};

function SortableCell({
  cell,
  isLast,
  autoFocus,
  onAutoFocusConsumed,
  timeRange,
  onChange,
  onRemove,
  onAddAfter,
  onSplit,
  onEditWidget,
}: SortableCellProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cell.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Once focus is requested, clear the request so subsequent renders don't
  // keep stealing the cursor.
  useEffect(() => {
    if (!autoFocus) return;
    const t = window.setTimeout(onAutoFocusConsumed, 50);
    return () => window.clearTimeout(t);
  }, [autoFocus, onAutoFocusConsumed]);

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <CellMenu
        onAdd={onAddAfter}
        onRemove={onRemove}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
      {cell.kind === "markdown" ? (
        <MarkdownCell
          value={cell.html}
          onChange={(html) => onChange({ html })}
          autoFocus={autoFocus || (isLast && cell.html === "")}
          onSplit={onSplit}
        />
      ) : (
        <WidgetCellView
          cell={cell as WidgetCell}
          timeRange={timeRange}
          onEdit={() => onEditWidget((cell as WidgetCell).widget)}
          onDelete={onRemove}
        />
      )}
    </div>
  );
}

function Header({
  name,
  favorite,
  timeRange,
  onTimeRangeChange,
  onToggleFavorite,
  moreOpen,
  onMoreToggle,
  onMoreClose,
  onDownloadPdf,
  onDelete,
}: {
  name: string;
  favorite: boolean;
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
  onToggleFavorite: () => void;
  moreOpen: boolean;
  onMoreToggle: () => void;
  onMoreClose: () => void;
  onDownloadPdf: () => void;
  onDelete: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-[#dadce0] bg-white px-4 py-2 print:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/notebook/list"
          className="rounded p-1 text-[#5f6368] hover:bg-[#f1f3f4]"
          aria-label="All notebooks"
          title="All notebooks"
        >
          <Books size={16} />
        </Link>
        <CaretRight size={12} className="text-[#9aa0a6]" weight="bold" />
        <button
          type="button"
          onClick={onToggleFavorite}
          className="rounded p-1 hover:bg-[#f1f3f4]"
          aria-label="Favorite"
        >
          <Star
            size={14}
            weight={favorite ? "fill" : "regular"}
            className={favorite ? "text-[#f59e0b]" : "text-[#5f6368]"}
          />
        </button>
        <span className="truncate text-[14px] font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center text-[#5f6368]">
          <span className="-mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#006CC2]">
            UTC{formatTzOffset(new Date().getTimezoneOffset())}
          </span>
          <TimeRangePicker
            value={timeRange}
            onChange={onTimeRangeChange}
            placement="bottom-end"
          />
        </div>
        <Button iconOnly aria-label="Pin">
          <PushPin size={12} />
        </Button>
        <Button iconOnly aria-label="More">
          <CaretDown size={10} weight="bold" />
        </Button>
        <div className="flex">
          <Button iconOnly aria-label="Previous range" className="rounded-r-none">
            <CaretDoubleLeft size={10} weight="bold" />
          </Button>
          <Button
            iconOnly
            aria-label="Pause"
            active
            className="rounded-none border-l-0"
          >
            <Pause size={10} weight="fill" />
          </Button>
          <Button
            iconOnly
            aria-label="Next range"
            className="rounded-l-none border-l-0"
          >
            <CaretDoubleRight size={10} weight="bold" />
          </Button>
        </div>
        <Button iconOnly aria-label="Zoom out">
          <MagnifyingGlassMinus size={12} />
        </Button>
        <span className="mx-1 h-5 w-px bg-[#dadce0]" />
        <div className="flex">
          <Button className="gap-1">
            <Pencil size={12} />
            <CaretDown size={9} weight="bold" />
          </Button>
        </div>
        <Button variant="primary" className="gap-1.5">
          <Lock size={12} weight="fill" />
          Share
          <LinkIcon size={12} weight="bold" />
        </Button>
        <div className="relative">
          <button
            type="button"
            onClick={onMoreToggle}
            aria-label="More actions"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
          >
            <DotsThreeVertical size={16} weight="bold" />
          </button>
          {moreOpen && (
            <div
              className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md border border-[#dadce0] bg-white shadow-xl"
              onMouseLeave={onMoreClose}
            >
              <MoreItem icon={<Copy size={14} />} label="Clone notebook" />
              <MoreItem
                icon={<DotsThreeOutline size={14} />}
                label="Convert to template"
              />
              <div className="border-t border-[#f1f3f4] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#5f6368]">
                Share
              </div>
              <MoreItem
                icon={<Copy size={14} />}
                label="Download as PDF"
                onClick={() => {
                  onMoreClose();
                  onDownloadPdf();
                }}
              />
              <MoreItem
                icon={<Copy size={14} />}
                label="Download markdown file (.md)"
              />
              <MoreItem
                icon={<Copy size={14} />}
                label="Import markdown file (.md)"
              />
              <div className="border-t border-[#f1f3f4]" />
              <MoreItem
                icon={<DotsThreeOutline size={14} />}
                label="Comment history"
              />
              <MoreItem
                icon={<Megaphone size={14} />}
                label="Notifications"
              />
              <MoreItem
                icon={<ArrowsCounterClockwise size={14} />}
                label="Display UTC time"
              />
              <div className="border-t border-[#f1f3f4]" />
              <MoreItem
                icon={<Trash size={14} className="text-[#d93025]" />}
                label="Delete notebook"
                danger
                onClick={() => {
                  onMoreClose();
                  onDelete();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MoreItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4] ${
        danger ? "text-[#d93025]" : "text-[#202124]"
      }`}
    >
      <span className={danger ? "text-[#d93025]" : "text-[#5f6368]"}>{icon}</span>
      {label}
    </button>
  );
}

function GetStartedRow({ onPick }: { onPick: (k: AddCellKind) => void }) {
  return (
    <div className="mt-6 print:hidden">
      <div className="text-[13px] text-[#5f6368]">Get started with</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ChipButton
          icon={<ChartLine size={14} />}
          label="Timeseries"
          onClick={() => onPick("timeseries")}
        />
        <ChipButton
          icon={<Database size={14} />}
          label="Data Source"
          onClick={() => onPick("datasource")}
        />
        <ChipButton
          icon={<CodeIcon size={14} />}
          label="SQL"
          onClick={() => onPick("sql")}
        />
        <ChipButton
          icon={<TextH size={14} weight="bold" />}
          label="Heading 1"
          onClick={() => onPick("heading")}
        />
        <ChipButton
          icon={<TableIcon size={14} />}
          label="Table"
          onClick={() => onPick("table")}
        />
        <ChipButton
          icon={<DotsThreeOutline size={14} />}
          label="More"
          onClick={() => onPick("markdown")}
        />
      </div>
    </div>
  );
}

function ChipButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-[#dadce0] bg-white px-3 py-1.5 text-[13px] text-[#202124] transition-colors hover:bg-[#f1f3f4]"
    >
      <span className="text-[#5f6368]">{icon}</span>
      {label}
    </button>
  );
}

function SidePanel() {
  return (
    <aside className="pointer-events-none fixed bottom-6 left-2 hidden flex-col items-center gap-3 text-[#9aa0a6] lg:flex print:hidden">
      <button
        type="button"
        className="pointer-events-auto rounded p-1.5 hover:bg-[#f1f3f4] hover:text-[#5f6368]"
        aria-label="Outline"
      >
        <Books size={16} />
      </button>
      <button
        type="button"
        className="pointer-events-auto rounded p-1.5 hover:bg-[#f1f3f4] hover:text-[#5f6368]"
        aria-label="Variables"
      >
        <span className="text-[14px]">{"{{}}"}</span>
      </button>
      <button
        type="button"
        className="pointer-events-auto rounded p-1.5 hover:bg-[#f1f3f4] hover:text-[#5f6368]"
        aria-label="Data sources"
      >
        <Database size={16} />
      </button>
    </aside>
  );
}

function relative(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "less than a minute ago";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function formatTzOffset(offsetMinutes: number): string {
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60).toString().padStart(2, "0");
  const mm = (abs % 60).toString().padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
