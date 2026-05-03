import { ChartLine, Star } from "@phosphor-icons/react";
import Link from "next/link";

const PINNED = [
  {
    id: "ds1",
    name: "Vedanta's Dashboard Sun, May 3, 12:51:59 pm",
    href: "/dashboard/lists",
  },
  {
    id: "ds2",
    name: "Vedanta's Dashboard Fri, May 1, 3:27:30 pm",
    href: "/dashboard/lists",
  },
];

export function ApmHomeDashboards() {
  return (
    <section className="rounded-lg border border-[#e8eaed] bg-white">
      <header className="flex items-center justify-between border-b border-[#e8eaed] px-4 py-2.5">
        <div className="inline-flex items-center gap-2">
          <ChartLine size={14} weight="bold" className="text-[#5f6368]" />
          <span className="text-[13px] font-semibold text-[#202124]">
            Dashboards
          </span>
        </div>
        <Link
          href="/dashboard/lists"
          className="text-[12.5px] text-[#1a73e8] hover:underline"
        >
          View All →
        </Link>
      </header>
      <ul className="divide-y divide-[#f1f3f4]">
        {PINNED.map((d) => (
          <li key={d.id}>
            <Link
              href={d.href}
              className="flex items-center gap-2 px-4 py-2 text-[12.5px] text-[#1a73e8] hover:bg-[#f8f9fb]"
            >
              <Star size={13} className="text-[#bdc1c6]" />
              <ChartLine size={13} className="text-[#5f6368]" />
              <span className="truncate hover:underline">{d.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
