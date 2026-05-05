"use client";

import {
  ArrowLeft,
  Broadcast,
  ChatCircle,
  CheckCircle,
  Circle,
  CircleHalf,
  GitMerge,
  Plus,
  ShieldCheck,
  UserCircle,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import type { StatusKind } from "@/lib/severity";
import {
  useCreateTask,
  useIncident,
  usePatchIncident,
  usePatchTask,
  usePostTimeline,
  useUpsertPostmortem,
} from "../hooks";
import type {
  Incident,
  IncidentTask,
  IncidentTimelineEntry,
  TaskStatus,
} from "../types";

type Tab = "overview" | "timeline" | "tasks" | "impact" | "notifications" | "postmortem";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "tasks", label: "Tasks" },
  { id: "impact", label: "Impact" },
  { id: "notifications", label: "Notifications" },
  { id: "postmortem", label: "Postmortem" },
];

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function IncidentDetail({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const { data: incident, isLoading } = useIncident(incidentId);
  const patch = usePatchIncident();
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading || !incident) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[#5f6368]">
        Loading incident…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] text-[#202124]">
      <SectionHeader
        icon={Broadcast}
        title={incident.title}
        breadcrumbs={[
          { label: "Incidents", href: "/incidents" },
          { label: incident.displayId },
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push("/incidents")}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-white px-2 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
            >
              <ArrowLeft size={12} />
              Back
            </button>
            {incident.status === "active" && (
              <button
                type="button"
                onClick={() =>
                  patch.mutate({ id: incident.id, payload: { status: "stable" } })
                }
                className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
              >
                Mark stable
              </button>
            )}
            {incident.status !== "resolved" && incident.status !== "completed" && (
              <button
                type="button"
                onClick={() =>
                  patch.mutate({
                    id: incident.id,
                    payload: { status: "resolved" },
                  })
                }
                className="rounded-md bg-[#1a73e8] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#6d28d9]"
              >
                Resolve
              </button>
            )}
            {incident.status === "resolved" && (
              <button
                type="button"
                onClick={() =>
                  patch.mutate({
                    id: incident.id,
                    payload: { status: "completed" },
                  })
                }
                className="rounded-md bg-[#137333] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#0e5a25]"
              >
                Complete
              </button>
            )}
          </>
        }
      />

      <div className="flex items-center gap-3 border-b border-[#dadce0] bg-white px-6 py-3">
        <span className="font-mono text-[12px] text-[#5f6368]">
          {incident.displayId}
        </span>
        <SeverityBadge severity={incident.severity} size="md" />
        <StatusPill status={incident.status as StatusKind} size="md" />
        <span className="text-[12px] text-[#5f6368]">
          Declared {relativeTime(incident.createdMs)}
        </span>
      </div>

      <div className="border-b border-[#dadce0] bg-white px-6">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-3 py-2 text-[13px] transition-colors ${
                tab === t.id
                  ? "font-medium text-[#1a73e8]"
                  : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1a73e8]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f8f9fb] px-6 py-6">
        {tab === "overview" && <OverviewTab incident={incident} />}
        {tab === "timeline" && <TimelineTab incident={incident} />}
        {tab === "tasks" && <TasksTab incident={incident} />}
        {tab === "impact" && <ImpactTab incident={incident} />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "postmortem" && <PostmortemTab incident={incident} />}
      </div>
    </div>
  );
}

