"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ScanList } from "@/lib/api";
import { FileDrop, type FileDropHandle } from "@/components/file-drop";

interface ScanFormProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  list: ScanList;
  onListChange: (list: ScanList) => void;
  scanning: boolean;
  onScan: () => void;
}

export default function ScanForm({
  file,
  onFileChange,
  list,
  onListChange,
  scanning,
  onScan,
}: ScanFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileDropRef = useRef<FileDropHandle | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Simulated uploader: drives the progress callback and resolves in
  // ~2 s with wobbling speed. The real upload happens when the user
  // hits Scan, not when the file is dropped.
  const uploadWithProgress = (_file: File, progress: (p: number) => void) => {
    return new Promise<void>((resolve) => {
      let p = 0;
      let last = performance.now();
      const tick = (now: number) => {
        const dt = now - last;
        last = now;
        const t = now / 1000;
        const speed =
          0.55 + 0.45 * Math.abs(Math.sin(t * 2.1)) + Math.random() * 0.15;
        p += (dt / 2000) * speed;
        if (p >= 1) {
          progress(1);
          resolve();
        } else {
          progress(p);
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  };

  // First file is the one to scan; the rest stay listed in FileDrop.
  const handleFilesChange = (files: File[]) => {
    onFileChange(files[0] ?? null);
  };

  const chooseDifferent = () => {
    fileDropRef.current?.clear();
    onFileChange(null);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft sm:p-6"
    >
      <FileDrop
        ref={fileDropRef}
        maxSize={10 * 1024 * 1024}
        upload={(file, progress) => uploadWithProgress(file, progress)}
        onFilesChange={handleFilesChange}
      />

      {file && previewUrl && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-ink-100 bg-ink-50/60 p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Selected prescription or pack"
            className="max-h-48 w-auto rounded-xl border border-ink-100 object-contain shadow-soft"
          />
          <p className="text-sm text-ink-800">
            <span className="font-semibold">{file.name}</span>{" "}
            <span className="text-ink-400">
              ({(file.size / 1024).toFixed(0)} KB)
            </span>
          </p>
          <button
            type="button"
            onClick={chooseDifferent}
            className="min-h-11 rounded-full px-4 py-2 text-sm font-medium text-ink-600 ring-1 ring-ink-200 transition hover:bg-ink-100 hover:text-ink-900"
          >
            Choose a different photo
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            What is this image?
          </span>
          <div
            role="group"
            aria-label="Image type"
            className="mt-2 flex rounded-full bg-ink-100 p-1"
          >
            {(
              [
                ["prescription", "Prescription"],
                ["dispensed", "Dispensed medicines"],
              ] as [ScanList, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={list === value}
                onClick={() => onListChange(value)}
                className={`min-h-11 flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition sm:flex-none ${
                  list === value
                    ? "bg-white text-ink-900 shadow-soft"
                    : "text-ink-500 hover:text-ink-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!file || scanning}
          onClick={onScan}
          className="min-h-12 w-full rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 sm:w-auto"
        >
          {scanning ? "Scanning…" : "Scan medicines"}
        </button>
      </div>
    </motion.section>
  );
}
