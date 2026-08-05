import { Link, useLocation } from "wouter";
import { Home, ArrowRightLeft, Wallet, Users2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const itemRefs = useRef<HTMLDivElement[]>([]);
  const blobRef = useRef<HTMLDivElement>(null);
  const hasMounted = useRef(false);

  const navItems = [
    { path: "/home", icon: Home, label: t('nav.home') },
    { path: "/exchange", icon: ArrowRightLeft, label: t('nav.exchange') },
    { path: "/wallet", icon: Wallet, label: t('nav.wallet') },
    { path: "/p2p", icon: Users2, label: t('nav.p2p') },
  ];

  const getActiveCenter = () => {
    const activeIndex = navItems.findIndex((item) => location === item.path);
    const activeItem = itemRefs.current[activeIndex];
    return activeItem ? activeItem.offsetLeft + activeItem.offsetWidth / 2 : 0;
  };

  useEffect(() => {
    const blob = blobRef.current;
    if (!blob) return;

    const frame = requestAnimationFrame(() => {
      gsap.set(blob, { x: getActiveCenter(), yPercent: -50, scaleX: 1, scaleY: 1 });
      hasMounted.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hasMounted.current || !blobRef.current) return;

    const timeline = gsap.timeline();
    timeline
      .to(blobRef.current, {
        x: getActiveCenter(),
        scaleX: 1.5,
        scaleY: 0.75,
        duration: 0.45,
        ease: "power3.out",
      })
      .to(blobRef.current, {
        scaleX: 1,
        scaleY: 1,
        duration: 0.4,
        ease: "elastic.out(1, 0.6)",
      });

    return () => {
      timeline.kill();
    };
  }, [location]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[rgba(13,15,22,0.96)] px-2 py-2 backdrop-blur-xl">
      <div className="relative flex justify-around">
        <div
          ref={blobRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1/2 z-0 h-11 w-[60px] -translate-y-1/2 rounded-[22px] bg-[rgba(58,179,104,0.18)] shadow-[0_0_18px_rgba(58,179,104,0.25)]"
        />
        {navItems.map((item) => {
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
                ref={(element) => {
                  if (element) itemRefs.current[navItems.indexOf(item)] = element;
                }}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 ${
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
