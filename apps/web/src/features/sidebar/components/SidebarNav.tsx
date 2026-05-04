"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ArrowSquareOut, Plus } from "@phosphor-icons/react";
import {
  isRouteAvailable,
  navSections,
  type FlyoutBadge,
  type FlyoutGroup,
  type FlyoutSubItem,
  type NavItem,
} from "../nav-config";

type SidebarNavProps = {
  collapsed: boolean;
};

export function SidebarNav({ collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-2.5 py-1">
      {navSections.map((section, index) => (
        <Fragment key={index}>
          {index > 0 && <SectionDivider />}
          <ul className="flex flex-col">
            {section.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={isActive(pathname, item.href)}
              />
            ))}
          </ul>
        </Fragment>
      ))}
    </nav>
  );
}

function SectionDivider() {
  return (
    <div className="my-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
  );
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;
  const available = isRouteAvailable(item.href);
  const stateClasses = !available
    ? "text-sidebar-muted/50 cursor-not-allowed hover:bg-[#171920]"
    : active
      ? "text-white hover:bg-[#171920]"
      : "text-sidebar-muted hover:bg-[#171920] hover:text-white";

  if (collapsed) {
    if (!available) {
      return (
        <li>
          <span
            title={`${item.label} (coming soon)`}
            aria-label={`${item.label} (coming soon)`}
            aria-disabled="true"
            className={`mx-auto flex h-10 w-10 items-center justify-center rounded transition-colors ${stateClasses}`}
          >
            <Icon size={18} weight="regular" />
          </span>
        </li>
      );
    }
    return (
      <li>
        <Link
          href={item.href}
          title={item.label}
          aria-label={item.label}
          className={`mx-auto flex h-10 w-10 items-center justify-center rounded transition-colors ${stateClasses}`}
        >
          <Icon size={18} weight={active ? "fill" : "regular"} />
        </Link>
      </li>
    );
  }

  const rowClass = `flex items-center gap-2.5 rounded px-2 py-1 transition-colors ${stateClasses}`;
  const rowContent = (
    <>
      <Icon size={16} weight={active && available ? "fill" : "regular"} />
      <span className="truncate text-[12.5px]">{item.label}</span>
    </>
  );

  return (
    <li className="group/row relative">
      {available ? (
        <Link href={item.href} className={rowClass}>
          {rowContent}
        </Link>
      ) : (
        <span
          aria-disabled="true"
          title={`${item.label} (coming soon)`}
          className={rowClass}
        >
          {rowContent}
        </span>
      )}
      {item.flyout && item.flyout.length > 0 && (
        <FlyoutPanel groups={item.flyout} />
      )}
    </li>
  );
}

function FlyoutPanel({ groups }: { groups: FlyoutGroup[] }) {
  const pathname = usePathname();
  return (
    <div
      className="invisible absolute left-full top-0 z-50 max-h-[calc(100vh-1rem)] w-[300px] overflow-y-auto rounded-r-md bg-[#171920] py-3 opacity-0 shadow-2xl shadow-black/40 transition-opacity duration-100 group-hover/row:visible group-hover/row:opacity-100"
      role="menu"
    >
      <div className="flex flex-col gap-3">
        {groups.map((group, idx) => (
          <FlyoutSection key={idx} group={group} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

function FlyoutSection({
  group,
  pathname,
}: {
  group: FlyoutGroup;
  pathname: string | null;
}) {
  const hasPrimary = !!group.primary && group.primary.length > 0;
  const hasSecondary = !!group.secondary && group.secondary.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 px-4">
        {group.href && isRouteAvailable(group.href) ? (
          <Link
            href={group.href}
            className="text-[13px] font-semibold text-white hover:text-blue-300"
          >
            {group.heading}
          </Link>
        ) : (
          <h3 className="text-[13px] font-semibold text-white">
            {group.heading}
          </h3>
        )}
        {group.badge && <Badge kind={group.badge} />}
      </div>
      {group.emptyState && !hasPrimary && !hasSecondary && (
        <div className="mt-1 px-4 text-[12px] italic text-sidebar-muted/70">
          {group.emptyState}
        </div>
      )}
      {(hasPrimary || hasSecondary) && (
        <div className="mt-1 flex flex-col gap-2">
          <SubItemList items={group.primary ?? []} pathname={pathname} />
          {hasSecondary && (
            <SubItemList items={group.secondary ?? []} pathname={pathname} />
          )}
        </div>
      )}
    </div>
  );
}

function SubItemList({
  items,
  pathname,
}: {
  items: FlyoutSubItem[];
  pathname: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="ml-4 flex flex-col border-l border-white/15 pl-1.5 pr-2">
      {items.map((sub, i) => (
        <li key={i}>
          <SubItemRow
            item={sub}
            active={isSubItemActive(pathname, sub.href)}
          />
        </li>
      ))}
    </ul>
  );
}

function isSubItemActive(pathname: string | null, href?: string) {
  if (!pathname || !href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SubItemRow({
  item,
  active,
}: {
  item: FlyoutSubItem;
  active: boolean;
}) {
  const available = isRouteAvailable(item.href);
  const className = `flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[12.5px] transition-colors ${
    active
      ? "bg-[#1a73e8] text-white"
      : available
        ? "text-sidebar-muted hover:bg-white/10 hover:text-white"
        : "text-sidebar-muted/50 cursor-not-allowed"
  }`;

  const content = (
    <>
      {item.isCreate ? (
        <Plus
          size={12}
          weight="bold"
          className={`shrink-0 ${
            active
              ? "text-white"
              : available
                ? "text-blue-400"
                : "text-blue-400/40"
          }`}
        />
      ) : null}
      <span className="truncate">{item.label}</span>
      {item.badge && <Badge kind={item.badge} compact />}
      {item.external && (
        <ArrowSquareOut
          size={11}
          className={`shrink-0 ${
            active ? "text-white/80" : "text-sidebar-muted/70"
          }`}
        />
      )}
    </>
  );

  if (available && item.href) {
    return (
      <Link href={item.href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <span aria-disabled="true" className={className}>
      {content}
    </span>
  );
}

function Badge({ kind, compact }: { kind: FlyoutBadge; compact?: boolean }) {
  const base = `rounded font-semibold uppercase tracking-wide ${
    compact ? "px-1 text-[8.5px]" : "px-1.5 py-0.5 text-[9px]"
  }`;
  const tone =
    kind === "NEW"
      ? "bg-purple-600/25 text-purple-300"
      : "border border-purple-400/40 text-purple-300";
  return <span className={`${base} ${tone}`}>{kind}</span>;
}
