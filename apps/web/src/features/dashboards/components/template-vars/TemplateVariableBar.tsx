"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { patchDashboard } from "../../api";
import { useDashboardsStore } from "../../store";
import {
  defaultTemplateVariable,
  type TemplateVariable,
} from "../../types";
import type { TemplateVarSelections } from "../../templateVars";
import { AddVariableMenu } from "./AddVariableMenu";
import { EditVariablePanel } from "./EditVariablePanel";
import { ManageVariablesMenu } from "./ManageVariablesMenu";
import { VariableValuePicker } from "./VariableValuePicker";

type Props = {
  dashboardId: string;
  variables: TemplateVariable[];
  selections: TemplateVarSelections;
  onSelectionChange: (name: string, value: string) => void;
  /** Public/share view: hide editing controls. */
  readOnly?: boolean;
};

/**
 * The variable bar shown above the dashboard grid. Two states:
 *
 * - **Empty** — only the labelled "+ Add Variable" button.
 * - **With variables** — `Saved Views ▼ │ Filter by: [pill]…  [⚙ manage] [+]`
 *
 * Definition mutations write to the local store and PATCH the dashboard;
 * selection mutations route through {@link useTemplateVarSelections} and stay
 * URL-only.
 */
export function TemplateVariableBar({
  dashboardId,
  variables,
  selections,
  onSelectionChange,
  readOnly,
}: Props) {
  const dashboard = useDashboardsStore((s) =>
    s.dashboards.find((d) => d.id === dashboardId),
  );
  const addTemplateVar = useDashboardsStore((s) => s.addTemplateVar);
  const updateTemplateVar = useDashboardsStore((s) => s.updateTemplateVar);
  const removeTemplateVar = useDashboardsStore((s) => s.removeTemplateVar);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const existingTagKeys = variables.map((v) => v.tagKey);

  useEffect(() => {
    if (!saveError) return;
    const t = window.setTimeout(() => setSaveError(null), 5000);
    return () => window.clearTimeout(t);
  }, [saveError]);

  const persist = async (nextVars: TemplateVariable[]) => {
    const serverId = dashboard?.serverId;
    if (!serverId) return; // local-only dashboard (not yet on server)
    try {
      await patchDashboard(serverId, { template_vars: nextVars });
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : "Failed to save template variable",
      );
    }
  };

  const handleAddRecommended = (tagKey: string) => {
    const variable = defaultTemplateVariable(tagKey);
    addTemplateVar(dashboardId, variable);
    setEditingId(variable.id);
    void persist([...variables, variable]);
  };

  const handleAddManual = () => {
    const variable = defaultTemplateVariable("");
    addTemplateVar(dashboardId, variable);
    setEditingId(variable.id);
    void persist([...variables, variable]);
  };

  const handleSave = (
    variableId: string,
    patch: Partial<TemplateVariable>,
  ) => {
    updateTemplateVar(dashboardId, variableId, patch);
    const next = variables.map((v) =>
      v.id === variableId ? { ...v, ...patch } : v,
    );
    void persist(next);
  };

  const handleDelete = (variableId: string) => {
    const target = variables.find((v) => v.id === variableId);
    removeTemplateVar(dashboardId, variableId);
    const next = variables.filter((v) => v.id !== variableId);
    void persist(next);
    setEditingId(null);
    if (target) onSelectionChange(target.name, "*");
  };

  const editingVar = variables.find((v) => v.id === editingId) ?? null;

  // Empty state: keep the original "+ Add Variable" labelled button.
  if (variables.length === 0) {
    return (
      <div className="relative flex items-center gap-2">
        {!readOnly && (
          <AddVariableMenu
            existingTagKeys={existingTagKeys}
            onPickRecommended={handleAddRecommended}
            onCreateManual={handleAddManual}
          />
        )}
        {saveError && (
          <span className="text-[11px] text-[#dc2626]">{saveError}</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {!readOnly && <SavedViewsButton />}
      {!readOnly && <BarDivider />}
      <span className="text-[12px] text-[#5f6368]">Filter by:</span>
      {variables.map((v) => (
        <VariableValuePicker
          key={v.id}
          variable={v}
          value={selections[v.name] ?? v.defaultValue ?? "*"}
          onChange={(val) => onSelectionChange(v.name, val)}
        />
      ))}
      {!readOnly && (
        <ManageVariablesMenu
          variables={variables}
          onEdit={(id) => setEditingId(id)}
          onDelete={handleDelete}
        />
      )}
      {!readOnly && (
        <AddVariableMenu
          existingTagKeys={existingTagKeys}
          onPickRecommended={handleAddRecommended}
          onCreateManual={handleAddManual}
          variant="icon"
        />
      )}
      {editingVar && (
        <div className="absolute left-0 top-full z-40 mt-2">
          <EditVariablePanel
            variable={editingVar}
            onSave={(patch) => handleSave(editingVar.id, patch)}
            onDelete={() => handleDelete(editingVar.id)}
            onClose={() => setEditingId(null)}
          />
        </div>
      )}
      {saveError && (
        <span className="text-[11px] text-[#dc2626]">{saveError}</span>
      )}
    </div>
  );
}

/** Placeholder — Saved Views UI lands in v2; the button is shown for parity with the Datadog bar. */
function SavedViewsButton() {
  return (
    <button
      type="button"
      title="Saved Views (coming soon)"
      className="inline-flex items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-white px-2.5 py-1 text-[12px] text-[#202124] hover:bg-[#f8f9fa]"
    >
      Saved Views
      <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
    </button>
  );
}

function BarDivider() {
  return <div aria-hidden="true" className="h-5 w-px bg-[#dadce0]" />;
}
