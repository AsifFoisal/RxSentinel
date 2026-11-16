/**
 * Typed API client for the RxSentinel backend (FastAPI, see PHASE4_SPEC §2).
 * Every fetch call in the frontend lives here, so the contract is in one
 * place. Base URL from NEXT_PUBLIC_API_URL, default http://127.0.0.1:8000.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const DISCLAIMER =
  "For information only — not medical advice. Ask your pharmacist or doctor before changing any medicine.";

export type Provenance = "database" | "web-unverified";
export type ScanList = "prescription" | "dispensed";
export type RiskLevel = "Low" | "Warning" | "Unknown" | "High";

export interface Medicine {
  brand?: string;
  generic?: string;
  /** Ingredients (web-unverified rows carry the web-searched composition). */
  ingredients?: string[];
  strength_parts?: string[];
  strength_mg?: number;
  doses_per_day?: number;
  expiry?: string | null;
  batch?: string | null;
  source?: string;
  confidence?: number;
  /** Where the composition came from. Web rows are labelled, never DB fact. */
  provenance?: Provenance;
}

export interface NeedsConfirmationItem {
  brand?: string;
  generic?: string;
  doses_per_day?: number;
  strength_mg?: number;
  reason?: string;
  stated_generic?: string;
  source?: string;
  confidence?: number;
}

export interface Prescription {
  medicines: Medicine[];
  needs_confirmation: NeedsConfirmationItem[];
  source?: string;
  confidence_threshold?: number;
  disclaimer?: string;
  list?: ScanList;
}

export interface Finding {
  code: string;
  severity: string;
  ingredient_a?: string;
  ingredient_b?: string;
  title: string;
  detail: string;
  management?: string;
  source?: string;
  verified_via?: string;
  mechanism_source?: string;
  action?: string;
}

export interface SafetyReport {
  risk_level: RiskLevel;
  medicines_checked: number;
  medicines_resolved: number;
  findings: Finding[];
  counts: Record<string, number>;
  coverage: {
    pairs_checked: number;
    pairs_with_data: number;
    ingredients_with_max: number;
    ingredients_totalled: number;
    expiry_checked: number;
    expiry_unparseable: number;
    expiry_total: number;
  };
  disclaimer: string;
}

export interface ScanResponse {
  prescription: Prescription;
  report: SafetyReport | null;
  provenance?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Sources are attached to an assistant message after the reply
  arrives; they are never sent back to the API (sendChat strips
  them, so the wire contract stays {role, content}). */
  sources?: ChatSource[];
}

export interface ChatSource {
  id: string;
  source: string;
  text: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

export type RequestStatus = "pending" | "approved" | "rejected";

export interface MedicineRequest {
  id: string;
  brand: string;
  generic_title?: string;
  ingredients: string[];
  strength_parts: string[];
  dosage_form?: string;
  company?: string;
  source?: string;
  source_verified: boolean;
  scan_count: number;
  first_seen?: string;
  last_seen?: string;
  status: RequestStatus;
}

/** Error carrying the backend's `{detail: "..."}` message — never a stack trace. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail) detail = body.detail;
  } catch {
    // Non-JSON error body: keep the generic message, never surface raw text.
  }
  return new ApiError(res.status, detail);
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

/**
 * Scan an image. No mode choice: the backend always runs intake in
 * auto mode (printed vs handwritten is detected from the image) and
 * the result's `prescription.source` says which reader was used.
 * See PHASE4_UI_SPEC §1.
 */
export async function scanImage(
  image: File,
  list: ScanList,
): Promise<ScanResponse> {
  const form = new FormData();
  form.append("image", image);
  form.append("list", list);
  const res = await fetch(`${API_URL}/api/scan`, {
    method: "POST",
    body: form,
  });
  return jsonOrThrow<ScanResponse>(res);
}

/** POST /api/report and return the PDF as a Blob for download. */
export async function fetchReportPdf(
  prescription: Prescription,
  report: SafetyReport | null,
): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prescription, report }),
  });
  if (!res.ok) throw await parseError(res);
  return await res.blob();
}

export async function sendChat(
  messages: ChatMessage[],
  context: { prescription: Prescription; report: SafetyReport | null },
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Sources ride on the local message objects only — strip them so
    // the request stays exactly {role, content} as the API expects.
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
      context,
    }),
  });
  return jsonOrThrow<ChatResponse>(res);
}

function adminHeaders(password: string): Record<string, string> {
  return { "X-Admin-Password": password };
}

export async function listMedicineRequests(
  password: string,
  status: RequestStatus,
): Promise<MedicineRequest[]> {
  const res = await fetch(
    `${API_URL}/api/admin/medicine-requests?status=${status}`,
    { headers: adminHeaders(password) },
  );
  const body = await jsonOrThrow<{ requests: MedicineRequest[] }>(res);
  return body.requests;
}

export async function approveMedicineRequest(
  password: string,
  id: string,
): Promise<{ ok: boolean; brand: string }> {
  const res = await fetch(
    `${API_URL}/api/admin/medicine-requests/${encodeURIComponent(id)}/approve`,
    { method: "POST", headers: adminHeaders(password) },
  );
  return jsonOrThrow<{ ok: boolean; brand: string }>(res);
}

export async function rejectMedicineRequest(
  password: string,
  id: string,
  reason: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `${API_URL}/api/admin/medicine-requests/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(password),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    },
  );
  return jsonOrThrow<{ ok: boolean }>(res);
}
