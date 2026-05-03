import type { Host } from "../types";

type Props = {
  hosts: Host[];
  hexSize: number;
};

function colorForCpu(cpu: number): string {
  const t = Math.max(0, Math.min(1, cpu / 100));
  const startR = 167;
  const startG = 213;
  const startB = 165;
  const midR = 250;
  const midG = 219;
  const midB = 134;
  const endR = 240;
  const endG = 130;
  const endB = 110;
  let r: number;
  let g: number;
  let b: number;
  if (t < 0.5) {
    const k = t / 0.5;
    r = startR + (midR - startR) * k;
    g = startG + (midG - startG) * k;
    b = startB + (midB - startB) * k;
  } else {
    const k = (t - 0.5) / 0.5;
    r = midR + (endR - midR) * k;
    g = midG + (endG - midG) * k;
    b = midB + (endB - midB) * k;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export function HexCluster({ hosts, hexSize }: Props) {
  const count = hosts.length;
  if (count === 0) return null;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * 1.6)));
  const rows = Math.ceil(count / cols);
  const cellW = hexSize * 0.92;
  const cellH = hexSize * 0.84;
  const width = cols * cellW + cellW / 2;
  const height = rows * cellH + cellH * 0.2;

  return (
    <div
      style={{ width, height }}
      className="relative"
    >
      {hosts.map((host, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = col * cellW + (row % 2 === 1 ? cellW / 2 : 0);
        const y = row * cellH;
        const fill = host.status === "down"
          ? "#cfd2d6"
          : colorForCpu(host.cpuPercent);
        return (
          <div
            key={host.id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: hexSize,
              height: hexSize,
            }}
          >
            <HexCell size={hexSize} fill={fill} />
          </div>
        );
      })}
    </div>
  );
}

function HexCell({ size, fill }: { size: number; fill: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
    >
      <polygon
        points="50,3 95,28 95,72 50,97 5,72 5,28"
        fill={fill}
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
