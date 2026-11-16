"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type DragEvent,
  type Ref,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import gsap from "gsap";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface FileDropHandle {
  /** Add files programmatically (e.g. from another picker). */
  add: (files: File[] | FileList) => void;
  /** Remove every listed file. */
  clear: () => void;
}

export type UploadFn = (
  file: File,
  progress: (p: number) => void,
) => Promise<void>;

interface FileDropProps {
  /** Max accepted file size in bytes. Defaults to 10 MB. */
  maxSize?: number;
  /**
   * Called per file with a progress callback. Defaults to a simulated
   * ~2 s upload with wobbling speed. The real upload happens when the
   * user hits Scan, not on drop.
   */
  upload?: UploadFn;
  /** Fires with the current file list whenever it changes. */
  onFilesChange?: (files: File[]) => void;
  className?: string;
  ref?: Ref<FileDropHandle>;
}

type RowStatus = "uploading" | "done" | "error";

interface RowData {
  id: string;
  file: File;
  thumbUrl: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif|heic|heif)$/i;

const isImageFile = (f: File) =>
  f.type.startsWith("image/") || IMAGE_EXT.test(f.name);

const formatSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

let rowCounter = 0;
const nextRowId = () => {
  rowCounter += 1;
  return `file-${Date.now().toString(36)}-${rowCounter}`;
};

