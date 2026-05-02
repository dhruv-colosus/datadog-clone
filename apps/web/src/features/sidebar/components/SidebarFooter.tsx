"use client";

import {
  ChatCircle,
  PuzzlePiece,
  Question,
  UserPlus,
} from "@phosphor-icons/react";
import { useAuthStore } from "@/features/auth";

type SidebarFooterProps = {
  collapsed: boolean;
};

export function SidebarFooter({ collapsed }: SidebarFooterProps) {
  const user = useAuthStore((s) => s.user);
  const initial = user?.name?.[0]?.toUpperCase() ?? "?";
  const truncatedEmail = user?.email
    ? user.email.length > 18
      ? `${user.email.slice(0, 15)}...`
      : user.email
    : "";
  const orgName = "TechBrig";

  if (collapsed) {
    return (
      <div className="px-2 py-3">
        <div className="-mx-2 mb-2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <ul className="flex flex-col items-center gap-1">
          <FooterIconButton icon={PuzzlePiece} label="Integrations" />
          <li className="my-1">
            <Avatar initial={initial} src={user?.picture} />
          </li>
          <FooterIconButton icon={UserPlus} label="Invite" />
          <FooterIconButton icon={ChatCircle} label="Support" />
          <FooterIconButton icon={Question} label="Help" />
        </ul>
      </div>
    );
  }

  return (
    <div className="px-2.5 py-2">
      <div className="-mx-2.5 mb-2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <button
        type="button"
        className="mb-1 flex w-full items-center gap-2.5 rounded px-2 py-1 text-[12.5px] text-sidebar-muted transition-colors hover:bg-[#171920] hover:text-white"
      >
        <PuzzlePiece size={16} />
        <span>Integrations</span>
      </button>

      <div className="mb-2 flex items-center gap-2 rounded px-2 py-1">
        <Avatar initial={initial} src={user?.picture} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11.5px] text-sidebar-muted">
            {truncatedEmail || user?.name || "Guest"}
          </div>
          <div className="truncate text-[11.5px] text-white/90">{orgName}</div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <FooterTextButton icon={UserPlus} label="Invite" />
        <FooterTextButton icon={ChatCircle} label="Support" />
        <FooterTextButton icon={Question} label="Help" />
      </div>
    </div>
  );
}

function Avatar({ initial, src }: { initial: string; src?: string | null }) {
  if (src) {
    return (
      <span
        className="block h-7 w-7 rounded-full bg-cover bg-center ring-1 ring-white/20"
        style={{ backgroundImage: `url(${src})` }}
        role="img"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-[12px] font-medium text-white">
      {initial}
    </span>
  );
}

function FooterIconButton({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ size?: number; weight?: "regular" | "fill" }>;
  label: string;
}) {
  return (
    <li>
      <button
        type="button"
        title={label}
        aria-label={label}
        className="flex h-9 w-9 items-center justify-center rounded text-sidebar-muted hover:bg-[#171920] hover:text-white"
      >
        <Icon size={18} />
      </button>
    </li>
  );
}

function FooterTextButton({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ size?: number; weight?: "regular" | "fill" }>;
  label: string;
}) {
  return (
    <button
      type="button"
      className="flex flex-1 flex-col items-center gap-0.5 rounded py-1.5 text-[11px] text-sidebar-muted transition-colors hover:bg-[#171920] hover:text-white"
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}
