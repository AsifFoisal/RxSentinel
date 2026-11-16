"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STEPS = ["Reading image", "Checking interactions", "Done"];

interface ScanProgressModalProps {
  open: boolean;
  step: number;
}

/**
 * Scan progress modal — replaces the old inline scanning state.
 * A dimmed, blurred backdrop covers the page and blocks interaction
 * while a scan runs. The modal has no buttons and cannot be
 * dismissed mid-scan; it closes on its own when the scan finishes
 * (success or error).
 */
export default function ScanProgressModal({
  open,
  step,
}: ScanProgressModalProps) {
  // Lock body scroll while the modal is open so the page behind it
  // cannot be scrolled on phones.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Scan in progress"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-6 shadow-lift"
            aria-live="polite"
          >
            <div className="flex items-center gap-4">
              <motion.span
                aria-hidden="true"
                className="block h-10 w-10 shrink-0 rounded-full border-[3px] border-brand-100 border-t-brand-600"
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  duration: 0.9,
                  ease: "linear",
                }}
              />
              <div>
                <h2 className="font-display text-lg font-bold text-ink-900">
                  Scanning your prescription
                </h2>
                <p className="text-sm text-ink-500">
                  Reading the image and running the safety check.
                </p>
              </div>
            </div>

            {/* Animated progress bar — fills as the steps advance. */}
            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-ink-100"
              aria-hidden="true"
            >
              <motion.div
                className="h-full rounded-full bg-brand-600"
                initial={false}
                animate={{
                  width: `${((Math.min(step, STEPS.length - 1) + 1) / STEPS.length) * 100}%`,
                }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>

            <ol className="mt-5 flex flex-col gap-3">
              {STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                      i < step
                        ? "bg-brand-600 text-white"
                        : i === step
                          ? "bg-brand-100 text-brand-700"
                          : "bg-ink-100 text-ink-400"
                    }`}
                  >
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span
                    className={
                      i === step
                        ? "font-semibold text-ink-900"
                        : "text-ink-500"
                    }
                  >
                    {label}
                    {i === step && i < STEPS.length - 1 ? "…" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
