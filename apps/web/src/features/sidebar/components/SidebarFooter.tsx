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
      <div className="border-t border-white/10 px-2 py-3">
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
    <div className="border-t border-white/10 px-3 py-3">
      <button
        type="button"
        className="mb-2 flex w-full items-center gap-3 rounded px-2 py-1.5 text-[13px] text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white"
      >
        <PuzzlePiece size={18} />
        <span>Integrations</span>
      </button>

      <div className="mb-3 flex items-center gap-2.5 rounded px-2 py-1.5">
        <Avatar initial={initial} src={user?.picture} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] text-sidebar-muted">
            {truncatedEmail || user?.name || "Guest"}
          </div>
          <div className="truncate text-[12px] text-white/90">{orgName}</div>
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
        className="flex h-9 w-9 items-center justify-center rounded text-sidebar-muted hover:bg-white/5 hover:text-white"
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
      className="flex flex-1 flex-col items-center gap-0.5 rounded py-1.5 text-[11px] text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white"
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}
