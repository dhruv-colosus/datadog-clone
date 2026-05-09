"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  TEMPLATE_VAR_WILDCARD,
  type TemplateVariable,
} from "./types";
import type { TemplateVarSelections } from "./templateVars";

const URL_PREFIX = "tpl_var_";

/**
 * URL-backed template variable selections. Datadog encodes them as
 * `?tpl_var_<name>=<value>`; we mirror that so links survive reload/share.
 *
 * Selections never persist to the dashboard record — they live only in the URL.
 */
export function useTemplateVarSelections(
  vars: TemplateVariable[] | undefined,
): {
  selections: TemplateVarSelections;
  setSelection: (name: string, value: string) => void;
  resetAll: () => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selections = useMemo<TemplateVarSelections>(() => {
    const out: TemplateVarSelections = {};
    if (!vars) return out;
    for (const v of vars) {
      const fromUrl = searchParams?.get(`${URL_PREFIX}${v.name}`);
      out[v.name] =
        fromUrl ?? v.defaultValue ?? TEMPLATE_VAR_WILDCARD;
    }
    return out;
  }, [vars, searchParams]);

  const setSelection = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const key = `${URL_PREFIX}${name}`;
      // Drop the param when the selection equals the "all" wildcard so
      // shared URLs stay clean and defaults remain implicit.
      if (!value || value === TEMPLATE_VAR_WILDCARD) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  const resetAll = useCallback(() => {
    if (!vars) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const v of vars) {
      params.delete(`${URL_PREFIX}${v.name}`);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [router, searchParams, vars]);

  return { selections, setSelection, resetAll };
}