/** Default simulated uploader: ~2 s with wobbling speed. */
const defaultUpload: UploadFn = (_file, progress) =>
  new Promise<void>((resolve) => {
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

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const CloudIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-7 w-7"
    aria-hidden
  >
    <path d="M7 18a4.5 4.5 0 1 1 .6-8.96A5.5 5.5 0 0 1 18.3 11 3.75 3.75 0 0 1 17.5 18H7Z" />
    <path d="M12 12v6M9.5 14.5 12 12l2.5 2.5" />
  </svg>
);

const CrossIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    className="h-4 w-4"
    aria-hidden
  >
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const BinIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
    aria-hidden
  >
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1.1 13a2 2 0 0 1-2 1.9H9.1a2 2 0 0 1-2-1.9L6 7" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* File row                                                            */
/* ------------------------------------------------------------------ */

interface FileRowProps {
  item: RowData;
  index: number;
  upload: UploadFn;
  reducedMotion: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  cardRef: RefObject<HTMLDivElement | null>;
  onStatusChange: (id: string, status: RowStatus) => void;
  onRemove: (id: string) => void;
}

function FileRow({
  item,
  index,
  upload,
  reducedMotion,
  stageRef,
  cardRef,
  onStatusChange,
  onRemove,
}: FileRowProps) {
  const progress: MotionValue<number> = useMotionValue(0);
  const [status, setStatus] = useState<RowStatus>("uploading");
  const [touchBin, setTouchBin] = useState(false);
  const rowRef = useRef<HTMLLIElement | null>(null);
  const cancelledRef = useRef(false);

  // Keep the latest callbacks in refs so the mount-once upload effect
  // never restarts when the parent re-renders with new closures.
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;

  useEffect(() => {
    let alive = true;
    void uploadRef
      .current(item.file, (p) => {
        if (alive) progress.set(p);
      })
      .then(() => {
        if (!alive || cancelledRef.current) return;
        progress.set(1);
        setStatus("done");
        statusRef.current(item.id, "done");
      })
      .catch(() => {
        if (!alive || cancelledRef.current) return;
        setStatus("error");
        statusRef.current(item.id, "error");
      });
    return () => {
      alive = false;
    };
    // Mount-only: the upload for a row starts once, on drop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On touch screens (hover: none) the finished check settles into a
  // grey bin after 1.4 s.
  useEffect(() => {
    if (status !== "done") return;
    if (!window.matchMedia("(hover: none)").matches) return;
    const t = window.setTimeout(() => setTouchBin(true), 1400);
    return () => window.clearTimeout(t);
  }, [status]);

  /* Thumbnail "develops" like a photo as progress rises. */
  const thumbBlur = useTransform(progress, [0, 1], [10, 0]);
  const thumbGray = useTransform(progress, [0, 1], [1, 0]);
  const thumbZoom = useTransform(progress, [0, 1], [1.08, 1]);
  const thumbFilter = useMotionTemplate`blur(${thumbBlur}px) grayscale(${thumbGray})`;
  const percentLabel = useTransform(
    progress,
    (v) => `${Math.round(v * 100)}%`,
  );
  const fillWidth = useTransform(progress, (v) => `${v * 100}%`);
  const done = status === "done";

  /** GSAP crack-and-shatter delete; falls back to a plain remove. */
  const shatter = useCallback(() => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    const rowEl = rowRef.current;
    const stage = stageRef.current;
    const card = cardRef.current;
    if (reducedMotion || !rowEl || !stage || !card) {
      onRemove(item.id);
      return;
    }

    const rowRect = rowEl.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const left = rowRect.left - cardRect.left;
    const top = rowRect.top - cardRect.top;
    const w = rowRect.width;
    const h = rowRect.height;
    const cx = w / 2;

    /* 1. Hairline SVG crack down the row (GSAP stroke tween). */
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;pointer-events:none;overflow:visible;`;
    let d = `M ${cx} -4`;
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      d += ` L ${(cx + (Math.random() * 14 - 7)).toFixed(1)} ${((h * i) / steps).toFixed(1)}`;
    }
    d += ` L ${cx} ${h + 4}`;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#0f1b2d");
    path.setAttribute("stroke-width", "1");
    path.setAttribute("opacity", "0.65");
    svg.appendChild(path);
    stage.appendChild(svg);
    const len = path.getTotalLength();
    gsap.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" },
    );

    /* 2. Clone the row twice, clipped into jagged left/right halves.
       The polygon extends past the edges so the outline breaks too. */
    const edge: string[] = [];
    for (let i = 0; i <= steps; i++) {
      edge.push(
        `${(cx + (Math.random() * 10 - 5)).toFixed(1)}px ${((h * i) / steps).toFixed(1)}px`,
      );
    }
    const leftPoly = `polygon(-24px -24px, ${edge.join(", ")}, -24px ${h + 24}px)`;
    const rightPoly = `polygon(${w + 24}px -24px, ${[...edge].reverse().join(", ")}, ${w + 24}px ${h + 24}px)`;
    const makeClone = (clip: string) => {
      const clone = rowEl.cloneNode(true) as HTMLElement;
      clone.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;margin:0;pointer-events:none;clip-path:${clip};will-change:transform,opacity,filter;`;
      stage.appendChild(clone);
      return clone;
    };
    const leftHalf = makeClone(leftPoly);
    const rightHalf = makeClone(rightPoly);

    /* 3. Five tiny triangle flakes along the crack. */
    const flakes: HTMLElement[] = [];
    for (let i = 0; i < 5; i++) {
      const flake = document.createElement("div");
      const s = 5 + Math.random() * 7;
      flake.style.cssText = `position:absolute;left:${(left + cx + (Math.random() * 16 - 8)).toFixed(1)}px;top:${(top + h * (0.15 + Math.random() * 0.7)).toFixed(1)}px;width:${s.toFixed(1)}px;height:${s.toFixed(1)}px;background:#c3d2de;clip-path:polygon(50% 0, 100% 100%, 0 100%);pointer-events:none;will-change:transform,opacity;`;
      stage.appendChild(flake);
      flakes.push(flake);
    }

    /* 4. Collapse the real row behind the flying halves. */
    gsap.set(rowEl, { overflow: "hidden", height: h });
    gsap.to(rowEl, {
      height: 0,
      opacity: 0,
      marginTop: 0,
      duration: 0.5,
      delay: 0.35,
      ease: "power2.inOut",
      onComplete: () => onRemove(item.id),
    });

    /* 5. Shiver, then free bodies on the GSAP ticker: outward + upward
       push, spin, gravity, air drag, growing drop shadow, fade. */
    interface Body {
      el: HTMLElement;
      x: number;
      y: number;
      vx: number;
      vy: number;
      rot: number;
      vr: number;
      life: number;
      shadow: boolean;
    }
    const bodies: Body[] = [
      {
        el: leftHalf,
        x: 0,
        y: 0,
        vx: -(50 + Math.random() * 90),
        vy: -(140 + Math.random() * 120),
        rot: 0,
        vr: -(40 + Math.random() * 120),
        life: 0,
        shadow: true,
      },
      {
        el: rightHalf,
        x: 0,
        y: 0,
        vx: 50 + Math.random() * 90,
        vy: -(120 + Math.random() * 120),
        rot: 0,
        vr: 40 + Math.random() * 120,
        life: 0,
        shadow: true,
      },
      ...flakes.map((el) => ({
        el,
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 360,
        vy: -(180 + Math.random() * 180),
        rot: 0,
        vr: (Math.random() - 0.5) * 1080,
        life: 0,
        shadow: false,
      })),
    ];

    gsap.to([leftHalf, rightHalf], {
      keyframes: [{ x: -2 }, { x: 2 }, { x: -2 }, { x: 2 }, { x: 0 }],
      duration: 0.3,
      ease: "none",
      onComplete: () => {
        const tick = (_time: number, deltaTime: number) => {
          const dt = Math.min(deltaTime, 50) / 1000;
          let alive = false;
          for (const b of bodies) {
            b.life += dt;
            if (b.life > 1.15) continue;
            alive = true;
            b.vy += 950 * dt; // gravity
            b.vx *= Math.exp(-1.6 * dt); // air drag
            b.vy *= Math.exp(-0.25 * dt);
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.rot += b.vr * dt;
            const fade =
              b.life < 0.55
                ? 1
                : Math.max(0, 1 - (b.life - 0.55) / 0.6);
            b.el.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px) rotate(${b.rot.toFixed(1)}deg)`;
            b.el.style.opacity = fade.toFixed(2);
            if (b.shadow) {
              const fall = Math.max(0, b.y);
              b.el.style.filter = `drop-shadow(0 ${Math.min(20, 4 + fall * 0.09).toFixed(1)}px ${(10 + fall * 0.08).toFixed(1)}px rgba(10,17,32,${Math.min(0.32, 0.12 + fall * 0.001).toFixed(2)}))`;
            }
          }
          if (!alive) {
            gsap.ticker.remove(tick);
            svg.remove();
            leftHalf.remove();
            rightHalf.remove();
            flakes.forEach((f) => f.remove());
          }
        };
        gsap.ticker.add(tick);
      },
    });
  }, [cardRef, item.id, onRemove, reducedMotion, stageRef]);

  return (
    <motion.li
      ref={rowRef}
      initial={
        reducedMotion
          ? false
          : { height: 0, opacity: 0, y: 12, filter: "blur(6px)" }
      }
      animate={
        reducedMotion
          ? { opacity: 1 }
          : { height: "auto", opacity: 1, y: 0, filter: "blur(0px)" }
      }
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 26,
        delay: reducedMotion ? 0 : index * 0.07,
      }}
      className="group relative list-none"
    >
      <div className="relative isolate overflow-hidden rounded-xl border border-ink-100 bg-ink-50/60">
        {/* Green wash sweeping the row on completion. */}
        {done && !reducedMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-emerald-200/50"
            initial={{ x: "-102%" }}
            animate={{ x: "102%" }}
            transition={{ duration: 0.55, ease: "easeInOut" }}
          />
        )}
        {/* Faint green radial glow rising from the bottom edge. */}
        {done && !reducedMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2"
            style={{
              background:
                "radial-gradient(ellipse 80% 100% at 50% 100%, rgba(16,185,129,0.35), transparent 70%)",
            }}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: [0, 1, 0] }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        )}

        <div className="relative flex items-center gap-3 p-3">
          {/* Thumbnail that develops as progress rises; pops on done. */}
          <motion.div
            animate={done && !reducedMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              src={item.thumbUrl}
              alt=""
              className="h-full w-full object-cover"
              style={{ filter: thumbFilter, scale: thumbZoom }}
            />
          </motion.div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900">
              {item.file.name}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {formatSize(item.file.size)}
              {done
                ? " · Uploaded"
                : status === "error"
                  ? " · Upload failed"
                  : (
                    <>
                      {" · "}
                      <motion.span>{percentLabel}</motion.span>
                    </>
                  )}
            </p>

            {/* Progress slider: ink fill, gliding sheen, knob on the tip. */}
            <AnimatePresence initial={false}>
              {status === "uploading" && (
                <motion.div
                  key="slider"
                  exit={
                    reducedMotion ? undefined : { opacity: 0, y: -8 }
                  }
                  transition={{ duration: 0.25 }}
                  className="relative mt-2 h-2"
                >
                  <div className="absolute inset-0 rounded-full bg-ink-100" />
                  <motion.div
                    className="absolute inset-y-0 left-0 overflow-hidden rounded-full bg-ink-800"
                    style={{ width: fillWidth }}
                  >
                    {!reducedMotion && (
                      <motion.div
                        aria-hidden
                        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                        animate={{ x: ["-100%", "320%"] }}
                        transition={{
                          duration: 1.4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    )}
                  </motion.div>
                  <motion.div
                    aria-hidden
                    className="absolute top-1/2 h-4 w-4 rounded-full bg-white shadow ring-1 ring-ink-200"
                    style={{ left: fillWidth, x: "-50%", y: "-50%" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Cancel cross / green check (becomes a bin on hover, focus
              or — on touch — 1.4 s after finishing). */}
          <button
            type="button"
            onClick={shatter}
            aria-label={
              done ? `Remove ${item.file.name}` : `Cancel ${item.file.name}`
            }
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-red-50 focus-visible:bg-red-50"
          >
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.span
                  key="check"
                  initial={
                    reducedMotion ? false : { scale: 0, rotate: -120 }
                  }
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 20,
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0 ${
                    touchBin ? "opacity-0" : ""
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <motion.path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      initial={{ pathLength: reducedMotion ? 1 : 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        duration: reducedMotion ? 0 : 0.35,
                        delay: reducedMotion ? 0 : 0.1,
                      }}
                    />
                  </svg>
                </motion.span>
              ) : (
                <motion.span
                  key="cancel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2 }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition hover:text-ink-700"
                >
                  <CrossIcon />
                </motion.span>
              )}
            </AnimatePresence>
            {done && (
              <span
                aria-hidden
                className={`absolute inset-0 flex items-center justify-center rounded-full transition-all duration-200 ${
                  touchBin
                    ? "text-ink-400 opacity-100 group-hover:text-red-600"
                    : "text-red-600 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                }`}
              >
                <BinIcon />
              </span>
            )}
          </button>
        </div>
      </div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */
/* FileDrop                                                            */
/* ------------------------------------------------------------------ */

export function FileDrop({
  maxSize = 10 * 1024 * 1024,
  upload,
  onFilesChange,
  className = "",
  ref,
}: FileDropProps) {
  const reducedMotion = useReducedMotion();
  const [rows, setRows] = useState<RowData[]>([]);
  const [statusById, setStatusById] = useState<Record<string, RowStatus>>(
    {},
  );
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const zoneRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragCount = useRef(0);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowsRef = useRef<RowData[]>([]);
  rowsRef.current = rows;
  const onFilesChangeRef = useRef(onFilesChange);
  onFilesChangeRef.current = onFilesChange;

  const shakeControls = useAnimationControls();
  const gulpControls = useAnimationControls();

  const uploadFn = upload ?? defaultUpload;

  // Revoke object URLs on unmount.
  useEffect(
    () => () => {
      rowsRef.current.forEach((r) => URL.revokeObjectURL(r.thumbUrl));
      if (errorTimer.current) clearTimeout(errorTimer.current);
    },
    [],
  );

  const doneCount = rows.filter((r) => statusById[r.id] === "done").length;
  const uploadingCount = rows.filter(
    (r) => statusById[r.id] !== "done" && statusById[r.id] !== "error",
  ).length;
  const anyUploading = uploadingCount > 0;

  const counterText =
    rows.length === 0
      ? `Images only · up to ${formatSize(maxSize)}`
      : `${doneCount} of ${rows.length} done`;

  const zoneLine = dragOver
    ? "Release to upload"
    : anyUploading
      ? `Uploading ${uploadingCount} file${uploadingCount === 1 ? "" : "s"}…`
      : "Drop images here or browse";

  const showError = useCallback(
    (message: string) => {
      setError(message);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(null), 4500);
      if (!reducedMotion) {
        void shakeControls.start({
          x: [0, -9, 9, -6, 6, 0],
          transition: { duration: 0.45 },
        });
      }
    },
    [reducedMotion, shakeControls],
  );

  /** Ripple from the drop point + cloud gulp. */
  const celebrate = useCallback(
    (point: { x: number; y: number }) => {
      if (reducedMotion) return;
      setRipple({ ...point, key: Date.now() });
      void gulpControls.start({
        scaleY: [1, 0.75, 1.12, 1],
        scaleX: [1, 1.15, 0.92, 1],
        y: [0, 3, -2, 0],
        transition: { duration: 0.5, ease: "easeInOut" },
      });
    },
    [gulpControls, reducedMotion],
  );

  const addFiles = useCallback(
    (incoming: File[] | FileList) => {
      const list = Array.from(incoming);
      const accepted: RowData[] = [];
      const reasons: string[] = [];
      for (const f of list) {
        if (!isImageFile(f)) {
          reasons.push(`"${f.name}" is not an image`);
        } else if (f.size > maxSize) {
          reasons.push(
            `"${f.name}" is over the ${formatSize(maxSize)} limit`,
          );
        } else {
          accepted.push({
            id: nextRowId(),
            file: f,
            thumbUrl: URL.createObjectURL(f),
          });
        }
      }
      if (reasons.length > 0) {
        showError(
          reasons.length > 1
            ? `${reasons[0]} (+${reasons.length - 1} more)`
            : reasons[0],
        );
      }
      if (accepted.length === 0) return;
      const next = [...rowsRef.current, ...accepted];
      setRows(next);
      setStatusById((prev) => {
        const map = { ...prev };
        accepted.forEach((r) => {
          map[r.id] = "uploading";
        });
        return map;
      });
      onFilesChangeRef.current?.(next.map((r) => r.file));
    },
    [maxSize, showError],
  );

  const removeRow = useCallback((id: string) => {
    const row = rowsRef.current.find((r) => r.id === id);
    if (row) URL.revokeObjectURL(row.thumbUrl);
    const next = rowsRef.current.filter((r) => r.id !== id);
    setRows(next);
    setStatusById((prev) => {
      const map = { ...prev };
      delete map[id];
      return map;
    });
    onFilesChangeRef.current?.(next.map((r) => r.file));
  }, []);

  const clearAll = useCallback(() => {
    rowsRef.current.forEach((r) => URL.revokeObjectURL(r.thumbUrl));
    setRows([]);
    setStatusById({});
    onFilesChangeRef.current?.([]);
  }, []);

  useImperativeHandle(ref, () => ({ add: addFiles, clear: clearAll }));

  const handleStatusChange = useCallback(
    (id: string, status: RowStatus) => {
      setStatusById((prev) => ({ ...prev, [id]: status }));
    },
    [],
  );

  /* --- Drag over: counted enter/leave so children don't flicker. --- */
  const dragHasFiles = (e: DragEvent) =>
    Array.from(e.dataTransfer.types).some(
      (t) =>
        t === "Files" ||
        t === "text/uri-list" ||
        t === "text/x-moz-url" ||
        t === "DownloadURL",
    );

  const handleDragEnter = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dragCount.current += 1;
    if (dragHasFiles(e)) setDragOver(true);
  };

  const handleDragLeave = () => {
    dragCount.current = Math.max(0, dragCount.current - 1);
    if (dragCount.current === 0) setDragOver(false);
  };

  /** Image dragged from a page: DownloadURL or uri-list link. */
  const handleLinkDrop = async (dt: DataTransfer) => {
    const dl = dt.getData("DownloadURL");
    const uriList = dt.getData("text/uri-list");
    let url: string | null = null;
    let name = "image";
    let type = "";
    if (dl) {
      const first = dl.indexOf(":");
      const second = dl.indexOf(":", first + 1);
      if (first > 0 && second > first) {
        type = dl.slice(0, first);
        name = dl.slice(first + 1, second) || "image";
        url = dl.slice(second + 1);
      }
    } else if (uriList) {
      const line = uriList
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s && !s.startsWith("#"));
      if (line) {
        url = line;
        try {
          name =
            decodeURIComponent(
              new URL(line).pathname.split("/").pop() || "image",
            ) || "image";
        } catch {
          name = "image";
        }
      }
    }
    if (!url) {
      showError("Couldn't read that dragged item — drop an image file instead.");
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      if (!blob.type.startsWith("image/") && !type.startsWith("image/")) {
        throw new Error("not an image");
      }
      const ext = blob.type.split("/")[1] || "png";
      const file = new File(
        [blob],
        name.includes(".") ? name : `${name}.${ext}`,
        { type: blob.type || type || "image/png" },
      );
      addFiles([file]);
    } catch {
      showError(
        "Couldn't download that image — the site may block direct downloads.",
      );
    }
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dragCount.current = 0;
    setDragOver(false);
    const rect = e.currentTarget.getBoundingClientRect();
    celebrate({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFiles(files);
      return;
    }
    void handleLinkDrop(e.dataTransfer);
  };

  const openPicker = () => inputRef.current?.click();

  const handleInputPick = () => {
    const files = inputRef.current?.files;
    if (files && files.length > 0) {
      const rect = zoneRef.current?.getBoundingClientRect();
      if (rect) celebrate({ x: rect.width / 2, y: rect.height / 2 });
      addFiles(files);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      ref={cardRef}
      className={`relative rounded-2xl border border-ink-100 bg-white p-4 shadow-soft sm:p-5 ${className}`}
    >
      {/* Card header: title + rolling counter. */}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink-900">
          Upload images
        </h3>
        <span className="relative block h-5 overflow-hidden text-xs font-medium text-ink-500">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={counterText}
              initial={
                reducedMotion ? false : { y: 10, opacity: 0, filter: "blur(4px)" }
              }
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={
                reducedMotion ? undefined : { y: -10, opacity: 0, filter: "blur(4px)" }
              }
              transition={{ duration: 0.25 }}
              className="block whitespace-nowrap"
            >
              {counterText}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      {/* Drop zone (shakes on bad files). */}
      <motion.div animate={shakeControls} className="relative mt-3">
        <motion.button
          ref={zoneRef}
          type="button"
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragHasFiles(e)) e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={handleDrop}
          animate={{ scale: dragOver && !reducedMotion ? 1.015 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          aria-label="Choose prescription or pack images"
          className={`relative block w-full overflow-hidden rounded-2xl p-6 text-center transition-colors sm:p-8 ${
            dragOver ? "bg-brand-50" : "bg-ink-50/60 hover:bg-brand-50/50"
          }`}
        >
          {/* SVG dashed border — dashes march while dragging over. */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <motion.rect
              x={2}
              y={2}
              rx={14}
              fill="none"
              strokeWidth={2}
              style={{
                width: "calc(100% - 4px)",
                height: "calc(100% - 4px)",
              }}
              stroke={dragOver ? "#0d9488" : "#c3d2de"}
              strokeDasharray="6 6"
              initial={false}
              animate={
                reducedMotion || !dragOver
                  ? { strokeDashoffset: 0 }
                  : { strokeDashoffset: [0, -12] }
              }
              transition={
                dragOver && !reducedMotion
                  ? { duration: 0.5, repeat: Infinity, ease: "linear" }
                  : { duration: 0.3 }
              }
            />
          </svg>

          {/* Drop ripple. */}
          <AnimatePresence>
            {ripple && (
              <motion.span
                key={ripple.key}
                aria-hidden
                className="pointer-events-none absolute rounded-full bg-brand-500/20"
                style={{
                  left: ripple.x - 130,
                  top: ripple.y - 130,
                  width: 260,
                  height: 260,
                }}
                initial={{ scale: 0, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                onAnimationComplete={() => setRipple(null)}
              />
            )}
          </AnimatePresence>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleInputPick}
          />

          {/* Cloud tile: lifts + inks on drag-over, conic arc while
              anything uploads, gulps on drop. */}
          <div className="relative mx-auto h-14 w-14">
            {anyUploading && (
              <div
                aria-hidden
                className="absolute -inset-1.5 rounded-2xl"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, transparent 240deg, #0d9488 360deg)",
                  WebkitMask:
                    "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
                  animation: reducedMotion
                    ? undefined
                    : "file-drop-spin 1.2s linear infinite",
                }}
              />
            )}
            <motion.div
              animate={
                dragOver && !reducedMotion ? { y: -4, scale: 1.06 } : { y: 0, scale: 1 }
              }
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                dragOver
                  ? "bg-brand-600 text-white"
                  : "bg-brand-100 text-brand-700"
              }`}
            >
              <motion.div animate={gulpControls}>
                <CloudIcon />
              </motion.div>
            </motion.div>
          </div>

          {/* Rolling zone line. */}
          <span className="relative mt-4 block h-6 overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={zoneLine}
                initial={
                  reducedMotion
                    ? false
                    : { y: 10, opacity: 0, filter: "blur(4px)" }
                }
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={
                  reducedMotion
                    ? undefined
                    : { y: -10, opacity: 0, filter: "blur(4px)" }
                }
                transition={{ duration: 0.25 }}
                className="block font-display text-base font-semibold text-ink-900"
              >
                {zoneLine}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="mt-1 block text-sm text-ink-500">
            Printed or handwritten — RxSentinel detects it automatically.
          </span>
        </motion.button>
      </motion.div>

      {/* Rejection reason. */}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="filedrop-error"
            role="alert"
            initial={reducedMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 text-sm font-medium text-red-600"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* File list — rows slide in one after another. */}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((row, i) => (
            <FileRow
              key={row.id}
              item={row}
              index={i}
              upload={uploadFn}
              reducedMotion={reducedMotion ?? false}
              stageRef={stageRef}
              cardRef={cardRef}
              onStatusChange={handleStatusChange}
              onRemove={removeRow}
            />
          ))}
        </ul>
      )}

      {/* Shatter overlay stage — clones + flakes fly here. */}
      <div
        ref={stageRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 overflow-visible"
      />
    </div>
  );
}
