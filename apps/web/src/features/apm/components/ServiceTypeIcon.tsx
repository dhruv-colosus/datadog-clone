import { Cube, Database, GearSix, Globe, Stack } from "@phosphor-icons/react";
import type { ApmServiceType } from "../types";

const COLOR: Record<ApmServiceType, string> = {
  web: "bg-[#e8f0fe] text-[#1a73e8]",
  db: "bg-[#f3e8fd] text-[#1a73e8]",
  cache: "bg-[#fce8f4] text-[#a142f4]",
  custom: "bg-[#fef7e0] text-[#a37200]",
};

export function ServiceTypeIcon({
  type,
  size = 16,
}: {
  type: ApmServiceType;
  size?: number;
}) {
  const cls = COLOR[type];
  const Icon =
    type === "web"
      ? Globe
      : type === "db"
      ? Database
      : type === "cache"
      ? Stack
      : type === "custom"
      ? GearSix
      : Cube;
  const wrap = size + 6;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md ${cls}`}
      style={{ width: wrap, height: wrap }}
    >
      <Icon size={size} weight="fill" />
    </span>
  );
}
