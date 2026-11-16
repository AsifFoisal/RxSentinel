"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ApiError,
  listMedicineRequests,
  type MedicineRequest,
  type RequestStatus,
} from "@/lib/api";
import AdminTable from "@/components/AdminTable";

const PASSWORD_KEY = "rxsentinel-admin-password";
const TABS: RequestStatus[] = ["pending", "approved", "rejected"];

export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [tab, setTab] = useState<RequestStatus>("pending");
  const [requests, setRequests] = useState<MedicineRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pw: string, status: RequestStatus) => {
      setLoading(true);
      setError(null);
      try {
        setRequests(await listMedicineRequests(pw, status));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setPassword(null);
          sessionStorage.removeItem(PASSWORD_KEY);
          setGateError("Wrong password.");
        } else {
          setError(
            e instanceof ApiError
              ? e.message
              : "Could not load the requests. Please try again.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Restore a previously entered password for this browser session.
  useEffect(() => {
    const saved = sessionStorage.getItem(PASSWORD_KEY);
    if (saved) setPassword(saved);
  }, []);

  useEffect(() => {
    if (password) void load(password, tab);
  }, [password, tab, load]);

  const signIn = async () => {
    if (!passwordInput.trim()) {
      setGateError("Enter the admin password.");
      return;
    }
    setGateBusy(true);
    setGateError(null);
    try {
      // A list call is the password check: 401 means wrong password.
      await listMedicineRequests(passwordInput, "pending");
      sessionStorage.setItem(PASSWORD_KEY, passwordInput);
      setPassword(passwordInput);
      setPasswordInput("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setGateError("Wrong password.");
      } else {
        setGateError(
          e instanceof ApiError
            ? e.message
            : "Could not reach the backend. Please try again.",
        );
      }
    } finally {
      setGateBusy(false);
    }
  };

  const signOut = () => {
    sessionStorage.removeItem(PASSWORD_KEY);
    setPassword(null);
    setRequests([]);
  };

  if (!password) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-md space-y-4 pt-4 text-center"
      >
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          Admin — medicine review
        </h1>
        <p className="text-sm text-ink-500">
          Enter the admin password to review medicines found by web search
          that are not yet in the database.
        </p>
        <div className="rounded-2xl border border-ink-100 bg-white p-5 text-left shadow-soft sm:p-6">
          <label
            htmlFor="admin-password"
            className="text-sm font-medium text-ink-700"
          >
            Admin password
          </label>
          <input
            id="admin-password"
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void signIn();
            }}
            className="mt-2 min-h-12 w-full rounded-xl border border-ink-200 bg-ink-50/60 px-4 text-sm focus:border-brand-600 focus:bg-white focus:outline-none"
          />
          {gateError && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {gateError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={gateBusy}
            className="mt-4 min-h-12 w-full rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:bg-ink-200"
          >
            {gateBusy ? "Checking…" : "Sign in"}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            Medicine review queue
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Medicines found by web search during scans, waiting for review.
            Approving adds the medicine to the database; rejecting keeps it
            out, with a reason.
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="min-h-11 shrink-0 rounded-full border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 transition hover:bg-ink-100"
        >
          Sign out
        </button>
      </div>

      <div
        className="flex gap-2 overflow-x-auto"
        role="tablist"
        aria-label="Request status"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-medium capitalize transition ${
              tab === t
                ? "bg-ink-900 text-white shadow-soft"
                : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-ink-400">Loading…</p>}
      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100"
        >
          {error}
        </p>
      )}
      {!loading && !error && (
        <AdminTable
          requests={requests}
          password={password}
          onChanged={() => void load(password, tab)}
        />
      )}
    </motion.div>
  );
}
