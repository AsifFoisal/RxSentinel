"use client";

import { useState } from "react";
import {
  ApiError,
  approveMedicineRequest,
  rejectMedicineRequest,
  type MedicineRequest,
} from "@/lib/api";

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function SourceCell({ req }: { req: MedicineRequest }) {
  return (
    <div>
      {req.source ? (
        <a
          href={req.source}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sm text-brand-700 underline"
        >
          Source page
        </a>
      ) : (
        <span className="text-sm text-ink-400">—</span>
      )}
      <span
        className={`mt-1.5 block w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
          req.source_verified
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        {req.source_verified ? "Source verified" : "Source not verified"}
      </span>
    </div>
  );
}

export default function AdminTable({
  requests,
  password,
  onChanged,
}: {
  requests: MedicineRequest[];
  password: string;
  /** Called after an approve/reject so the parent reloads the list. */
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approve = async (req: MedicineRequest) => {
    setError(null);
    setNotice(null);
    setBusyId(req.id);
    try {
      const res = await approveMedicineRequest(password, req.id);
      setNotice(`Added “${res.brand}” to the database.`);
      onChanged();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Approving this request failed. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (req: MedicineRequest) => {
    if (!reason.trim()) {
      setError("Please give a reason for the rejection.");
      return;
    }
    setError(null);
    setNotice(null);
    setBusyId(req.id);
    try {
      await rejectMedicineRequest(password, req.id, reason.trim());
      setNotice(`Rejected “${req.brand}”.`);
      setRejectingId(null);
      setReason("");
      onChanged();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Rejecting this request failed. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (requests.length === 0) {
    return (
      <p className="rounded-2xl border border-ink-100 bg-white px-5 py-6 text-sm text-ink-500 shadow-soft">
        No requests in this tab.
      </p>
    );
  }

  const actions = (req: MedicineRequest) =>
    req.status === "pending" ? (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busyId === req.id}
          onClick={() => approve(req)}
          className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-ink-200"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busyId === req.id}
          onClick={() =>
            setRejectingId(rejectingId === req.id ? null : req.id)
          }
          className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:bg-ink-200"
        >
          Reject
        </button>
        {rejectingId === req.id && (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection"
              aria-label="Reason for rejection"
              className="min-h-11 w-full rounded-xl border border-ink-200 px-3 text-sm focus:border-brand-600 focus:outline-none"
            />
            <button
              type="button"
              disabled={busyId === req.id || !reason.trim()}
              onClick={() => reject(req)}
              className="min-h-11 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:bg-ink-200"
            >
              Confirm rejection
            </button>
          </div>
        )}
      </div>
    ) : (
      <span className="text-xs capitalize text-ink-400">{req.status}</span>
    );

  return (
    <div>
      {notice && (
        <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </p>
      )}

      {/* Mobile: one card per request (no horizontal scroll). */}
      <div className="space-y-3 md:hidden">
        {requests.map((req) => (
          <article
            key={req.id}
            className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft"
          >
            <h3 className="font-display text-base font-bold text-ink-900">
              {req.brand}
            </h3>
            {req.company && (
              <p className="text-xs text-ink-400">{req.company}</p>
            )}
            {req.dosage_form && (
              <p className="text-xs text-ink-400">{req.dosage_form}</p>
            )}
            <p className="mt-2 text-sm text-ink-700">
              {req.generic_title ?? req.ingredients.join(" + ")}
            </p>
            {req.generic_title && req.ingredients.length > 0 && (
              <p className="text-xs text-ink-400">
                {req.ingredients.join(" + ")}
              </p>
            )}
            <p className="mt-1 text-sm text-ink-500">
              Strengths:{" "}
              {req.strength_parts.length > 0
                ? req.strength_parts.join(" + ")
                : "—"}
            </p>
            <div className="mt-3">
              <SourceCell req={req} />
            </div>
            <p className="mt-2 text-xs text-ink-400">
              Scans: {req.scan_count} · {formatDate(req.first_seen)} →{" "}
              {formatDate(req.last_seen)}
            </p>
            <div className="mt-3">{actions(req)}</div>
          </article>
        ))}
      </div>

      {/* Desktop: table. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-soft md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Composition</th>
              <th className="px-4 py-3">Strengths</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Scans</th>
              <th className="px-4 py-3">First / last seen</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {requests.map((req) => (
              <tr key={req.id}>
                <td className="px-4 py-3 font-medium text-ink-900">
                  {req.brand}
                  {req.company && (
                    <span className="block text-xs font-normal text-ink-400">
                      {req.company}
                    </span>
                  )}
                  {req.dosage_form && (
                    <span className="block text-xs font-normal text-ink-400">
                      {req.dosage_form}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {req.generic_title ?? req.ingredients.join(" + ")}
                  {req.generic_title && req.ingredients.length > 0 && (
                    <span className="block text-xs text-ink-400">
                      {req.ingredients.join(" + ")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {req.strength_parts.length > 0
                    ? req.strength_parts.join(" + ")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <SourceCell req={req} />
                </td>
                <td className="px-4 py-3 text-ink-700">{req.scan_count}</td>
                <td className="px-4 py-3 text-xs text-ink-500">
                  {formatDate(req.first_seen)}
                  <span className="block">{formatDate(req.last_seen)}</span>
                </td>
                <td className="px-4 py-3">{actions(req)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
