"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Finding } from "@/lib/api";

const SEVERITY_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-800",
  Major: "bg-red-100 text-red-800",
  Warning: "bg-amber-100 text-amber-800",
  Moderate: "bg-amber-100 text-amber-800",
  Minor: "bg-yellow-100 text-yellow-800",
  Unknown: "bg-slate-200 text-slate-700",
};

export function severityBadge(severity: string): string {
  return SEVERITY_STYLES[severity] ?? "bg-slate-200 text-slate-700";
}

export default function FindingsAccordion({
  findings,
}: {
  findings: Finding[];
}) {
  const [open, setOpen] = useState<number | null>(0);

  if (findings.length === 0) {
    return (
      <p className="rounded-2xl border border-ink-100 bg-white px-5 py-4 text-sm text-ink-500 shadow-soft">
        No findings — nothing was flagged for this scan.
      </p>
    );
  }

  return (
    <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
      {findings.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={`${f.code}-${i}`}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50"
            >
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${severityBadge(f.severity)}`}
              >
                {f.severity}
              </span>
              <span className="flex-1 text-sm font-medium text-ink-800">
                {f.title}
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-lg leading-none text-ink-400"
                aria-hidden
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 border-t border-ink-100 px-4 py-4 text-sm text-ink-700">
                    <p>{f.detail}</p>
                    {f.management && (
                      <p>
                        <span className="font-medium">What to do: </span>
                        {f.management}
                      </p>
                    )}
                    {f.action && (
                      <p>
                        <span className="font-medium">Action: </span>
                        {f.action}
                      </p>
                    )}
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink-400">
                      <dt className="font-medium">Code</dt>
                      <dd>{f.code}</dd>
                      {f.source && (
                        <>
                          <dt className="font-medium">Source</dt>
                          <dd>
                            <a
                              href={f.source}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-brand-700 underline"
                            >
                              {f.source}
                            </a>
                          </dd>
                        </>
                      )}
                      {f.verified_via && (
                        <>
                          <dt className="font-medium">Verified via</dt>
                          <dd>{f.verified_via}</dd>
                        </>
                      )}
                      {f.mechanism_source && (
                        <>
                          <dt className="font-medium">Mechanism source</dt>
                          <dd>{f.mechanism_source}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
