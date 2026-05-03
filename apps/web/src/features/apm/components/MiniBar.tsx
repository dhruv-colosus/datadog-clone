export function MiniBar({
  value,
  max,
  color = "#3b82f6",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(2, (value / max) * 100)) : 0;
  return (
    <div className="mt-1 h-[3px] w-full max-w-[120px] rounded-full bg-[#e8eaed]">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
