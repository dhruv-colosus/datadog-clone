type Props = {
  size: number;
  fill: string;
  stroke?: string;
  label?: string;
  valueLabel?: string;
  badge?: string;
};

const HEX_POINTS = "50,3 95,28 95,72 50,97 5,72 5,28";

export function HexHost({
  size,
  fill,
  stroke,
  label,
  valueLabel,
  badge,
}: Props) {
  const showText = size >= 80;
  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center"
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0"
        preserveAspectRatio="xMidYMid meet"
      >
        <polygon
          points={HEX_POINTS}
          fill={fill}
          stroke={stroke ?? "rgba(0,0,0,0.06)"}
          strokeWidth={1}
        />
      </svg>
      {showText && (
        <div className="relative z-[1] flex flex-col items-center justify-center text-center">
          {label && (
            <div className="text-[11px] font-medium text-[#202124]">
              {label}
            </div>
          )}
          {valueLabel && (
            <div className="text-[20px] font-bold leading-none text-[#202124]">
              {valueLabel}
            </div>
          )}
          {badge && (
            <div className="mt-1 inline-flex items-center justify-center rounded-full bg-[#5f6368] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              {badge}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
