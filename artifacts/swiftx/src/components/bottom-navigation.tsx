import { Link, useLocation, useSearch } from "wouter";
import { Home, Briefcase, Wallet, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import gsap from "gsap";

const BLOB_W = 94; // 64 + 15px each side

export default function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useTranslation();

  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const blobRef  = useRef<HTMLDivElement>(null);
  const navRef   = useRef<HTMLDivElement>(null);   // outer nav — blob reference
  const railRef  = useRef<HTMLDivElement>(null);   // inner flex row — item reference
  const mounted  = useRef(false);
  const tl       = useRef<gsap.core.Timeline | null>(null);

  const [, setLocation] = useLocation();

  const navItems = [
    { path: "/home",   icon: Home,    label: t("nav.home")   },
    { path: "/wallet", icon: Wallet,  label: t("nav.wallet") },
    { path: "/p2p",    icon: Users2,  label: t("nav.p2p")    },
  ];

  /** x so blob center aligns with active column center, relative to navRef */
  const blobX = (): number | null => {
    const idx  = navItems.findIndex(n => n.path === location);
    const col  = colRefs.current[idx];
    const nav  = navRef.current;
    if (!col || !nav) return null;

    const colR  = col.getBoundingClientRect();
    const navR  = nav.getBoundingClientRect();
    const center = colR.left - navR.left + colR.width / 2;
    return Math.round(center - BLOB_W / 2);
  };

  // Mount — snap without animation
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const x = blobX();
      if (x !== null && blobRef.current) {
        gsap.set(blobRef.current, { x, scaleX: 1, scaleY: 1 });
        mounted.current = true;
      }
    });
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route change — liquid slide
  useEffect(() => {
    if (!mounted.current || !blobRef.current) return;
    const x = blobX();
    if (x === null) return;

    tl.current?.kill();
    tl.current = gsap.timeline()
      .to(blobRef.current, {
        x,
        scaleX: 1.4,
        scaleY: 0.78,
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
    <div
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[rgba(13,15,22,0.97)] px-2 py-2 backdrop-blur-xl"
      style={{ position: "fixed" }}
    >
      {/* Blob — full height of the nav block */}
      <div
        ref={blobRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 z-0"
        style={{
          width: BLOB_W,
          left: 0,
          borderRadius: 10,
          background: "rgba(58,179,104,0.15)",
          opacity: isNavActive ? 1 : 0,
        }}
      />

      {/* Nav items */}
      <div ref={railRef} className="relative flex">
        {/* Home */}
        {navItems.map((item, idx) => {
          const Icon     = item.icon;
          const isActive = location === item.path;

          return (
            <div
              key={item.path}
              ref={el => { colRefs.current[idx] = el; }}
              className="relative z-10 flex flex-1 justify-center"
            >
              <Link href={item.path} data-testid={`nav-${item.label.toLowerCase()}`}>
                <div className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors duration-200 ${isActive ? "text-white" : "text-white/40"}`}>
                  <Icon className={isActive ? "h-6 w-6 text-[#3ab368]" : "h-5 w-5"} strokeWidth={isActive ? 2.5 : 2} />
                  <span className={`text-xs ${isActive ? "font-bold" : "font-medium"}`}>{item.label}</span>
                </div>
              </Link>
            </div>
          );
        })}

        {/* Business */}
        <div className="relative z-10 flex flex-1 justify-center">
          <Link href="/business" data-testid="nav-business">
            <div className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors duration-200 ${location === "/business" ? "text-white" : "text-white/40"}`}>
              <Briefcase className={location === "/business" ? "h-6 w-6 text-[#3ab368]" : "h-5 w-5"} strokeWidth={location === "/business" ? 2.5 : 2} />
              <span className={`text-xs ${location === "/business" ? "font-bold" : "font-medium"}`}>{t("nav.business")}</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
