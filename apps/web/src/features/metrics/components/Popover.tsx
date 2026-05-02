"use client";

import {
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Placement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

type Coords = { top: number; left: number };

type PopoverProps = {
  trigger: ReactElement<{
    onClick?: (e: React.MouseEvent) => void;
    "aria-expanded"?: boolean;
    "aria-controls"?: string;
  }>;
  children:
    | ReactNode
    | ((args: { close: () => void }) => ReactNode);
  placement?: Placement;
  offset?: number;
  matchTriggerWidth?: boolean;
  panelClassName?: string;
};

export function Popover({
  trigger,
  children,
  placement = "bottom-start",
  offset = 4,
  matchTriggerWidth = false,
  panelClassName = "",
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 });
  const [width, setWidth] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    let top = r.bottom + offset;
    let left = r.left;
    if (placement === "bottom-end") left = r.right;
    if (placement === "top-start") top = r.top - offset;
    if (placement === "top-end") {
      top = r.top - offset;
      left = r.right;
    }
    setCoords({ top, left });
    if (matchTriggerWidth) setWidth(r.width);
  };

  useLayoutEffect(() => {
    if (open) updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isValidElement(trigger)) return null;

  const triggerEl = cloneElement(trigger, {
    ref: (node: HTMLElement) => {
      triggerRef.current = node;
      const orig = (trigger as unknown as { ref?: unknown }).ref;
      if (typeof orig === "function") {
        (orig as (n: HTMLElement) => void)(node);
      } else if (orig && typeof orig === "object" && "current" in orig) {
        (orig as { current: HTMLElement | null }).current = node;
      }
    },
    onClick: (e: React.MouseEvent) => {
      trigger.props.onClick?.(e);
      if (!e.defaultPrevented) setOpen((v) => !v);
    },
    "aria-expanded": open,
    "aria-controls": panelId,
  } as Partial<typeof trigger.props> & { ref?: unknown });

  const transform =
    placement === "bottom-end" || placement === "top-end"
      ? "translateX(-100%)"
      : undefined;
  const translateY =
    placement === "top-start" || placement === "top-end"
      ? "translateY(-100%)"
      : undefined;
  const combinedTransform =
    [transform, translateY].filter(Boolean).join(" ") || undefined;

  const panel =
    open && typeof window !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: combinedTransform,
              minWidth: width ?? undefined,
              zIndex: 1000,
            }}
            className={`rounded-md border border-[#bdc1c6] bg-white shadow-lg ${panelClassName}`}
          >
            {typeof children === "function"
              ? children({ close: () => setOpen(false) })
              : children}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {triggerEl}
      {panel}
    </>
  );
}
