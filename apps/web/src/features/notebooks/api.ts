import type { Notebook, NotebookCell } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const notebooksEndpoints = {
  list: `${API_URL}/notebooks`,
  byId: (id: string) => `${API_URL}/notebooks/${id}`,
  clone: (id: string) => `${API_URL}/notebooks/${id}/clone`,
};

export type CreateNotebookPayload = {
  name?: string;
  type?: string;
  cells?: NotebookCell[];
  tags?: string[];
  favorite?: boolean;
};

export type PatchNotebookPayload = Partial<CreateNotebookPayload>;

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ? ` — ${body.detail}` : "";
    } catch {
      // ignore
    }
    throw new Error(`${label} failed: ${res.status} ${res.statusText}${detail}`);
  }
  return res.json() as Promise<T>;
}

export async function listNotebooks(): Promise<Notebook[]> {
  const res = await fetch(notebooksEndpoints.list, {
    credentials: "include",
  });
  return jsonOrThrow<Notebook[]>(res, "GET /notebooks");
}

export async function getNotebook(id: string): Promise<Notebook> {
  const res = await fetch(notebooksEndpoints.byId(id), {
    credentials: "include",
  });
  return jsonOrThrow<Notebook>(res, `GET /notebooks/${id}`);
}

export async function createNotebook(
  payload: CreateNotebookPayload,
): Promise<Notebook> {
  const res = await fetch(notebooksEndpoints.list, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<Notebook>(res, "POST /notebooks");
}

export async function patchNotebook(
  id: string,
  payload: PatchNotebookPayload,
): Promise<Notebook> {
  const res = await fetch(notebooksEndpoints.byId(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<Notebook>(res, `PATCH /notebooks/${id}`);
}

export async function deleteNotebook(id: string): Promise<void> {
  const res = await fetch(notebooksEndpoints.byId(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`DELETE /notebooks/${id} failed: ${res.status}`);
  }
}

export function notebookSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "notebook"
  );
}
