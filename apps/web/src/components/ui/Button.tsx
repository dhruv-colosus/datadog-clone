"use client";

import { ButtonHTMLAttributes, Ref } from "react";

export type ButtonVariant =
  | "outline"
  | "pill"
  | "connector"
  | "primary"
  | "ghost";

export type ButtonSize = "xs" | "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  iconOnly?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

const SIZE_CLASSES: Record<ButtonSize, { default: string; iconOnly: string }> =
  {
    xs: {
      default: "h-6 px-1.5 text-[12px]",
      iconOnly: "h-6 w-6",
    },
    sm: {
      default: "h-[26px] px-1.5 text-[13px]",
      iconOnly: "h-[26px] w-[26px]",
    },
    md: {
      default: "h-7 px-2 text-[13px]",
      iconOnly: "h-7 w-7",
    },
  };

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  outline:
    "border border-[#bdc1c6] bg-white text-[#202124] hover:bg-[#f1f3f4] hover:border-[#a8b3be]",
  pill: "border border-[#bdc1c6] bg-[#f1f3f4] text-[#202124] hover:bg-[#e8eaed] hover:border-[#a8b3be]",
  connector:
    "border border-transparent bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]",
  primary:
    "border border-transparent bg-[#7c3aed] text-white hover:bg-[#6d28d9]",
  ghost:
    "border border-transparent bg-transparent text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]",
};

const ACTIVE_CLASSES: Partial<Record<ButtonVariant, string>> = {
  outline:
    "border-[#a8b3be] bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc] hover:text-[#1a73e8]",
  pill: "border-[#a8b3be] bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]",
  ghost: "bg-[#f1f3f4] text-[#202124]",
};

export function Button({
  variant = "outline",
  size = "md",
  active = false,
  iconOnly = false,
  className = "",
  type = "button",
  ref,
  ...rest
}: ButtonProps) {
  const sizeCls = SIZE_CLASSES[size][iconOnly ? "iconOnly" : "default"];
  const variantCls = active
    ? `${VARIANT_CLASSES[variant]} ${ACTIVE_CLASSES[variant] ?? ""}`
    : VARIANT_CLASSES[variant];

  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-md font-normal transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${sizeCls} ${variantCls} ${className}`}
      {...rest}
    />
  );
}
