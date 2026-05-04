import { newQueryId, newWidgetId } from "@/features/dashboards/store";
import type { Widget } from "@/features/dashboards/types";
import { newCellId, type NotebookCell } from "./types";

export type TemplateKey = "blank" | "postmortem" | "runbook" | "incident_report";

export type TemplateMeta = {
  key: TemplateKey;
  label: string;
  /** Human title used as the new notebook name (placeholders included). */
  defaultName: string;
  /** Whether the cells are seeded; "blank" returns []. */
  enabled: boolean;
};

export const TEMPLATES: TemplateMeta[] = [
  { key: "blank", label: "Blank Notebook", defaultName: "", enabled: true },
  {
    key: "postmortem",
    label: "Postmortem",
    defaultName: "Postmortem IR-xxxx: [outage name]",
    enabled: true,
  },
  // Listed for the dropdown but not yet implemented.
  { key: "runbook", label: "Runbook", defaultName: "Runbook", enabled: false },
  {
    key: "incident_report",
    label: "Incident Report",
    defaultName: "Incident Report",
    enabled: false,
  },
];

const md = (html: string): NotebookCell => ({
  id: newCellId(),
  kind: "markdown",
  html,
});

function postmortemWidget(): Widget {
  return {
    id: newWidgetId(),
    type: "timeseries",
    title: "avg:system.load.1{*}",
    queries: [
      {
        id: newQueryId(),
        alias: "a",
        metricName: "system.load.1",
        aggregator: "avg",
        filters: [],
        groupBy: [],
      },
    ],
    display: "areas",
    createdAt: Date.now(),
  };
}

/**
 * Build the cells for the Postmortem template. Each section is its own cell so
 * the user can rearrange or remove them with the drag handle.
 */
function postmortemCells(): NotebookCell[] {
  return [
    // Incident properties table.
    md(
      `<table>
  <tbody>
    <tr>
      <th>Incident Property</th>
      <th>Details</th>
    </tr>
    <tr>
      <td><strong>Status:</strong></td>
      <td>Active/Stable/Resolved</td>
    </tr>
    <tr>
      <td><strong>Severity:</strong></td>
      <td>SEV-X</td>
    </tr>
    <tr>
      <td><strong>Started:</strong></td>
      <td>HH:mm UTC MM/dd/yyyy</td>
    </tr>
    <tr>
      <td><strong>Commander:</strong></td>
      <td>[name]</td>
    </tr>
    <tr>
      <td><strong>Incident Overview:</strong></td>
      <td>[IR-xxxx] (/incidents)</td>
    </tr>
    <tr>
      <td><strong>Slack Channel:</strong></td>
      <td>[#IR-xxxx] (/link)</td>
    </tr>
  </tbody>
</table>`,
    ),
    md(
      `<p><em>You can generate a postmortem <a href="/incidents?query=state%3Aresolved">from any resolved incident</a> with these fields pre-fillled, along with incident metadata and timeline.</em></p>`,
    ),
    md(`<h1>What happened?</h1>`),
    md(`<h3>Impact on customers</h3>`),
    md(`<p><em>How did this incident impact external users?</em></p>`),
    md(`<h1>Why did it happen?</h1>`),
    md(`<h3>Root cause</h3>`),
    md(
      `<p><em>A deep dive into the causes and what went particularly wrong.</em></p>`,
    ),
    md(`<h1>Timeline</h1>`),
    md(
      `<p><em>A detailed sequence of the events that led to the incident, including contributing factors, notification, and remediation actions.</em></p>`,
    ),
    md(
      `<p><em>You can add graphs that show what happened and scope them to the exact time range of the incident.</em></p>`,
    ),
    md(`<ul><li>[timestamp] event</li><li>[timestamp] event</li></ul>`),
    {
      id: newCellId(),
      kind: "widget",
      widget: postmortemWidget(),
    },
    md(`<h1>How do we prevent it in the future?</h1>`),
    md(`<h3>Action Items</h3>`),
    md(
      `<p><em>Include both short-term and long-term steps to prevent this in the future. Link to any relevant action items, and include when the action items are planned.</em></p>`,
    ),
    md(`<h3>Short-term</h3>`),
    md(
      `<ul><li>[X] <s>Action 1</s></li><li>[ ] Action 2</li></ul>`,
    ),
    md(`<h3>Long-term</h3>`),
    md(`<ul><li>[ ] Action 1</li><li>[ ] Action 2</li></ul>`),
  ];
}

export function cellsForTemplate(key: TemplateKey): NotebookCell[] {
  switch (key) {
    case "postmortem":
      return postmortemCells();
    case "blank":
    case "runbook":
    case "incident_report":
    default:
      return [];
  }
}
