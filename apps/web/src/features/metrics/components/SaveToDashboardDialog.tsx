"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDashboards, useSaveWidget } from "../hooks";
import { useExplorerStore } from "../store";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SaveToDashboardDialog({ open, onClose }: Props) {
  const {
    data: dashboards,
    isLoading: dashboardsLoading,
    error: dashboardsError,
    refetch: refetchDashboards,
  } = useDashboards();
  const queries = useExplorerStore((s) => s.queries);
  const formulas = useExplorerStore((s) => s.formulas);
  const visualization = useExplorerStore((s) => s.visualization);
  const saveWidget = useSaveWidget();

  const [title, setTitle] = useState("New widget");
  const [dashboardId, setDashboardId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setTitle(
        queries[0]?.metricName
          ? `${queries[0].aggregator}:${queries[0].metricName}`
          : "New widget",
      );
      saveWidget.reset();
      refetchDashboards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && dashboards && dashboards.length > 0 && !dashboardId) {
      setDashboardId(dashboards[0].id);
    }
  }, [open, dashboards, dashboardId]);

  if (!open) return null;

  const noDashboards = !dashboardsLoading && !dashboardsError &&
    (dashboards?.length ?? 0) === 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboardId) return;
    saveWidget.mutate(
      {
        title,
        dashboardId,
        visualization,
        queries,
        formulas,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-md border border-[#bdc1c6] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#bdc1c6] px-4 py-3">
          <h2 className="text-[15px] font-semibold text-[#202124]">
            Save to Dashboard
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
            aria-label="Close"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-4">
          <div>
            <label
              htmlFor="widget-title"
              className="mb-1 block text-[12px] font-medium text-[#5f6368]"
            >
              Widget title
            </label>
            <input
              id="widget-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-[#bdc1c6] px-3 py-2 text-[13px] outline-none focus:border-[#1a73e8]"
            />
          </div>
          <div>
            <label
              htmlFor="dashboard"
              className="mb-1 block text-[12px] font-medium text-[#5f6368]"
            >
              Dashboard
            </label>
            <select
              id="dashboard"
              value={dashboardId}
              onChange={(e) => setDashboardId(e.target.value)}
              disabled={dashboardsLoading || noDashboards}
              className="w-full rounded-md border border-[#bdc1c6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#1a73e8] disabled:bg-[#f1f3f4] disabled:text-[#9aa0a6]"
            >
              {dashboardsLoading && (
                <option value="">Loading dashboards…</option>
              )}
              {noDashboards && (
                <option value="">No dashboards available</option>
              )}
              {(dashboards ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {noDashboards && (
              <p className="mt-1 text-[12px] text-[#5f6368]">
                Create a dashboard from the Dashboards page first, then come
                back here.
              </p>
            )}
            {dashboardsError && (
              <p className="mt-1 text-[12px] text-red-600">
                Couldn’t load dashboards: {(dashboardsError as Error).message}
              </p>
            )}
          </div>
          <div className="rounded-md bg-[#f8f9fa] p-3 text-[12px] text-[#5f6368]">
            Visualization: <strong>{visualization}</strong> · {queries.length}{" "}
            quer{queries.length === 1 ? "y" : "ies"} · {formulas.length} formula
            {formulas.length === 1 ? "" : "s"}
          </div>
          {saveWidget.isError && (
            <p className="text-[12px] text-red-600">
              {(saveWidget.error as Error).message}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#bdc1c6] px-4 py-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={
              saveWidget.isPending ||
              !dashboardId ||
              dashboardsLoading ||
              noDashboards
            }
          >
            {saveWidget.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
