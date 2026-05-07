"use client";

import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export function SimpleConfigPage({
  title,
  icon: IconCmp,
  description,
  children,
  actions,
}: {
  title: string;
  icon?: Icon;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-[#e6e7ea] bg-white px-7 py-4">
        <div className="flex items-center gap-2">
          {IconCmp && (
            <IconCmp size={18} weight="duotone" className="text-[#774aa4]" />
          )}
          <h1 className="text-[20px] font-semibold text-[#202124]">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="px-7 py-6">
        {description && (
          <p className="mb-4 max-w-3xl text-[13px] text-[#5f6368]">{description}</p>
        )}
        {children}
      </div>
    </div>
  );
}
