export function InfraFooter() {
  return (
    <footer className="flex items-center justify-center gap-2 border-t border-[#e8eaed] bg-white px-4 py-2 text-[12px] text-[#5f6368]">
      <span>Copyright Datadog, Inc. 2026 - 35.111057413 -</span>
      <a className="text-[#1a73e8] hover:underline" href="#">
        Master Subscription Agreement
      </a>
      <span>-</span>
      <a className="text-[#1a73e8] hover:underline" href="#">
        Privacy Policy
      </a>
      <span>-</span>
      <a className="text-[#1a73e8] hover:underline" href="#">
        Cookie Policy
      </a>
      <span>-</span>
      <a className="text-[#1a73e8] hover:underline" href="#">
        Datadog Status →
      </a>
      <span className="ml-1 inline-block h-2 w-2 rounded-full bg-[#10b981]" />
      <span>All Systems Operational</span>
    </footer>
  );
}
