import { Link, useLocation } from "wouter";
import { Home, ArrowRightLeft, Wallet, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const BLOB_WIDTH = 60;

export default function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const blobRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMounted = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const navItems = [
    { path: "/home",     icon: Home,          label: t("nav.home")     },
    { path: "/exchange", icon: ArrowRightLeft, label: t("nav.exchange") },
    { path: "/wallet",   icon: Wallet,         label: t("nav.wallet")   },
    { path: "/p2p",      icon: Users2,         label: t("nav.p2p")      },
  ];

  /** Returns the x offset (from container left) of the center of the active item. */
  const getActiveCenterX = (): number | null => {
    const activeIndex = navItems.findIndex((item) => location === item.path);
    const itemEl = itemRefs.current[activeIndex];
    const containerEl = containerRef.current;
    if (!itemEl || !containerEl) return null;

    const itemRect = itemEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    // center of item relative to container, then shift so blob center aligns
    return itemRect.left - containerRect.left + itemRect.width / 2 - BLOB_WIDTH / 2;
  };

  // Mount: snap blob to initial active position with no animation
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const x = getActiveCenterX();
      if (x !== null && blobRef.current) {
        gsap.set(blobRef.current, { x, scaleX: 1, scaleY: 1 });
        hasMounted.current = true;
      }
    });
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route change: liquid mercury slide
  useEffect(() => {
    if (!hasMounted.current || !blobRef.current) return;
    const x = getActiveCenterX();
    if (x === null) return;

    tlRef.current?.kill();
    tlRef.current = gsap.timeline()
      .to(blobRef.current, {
        x,
        scaleX: 1.5,
        scaleY: 0.75,
        duration: 0.42,
        ease: "power3.out",
      })
      .to(blobRef.current, {
        scaleX: 1,
        scaleY: 1,
        duration: 0.5,
        ease: "elastic.out(1, 0.55)",
      });

    return () => { tlRef.current?.kill(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[rgba(13,15,22,0.96)] px-2 py-2 backdrop-blur-xl">
      <div ref={containerRef} className="relative flex justify-around">
        {/* Liquid blob — absolutely positioned, behind everything */}
        <div
          ref={blobRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 z-0 -translate-y-1/2 rounded-[22px] bg-[rgba(58,179,104,0.18)] shadow-[0_0_18px_rgba(58,179,104,0.28)]"
          style={{ width: BLOB_WIDTH, height: 44, left: 0 }}
        />

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className="relative z-10 flex min-w-0 flex-1 justify-center"
            >
              <div
                ref={(el) => { itemRefs.current[index] = el; }}
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
          );
        })}
      </div>
    </div>
  );
}
