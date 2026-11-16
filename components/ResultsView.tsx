"use client";

import { motion } from "framer-motion";
import type { Prescription, SafetyReport } from "@/lib/api";
import FindingsAccordion from "./FindingsAccordion";
import { DISCLAIMER } from "@/lib/api";

const RISK_STYLES: Record<string, { badge: string; hero: string }> = {
  Low: {
    badge: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    hero: "from-emerald-50 to-white",
  },
  Warning: {
    badge: "bg-amber-100 text-amber-800 ring-amber-200",
    hero: "from-amber-50 to-white",
  },
  Unknown: {
    badge: "bg-slate-200 text-slate-700 ring-slate-300",
    hero: "from-slate-100 to-white",
  },
  High: {
    badge: "bg-red-100 text-red-800 ring-red-200",
    hero: "from-red-50 to-white",
  },
};

/** What the auto mode decided, from the intake's `source` field. */
function autoDetectedLabel(source?: string): string | null {
  if (source === "paddle") return "Auto-detected: printed text";
  if (source === "llm") return "Auto-detected: handwriting";
  return null;
}

function strengthOf(med: Prescription["medicines"][number]): string {
  if (med.strength_parts && med.strength_parts.length > 0)
    return med.strength_parts.join(" + ");
  if (med.strength_mg != null) return `${med.strength_mg} mg`;
  return "—";
}

export default function ResultsView({
  prescription,
  report,
  downloading,
  onDownloadPdf,
}: {
  prescription: Prescription;
  report: SafetyReport | null;
  downloading: boolean;
  onDownloadPdf: () => void;
}) {
  const doseFindings = (report?.findings ?? []).filter((f) =>
    f.code.startsWith("dose_"),
  );
  const coverage = report?.coverage;
  const riskStyle = report
    ? (RISK_STYLES[report.risk_level] ?? RISK_STYLES.Unknown)
    : RISK_STYLES.Unknown;
  const autoLabel = autoDetectedLabel(prescription.source);

  return (
    <section className="space-y-6">
      {/* Risk hero card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`rounded-2xl border border-ink-100 bg-gradient-to-b ${riskStyle.hero} p-5 shadow-soft sm:p-6`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {report ? (
            <>
              <motion.span
                key={report.risk_level}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`rounded-full px-4 py-2 font-display text-base font-bold ring-1 ${riskStyle.badge}`}
              >
                Risk: {report.risk_level}
              </motion.span>
              {autoLabel && (
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-600 ring-1 ring-ink-200">
                  {autoLabel}
                </span>
              )}
              <p className="w-full text-sm text-ink-600 sm:w-auto">
                {report.medicines_resolved} of {report.medicines_checked}{" "}
                medicine(s) identified
                {report.risk_level === "Low" &&
                  " — no issues were flagged in this check."}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-600">
              No medicines were confirmed, so no safety check was run.
            </p>
          )}
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={!report || downloading}
            className="ml-auto hidden min-h-11 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-200 md:block"
          >
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </motion.div>

      {/* Medicine cards */}
      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">
          Medicines
        </h2>
        {prescription.medicines.length === 0 ? (
          <p className="rounded-2xl border border-ink-100 bg-white px-5 py-4 text-sm text-ink-500 shadow-soft">
            No medicines were confirmed from this image.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {prescription.medicines.map((med, i) => (
              <motion.article
                key={`${med.brand ?? med.generic ?? "med"}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: i * 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft sm:p-5"
              >
                <h3 className="font-display text-base font-bold text-ink-900">
                  {med.brand ?? med.generic ?? "Unknown medicine"}
                </h3>
                <p className="mt-0.5 text-sm text-ink-500">
                  {med.generic ??
                    (med.ingredients ? med.ingredients.join(" + ") : "—")}
                </p>
                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <div>
                    <dt className="text-xs text-ink-400">Doses / day</dt>
                    <dd className="font-medium text-ink-800">
                      {med.doses_per_day ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Strength</dt>
                    <dd className="font-medium text-ink-800">
                      {strengthOf(med)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">
                  {med.provenance === "web-unverified" ? (
                    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      Web search — not yet verified in our database
                      {med.source && (
                        <>
                          {" "}
                          (
                          <a
                            href={med.source}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            source
                          </a>
                          )
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600">
                      Database
                    </span>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      {/* Needs confirmation */}
      {prescription.needs_confirmation.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-soft">
          <h2 className="font-display text-base font-bold text-amber-900">
            Needs confirmation
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            These were read from the image but could not be confirmed — they
            were not included in the safety check.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {prescription.needs_confirmation.map((item, i) => (
              <li key={`${item.brand ?? item.generic ?? "item"}-${i}`}>
                <span className="font-medium">
                  {item.brand ?? item.generic ?? "Unknown medicine"}
                </span>
                {item.reason ? ` — ${item.reason}` : ""}
                {item.stated_generic
                  ? ` (stated generic: ${item.stated_generic})`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Findings */}
      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-ink-900">
          Findings
        </h2>
        {report ? (
          <FindingsAccordion findings={report.findings} />
        ) : (
          <p className="text-sm text-ink-500">
            No safety check was run for this scan.
          </p>
        )}
      </div>

      {/* Dose summary */}
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft sm:p-6">
        <h2 className="font-display text-base font-bold text-ink-900">
          Dose summary
        </h2>
        {report ? (
          doseFindings.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
              {doseFindings.map((f, i) => (
                <li key={`${f.code}-${i}`}>
                  <span className="font-medium">{f.severity}:</span> {f.title}{" "}
                  — {f.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-500">
              No dose issues were flagged.{" "}
              {coverage &&
                `${coverage.ingredients_totalled} of ${coverage.ingredients_with_max} ingredient(s) with a maximum-dose reference were totalled.`}
            </p>
          )
        ) : (
          <p className="mt-2 text-sm text-ink-500">
            No dose summary — no safety check was run.
          </p>
        )}
      </div>

      {/* Coverage line */}
      {coverage && (
        <p className="text-sm text-ink-500">
          Coverage: {coverage.pairs_checked} interaction pair(s) checked,{" "}
          {coverage.pairs_with_data} with data;{" "}
          {coverage.ingredients_totalled} ingredient(s) totalled for dose
          checks; {coverage.expiry_checked} expiry date(s) checked
          {coverage.expiry_unparseable > 0 &&
            ` (${coverage.expiry_unparseable} unparseable)`}
          .
        </p>
      )}

      <p className="text-xs text-ink-400">{DISCLAIMER}</p>
    </section>
  );
}
