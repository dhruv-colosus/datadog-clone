"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { navSections, type NavItem } from "../nav-config";

type SidebarNavProps = {
  collapsed: boolean;
};

export function SidebarNav({ collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2">
      {navSections.map((section, index) => (
        <Fragment key={index}>
          {index > 0 && <hr className="my-2 border-white/10" />}
          <ul className="flex flex-col gap-0.5">
            {section.map((item) => (
              <li key={item.href}>
                <NavLinkItem
                  item={item}
                  collapsed={collapsed}
                  active={isActive(pathname, item.href)}
                />
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
    </nav>
  );
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinkItem({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;
  const baseClasses =
    "flex items-center rounded text-[13px] transition-colors";
  const stateClasses = active
    ? "bg-white/10 text-white"
    : "text-sidebar-muted hover:bg-white/5 hover:text-white";

  if (collapsed) {
    return (
      <Link
        href={item.href}
        title={item.label}
        aria-label={item.label}
        className={`${baseClasses} ${stateClasses} h-10 w-10 justify-center mx-auto`}
      >
        <Icon size={18} weight={active ? "fill" : "regular"} />
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className={`${baseClasses} ${stateClasses} gap-3 px-2.5 py-1.5`}
    >
      <Icon size={18} weight={active ? "fill" : "regular"} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
