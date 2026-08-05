import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";

interface QuickActionButtonProps {
  label: string;
  iconColor: string;
  testId: string;
  icon: ReactNode;
  entryDelay?: number;
}

export default function QuickActionButton({
  label,
  iconColor,
  testId,
  icon,
  entryDelay = 0,
}: QuickActionButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const hoverTimeline = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    const iconCircle = iconRef.current;
    const halo = haloRef.current;
    const shimmer = shimmerRef.current;
    if (!card || !iconCircle || !halo || !shimmer) return;

    const ctx = gsap.context(() => {
      gsap.from(card, {
        x: 60,
        y: 8,
        rotation: 2,
        opacity: 0,
        duration: 0.72,
        delay: entryDelay,
        ease: "power3.out",
      });
    }, card);

    const enter = (event?: MouseEvent | TouchEvent) => {
      const bounds = card.getBoundingClientRect();
      const point = event && "clientX" in event
        ? { x: event.clientX, y: event.clientY }
        : { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      const rotateY = gsap.utils.clamp(-6, 6, ((point.x - (bounds.left + bounds.width / 2)) / bounds.width) * 12);
      const rotateX = gsap.utils.clamp(-4, 4, -((point.y - (bounds.top + bounds.height / 2)) / bounds.height) * 8);

      hoverTimeline.current?.kill();
      hoverTimeline.current = gsap.timeline();
      hoverTimeline.current
        .to(card, { rotateY, rotateX, duration: 0.28, ease: "power2.out" }, 0)
        .to(iconCircle, { scale: 1.18, duration: 0.16, ease: "power2.out" }, 0)
        .to(iconCircle, { scale: 1, duration: 0.28, ease: "power2.out" }, 0.16)
        .fromTo(halo, { scale: 1, opacity: 0.24 }, { scale: 1.4, opacity: 0, duration: 0.58, ease: "power2.out" }, 0)
        .fromTo(shimmer, { xPercent: -110 }, { xPercent: 145, duration: 0.7, ease: "power2.out" }, 0.02);
    };

    const leave = () => {
      hoverTimeline.current?.kill();
      gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.72, ease: "elastic.out(1, 0.5)" });
      gsap.to(iconCircle, { scale: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" });
      gsap.to(halo, { scale: 1, opacity: 0.16, duration: 0.45, ease: "power2.out" });
    };

    const press = () => {
      gsap.to(card, {
        scaleX: 0.93,
        scaleY: 1.05,
        duration: 0.12,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      });
    };

    card.addEventListener("mouseenter", enter);
    card.addEventListener("mouseleave", leave);
    card.addEventListener("touchstart", enter, { passive: true });
    card.addEventListener("touchend", leave, { passive: true });
    card.addEventListener("mousedown", press);

    return () => {
      card.removeEventListener("mouseenter", enter);
      card.removeEventListener("mouseleave", leave);
      card.removeEventListener("touchstart", enter);
      card.removeEventListener("touchend", leave);
      card.removeEventListener("mousedown", press);
      hoverTimeline.current?.kill();
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative h-24 w-[90px] flex-shrink-0 overflow-hidden rounded-[14px] border border-white/[0.11] bg-[linear-gradient(145deg,rgba(39,43,58,0.92),rgba(20,23,34,0.96))] p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_10px_26px_rgba(0,0,0,0.18)] [transform-style:preserve-3d] will-change-transform"
      style={{ borderTopColor: `${iconColor}55` }}
      data-testid={testId}
    >
      <div
        className="pointer-events-none absolute inset-[1px] rounded-[13px] border border-white/[0.045]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${iconColor}, transparent)` }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
        <div
          ref={shimmerRef}
          className="absolute -inset-y-10 left-0 w-1/3 -skew-x-[24deg] bg-gradient-to-r from-transparent via-white/[0.13] to-transparent"
        />
      </div>
      <div
        ref={haloRef}
        className="pointer-events-none absolute left-1/2 top-[13px] h-11 w-11 -translate-x-1/2 rounded-full opacity-[0.16] blur-md"
        style={{ backgroundColor: iconColor }}
        aria-hidden="true"
      />
      <div
        ref={iconRef}
        className="relative z-[1] mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.075]"
        style={{ color: iconColor, boxShadow: `0 0 18px ${iconColor}20` }}
      >
        {icon}
      </div>
      <p className="relative z-[1] whitespace-nowrap text-xs font-semibold leading-tight text-white/95">{label}</p>
    </div>
  );
}