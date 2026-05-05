"use client";

import { CaretDown } from "@phosphor-icons/react";
import { forwardRef } from "react";
import {
  COLOR_PALETTES,
  LINE_STROKES,
  LINE_STYLES,
  ORDER_BYS,
  VISUALIZATIONS,
} from "../constants";
import { useExplorerStore } from "../store";
import type {
  ColorPalette,
  LineStroke,
  LineStyle,
  OrderBy,
  VisualizationType,
} from "../types";
import { Popover } from "./Popover";
import { Toggle } from "./Toggle";

export function DisplayOptions() {
  const visualization = useExplorerStore((s) => s.visualization);
  const lineStyle = useExplorerStore((s) => s.lineStyle);
  const lineStroke = useExplorerStore((s) => s.lineStroke);
  const colorPalette = useExplorerStore((s) => s.colorPalette);
  const orderBy = useExplorerStore((s) => s.orderBy);
  const reverseOrder = useExplorerStore((s) => s.reverseOrder);
  const setVisualization = useExplorerStore((s) => s.setVisualization);
  const setLineStyle = useExplorerStore((s) => s.setLineStyle);
  const setLineStroke = useExplorerStore((s) => s.setLineStroke);
  const setColorPalette = useExplorerStore((s) => s.setColorPalette);
  const setOrderBy = useExplorerStore((s) => s.setOrderBy);
  const toggleReverse = useExplorerStore((s) => s.toggleReverse);

  const usesLineStyling =
    visualization === "line" || visualization === "area";
  const usesOrdering = visualization !== "query_value";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 text-[13px]">
      <Field label="Display:">
        <VisualizationDropdown
          value={visualization}
          onChange={setVisualization}
        />
      </Field>
      {usesLineStyling && (
        <>
          <Field label="Style:">
            <SimpleDropdown
              value={lineStyle}
              options={LINE_STYLES}
              onChange={(v) => setLineStyle(v as LineStyle)}
            />
          </Field>
          <Field label="Stroke:">
            <SimpleDropdown
              value={lineStroke}
              options={LINE_STROKES}
              onChange={(v) => setLineStroke(v as LineStroke)}
            />
          </Field>
        </>
      )}
      <Separator />
      <Field label="Color:">
        <ColorPaletteDropdown
          value={colorPalette}
          onChange={setColorPalette}
        />
      </Field>
      {usesOrdering && (
        <>
          <Separator />
          <Field label="Order by:">
            <SimpleDropdown
              value={orderBy}
              options={ORDER_BYS}
              onChange={(v) => setOrderBy(v as OrderBy)}
            />
          </Field>
          <Toggle
            checked={reverseOrder}
            onChange={toggleReverse}
            label="Reverse"
          />
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#5f6368]">{label}</span>
      {children}
    </div>
  );
}

function Separator() {
  return <span className="h-5 w-px bg-[#bdc1c6]" aria-hidden />;
}

const InlineTrigger = forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    ariaExpanded?: boolean;
  }
>(function InlineTrigger({ children, onClick, ariaExpanded }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      className="inline-flex h-7 items-center gap-1 rounded-sm px-1 font-medium text-[#202124] hover:bg-[#f1f3f4]"
    >
      {children}
      <CaretDown size={10} weight="bold" className="text-[#5f6368]" />
    </button>
  );
});

function SimpleDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Popover
      placement="bottom-start"
      panelClassName="min-w-[140px] py-1"
      trigger={<InlineTrigger>{current.label}</InlineTrigger>}
    >
      {({ close }) => (
        <ul>
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  close();
                }}
                className={`flex w-full px-3 py-1.5 text-left text-[13px] hover:bg-[#f1f3f4] ${
                  o.value === value ? "text-[#1a73e8]" : "text-[#202124]"
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

function VisualizationDropdown({
  value,
  onChange,
}: {
  value: VisualizationType;
  onChange: (v: VisualizationType) => void;
}) {
  const current =
    VISUALIZATIONS.find((v) => v.value === value) ?? VISUALIZATIONS[0];
  return (
    <Popover
      placement="bottom-start"
      panelClassName="min-w-[160px] py-1"
      trigger={<InlineTrigger>{current.label}</InlineTrigger>}
    >
      {({ close }) => (
        <ul>
          {VISUALIZATIONS.map((v) => (
            <li key={v.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(v.value);
                  close();
                }}
                className={`flex w-full px-3 py-1.5 text-left text-[13px] ${
                  v.value === value
                    ? "bg-[#1a73e8] text-white"
                    : "text-[#202124] hover:bg-[#f1f3f4]"
                }`}
              >
                {v.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

function ColorPaletteDropdown({
  value,
  onChange,
}: {
  value: ColorPalette;
  onChange: (v: ColorPalette) => void;
}) {
  const current =
    COLOR_PALETTES.find((p) => p.value === value) ?? COLOR_PALETTES[1];
  return (
    <Popover
      placement="bottom-start"
      panelClassName="w-[420px] flex"
      trigger={
        <InlineTrigger>
          <Swatches colors={current.swatches} />
          <span>{current.label}</span>
        </InlineTrigger>
      }
    >
      {({ close }) => (
        <PaletteGrid current={value} onPick={(v) => { onChange(v); close(); }} />
      )}
    </Popover>
  );
}

function PaletteGrid({
  current,
  onPick,
}: {
  current: ColorPalette;
  onPick: (v: ColorPalette) => void;
}) {
  const active =
    COLOR_PALETTES.find((p) => p.value === current) ?? COLOR_PALETTES[1];
  return (
    <div className="grid w-full grid-cols-[200px_1fr]">
      <ul className="border-r border-[#bdc1c6] py-1">
        {COLOR_PALETTES.map((p) => (
          <li key={p.value}>
            <button
              type="button"
              onClick={() => onPick(p.value)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left ${
                p.value === current
                  ? "bg-[#1a73e8] text-white"
                  : "text-[#202124] hover:bg-[#f1f3f4]"
              }`}
            >
              <span className="flex items-center gap-2">
                <Swatches colors={p.swatches} />
                <span className="text-[13px]">{p.label}</span>
              </span>
              {p.value === current && <span className="text-[12px]">✓</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="p-3 text-[12px] text-[#5f6368]">
        {active.description}
      </div>
    </div>
  );
}

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-[#bdc1c6]">
      {colors.slice(0, 4).map((c, i) => (
        <span
          key={`${c}-${i}`}
          className="block h-3 w-3"
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  );
}
