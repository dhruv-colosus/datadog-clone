"use client";

import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { useExplorerStore } from "../store";
import { ChartActions } from "./ChartActions";
import { DisplayOptions } from "./DisplayOptions";
import { ExplorerHeader } from "./ExplorerHeader";
import { FormulaRow } from "./FormulaRow";
import { MetricChart } from "./MetricChart";
import { QueryRow } from "./QueryRow";

export function MetricsExplorer() {
  const queries = useExplorerStore((s) => s.queries);
  const formulas = useExplorerStore((s) => s.formulas);
  const oneGraphPerQuery = useExplorerStore((s) => s.oneGraphPerQuery);
  const addQuery = useExplorerStore((s) => s.addQuery);
  const addFormula = useExplorerStore((s) => s.addFormula);

  return (
    <div className="flex h-full flex-col bg-white text-[#202124]">
      <ExplorerHeader />
      <div className="flex-1 overflow-auto">
        <section className="space-y-1.5 px-4 py-3">
          {queries.map((q) => (
            <QueryRow
              key={q.id}
              query={q}
              canRemove={queries.length > 1 || formulas.length > 0}
            />
          ))}
          {formulas.map((f) => (
            <FormulaRow key={f.id} formula={f} />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={addQuery}>
              <Plus size={12} weight="bold" />
              <span>Add Query</span>
            </Button>
            <Button onClick={addFormula}>
              <Plus size={12} weight="bold" />
              <span>Add Formula</span>
            </Button>
          </div>
        </section>
        <div className="border-t border-[#bdc1c6] px-4">
          <DisplayOptions />
        </div>
        <div className="border-t border-[#bdc1c6] bg-[#fafbfc] px-4 py-3">
          <ChartActions />
        </div>
        <section className="space-y-3 px-4 py-4">
          {oneGraphPerQuery ? (
            queries.map((q) => <MetricChart key={q.id} query={q} />)
          ) : (
            <MetricChart query={queries[0]} />
          )}
        </section>
      </div>
    </div>
  );
}
