/**
 * SendButton — GSAP animated send button.
 *
 * Faithful port of CodePen abRKeXX using free GSAP plugins only:
 *   • MotionPathPlugin  (plane flight)
 *   • strokeDashoffset  (simulates DrawSVGPlugin trail "полоска")
 *   • attr tween        (simulates MorphSVGPlugin rect→circle→rect)
 *
 * Flow:
 *   idle    → green rect, send-icon (left) + label (centre)
 *   click   → label scales out → rect morphs to circle
 *             → route trail draws itself while plane flies the same arc
 *             → await onSend()
 *   success → trail fades → circle morphs back to rect → tick + "Sent!" slide in
 *   error   → rect flashes red → idle
 */

import { useRef, useState, useCallback, useEffect } from "react";
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

gsap.registerPlugin(MotionPathPlugin);

/* ── geometry ─────────────────────────────────────────────────────── */
const VW     = 400;
const VH     = 64;
const BTN_RX = 16;

// Circle (loading) phase — centred in viewBox
const C_R = VH / 2;          // 32
const C_X = VW / 2 - C_R;    // 168
const C_W = VH;               // 64

// Send-icon idle centre
const PX = 50;
const PY = 32;

/*
 * Flight route — S-curve matching the CodePen spirit:
 * starts at icon centre (50,32), arcs UP and RIGHT above the button,
 * loops back DOWN, ends exactly at circle centre (200,32).
 * overflow="visible" on the outer SVG lets it escape the button bounds.
 */
