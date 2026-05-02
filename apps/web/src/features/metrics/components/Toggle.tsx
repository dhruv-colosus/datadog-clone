"use client";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  ariaLabel?: string;
};

export function Toggle({ checked, onChange, label, ariaLabel }: Props) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-[#202124]">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-[#7c3aed]" : "bg-[#bdc1c6]"
        }`}
      >
        <span
          className={`absolute top-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  );
}
