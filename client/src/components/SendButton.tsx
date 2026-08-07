/**
 * SendButton — animated GSAP send button for TransferTab.
 *
 * Visual flow (adapted from CodePen abRKeXX, free GSAP only):
 *   idle      → "Send →" text + paper-plane icon visible in full green rect
 *   click     → text scales out → rect morphs to green circle (attr tween rx/w/h)
 *               → plane flies along curved SVG route (MotionPathPlugin, free)
 *               → awaits onSend() promise
 *   success   → circle expands back to rect → checkmark + "Sent!" appear
 *   error     → circle expands back → rect flashes red briefly → returns to idle
 */

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(MotionPathPlugin);

/* ── geometry ─────────────────────────────────────────────────────── */
const VW = 400;          // viewBox width
const VH = 64;           // viewBox height
const BTN_RX = 20;       // idle corner radius

// Circle phase: centered in viewBox, radius = VH/2 → perfect circle
const C_R  = VH / 2;
const C_X  = VW / 2 - C_R;   // 168
const C_Y  = 0;
const C_W  = VH;              // 64  (circle width = height)
const C_RX = C_R;             // 32

// Paper-plane anchor in idle (left area of button)
const PLANE_IX = 72;
const PLANE_IY = 32;

/* ─────────────────────────────────────────────────────────────────── */

type BtnState = "idle" | "loading" | "success" | "error";

interface SendButtonProps {
  disabled?: boolean;
  onSend: () => Promise<void>;
  label?: string;
  processingLabel?: string;
  "data-testid"?: string;
}