function OverviewTab({ incident }: { incident: Incident }) {
  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 space-y-5">
        <Card title="Summary">
          <p className="text-[13.5px] leading-relaxed text-[#202124]">
            {incident.summary || (
              <span className="italic text-[#9aa0a6]">No summary yet.</span>
            )}
          </p>
        </Card>
        {incident.rootCause && (
          <Card title="Root cause">
            <p className="text-[13.5px] leading-relaxed text-[#202124]">
              {incident.rootCause}
            </p>
          </Card>
        )}
        {incident.customerImpact && (
          <Card title="Customer impact">
            <p className="text-[13.5px] leading-relaxed text-[#202124]">
              {incident.customerImpact}
            </p>
          </Card>
        )}
      </div>
      <div className="space-y-5">
        <Card title="Affected services">
          <div className="flex flex-wrap gap-1.5">
            {incident.affectedServices.map((s) => (
              <a
                key={s}
                href={`/apm/services/${s}`}
                className="rounded bg-[#f1f3f4] px-2 py-1 font-mono text-[12px] text-[#1a73e8] hover:bg-[#e8eaed]"
              >
                {s}
              </a>
            ))}
          </div>
        </Card>
        <Card title="Roles">
          <RoleRow label="Commander" id={incident.commanderUserId} />
          <RoleRow label="Comms" id={incident.commsUserId} />
        </Card>
        <Card title="Detection">
          <div className="text-[12.5px] text-[#5f6368]">
            <span className="font-medium text-[#202124]">Source:</span>{" "}
            {incident.detectedVia ?? "—"}
          </div>
        </Card>
      </div>
    </div>
  );
}

function RoleRow({ label, id }: { label: string; id: number | null }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[12.5px]">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1a73e8] text-[10px] font-semibold text-white">
        {id ? "U" + id : <UserCircle size={14} />}
      </span>
      <div>
        <div className="font-medium text-[#202124]">{label}</div>
        <div className="text-[11px] text-[#5f6368]">
          {id ? `User #${id}` : "Unassigned"}
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ incident }: { incident: Incident }) {
  const post = usePostTimeline();
  const [comment, setComment] = useState("");
  const entries = useMemo(
    () =>
      [...(incident.timeline ?? [])].sort(
        (a, b) => a.occurredMs - b.occurredMs,
      ),
    [incident.timeline],
  );

  const submit = async () => {
    if (!comment.trim()) return;
    await post.mutateAsync({
      id: incident.id,
      kind: "comment",
      payload: { text: comment.trim() },
    });
    setComment("");
  };

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2 space-y-3">
        <Card title="Add a comment">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What's happening? @mention to notify."
            rows={2}
            className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px]"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={post.isPending || !comment.trim()}
              onClick={submit}
              className="rounded-md bg-[#1a73e8] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {post.isPending ? "Posting…" : "Post comment"}
            </button>
          </div>
        </Card>
        <Card title={`Timeline (${entries.length})`}>
          <ul className="space-y-3">
            {entries.map((e) => (
              <TimelineRow key={e.id} entry={e} />
            ))}
            {entries.length === 0 && (
              <li className="text-[12.5px] italic text-[#9aa0a6]">
                No timeline entries yet.
              </li>
            )}
          </ul>
        </Card>
      </div>
      <Card title="Quick actions">
        <ul className="space-y-1.5 text-[12.5px]">
          <li className="text-[#5f6368]">
            · State changes auto-append to the timeline.
          </li>
          <li className="text-[#5f6368]">
            · Watchdog stories on affected services link automatically.
          </li>
          <li className="text-[#5f6368]">
            · Mention services with #web, #api etc.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function TimelineRow({ entry }: { entry: IncidentTimelineEntry }) {
  const icon =
    entry.kind === "comment" ? (
      <ChatCircle size={14} className="text-[#1a73e8]" />
    ) : entry.kind === "state_change" ? (
      <GitMerge size={14} className="text-[#1a73e8]" />
    ) : entry.kind === "task_added" ? (
      <CheckCircle size={14} className="text-[#137333]" />
    ) : entry.kind === "role_assigned" ? (
      <UserCircle size={14} className="text-[#5f6368]" />
    ) : (
      <ShieldCheck size={14} className="text-[#5f6368]" />
    );
  return (
    <li className="flex gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f1f3f4]">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline justify-between text-[12.5px]">
          <span className="font-medium text-[#202124]">
            {entry.actorLabel ?? "system"}
          </span>
          <span className="text-[11px] text-[#9aa0a6]">
            {fmtTime(entry.occurredMs)}
          </span>
        </div>
        <div className="mt-0.5 text-[13px] text-[#202124]">
          {renderPayload(entry)}
        </div>
      </div>
    </li>
  );
}

