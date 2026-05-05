import {
  IncidentSeverity,
  SEVERITY_BG,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  SeverityLevel,
  levelForIncidentSeverity,
} from "@/lib/severity";

type Variant = "filled" | "outline" | "dot";

type Props = {
  severity: SeverityLevel | IncidentSeverity;
  variant?: Variant;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
};

function isIncidentSeverity(
  s: SeverityLevel | IncidentSeverity,
): s is IncidentSeverity {
  return typeof s === "string" && s.startsWith("SEV-");
}

export function SeverityBadge({
  severity,
  variant = "filled",
  size = "sm",
  showLabel = true,
  className = "",
}: Props) {
  const level: SeverityLevel = isIncidentSeverity(severity)
    ? levelForIncidentSeverity(severity)
    : severity;
  const display = isIncidentSeverity(severity)
    ? severity
    : SEVERITY_LABEL[level];
  const fg = SEVERITY_COLOR[level];
  const bg = SEVERITY_BG[level];

  const sizeCls =
    size === "xs"
      ? "h-[18px] px-1.5 text-[10px]"
      : size === "md"
        ? "h-6 px-2 text-[12px]"
        : "h-5 px-1.5 text-[11px]";

  if (variant === "dot") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[12px] text-[#202124] ${className}`}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: fg }}
        />
        {showLabel && <span>{display}</span>}
      </span>
    );
  }

  if (variant === "outline") {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded font-medium uppercase tracking-wide ${sizeCls} ${className}`}
        style={{ color: fg, border: `1px solid ${fg}`, background: "white" }}
      >
        {showLabel ? display : ""}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded font-medium uppercase tracking-wide ${sizeCls} ${className}`}
      style={{ color: fg, background: bg }}
    >
      {showLabel ? display : ""}
    </span>
  );
}
