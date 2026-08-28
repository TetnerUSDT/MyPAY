import { createContext, type ReactNode, useContext, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  History, 
  Megaphone, 
  CreditCard, 
  Sparkles,
  ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-p2p";
import { P2PWorkspaceModal } from "@/components/p2p-modal";
import Deals from "@/pages/deals";
import Ads from "@/pages/ads";
import PaymentDetails from "@/pages/payment-details";

type P2PModal = "deals" | "ads" | "payment-details" | null;
const P2PModalContext = createContext<{ openP2PModal: (modal: Exclude<P2PModal, null>) => void }>({
  openP2PModal: () => {},
});

export function useP2PModal() {
  return useContext(P2PModalContext);
}

function MiniIcon({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span 
      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
        active 
          ? "bg-[#3ab368]/15 text-[#59d17e]" 
          : "bg-[#171a20] text-white/45 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [modal, setModal] = useState<P2PModal>(null);
  const { toast } = useToast();
  const { data: user } = useCurrentUser();
  const displayName = user?.name || user?.username || "Трейдер";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleHelp = () => {
    toast({
      title: "Справка SwiftX",
      description: "P2P платформа позволяет обменивать фиат на крипту напрямую между пользователями."
    });
  };

  return (
    <P2PModalContext.Provider value={{ openP2PModal: setModal }}>
      <div className="flex min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="flex w-[76px] shrink-0 flex-col items-center border-r border-white/[.055] bg-sidebar py-5 z-10 relative">
        <Link href="/">
          <div className="mb-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-primary text-[17px] font-black text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95">
            S
          </div>
        </Link>
        <div className="flex flex-1 flex-col items-center gap-3">
          <Link href="/">
            <MiniIcon active={location === "/"}><LayoutDashboard size={17} /></MiniIcon>
          </Link>
          <button type="button" title="Сделки" data-testid="button-deals" onClick={() => setModal("deals")}>
            <MiniIcon active={modal === "deals" || location.startsWith("/order/")}><History size={17} /></MiniIcon>
          </button>
          <button type="button" title="Объявления" data-testid="button-ads" onClick={() => setModal("ads")}>
            <MiniIcon active={modal === "ads" || location === "/create-ad"}><Megaphone size={17} /></MiniIcon>
          </button>
          <button type="button" title="Реквизиты" data-testid="button-payment" onClick={() => setModal("payment-details")}>
            <MiniIcon active={modal === "payment-details"}><CreditCard size={17} /></MiniIcon>
          </button>
        </div>
        <button onClick={handleHelp} title="Справка" data-testid="button-help">
          <MiniIcon><Sparkles size={17} /></MiniIcon>
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 bg-[#0b0d11]">
        {/* Topbar */}
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[.055] px-8 bg-[#0b0d11] z-10">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-semibold tracking-tight">P2P Exchange</h1>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#59d17e]">
                  Desk
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-white/35">Торговый кабинет · P2P Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[11px] text-white/40">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              Сеть стабильна
            </div>
            <button className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-[#13161b] px-3 py-2 text-left transition hover:border-white/15">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#73548c] text-[10px] font-bold text-white">
                {initials}
              </span>
              <span>
                <b className="block max-w-28 truncate text-xs text-white">{displayName}</b>
                <small className="block text-[10px] text-white/35">SwiftX</small>
              </span>
              <ChevronDown size={14} className="text-white/30" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          {children}
        </main>
      </div>
      </div>
      {modal === "deals" && (
        <P2PWorkspaceModal title="Сделки" kicker="История операций" onClose={() => setModal(null)}>
          <Deals onClose={() => setModal(null)} />
        </P2PWorkspaceModal>
      )}
      {modal === "ads" && (
        <P2PWorkspaceModal title="Объявления" kicker="Ваши предложения" onClose={() => setModal(null)}>
          <Ads onClose={() => setModal(null)} />
        </P2PWorkspaceModal>
      )}
      {modal === "payment-details" && (
        <P2PWorkspaceModal title="Реквизиты" kicker="Способы оплаты" onClose={() => setModal(null)}>
          <PaymentDetails />
        </P2PWorkspaceModal>
      )}
    </P2PModalContext.Provider>
  );
}
