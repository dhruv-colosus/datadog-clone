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
  Books,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretDown,
  CaretRight,
  ChartLine,
  Check,
  Code as CodeIcon,
  Copy,
  Database,
  DotsThreeOutline,
  Funnel,
  Link as LinkIcon,
  Lock,
  MagnifyingGlassMinus,
  Pause,
  PushPin,
  Question,
  Table as TableIcon,
  TextH,
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
import {
  useNotebookTemplate,
  usePatchNotebookTemplate,
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

type Props = {
  templateId: string;
};

type WidgetEditorState =
  | { mode: "closed" }
  | { mode: "create"; type: WidgetType; insertAfterCellId?: string }
  | { mode: "edit"; cellId: string; widget: Widget };

export function NotebookTemplateEditor({ templateId }: Props) {
  const router = useRouter();
  const { data: template, isLoading, isError } = useNotebookTemplate(templateId);
  const patchMut = usePatchNotebookTemplate(templateId);

  const [cells, setCells] = useState<NotebookCell[]>([]);
  const [name, setName] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>(() =>
    rangeFromPreset("1h"),
  );
  const [editor, setEditor] = useState<WidgetEditorState>({ mode: "closed" });
  const [focusCellId, setFocusCellId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!template || hydrated) return;
    setCells(template.cells.length ? template.cells : [emptyMarkdownCell()]);
    setName(template.name);
    setHydrated(true);
  }, [template, hydrated]);

  const isDirty = useMemo(() => {
    if (!hydrated || !template) return false;
    return (
      JSON.stringify(cells) !== JSON.stringify(template.cells) ||
      name !== template.name
    );
  }, [hydrated, template, cells, name]);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    await patchMut.mutateAsync({ cells, name });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  }, [isDirty, patchMut, cells, name]);

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
        Loading template…
      </div>
    );
  }

  if (isError || !template) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white text-[14px] text-[#5f6368]">
        <p>Template not found.</p>
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
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        isDirty={isDirty}
        savedFlash={savedFlash}
        onSave={handleSave}
        saving={patchMut.isPending}
      />

      <main className="relative flex-1 overflow-auto">
        <div className="mx-auto max-w-[1100px] px-12 py-6">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-[12px] text-[#5f6368]">
            <Button>
              <Funnel size={12} weight="bold" />
              Add Variable
            </Button>
            <Question size={14} className="text-[#5f6368]" />
          </div>

          <div className="mb-3 flex items-center gap-3 text-[12px] text-[#5f6368]">
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
                style={{ backgroundColor: template.author.avatarColor }}
              >
                {template.author.name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="rounded bg-[#f1f3f4] px-2 py-0.5 text-[#202124]">
                {template.author.name}
              </span>
            </span>
            <span className="text-[#dadce0]">|</span>
            <span>Updated {relative(template.modifiedMs)}</span>
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
  timeRange,
  onTimeRangeChange,
  isDirty,
  savedFlash,
  onSave,
  saving,
}: {
  name: string;
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
  isDirty: boolean;
  savedFlash: boolean;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-[#dadce0] bg-white px-4 py-2">
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
        <span
          className="rounded border border-[#0d8f5c] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0d8f5c]"
          aria-label="This is a template"
        >
          Template
        </span>
        <span className="ml-2 truncate text-[14px] font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          onClick={onSave}
          disabled={!isDirty || saving}
        >
          {savedFlash ? <Check size={12} weight="bold" /> : null}
          {saving ? "Saving…" : savedFlash ? "Saved" : "Save Changes"}
        </Button>
        <span className="mx-1 h-5 w-px bg-[#dadce0]" />
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
        <Button variant="primary" className="gap-1.5">
          <Lock size={12} weight="fill" />
          Share
          <LinkIcon size={12} weight="bold" />
        </Button>
      </div>
    </header>
  );
}

function GetStartedRow({ onPick }: { onPick: (k: AddCellKind) => void }) {
  return (
    <div className="mt-6">
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
