"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ApiError,
  fetchReportPdf,
  scanImage,
  type Prescription,
  type SafetyReport,
  type ScanList,
  type ScanResponse,
} from "@/lib/api";
import ScanForm from "@/components/ScanForm";
import ScanProgressModal from "@/components/ScanProgressModal";
import ResultsView from "@/components/ResultsView";
import ChatPanel from "@/components/ChatPanel";

export default function ScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [list, setList] = useState<ScanList>("prescription");
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearTimeout(stepTimer.current);
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  const onScan = async () => {
    if (!file || scanning) return;
    setScanning(true);
    setScanStep(0);
    setError(null);
    setDownloadError(null);
    // The scan is one request; the steps show its phases. The second
    // step appears after a short beat so the state is visible even on
    // a fast scan — it never delays the result itself.
    stepTimer.current = setTimeout(() => setScanStep(1), 1200);
    try {
      const result = await scanImage(file, list);
      if (stepTimer.current) clearTimeout(stepTimer.current);
      setScanStep(2);
      setScan(result);
      // Let the "Done" step show briefly before the modal closes.
      await new Promise<void>((resolve) => {
        doneTimer.current = setTimeout(() => resolve(), 800);
      });
    } catch (e) {
      setScan(null);
      setError(
        e instanceof ApiError
          ? e.message
          : "The scan failed. Please check the backend is running and try again.",
      );
    } finally {
      if (stepTimer.current) clearTimeout(stepTimer.current);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      setScanning(false);
    }
  };

  const downloadPdf = async () => {
    if (!scan) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await fetchReportPdf(scan.prescription, scan.report);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rxsentinel-report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(
        e instanceof ApiError
          ? e.message
          : "The PDF download failed. Please try again.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const prescription: Prescription | null = scan?.prescription ?? null;
  const report: SafetyReport | null = scan?.report ?? null;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="pt-2 text-center sm:pt-4"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Medicine safety check
        </p>
        <h1 className="mx-auto mt-3 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-ink-900 sm:text-4xl">
          Check a prescription in seconds
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-ink-500">
          Upload a photo of a prescription or of the dispensed medicine
          packs. RxSentinel reads the medicines and checks for interactions,
          duplicate ingredients, dose load and expiry.
        </p>
      </motion.div>

      <div ref={formRef}>
        <ScanForm
          file={file}
          onFileChange={setFile}
          list={list}
          onListChange={setList}
          scanning={scanning}
          onScan={() => void onScan()}
        />
      </div>

      {/* Scan progress modal — replaces the old inline scanning state. */}
      <ScanProgressModal open={scanning} step={scanStep} />

      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100"
        >
          {error}
        </p>
      )}

      {downloadError && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100"
        >
          {downloadError}
        </p>
      )}

      <AnimatePresence>
        {scan && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <ResultsView
              prescription={scan.prescription}
              report={scan.report}
              downloading={downloading}
              onDownloadPdf={downloadPdf}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ChatPanel prescription={prescription} report={report} />

      {/* Sticky bottom action bar — phones only, app-like. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/95 pb-safe backdrop-blur-md md:hidden">
        <div className="flex gap-3 px-4 py-3">
          <button
            type="button"
            disabled={!file || scanning}
            onClick={() => {
              if (!file) {
                formRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                return;
              }
              void onScan();
            }}
            className="min-h-12 flex-1 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200"
          >
            {scanning ? "Scanning…" : "Scan"}
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={!scan?.report || downloading}
            className="min-h-12 flex-1 rounded-xl bg-ink-900 text-sm font-semibold text-white shadow-soft transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-200"
          >
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
