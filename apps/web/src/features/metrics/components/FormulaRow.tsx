"use client";

import { ArrowRight, Palette, Sigma, X } from "@phosphor-icons/react";
import { useExplorerStore } from "../store";
import type { Formula } from "../types";
import { Popover } from "./Popover";

type Props = { formula: Formula };

export function FormulaRow({ formula }: Props) {
  const updateFormula = useExplorerStore((s) => s.updateFormula);
  const removeFormula = useExplorerStore((s) => s.removeFormula);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1a73e8] text-white">
        <ArrowRight size={14} weight="bold" />
      </span>
      <input
        value={formula.expression}
        onChange={(e) =>
          updateFormula(formula.id, { expression: e.target.value })
        }
        placeholder="Formula, eg. 2*a"
        className="h-7 flex-1 min-w-[240px] rounded-md border border-[#bdc1c6] bg-white px-2 text-[13px] outline-none focus:border-[#7c3aed]"
      />
      <button
        type="button"
        disabled
        className="flex h-7 items-center gap-1.5 rounded-md border border-[#bdc1c6] bg-[#f8f9fa] px-2 text-[13px] text-[#9aa0a6]"
        title="Functions on formulas — coming soon"
      >
        <Sigma size={14} />
        <span>Modify</span>
      </button>
      <span className="ml-auto flex items-center gap-1">
        <Popover
          placement="bottom-end"
          panelClassName="w-[260px] p-3"
          trigger={
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4]"
              title="Color"
            >
              <Palette size={14} />
            </button>
          }
        >
          <div className="text-[12px] text-[#5f6368]">
            Color override — coming soon.
          </div>
        </Popover>
        <Popover
          placement="bottom-end"
          panelClassName="w-[260px] p-3 space-y-2"
          trigger={
            <button
              type="button"
              className="flex h-7 items-center px-1 text-[12px] text-[#5f6368] hover:bg-[#f1f3f4]"
            >
              as…
            </button>
          }
        >
          <label className="block text-[11px] uppercase tracking-wide text-[#5f6368]">
            Display name
          </label>
          <input
            value={formula.displayName ?? ""}
            onChange={(e) =>
              updateFormula(formula.id, {
                displayName: e.target.value || null,
              })
            }
            placeholder="formula display name"
            className="w-full rounded-md border border-[#bdc1c6] px-2 py-1 text-[13px] outline-none focus:border-[#7c3aed]"
          />
        </Popover>
        <button
          type="button"
          onClick={() => removeFormula(formula.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]"
          aria-label="Remove formula"
        >
          <X size={14} weight="bold" />
        </button>
      </span>
    </div>
  );
}
