/**
 * SendButton — animated GSAP send button for TransferTab.
 *
 * Visual flow:
 *   idle     → green rect, white paper-plane (pointing right) + "Send" label
 *   click    → label fades → rect morphs to circle → plane flies arc (MotionPath)
 *              → awaits onSend() + flight completion simultaneously
 *   success  → circle expands back → white tick + "Sent!" appear, then reset
 *   error    → rect flashes red briefly → returns to idle
 */

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(MotionPathPlugin);

/* ── geometry ─────────────────────────────────────────────────────── */
const VW     = 400;
const VH     = 64;
const BTN_RX = 16;

// Circle phase
const C_R  = VH / 2;          // 32
const C_X  = VW / 2 - C_R;   // 168
const C_W  = VH;              // 64

// Plane idle anchor
const PX = 72;
const PY = 32;

/* ─────────────────────────────────────────────────────────────────── */

type BtnState = "idle" | "loading" | "success" | "error";

interface SendButtonProps {
  disabled?: boolean;
  onSend: () => Promise<void>;
  label?: string;
  "data-testid"?: string;
}

export default function SendButton({
  disabled,
  onSend,
  label = "Send",
  "data-testid": testId = "button-send",
}: SendButtonProps) {
  const [uiState, setUiState] = useState<BtnState>("idle");
  const stateRef = useRef<BtnState>("idle");

  /* SVG element refs */
  const btnBaseRef = useRef<SVGRectElement>(null);
  const txtSendRef = useRef<SVGGElement>(null);
  const planeGRef  = useRef<SVGGElement>(null);
  const routeRef   = useRef<SVGPathElement>(null);
  const tickGRef   = useRef<SVGGElement>(null);
  const txtSentRef = useRef<SVGTextElement>(null);

  const tlRef      = useRef<gsap.core.Timeline | null>(null);
  const tl2Ref     = useRef<gsap.core.Timeline | null>(null);

  /* ── reset ─────────────────────────────────────────────────────── */
  const reset = useCallback(() => {
    tlRef.current?.kill();
    tl2Ref.current?.kill();
    tlRef.current = null;
    tl2Ref.current = null;

    const r   = btnBaseRef.current;
    const ts  = txtSendRef.current;
    const pg  = planeGRef.current;
    const rt  = routeRef.current;
    const tk  = tickGRef.current;
    const tst = txtSentRef.current;

    if (r)   gsap.set(r,   { attr: { x: 0, y: 0, width: VW, height: VH, rx: BTN_RX }, fill: "#3ab368" });
    if (ts)  gsap.set(ts,  { opacity: 1, scale: 1, x: 0, y: 0 });
    if (pg)  gsap.set(pg,  { x: 0, y: 0, rotation: 0, opacity: 1, clearProps: "transform,motionPath" });
    if (tk)  gsap.set(tk,  { opacity: 0, scale: 0.8, transformOrigin: "50% 50%" });
    if (tst) gsap.set(tst, { opacity: 0 });
    if (rt)  gsap.set(rt,  { opacity: 0 });

    stateRef.current = "idle";
    setUiState("idle");
  }, []);

  useEffect(() => () => {
    tlRef.current?.kill();
    tl2Ref.current?.kill();
  }, []);

  /* ── click ─────────────────────────────────────────────────────── */
  const handleClick = useCallback(async () => {
    if (disabled || stateRef.current !== "idle") return;
    stateRef.current = "loading";
    setUiState("loading");

    const r   = btnBaseRef.current;
    const ts  = txtSendRef.current;
    const pg  = planeGRef.current;
    const rt  = routeRef.current;
    const tk  = tickGRef.current;
    const tst = txtSentRef.current;

    /* Phase 1 — morph + flight */
    const tl = gsap.timeline({ paused: true });
    tlRef.current = tl;

    // Fade label
    if (ts) tl.to(ts, { opacity: 0, scale: 0.94, transformOrigin: "50% 50%", duration: 0.18, ease: "power2.in" }, 0);

    // Rect → circle
    if (r) tl.to(r, { attr: { x: C_X, y: 0, width: C_W, height: VH, rx: C_R }, duration: 0.42, ease: "power2.inOut" }, 0.06);

    // Fly plane along arc (MotionPath)
    if (pg && rt) {
      gsap.set(rt, { opacity: 0 });
      tl.to(pg, {
        duration: 0.68,
        ease: "power2.inOut",
        motionPath: {
          path: rt,
          align: rt,
          alignOrigin: [0.5, 0.5],
          autoRotate: true,
        },
      }, 0.24);
    }

    // Fade plane out as it "enters" the circle
    if (pg) tl.to(pg, { opacity: 0, duration: 0.14 }, 0.24 + 0.54);

    const flightDone = new Promise<void>((res) => tl.eventCallback("onComplete", res));
    tl.play();

    /* Await both send + flight */
    try {
      await Promise.all([onSend(), flightDone]);

      stateRef.current = "success";
      setUiState("success");

      const tl2 = gsap.timeline({ onComplete: () => setTimeout(reset, 2000) });
      tl2Ref.current = tl2;

      // Expand circle back to rect
      if (r) tl2.to(r, { attr: { x: 0, y: 0, width: VW, height: VH, rx: BTN_RX }, duration: 0.32, ease: "power2.out" }, 0);
      // Tick appears
      if (tk) tl2.to(tk, { opacity: 1, scale: 1, transformOrigin: "50% 50%", duration: 0.22, ease: "power2.out" }, 0.22);
      // "Sent!" text
      if (tst) tl2.to(tst, { opacity: 1, duration: 0.18 }, 0.28);

      tl2.play();
    } catch {
      stateRef.current = "error";
      setUiState("error");

      tlRef.current?.kill();
      const errTl = gsap.timeline({ onComplete: reset });
      if (r) {
        errTl.to(r, { attr: { x: 0, y: 0, width: VW, height: VH, rx: BTN_RX }, fill: "#ef4444", duration: 0.28, ease: "power2.out" }, 0);
        errTl.to(r, { fill: "#3ab368", duration: 0.4 }, 1.0);
      }
      if (ts) errTl.to(ts, { opacity: 1, scale: 1, transformOrigin: "50% 50%", duration: 0.22 }, 0.12);
      if (pg) errTl.to(pg, { opacity: 0, duration: 0.12 }, 0);
    }
  }, [disabled, onSend, reset]);

  const isDisabled = disabled || uiState !== "idle";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      data-testid={testId}
      aria-label={label}
      className="w-full h-14 relative select-none"
      style={{ background: "none", border: "none", padding: 0, cursor: isDisabled ? "default" : "pointer" }}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full block"
        overflow="visible"
      >
        {/*
          Hidden flight arc: starts at plane anchor (PX,PY),
          arcs up and right, lands at circle centre (VW/2, VH/2).
        */}
        <path
          ref={routeRef}
          d={`M ${PX},${PY}
              C ${PX + 30},-50  ${VW * 0.55},-60  ${VW / 2},${VH / 2}
              C ${VW * 0.55},${VH + 40}  ${VW * 0.75},-30  ${VW / 2},${VH / 2}`}
          fill="none"
          opacity="0"
        />

        {/* Button base */}
        <rect
          ref={btnBaseRef}
          x="0" y="0"
          width={VW} height={VH}
          rx={BTN_RX}
          fill="#3ab368"
          opacity={disabled && uiState === "idle" ? 0.45 : 1}
        />

        {/* Send label (idle) */}
        <g ref={txtSendRef}>
          <text
            x={VW / 2 + 16}
            y={VH / 2 + 6}
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="16"
            fontWeight="700"
            letterSpacing="0.04em"
          >
            {uiState === "idle" || uiState === "error" ? label : ""}
          </text>
        </g>

        {/*
          Paper plane — right-facing Telegram-style shape, centered at (PX, PY).
          Tip points right (+x), wings spread up/down.
        */}
        <g
          ref={planeGRef}
          style={{ transformOrigin: `${PX}px ${PY}px` }}
        >
          {/* Main body: tip right, body left */}
          <path
            d="M 58 21 L 88 31.5 L 77.2 36.2 L 72.4 45 L 68.7 36.8 L 58 32.8 Z"
            fill="#ffffff"
          />
          {/* Fold line (lower wing crease) */}
          <path
            d="M 68.7 36.8 L 75.2 32.9 L 62.6 29.1 Z"
            fill="rgba(0,0,0,0.18)"
          />
        </g>

        {/* Checkmark (success) */}
        <g ref={tickGRef} opacity="0">
          <path
            d="M 162 32 L 170 40 L 186 24"
            stroke="#ffffff"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* "Sent!" text (success) */}
        <text
          ref={txtSentRef}
          x="218"
          y="38"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="16"
          fontWeight="700"
          letterSpacing="0.04em"
          opacity="0"
        >
          Sent!
        </text>
      </svg>
    </button>
  );
}
