import type { NotebookCell, NotebookTemplate } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const notebookTemplatesEndpoints = {
  list: `${API_URL}/notebook-templates`,
  byId: (id: string) => `${API_URL}/notebook-templates/${id}`,
  instantiate: (id: string) =>
    `${API_URL}/notebook-templates/${id}/instantiate`,
};

export type CreateTemplatePayload = {
  name?: string;
  cells?: NotebookCell[];
};

export type PatchTemplatePayload = Partial<CreateTemplatePayload>;

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

export async function listNotebookTemplates(): Promise<NotebookTemplate[]> {
  const res = await fetch(notebookTemplatesEndpoints.list, {
    credentials: "include",
  });
  return jsonOrThrow<NotebookTemplate[]>(res, "GET /notebook-templates");
}

export async function getNotebookTemplate(
  id: string,
): Promise<NotebookTemplate> {
  const res = await fetch(notebookTemplatesEndpoints.byId(id), {
    credentials: "include",
  });
  return jsonOrThrow<NotebookTemplate>(res, `GET /notebook-templates/${id}`);
}

export async function createNotebookTemplate(
  payload: CreateTemplatePayload,
): Promise<NotebookTemplate> {
  const res = await fetch(notebookTemplatesEndpoints.list, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<NotebookTemplate>(res, "POST /notebook-templates");
}

export async function patchNotebookTemplate(
  id: string,
  payload: PatchTemplatePayload,
): Promise<NotebookTemplate> {
  const res = await fetch(notebookTemplatesEndpoints.byId(id), {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<NotebookTemplate>(
    res,
    `PATCH /notebook-templates/${id}`,
  );
}

export async function deleteNotebookTemplate(id: string): Promise<void> {
  const res = await fetch(notebookTemplatesEndpoints.byId(id), {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`DELETE /notebook-templates/${id} failed: ${res.status}`);
  }
}

export async function instantiateNotebookTemplate(
  id: string,
): Promise<{ id: string; name: string }> {
  const res = await fetch(notebookTemplatesEndpoints.instantiate(id), {
    method: "POST",
    credentials: "include",
  });
  return jsonOrThrow<{ id: string; name: string }>(
    res,
    `POST /notebook-templates/${id}/instantiate`,
  );
}
