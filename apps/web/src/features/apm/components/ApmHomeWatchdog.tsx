import { Binoculars } from "@phosphor-icons/react";

export function ApmHomeWatchdog() {
  return (
    <section className="rounded-lg border border-[#e8eaed] bg-white">
      <header className="flex items-center gap-3 border-b border-[#e8eaed] px-4 py-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-[#f1f3f4] px-2 py-1 text-[12.5px] text-[#202124]">
          <Binoculars size={12} className="text-[#5f6368]" />
          <span className="font-medium">Watchdog</span>
        </div>
        <span className="rounded-md bg-[#f1f3f4] px-1.5 py-0.5 text-[11px] font-semibold text-[#5f6368]">
          2d
        </span>
        <span className="text-[12.5px] text-[#5f6368]">Past 2 Days</span>
      </header>
      <div className="flex flex-col items-center gap-3 px-4 py-10">
        <Binoculars size={36} className="text-[#7c3aed]" />
        <p className="text-[13px] text-[#5f6368]">
          Watchdog is monitoring your services. Any anomalies will appear here.
        </p>
      </div>
    </section>
  );
}
