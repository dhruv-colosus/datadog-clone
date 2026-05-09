// Pure substitution logic for dashboard template variables. See
// https://docs.datadoghq.com/dashboards/template_variables/ — when a user
// selects a value for `$env`, every applicable widget's query is rewritten
// before fetch by appending an `in`-filter on the variable's tag key.
//
// v1 supports filter-type variables only; group-type is gated behind a check
// so the model is forward-compat.

import type { Filter } from "@/features/metrics/types";
import {
  TEMPLATE_VAR_WILDCARD,
  type TemplateVariable,
  type WidgetQuery,
} from "./types";

export type TemplateVarSelections = Record<string, string>;

export function applyTemplateVars(
  query: WidgetQuery,
  vars: TemplateVariable[],
  selections: TemplateVarSelections,
  widgetId: string,
): WidgetQuery {
  const additional: Filter[] = [];
  for (const v of vars) {
    if (v.type !== "filter") continue;
    if (v.appliesTo.length > 0 && !v.appliesTo.includes(widgetId)) continue;
    const value = (selections[v.name] ?? v.defaultValue ?? "").trim();
    if (!value || value === TEMPLATE_VAR_WILDCARD) continue;
    additional.push({
      id: `tplvar_${v.name}`,
      tag: v.tagKey,
      operator: "in",
      values: [value],
    });
  }
  if (additional.length === 0) return query;
  return { ...query, filters: [...query.filters, ...additional] };
}

/** Resolve the current effective value of a variable (URL → default). */
export function effectiveSelection(
  v: TemplateVariable,
  selections: TemplateVarSelections,
): string {
  return selections[v.name] ?? v.defaultValue ?? TEMPLATE_VAR_WILDCARD;
}

/** v2 hook — substitute `$name` tokens inside a string filter value. Inert in v1. */
export function substituteTokensInFilterValue(
  value: string,
  vars: TemplateVariable[],
  selections: TemplateVarSelections,
): string {
  let out = value;
  for (const v of vars) {
    const sel = selections[v.name] ?? v.defaultValue;
    if (!sel || sel === TEMPLATE_VAR_WILDCARD) continue;
    out = out.replaceAll(`$${v.name}`, sel);
  }
  return out;
}
