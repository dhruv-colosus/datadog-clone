import {
  Cube,
  GearSix,
  PawPrint,
  ShippingContainer,
} from "@phosphor-icons/react";
import type { DashboardIcon as Kind } from "../types";

type Props = {
  icon?: Kind;
  size?: number;
};

export function DashboardIcon({ icon, size = 16 }: Props) {
  if (!icon) return null;
  if (icon === "system") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#fef0c3]">
        <GearSix size={size - 4} weight="fill" className="text-[#f59e0b]" />
      </span>
    );
  }
  if (icon === "datadog") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#774aa4]">
        <PawPrint size={size - 4} weight="fill" className="text-white" />
      </span>
    );
  }
  if (icon === "container") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#dadce0]">
        <Cube size={size - 4} weight="fill" className="text-[#5f6368]" />
      </span>
    );
  }
  if (icon === "docker") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1d63ed]">
        <ShippingContainer size={size - 4} weight="fill" className="text-white" />
      </span>
    );
  }
  return null;
}
