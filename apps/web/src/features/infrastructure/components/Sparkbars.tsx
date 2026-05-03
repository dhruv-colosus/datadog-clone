type Props = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
};

export function Sparkbars({
  values,
  width = 80,
  height = 14,
  color = "#bdc1c6",
}: Props) {
  const max = Math.max(0.0001, ...values);
  const barW = width / values.length;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {values.map((v, i) => {
        const h = Math.max(1, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * barW + 0.5}
            y={height - h}
            width={Math.max(1, barW - 1)}
            height={h}
            fill={color}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
}
