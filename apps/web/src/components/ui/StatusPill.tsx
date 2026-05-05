import { STATUS_COLOR, STATUS_LABEL, StatusKind } from "@/lib/severity";

type Props = {
  status: StatusKind;
  size?: "xs" | "sm" | "md";
  withDot?: boolean;
  className?: string;
};

export function StatusPill({
  status,
  size = "sm",
  withDot = true,
  className = "",
}: Props) {
  const { fg, bg } = STATUS_COLOR[status];
  const label = STATUS_LABEL[status];

  const sizeCls =
    size === "xs"
      ? "h-[18px] px-1.5 text-[10px]"
      : size === "md"
        ? "h-6 px-2 text-[12px]"
        : "h-5 px-1.5 text-[11px]";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded font-medium ${sizeCls} ${className}`}
      style={{ color: fg, background: bg }}
    >
      {withDot && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: fg }}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
