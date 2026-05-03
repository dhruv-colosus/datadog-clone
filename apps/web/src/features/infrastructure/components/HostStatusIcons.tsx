import { LinuxLogo, AppleLogo, WindowsLogo } from "@phosphor-icons/react";

export function OsIcon({ os }: { os: "linux" | "darwin" | "windows" }) {
  if (os === "darwin") return <AppleLogo size={16} weight="fill" className="text-[#202124]" />;
  if (os === "windows") return <WindowsLogo size={16} weight="fill" className="text-[#0078d4]" />;
  return <LinuxLogo size={16} weight="fill" className="text-[#202124]" />;
}

export function AgentIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden="true">
      <path
        d="M7 0L13 3.5V12.5L7 16L1 12.5V3.5L7 0Z"
        fill="#632ca6"
      />
      <path
        d="M7 2.5L11 4.8V11.2L7 13.5L3 11.2V4.8L7 2.5Z"
        fill="#7f4cb5"
      />
      <circle cx="7" cy="8" r="1.6" fill="#fff" />
    </svg>
  );
}