const ROUTE_D =
  `M ${PX},${PY}` +
  ` C 115,-62 315,-78 358,20` +
  ` C 390,82 296,112 226,84` +
  ` C 156,56 160,40 ${VW / 2},${VH / 2}`;

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

  const btnBaseRef  = useRef<SVGRectElement>(null);
  const txtSendRef  = useRef<SVGTextElement>(null);
  const planeGRef   = useRef<SVGGElement>(null);
  const routeRef    = useRef<SVGPathElement>(null);
  const tickGRef    = useRef<SVGGElement>(null);
  const sentGRef    = useRef<SVGGElement>(null);
  const tlRef       = useRef<gsap.core.Timeline | null>(null);
  const tl2Ref      = useRef<gsap.core.Timeline | null>(null);

  /* ── reset to idle ────────────────────────────────────────────── */
  const reset = useCallback(() => {
    tlRef.current?.kill();
    tl2Ref.current?.kill();

    const r  = btnBaseRef.current;
    const ts = txtSendRef.current;
    const pg = planeGRef.current;
    const rt = routeRef.current;
    const tk = tickGRef.current;
    const sg = sentGRef.current;

    if (r)  gsap.set(r,  { attr: { x: 0, y: 0, width: VW, height: VH, rx: BTN_RX }, fill: "#3ab368" });
    if (ts) gsap.set(ts, { opacity: 1, scale: 1, transformOrigin: "50% 50%" });
    if (pg) gsap.set(pg, { opacity: 1, x: 0, y: 0, rotation: 0, clearProps: "transform,motionPath" });
    if (rt) gsap.set(rt, { opacity: 0, strokeDashoffset: 1, strokeDasharray: "0 99999" });
    if (tk) gsap.set(tk, { opacity: 0, scale: 0.6, transformOrigin: "50% 50%" });
    if (sg) gsap.set(sg, { opacity: 0, x: 20 });

    stateRef.current = "idle";
    setUiState("idle");
  }, []);

  useEffect(() => () => { tlRef.current?.kill(); tl2Ref.current?.kill(); }, []);

  /* ── click handler ────────────────────────────────────────────── */
  const handleClick = useCallback(async () => {
    if (disabled || stateRef.current !== "idle") return;
    stateRef.current = "loading";
    setUiState("loading");

    const r  = btnBaseRef.current;
    const ts = txtSendRef.current;
    const pg = planeGRef.current;
    const rt = routeRef.current;
    const tk = tickGRef.current;
    const sg = sentGRef.current;

    /* measure trail length */
    const pathLen = rt?.getTotalLength?.() ?? 320;

    /* set up trail for drawing */
    if (rt) {
      gsap.set(rt, {
        opacity: 1,
        strokeDasharray: `${pathLen} ${pathLen}`,
        strokeDashoffset: pathLen,   // nothing visible yet
      });
    }

    /* ── Phase 1: morph + fly + draw trail ─────────────────────── */
    const tl = gsap.timeline({ paused: true });
    tlRef.current = tl;

    // Scale-out label
    if (ts) tl.to(ts, { opacity: 0, scale: 0, transformOrigin: "50% 50%", duration: 0.35, ease: "power2.in" }, 0);

    // Rect → circle  (two-step for squish feel like original)
    if (r) {
      tl.to(r, {
        attr: { x: C_X, y: 0, width: C_W, height: VH, rx: C_R },
        duration: 0.55, ease: "power2.inOut",
      }, 0.05);
    }

    // ── "Полоска" — trail draws itself along the route ──
    // Mirrors the CodePen: drawSVG "0%→80%" then "80%→100%" (erase)
    // We do: dashoffset pathLen→0 (draw) over flight duration,
    //        then erase quickly before success reveal.
    if (rt) {
      tl.to(rt, {
        strokeDashoffset: 0,
        duration: 1.05,
        ease: "power1.inOut",
      }, 0.25);
    }

    // Plane flies along the same route
    if (pg && rt) {
      tl.to(pg, {
        duration: 1.05,
        ease: "power1.inOut",
        immediateRender: true,
        motionPath: {
          path: rt,
          align: rt,
          alignOrigin: [0.5, 0.5],
          autoRotate: 90,
        },
      }, 0.25);
    }

    // Plane flashes white while in flight (CodePen: fill→#fff then back)
    if (pg) {
      tl.to(pg.querySelectorAll("path, line"), { fill: "#ffffff", stroke: "#ffffff", duration: 0.15 }, 0.25);
      tl.to(pg.querySelectorAll("path, line"), { fill: "#ffffff", stroke: "#ffffff", duration: 0.15 }, 0.25 + 0.77);
    }

    // Fade plane out as it reaches circle
    if (pg) tl.to(pg, { opacity: 0, duration: 0.18 }, 0.25 + 0.87);

    const flightDone = new Promise<void>((res) => tl.eventCallback("onComplete", res));
    tl.play();

    /* ── await send + flight ────────────────────────────────────── */
    try {
      await Promise.all([onSend(), flightDone]);

      stateRef.current = "success";
      setUiState("success");

      const tl2 = gsap.timeline({ onComplete: () => setTimeout(reset, 2200) });
      tl2Ref.current = tl2;

      // Erase trail
      if (rt) tl2.to(rt, { opacity: 0, duration: 0.2 }, 0);

      // Circle → rect  (CodePen: morphSVG "#cEnd" slides left then reveals "Sent!")
      if (r)  tl2.to(r, {
        attr: { x: 0, y: 0, width: VW, height: VH, rx: BTN_RX },
        duration: 0.42, ease: "power2.out",
      }, 0.1);

      // Tick appears
      if (tk) tl2.to(tk, {
        opacity: 1, scale: 1, transformOrigin: "50% 50%",
        duration: 0.3, ease: "back.out(1.8)",
      }, 0.36);

      // "Sent!" slides in from right (clip-path slide like original)
      if (sg) tl2.to(sg, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }, 0.42);

      tl2.play();
    } catch {
      stateRef.current = "error";
      setUiState("error");

      tlRef.current?.kill();
      const errTl = gsap.timeline({ onComplete: reset });

      if (rt) errTl.to(rt, { opacity: 0, duration: 0.15 }, 0);
      if (pg) errTl.to(pg, { opacity: 0, duration: 0.15 }, 0);
      if (r)  errTl.to(r, {
        attr: { x: 0, y: 0, width: VW, height: VH, rx: BTN_RX },
        fill: "#ef4444", duration: 0.28, ease: "power2.out",
      }, 0);
      if (r)  errTl.to(r, { fill: "#3ab368", duration: 0.45 }, 1.0);
      if (ts) errTl.to(ts, { opacity: 1, scale: 1, transformOrigin: "50% 50%", duration: 0.25 }, 0.15);
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
          ── Flight route + trail ("полоска") ─────────────────────
          Starts hidden (opacity:0, dasharray:0).
          On click: dashoffset animates pathLen→0 in sync with the
          plane, drawing the trail stroke as the plane flies.
        */}
        <path
          ref={routeRef}
          d={ROUTE_D}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          opacity="0"
          strokeDasharray="0 99999"
        />

        {/* ── Button base ── morphs rect → circle → rect */}
        <rect
          ref={btnBaseRef}
          x="0" y="0"
          width={VW} height={VH}
          rx={BTN_RX}
          fill="#3ab368"
          opacity={disabled && uiState === "idle" ? 0.45 : 1}
        />

        {/* ── Send label ── */}
        <text
          ref={txtSendRef}
          x={VW / 2 + 22}
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

        {/*
          ── Send icon (user-provided SVG), centred at (PX, PY) ──
          The group is animated by MotionPathPlugin during flight.
        */}
        <g
          ref={planeGRef}
          style={{ transformOrigin: `${PX}px ${PY}px` }}
        >
          <svg
            x={PX - 14}
            y={PY - 14}
            width="28"
            height="28"
            viewBox="0 0 682.667 682.667"
            overflow="visible"
          >
            <g
              transform="matrix(1.33333 0 0 -1.33333 0 682.667)"
              fill="none"
              stroke="#ffffff"
              strokeWidth="40"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeMiterlimit="10"
            >
              <path
                transform="translate(489.325 437.607)"
                d="m 0 0 -141.421 -367.695 a 39.9 39.9 0 0 0 -9.051 -13.902 c -15.621 -15.621 -40.947 -15.621 -56.569 0 A 39.8 39.8 0 0 0 -217.39 -363.7 l -35.869 133.912 a 39.8 39.8 0 0 1 -10.35 17.897 a 39.8 39.8 0 0 1 -17.896 10.349 l -133.913 35.87 a 39.8 39.8 0 0 0 -17.896 10.349 c -15.622 15.621 -15.622 40.948 0 56.569 a 39.8 39.8 0 0 0 13.901 9.05 L -51.718 51.718 c 14.303 5.502 31.132 2.485 42.668 -9.051 S 5.502 14.303 0 0"
              />
              <path transform="translate(104.853 104.853)" d="m 0 0 -84.853 -84.853" />
              <path transform="translate(189.706 76.568)"  d="m 0 0 -56.568 -56.568" />
              <path transform="translate(76.568 189.706)"  d="m 0 0 -56.568 -56.568" />
              <path transform="translate(367.137 367.137)" d="m 0 0 -84.853 -84.853" />
            </g>
          </svg>
        </g>

        {/* ── Checkmark (success) ── */}
        <g ref={tickGRef} opacity="0">
          <path
            d="M 156 33 L 166 43 L 184 23"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/*
          ── "Sent!" group — slides in from right on success ──
          Mirrors the CodePen clip-path reveal of #rectSentItems.
        */}
        <g ref={sentGRef} opacity="0">
          <text
            x="222"
            y="38"
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="16"
            fontWeight="700"
            letterSpacing="0.04em"
          >
            Sent!
          </text>
        </g>
      </svg>
    </button>
  );
}
