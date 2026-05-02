"use client";

import { CaretDown } from "@phosphor-icons/react";
import { AGGREGATORS } from "../constants";
import type { Aggregator } from "../types";
import { Popover } from "./Popover";

type Props = {
  value: Aggregator;
  onChange: (next: Aggregator) => void;
};

export function AggregatorMenu({ value, onChange }: Props) {
  const current = AGGREGATORS.find((a) => a.value === value) ?? AGGREGATORS[0];
  return (
    <Popover
      placement="bottom-start"
      panelClassName="min-w-[160px] py-1"
      trigger={
        <button
          type="button"
          className="flex h-7 items-center gap-1 bg-[#f1f3f4] px-2 text-[13px] text-[#202124] hover:bg-[#e8eaed]"
        >
          {current.label}
          <CaretDown size={10} weight="bold" />
        </button>
      }
    >
      {({ close }) => (
        <ul>
          {AGGREGATORS.map((a) => (
            <li key={a.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(a.value);
                  close();
                }}
                className={`flex w-full items-center px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4] ${
                  a.value === value
                    ? "bg-[#e8f0fe] text-[#1a73e8]"
                    : "text-[#202124]"
                }`}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