export default function SendButton({
  disabled,
  onSend,
  label = "Send →",
  processingLabel = "",
  "data-testid": testId = "button-send",
}: SendButtonProps) {
  const [uiState, setUiState] = useState<BtnState>("idle");
  const stateRef = useRef<BtnState>("idle");

  /* SVG element refs */
  const btnBaseRef  = useRef<SVGRectElement>(null);
  const txtSendRef  = useRef<SVGGElement>(null);
  const planeGRef   = useRef<SVGGElement>(null);   // paper-plane group
  const routeRef    = useRef<SVGPathElement>(null); // hidden flight path
  const tickGRef    = useRef<SVGGElement>(null);    // checkmark group
  const txtSentRef  = useRef<SVGTextElement>(null);
  const tlRef       = useRef<gsap.core.Timeline | null>(null);

  /* ── reset all SVG transforms back to idle ────────────────────── */
  const reset = useCallback(() => {
    tlRef.current?.kill();
    tlRef.current = null;
    const r = btnBaseRef.current;
    const ts = txtSendRef.current;
    const pg = planeGRef.current;
    const tk = tickGRef.current;
    const tst = txtSentRef.current;
    const rt = routeRef.current;

    if (r)   gsap.set(r,   { attr: { x: 0, y: 0, width: VW, height: VH, rx: BTN_RX }, fill: "#3ab368" });
    if (ts)  gsap.set(ts,  { opacity: 1, scale: 1, transformOrigin: "50% 50%", x: 0, y: 0 });
    if (pg)  gsap.set(pg,  { x: 0, y: 0, rotation: 0, opacity: 1, clearProps: "transform,motionPath" });
    if (tk)  gsap.set(tk,  { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" });
    if (tst) gsap.set(tst, { opacity: 0 });
    if (rt)  gsap.set(rt,  { strokeDasharray: "0 9999", strokeDashoffset: 0, opacity: 0 });

    stateRef.current = "idle";
    setUiState("idle");
  }, []);

  useEffect(() => () => tlRef.current?.kill(), []);

  /* ── main click handler ───────────────────────────────────────── */
  const handleClick = useCallback(async () => {
    if (disabled || stateRef.current !== "idle") return;
    stateRef.current = "loading";
    setUiState("loading");

    const r  = btnBaseRef.current;
    const ts = txtSendRef.current;
    const pg = planeGRef.current;
    const rt = routeRef.current;
    const tk = tickGRef.current;
    const tst = txtSentRef.current;

    /* ── Phase 1 timeline: morph + plane launch ─────────────────── */
    const tl = gsap.timeline({ paused: true });
    tlRef.current = tl;

    // Fade/scale out "Send" text
    if (ts)
      tl.to(ts, { opacity: 0, scale: 0.6, transformOrigin: "50% 50%", duration: 0.35, ease: "power2.in" }, 0);

    // Morph rect → circle (simulate MorphSVG with attr tween)
    if (r) {
      tl.to(r, {
        attr: { x: C_X, y: C_Y, width: C_W, height: C_W, rx: C_RX },
        duration: 0.77,
        ease: "power2.inOut",
      }, 0.05);
    }

    // Draw the route path (simulate DrawSVGPlugin with strokeDashoffset)
    if (rt) {
      const pathLen = rt.getTotalLength ? rt.getTotalLength() : 300;
      gsap.set(rt, { strokeDasharray: `${pathLen} ${pathLen}`, strokeDashoffset: pathLen, opacity: 0.35 });
      tl.to(rt, { strokeDashoffset: 0, duration: 1.0, ease: "power2.inOut" }, 0.35);
    }

    // Fly paper plane along route (free MotionPathPlugin)
    if (pg && rt) {
      tl.to(pg, {
        duration: 1.0,
        ease: "power2.inOut",
        motionPath: {
          path: rt,
          align: rt,
          alignOrigin: [0.5, 0.5],
          autoRotate: 90,
        },
      }, 0.35);
    } else if (pg) {
      // Fallback if refs not ready: simple arc keyframes
      tl.to(pg, { y: -60, x:  60, rotation: -45, duration: 0.45, ease: "power2.out" }, 0.35);
      tl.to(pg, { y:   0, x: 130, rotation:   0, duration: 0.45, ease: "power2.in"  }, 0.8);
    }

    // Plane becomes white mid-flight (colour flash like CodePen)
    if (pg) {
      tl.to(pg.querySelectorAll("path"), { fill: "#ffffff", duration: 0.15 }, 0.35);
      tl.to(pg.querySelectorAll("path"), { fill: "#0B0C10", duration: 0.15 }, 0.77 + 0.35);
    }

    tl.play();

    /* ── Await actual send ───────────────────────────────────────── */
    try {
      await onSend();

      // success — kill flight, do reveal
      stateRef.current = "success";
      setUiState("success");

      const tl2 = gsap.timeline();
      // Hide route
      if (rt)  tl2.to(rt, { opacity: 0, duration: 0.2 }, 0);
      // Morph circle back to full rect
      if (r)   tl2.to(r,  { attr: { x: 0, y: 0, width: VW, height: VH, rx: BTN_RX }, duration: 0.45, ease: "back.out(1.5)" }, 0.1);
      // Fade out plane
      if (pg)  tl2.to(pg, { opacity: 0, duration: 0.2 }, 0);
      // Reveal checkmark
      if (tk)  tl2.to(tk, { opacity: 1, scale: 1, transformOrigin: "50% 50%", duration: 0.45, ease: "back.out(2)" }, 0.3);
      // "Sent!" text
      if (tst) tl2.to(tst, { opacity: 1, duration: 0.3 }, 0.45);

      setTimeout(reset, 2500);
    } catch {
      stateRef.current = "error";
      setUiState("error");

      tlRef.current?.kill();
      const errTl = gsap.timeline({ onComplete: reset });
      // Snap circle back to full rect and flash red
      if (r) {
        errTl.to(r, {
          attr: { x: 0, y: 0, width: VW, height: VH, rx: BTN_RX },
          fill: "#ef4444",
          duration: 0.3,
          ease: "power2.out",
        }, 0);
        errTl.to(r, { fill: "#3ab368", duration: 0.45 }, 1.0);
      }
      // Restore text
      if (ts) errTl.to(ts, { opacity: 1, scale: 1, transformOrigin: "50% 50%", duration: 0.25 }, 0.15);
      // Hide route & plane
      if (rt) errTl.to(rt, { opacity: 0, duration: 0.15 }, 0);
      if (pg) errTl.to(pg, { opacity: 0, duration: 0.15 }, 0);
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
      className="w-full h-14 relative"
      style={{ background: "none", border: "none", padding: 0, cursor: isDisabled ? "not-allowed" : "pointer" }}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full block"
        overflow="visible"
      >
        {/*
          ── Hidden flight route ──────────────────────────────────────
          Path starts at plane's idle position (PLANE_IX, PLANE_IY),
          arcs up above the button, sweeps right, loops back to the
          circle centre (VW/2, VH/2). Adapted from CodePen route.
        */}
        <path
          ref={routeRef}
          d={`M ${PLANE_IX},${PLANE_IY}
              C ${PLANE_IX + 40},-55  ${VW / 2 - 20},-80  ${VW / 2},${VH / 2 - 30}
              C ${VW / 2 + 20},-80   ${VW - 60},-30       ${VW - 40},${VH / 2}
              C ${VW - 20},${VH + 30} ${VW / 2 + 40},${VH + 50} ${VW / 2},${VH / 2}`}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="0 9999"
          opacity="0"
        />

        {/* ── Button base ── morphs rect → circle → rect */}
        <rect
          ref={btnBaseRef}
          x="0" y="0"
          width={VW} height={VH}
          rx={BTN_RX}
          fill="#3ab368"
          opacity={disabled && uiState === "idle" ? 0.4 : 1}
        />

        {/* ── Send text + arrow (idle / error labels) ── */}
        <g ref={txtSendRef}>
          <text
            x={VW / 2 + 18}
            y={VH / 2 + 6}
            textAnchor="middle"
            fill="#0B0C10"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="17"
            fontWeight="700"
            letterSpacing="0.04em"
          >
            {uiState === "idle" || uiState === "error" ? label : (processingLabel || "")}
          </text>
        </g>

        {/* ── Paper plane (visible in idle, flies during loading) ── */}
        {/* Centred on (PLANE_IX, PLANE_IY) so MotionPath aligns correctly */}
        <g
          ref={planeGRef}
          style={{ transformOrigin: `${PLANE_IX}px ${PLANE_IY}px` }}
        >
          {/* Plane body */}
          <path
            d={`M ${PLANE_IX} ${PLANE_IY - 13}
                L ${PLANE_IX + 11} ${PLANE_IY + 9}
                L ${PLANE_IX} ${PLANE_IY + 4}
                L ${PLANE_IX - 11} ${PLANE_IY + 9} Z`}
            fill="#0B0C10"
          />
          {/* Tail spine */}
          <line
            x1={PLANE_IX} y1={PLANE_IY + 4}
            x2={PLANE_IX} y2={PLANE_IY + 13}
            stroke="#0B0C10"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        {/* ── Checkmark (revealed on success) ── */}
        <g ref={tickGRef} opacity="0">
          <path
            d={`M ${VW / 2 - 32} ${VH / 2 - 2}
                L ${VW / 2 - 14} ${VH / 2 + 13}
                L ${VW / 2 + 28} ${VH / 2 - 16}`}
            stroke="#0B0C10"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* ── "Sent!" text (revealed on success) ── */}
        <text
          ref={txtSentRef}
          x={VW / 2 + 20}
          y={VH / 2 + 6}
          textAnchor="middle"
          fill="#0B0C10"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="17"
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
