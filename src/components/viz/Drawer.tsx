import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The inspect drawer.
 *
 * Reading something should not mean leaving the page. Every panel that has
 * something to say about the current selection says it here, over the context
 * you were already reading, and Escape or the close button puts that context
 * back exactly as it was. Motion is a single short slide; a drawer that
 * animates elaborately gets in the way of the reading it is meant to support.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  width = "w-[min(26rem,100vw)]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-background/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.15 }}
          />
          <motion.aside
            className={cn(
              "relative flex h-full flex-col border-l border-rule bg-card shadow-[0_0_60px_rgba(0,0,0,0.55)]",
              width,
            )}
            initial={reduced ? { opacity: 0 } : { x: 24, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { x: 24, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flex shrink-0 items-start gap-3 border-b border-rule px-4 py-3">
              <div className="min-w-0 flex-1">
                {eyebrow ? (
                  <div className="mb-1 flex items-center gap-2">{eyebrow}</div>
                ) : null}
                <h2 className="text-[15px] leading-tight font-semibold">{title}</h2>
                {subtitle ? (
                  <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {subtitle}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Close (Esc)"
                aria-label="Close panel"
                className="flex size-7 shrink-0 items-center justify-center border border-rule text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

            {footer ? (
              <footer className="shrink-0 border-t border-rule p-3">{footer}</footer>
            ) : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}