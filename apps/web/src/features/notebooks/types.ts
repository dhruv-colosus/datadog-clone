import type { Widget } from "@/features/dashboards/types";

export type NotebookCellKind = "markdown" | "widget";

export type MarkdownCell = {
  id: string;
  kind: "markdown";
  /** TipTap-serialized HTML — rendered as-is in display mode. */
  html: string;
};

export type WidgetCell = {
  id: string;
  kind: "widget";
  widget: Widget;
};

export type NotebookCell = MarkdownCell | WidgetCell;

export type NotebookAuthor = {
  name: string;
  avatarColor: string;
};

export type Notebook = {
  id: string;
  name: string;
  type: string;
  cells: NotebookCell[];
  templateVars: unknown[];
  tags: string[];
  favorite: boolean;
  modifiedMs: number;
  createdMs: number;
  ownerId?: number;
  author: NotebookAuthor;
};

export function newCellId(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyMarkdownCell(): MarkdownCell {
  return { id: newCellId(), kind: "markdown", html: "" };
}