function renderPayload(entry: IncidentTimelineEntry): string {
  const p = entry.payload as Record<string, unknown>;
  if (entry.kind === "comment") return String(p.text ?? "");
  if (entry.kind === "state_change") {
    const from = p.from ? `${String(p.from)} → ` : "";
    return `Status: ${from}${String(p.to ?? "")}`;
  }
  if (entry.kind === "severity_change")
    return `Severity changed: ${String(p.from ?? "")} → ${String(p.to ?? "")}`;
  if (entry.kind === "task_added") return `Task added: ${String(p.title ?? "")}`;
  if (entry.kind === "role_assigned")
    return `Role assigned: ${String(p.role ?? "")} → user #${String(p.user_id ?? "")}`;
  return JSON.stringify(p);
}

function TasksTab({ incident }: { incident: Incident }) {
  const create = useCreateTask();
  const patch = usePatchTask();
  const [title, setTitle] = useState("");
  const tasks = incident.tasks ?? [];
  const grouped: Record<TaskStatus, IncidentTask[]> = {
    open: [],
    in_progress: [],
    done: [],
  };
  for (const t of tasks) grouped[t.status].push(t);

  const submit = async () => {
    if (!title.trim()) return;
    await create.mutateAsync({ id: incident.id, title: title.trim() });
    setTitle("");
  };

  return (
    <div className="space-y-5">
      <Card title="Add task">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title (e.g. Roll back v3.2.0)"
            className="flex-1 rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px]"
          />
          <button
            type="button"
            disabled={create.isPending || !title.trim()}
            onClick={submit}
            className="rounded-md bg-[#1a73e8] px-3 py-2 text-[13px] font-medium text-white hover:bg-[#6d28d9] disabled:opacity-60"
          >
            <Plus size={13} weight="bold" className="inline" /> Add
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {(["open", "in_progress", "done"] as TaskStatus[]).map((col) => (
          <div
            key={col}
            className="rounded-lg border border-[#dadce0] bg-white p-3"
          >
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
              {col === "open"
                ? "Open"
                : col === "in_progress"
                  ? "In progress"
                  : "Done"}{" "}
              · {grouped[col].length}
            </h3>
            <ul className="space-y-2">
              {grouped[col].map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onChange={(status) =>
                    patch.mutate({
                      id: incident.id,
                      taskId: t.id,
                      status,
                    })
                  }
                />
              ))}
              {grouped[col].length === 0 && (
                <li className="text-[12px] italic text-[#9aa0a6]">
                  Empty
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onChange,
}: {
  task: IncidentTask;
  onChange: (status: TaskStatus) => void;
}) {
  const next: TaskStatus =
    task.status === "open"
      ? "in_progress"
      : task.status === "in_progress"
        ? "done"
        : "open";
  const Icon =
    task.status === "done"
      ? CheckCircle
      : task.status === "in_progress"
        ? CircleHalf
        : Circle;
  return (
    <li className="flex items-start gap-2 rounded-md border border-[#f1f3f4] bg-[#f8f9fb] px-2 py-1.5">
      <button type="button" onClick={() => onChange(next)} aria-label="Cycle status">
        <Icon
          size={16}
          className={
            task.status === "done"
              ? "text-[#137333]"
              : task.status === "in_progress"
                ? "text-[#1e88e5]"
                : "text-[#9aa0a6]"
          }
        />
      </button>
      <div className="flex-1">
        <div className="text-[13px] text-[#202124]">{task.title}</div>
        {task.assigneeLabel && (
          <div className="text-[11px] text-[#5f6368]">
            {task.assigneeLabel}
          </div>
        )}
      </div>
    </li>
  );
}

function ImpactTab({ incident }: { incident: Incident }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      <Card title="Affected services">
        <ul className="space-y-2 text-[13px]">
          {incident.affectedServices.map((s) => (
            <li
              key={s}
              className="flex items-center justify-between rounded border border-[#f1f3f4] bg-[#f8f9fb] px-2 py-1.5"
            >
              <a
                href={`/apm/services/${s}`}
                className="font-mono text-[#1a73e8] hover:underline"
              >
                {s}
              </a>
              <a
                href={`/logs?service=${s}`}
                className="text-[12px] text-[#1a73e8] hover:underline"
              >
                View logs →
              </a>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Customer impact">
        <p className="text-[13.5px] leading-relaxed text-[#202124]">
          {incident.customerImpact || (
            <span className="italic text-[#9aa0a6]">
              No customer impact recorded.
            </span>
          )}
        </p>
      </Card>
    </div>
  );
}

function NotificationsTab() {
  return (
    <Card title="Broadcast log">
      <p className="text-[13px] text-[#5f6368]">
        Notification integrations (Slack, PagerDuty, email) will appear here.
        This is a demo — no notifications were actually sent.
      </p>
    </Card>
  );
}

function PostmortemTab({ incident }: { incident: Incident }) {
  const upsert = useUpsertPostmortem();
  const [content, setContent] = useState(
    incident.postmortem?.content ?? "",
  );

  const generate = () => {
    const tasks = (incident.tasks ?? [])
      .map((t) => `- [${t.status === "done" ? "x" : " "}] ${t.title}`)
      .join("\n");
    const timeline = (incident.timeline ?? [])
      .map((e) => `- ${fmtTime(e.occurredMs)} — ${e.actorLabel ?? "system"}: ${describeEntry(e)}`)
      .join("\n");
    const tpl = `## Summary\n${incident.summary ?? "TBD"}\n\n` +
      `## Impact\n${incident.customerImpact ?? "TBD"}\n\n` +
      `## Root Cause\n${incident.rootCause ?? "TBD"}\n\n` +
      `## Timeline\n${timeline || "TBD"}\n\n` +
      `## What Went Well\n- TBD\n\n` +
      `## What Went Wrong\n- TBD\n\n` +
      `## Action Items\n${tasks || "- TBD"}`;
    setContent(tpl);
  };

  const save = async (status: "draft" | "published") => {
    await upsert.mutateAsync({ id: incident.id, content, status });
  };

  const blocked =
    incident.status !== "resolved" && incident.status !== "completed";

  return (
    <div className="space-y-5">
      {blocked && (
        <div className="rounded-md border border-[#fdd835] bg-[#fff9d9] px-3 py-2 text-[12.5px] text-[#5f6368]">
          Postmortems are usually authored after resolution. You can still draft now.
        </div>
      )}
      <Card title="Postmortem">
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={generate}
            className="rounded-md border border-[#bdc1c6] bg-white px-2 py-1 text-[12px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            Generate from template
          </button>
          <span className="text-[11px] text-[#5f6368]">Five-whys template</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 font-mono text-[12.5px]"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={upsert.isPending}
            onClick={() => save("draft")}
            className="rounded-md border border-[#bdc1c6] bg-white px-3 py-1.5 text-[12.5px] text-[#202124] hover:bg-[#f1f3f4]"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={upsert.isPending || !content.trim()}
            onClick={() => save("published")}
            className="rounded-md bg-[#1a73e8] px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-[#6d28d9] disabled:opacity-60"
          >
            Publish
          </button>
        </div>
      </Card>
    </div>
  );
}

function describeEntry(entry: IncidentTimelineEntry): string {
  const p = entry.payload as Record<string, unknown>;
  if (entry.kind === "comment") return String(p.text ?? "");
  if (entry.kind === "state_change")
    return `state ${String(p.from ?? "")} → ${String(p.to ?? "")}`;
  if (entry.kind === "task_added") return `task added: ${String(p.title ?? "")}`;
  return entry.kind;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#dadce0] bg-white p-4">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#5f6368]">
        {title}
      </h3>
      {children}
    </section>
  );
}
