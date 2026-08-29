import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function P2PWorkspaceModal({
  title,
  kicker,
  onClose,
  children,
}: {
  title: string;
  kicker?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050609]/80 p-6 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="p2p-modal-title"
        className="flex max-h-[calc(100vh-48px)] w-full max-w-[1080px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1014] shadow-2xl shadow-black/70 animate-scaleIn-fast"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[.06] bg-[#101318] px-6 py-4">
          <div>
            {kicker && <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#59d17e]">{kicker}</div>}
            <h2 id="p2p-modal-title" className="mt-1 text-lg font-semibold text-white">{title}</h2>
          </div>
          <button
            type="button"
            aria-label={`Закрыть окно «${title}»`}
            onClick={onClose}
            className="rounded-xl p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}