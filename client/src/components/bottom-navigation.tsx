import { Link, useLocation } from "wouter";
import { Home, ArrowRightLeft, Wallet, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const BLOB_W = 64;
const BLOB_H = 46;

export default function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useTranslation();

  // Refs on the flex-1 column wrappers — gives true item width for centering
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const blobRef  = useRef<HTMLDivElement>(null);
  const railRef  = useRef<HTMLDivElement>(null);
  const mounted  = useRef(false);
  const tl       = useRef<gsap.core.Timeline | null>(null);

  const navItems = [
    { path: "/home",     icon: Home,           label: t("nav.home")     },
    { path: "/exchange", icon: ArrowRightLeft,  label: t("nav.exchange") },
    { path: "/wallet",   icon: Wallet,          label: t("nav.wallet")   },
    { path: "/p2p",      icon: Users2,          label: t("nav.p2p")      },
  ];

  /** x-offset so the blob center sits on the active column center */
  const blobX = (): number | null => {
    const idx = navItems.findIndex(n => n.path === location);
    const col = colRefs.current[idx];
    const rail = railRef.current;
    if (!col || !rail) return null;

    const colR  = col.getBoundingClientRect();
    const railR = rail.getBoundingClientRect();
    const colCenter = colR.left - railR.left + colR.width / 2;
    return Math.round(colCenter - BLOB_W / 2);
  };

  // Mount — snap with no animation
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const x = blobX();
      if (x !== null && blobRef.current) {
        gsap.set(blobRef.current, { x, scaleX: 1, scaleY: 1, opacity: 1 });
        mounted.current = true;
      }
    });
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route change — liquid mercury slide
  useEffect(() => {
    if (!mounted.current || !blobRef.current) return;
    const x = blobX();
    if (x === null) return;

    tl.current?.kill();
    tl.current = gsap.timeline()
      .to(blobRef.current, {
        x,
        scaleX: 1.45,
        scaleY: 0.72,
        duration: 0.4,
        ease: "power3.out",
      })
      .to(blobRef.current, {
        scaleX: 1,
        scaleY: 1,
        duration: 0.5,
        ease: "elastic.out(1, 0.55)",
      });

    return () => { tl.current?.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const isNavActive = navItems.some(n => n.path === location);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[rgba(13,15,22,0.97)] px-2 py-2 backdrop-blur-xl">
      <div ref={railRef} className="relative flex">

        {/* Liquid blob */}
        <div
          ref={blobRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 z-0 -translate-y-1/2"
          style={{
            width:  BLOB_W,
            height: BLOB_H,
            left: 0,
            borderRadius: BLOB_H / 2,
            background: "rgba(58,179,104,0.16)",
            border: "1.5px solid rgba(58,179,104,0.55)",
            boxShadow: "0 0 14px rgba(58,179,104,0.35), inset 0 0 8px rgba(58,179,104,0.08)",
            opacity: isNavActive ? 1 : 0,
          }}
        />

        {navItems.map((item, idx) => {
          const Icon     = item.icon;
          const isActive = location === item.path;

          return (
            /* flex-1 column — this is what we measure for centering */
            <div
              key={item.path}
              ref={el => { colRefs.current[idx] = el; }}
              className="relative z-10 flex flex-1 justify-center"
            >
              <Link
                href={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <div
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors duration-200 ${
                    isActive ? "text-white" : "text-white/40"
                  }`}
                >
                  <Icon
                    className={isActive ? "h-6 w-6 text-[#3ab368]" : "h-5 w-5"}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className={`text-xs ${isActive ? "font-bold" : "font-medium"}`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
