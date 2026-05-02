"use client";

import { CaretDown, Sigma, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { FUNCTION_OPTIONS, ROLLUP_INTERVALS } from "../constants";
import { useExplorerStore } from "../store";
import type { FunctionStep, MetricQuery, RollupMethod } from "../types";
import { Popover } from "./Popover";

type Props = { query: MetricQuery };

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function FunctionPipeline({ query }: Props) {
  const addFunction = useExplorerStore((s) => s.addFunction);
  const removeFunction = useExplorerStore((s) => s.removeFunction);
  const updateFunction = useExplorerStore((s) => s.updateFunction);

  const fns = query.functions;

  return (
    <div className="flex items-center gap-1">
      <Popover
        placement="bottom-start"
        panelClassName="w-[280px] py-1"
        trigger={
          <Button size="sm" title="Add a function">
            <Sigma size={14} />
            <span>Modify</span>
            <CaretDown size={10} weight="bold" />
          </Button>
        }
      >
        {({ close }) => (
          <div>
            <div className="border-b border-[#bdc1c6] px-3 py-1.5 text-[11px] uppercase tracking-wide text-[#5f6368]">
              Add a function
            </div>
            <div className="max-h-[280px] overflow-y-auto py-1">
              {FUNCTION_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.kind}
                  onClick={() => {
                    const next: FunctionStep =
                      opt.kind === "rollup"
                        ? {
                            id: uid("fn"),
                            kind: "rollup",
                            method: "avg",
                            intervalSeconds: 60,
                          }
                        : ({
                            id: uid("fn"),
                            kind: opt.kind,
                          } as FunctionStep);
                    addFunction(query.id, next);
                    close();
                  }}
                  className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-[#f1f3f4]"
                >
                  <span className="text-[13px] text-[#202124]">{opt.label}</span>
                  <span className="text-[11px] text-[#5f6368]">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>
      {fns.map((fn) => (
        <FunctionPill
          key={fn.id}
          fn={fn}
          onRemove={() => removeFunction(query.id, fn.id)}
          onUpdate={(patch) => updateFunction(query.id, fn.id, patch)}
        />
      ))}
    </div>
  );
}

function FunctionPill({
  fn,
  onRemove,
  onUpdate,
}: {
  fn: FunctionStep;
  onRemove: () => void;
  onUpdate: (patch: Partial<FunctionStep>) => void;
}) {
  if (fn.kind === "rollup") {
    return (
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-[#f8f9fa] px-2 text-[12px] text-[#202124]">
        <span className="font-medium">rollup</span>
        <span className="text-[#5f6368]">(</span>
        <Popover
          placement="bottom-start"
          panelClassName="min-w-[120px] py-1"
          trigger={
            <button
              type="button"
              className="rounded-md px-1 hover:bg-[#e8eaed]"
            >
              {fn.method}
            </button>
          }
        >
          {({ close }) => (
            <ul>
              {(["avg", "sum", "min", "max", "count"] as RollupMethod[]).map(
                (m) => (
                  <li key={m}>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdate({ method: m });
                        close();
                      }}
                      className="flex w-full px-3 py-1 text-left text-[13px] hover:bg-[#f1f3f4]"
                    >
                      {m}
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </Popover>
        <span className="text-[#5f6368]">,</span>
        <Popover
          placement="bottom-start"
          panelClassName="min-w-[100px] py-1"
          trigger={
            <button
              type="button"
              className="rounded-md px-1 hover:bg-[#e8eaed]"
            >
              {ROLLUP_INTERVALS.find((r) => r.seconds === fn.intervalSeconds)
                ?.label ?? `${fn.intervalSeconds}s`}
            </button>
          }
        >
          {({ close }) => (
            <ul>
              {ROLLUP_INTERVALS.map((r) => (
                <li key={r.seconds}>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdate({ intervalSeconds: r.seconds });
                      close();
                    }}
                    className="flex w-full px-3 py-1 text-left text-[13px] hover:bg-[#f1f3f4]"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Popover>
        <span className="text-[#5f6368]">)</span>
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 rounded-md p-0.5 hover:bg-[#e8eaed]"
          aria-label="Remove function"
        >
          <X size={10} weight="bold" />
        </button>
      </span>
    );
  }

  const opt = FUNCTION_OPTIONS.find((o) => o.kind === fn.kind);
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[#bdc1c6] bg-[#f8f9fa] px-2 text-[12px] text-[#202124]">
      <span className="font-medium">{opt?.label ?? fn.kind}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 rounded-md p-0.5 hover:bg-[#e8eaed]"
        aria-label="Remove function"
      >
        <X size={10} weight="bold" />
      </button>
    </span>
  );
}
