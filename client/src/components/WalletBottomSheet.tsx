import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { X } from "lucide-react";
import TopUpTab from "@/components/sheet-tabs/TopUpTab";
import TransferTab from "@/components/sheet-tabs/TransferTab";
import ExchangeTab from "@/components/sheet-tabs/ExchangeTab";

type Tab = "topup" | "transfer" | "exchange";

interface WalletBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: Tab;
  network?: string;
  currency?: string;
}

const TAB_LABELS: [Tab, string][] = [
  ["topup", "Пополнить"],
  ["transfer", "Перевести"],
  ["exchange", "Обмен"],
];

export default function WalletBottomSheet({
  isOpen,
  onClose,
  defaultTab = "topup",
  network,
  currency,
}: WalletBottomSheetProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>(defaultTab);

  // ── Open animation ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setTab(defaultTab);

    const ctx = gsap.context(() => {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" });
      gsap.fromTo(sheetRef.current, { y: "100%" }, { y: 0, duration: 0.45, ease: "power3.out" });
      gsap.fromTo(
        closeRef.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, delay: 0.3, ease: "elastic.out(1, 0.6)" }
      );
    });

    return () => ctx.revert();
  }, [isOpen, defaultTab]);

  // ── Tab pill animation ───────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !railRef.current || !pillRef.current) return;
    const el = railRef.current.querySelector(`[data-tab="${tab}"]`) as HTMLElement;
    if (!el) return;

    const elRect = el.getBoundingClientRect();
    const railRect = railRef.current.getBoundingClientRect();

    gsap.to(pillRef.current, {
      left: elRect.left - railRect.left,
      width: elRect.width,
      duration: 0.32,
      ease: "power3.out",
    });
  }, [tab, isOpen]);

  const close = () => {
    const ctx = gsap.context(() => {
      gsap.to(sheetRef.current, { y: "100%", duration: 0.3, ease: "power3.in" });
      gsap.to(backdropRef.current, { opacity: 0, duration: 0.3, onComplete: onClose });
    });
    // ctx revert not needed — elements unmount after onClose
    void ctx;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={close}
        className="fixed inset-0 z-[60] bg-black/60"
        style={{ backdropFilter: "blur(6px)" }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[61] h-[96vh] overflow-hidden rounded-t-[24px] border-t border-white/[.08] text-white"
        style={{
          background: "rgba(14,16,22,0.92)",
          backdropFilter: "blur(24px)",
          boxShadow: "0 -18px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div className="mx-auto flex h-full w-full max-w-lg flex-col px-5 pt-5">
          {/* Tab rail + X button */}
          <div className="mb-5 flex items-center gap-3">
            {/* Tab rail — grows to fill available space */}
            <div
              ref={railRef}
              className="relative flex flex-1 rounded-[13px] border border-white/[.08] p-1"
              style={{ background: "rgba(255,255,255,0.045)" }}
            >
              {/* Sliding pill */}
              <div
                ref={pillRef}
                className="pointer-events-none absolute inset-y-1 rounded-[11px]"
                style={{
                  background: "rgba(255,255,255,0.11)",
                  border: "1px solid rgba(255,255,255,0.11)",
                  left: 4,
                  width: 92,
                }}
              />

              {TAB_LABELS.map(([id, label]) => (
                <button
                  key={id}
                  data-tab={id}
                  onClick={() => setTab(id)}
                  className={`relative z-10 flex-1 rounded-[11px] py-[10px] text-[13px] transition-colors ${
                    tab === id ? "font-semibold text-white" : "text-white/[.38] hover:text-white/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Close button — same height as the tab rail */}
            <button
              ref={closeRef}
              onClick={close}
              aria-label="Закрыть"
              className="grid h-[44px] w-[44px] flex-shrink-0 place-items-center rounded-full transition-colors hover:bg-white/[.13] active:bg-white/[.18]"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <X size={18} strokeWidth={1.8} className="text-white/70" />
            </button>
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {tab === "topup" ? (
              <TopUpTab network={network} currency={currency} onSuccess={close} />
            ) : tab === "transfer" ? (
              <TransferTab network={network} currency={currency} onSuccess={close} />
            ) : (
              <ExchangeTab onSuccess={close} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
