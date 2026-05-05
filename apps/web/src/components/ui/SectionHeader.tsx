import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

type Props = {
  icon?: Icon;
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  subtitle?: string;
};

export function SectionHeader({
  icon: IconCmp,
  title,
  breadcrumbs,
  actions,
  subtitle,
}: Props) {
  return (
    <div className="flex items-center justify-between border-b border-[#dadce0] bg-white px-6 py-3">
      <div className="flex items-center gap-2 text-[15px] text-[#202124]">
        {IconCmp && <IconCmp size={18} className="text-[#202124]" />}
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <>
            {breadcrumbs.map((bc, i) => (
              <span key={i} className="flex items-center gap-2">
                {bc.href ? (
                  <a
                    href={bc.href}
                    className="text-[#5f6368] hover:text-[#1a73e8]"
                  >
                    {bc.label}
                  </a>
                ) : (
                  <span>{bc.label}</span>
                )}
                <span className="text-[#bdc1c6]">›</span>
              </span>
            ))}
            <span className="font-medium">{title}</span>
            {subtitle && (
              <span className="text-[13px] text-[#5f6368]">{subtitle}</span>
            )}
          </>
        ) : (
          <>
            <span>{title}</span>
            {subtitle && (
              <span className="text-[13px] text-[#5f6368]">{subtitle}</span>
            )}
          </>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
