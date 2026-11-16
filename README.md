# RxSentinel — Frontend (Phase 4)

Next.js (App Router) + TypeScript + Tailwind CSS v4. Talks to the FastAPI
backend in `../backend/` (see `../PHASE4_SPEC.md` §2 for the API contract).

## Run

```powershell
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

The backend must be running on port 8000 (or set `NEXT_PUBLIC_API_URL` in
`.env.local` — see `.env.example`). The backend enables CORS for
`http://localhost:3000`.

## Pages

- `/` — scan a prescription or dispensed-packs photo (drag/drop or file
  picker, prescription/dispensed toggle, handwritten toggle), inline
  results (risk badge, medicines table with the "web search — not yet
  verified in our database" label + source link, needs-confirmation
  list, findings accordion, dose summary, coverage), PDF download,
  and the document chat panel (disabled until a scan has run).
- `/admin` — password gate (password kept in sessionStorage, sent as the
  `X-Admin-Password` header), then the medicine review queue with
  pending / approved / rejected tabs and one-click approve / reject
  (reject asks for a reason).

## Rules the UI follows

- Every page shows the standard disclaimer: "For information only — not
  medical advice. Ask your pharmacist or doctor before changing any
  medicine."
- No medical-advice wording anywhere; a web-sourced composition is never
  presented as database fact; a Low result is never called "safe".
- API errors show the backend's `{detail}` message, never a stack trace.
