import { useState } from "react";
import { ArrowDown, Check, ChevronDown, Copy, QrCode, X } from "lucide-react";
import "./_group.css";

const tabs = ["Пополнить", "Перевести", "Обмен"];

export function Glassmorphic() {
  const [activeTab, setActiveTab] = useState("Пополнить");
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    setCopied(true);
    try {
      await navigator.clipboard?.writeText("TXx9...m4abc");
    } catch {
      // Clipboard can be unavailable in the static preview.
    }
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main
      className="relative mx-auto min-h-[100dvh] w-full max-w-[390px] overflow-hidden font-sans text-white"
      style={{ background: "#0d0f16" }}
    >
      <div className="absolute inset-0 bg-[#0e1014] px-5 pt-8">
        <header className="flex items-center justify-between opacity-70">
          <div>
            <p className="text-[12px] text-white/45">Мой кошелёк</p>
            <p className="mt-1 text-[17px] font-semibold tracking-[-.02em]">MY PAY</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.06]">
            <span className="text-[11px] font-bold text-[#3ab368]">MP</span>
          </div>
        </header>
        <section className="mt-11 opacity-60">
          <p className="text-[12px] text-white/40">Общий баланс</p>
          <p className="mt-2 text-[32px] font-semibold tracking-[-.05em]">1 240.50 <span className="text-lg text-white/50">USDT</span></p>
          <div className="mt-6 h-px bg-white/[.08]" />
          <div className="mt-6 flex gap-3">
            {["Пополнить", "Перевести"].map((label) => (
              <div key={label} className="rounded-xl border border-white/[.07] bg-white/[.035] px-4 py-3 text-[12px] text-white/50">{label}</div>
            ))}
          </div>
        </section>
      </div>

      <div className="absolute inset-0 bg-[#07090d]/65 backdrop-blur-[7px]" />

      <section
        className="glass-sheet absolute bottom-0 left-0 right-0 h-[96%] overflow-hidden rounded-t-[24px] border-t border-white/[.08] bg-[rgba(14,16,22,.86)] px-5 pb-5 pt-6 shadow-[0_-18px_60px_rgba(0,0,0,.42)] backdrop-blur-2xl"
        aria-label="Пополнение кошелька"
      >
        <div className="relative z-10 flex h-full flex-col">
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => undefined}
            className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/[.14] bg-white/[.08] text-white/70 transition-colors hover:bg-white/[.13] active:bg-white/[.18]"
          >
            <X size={19} strokeWidth={1.7} />
          </button>

          <div className="pr-14">
            <p className="text-[11px] font-medium uppercase tracking-[.2em] text-[#3ab368]">Кошелёк</p>
            <h1 className="mt-2 text-[25px] font-semibold tracking-[-.04em]">Операции</h1>
          </div>

          <nav className="mt-6 flex rounded-[15px] border border-white/[.09] bg-white/[.045] p-1" aria-label="Тип операции">
            {tabs.map((tab) => {
              const active = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex-1 rounded-[11px] py-[11px] text-[12px] font-medium transition-colors ${active ? "text-white" : "text-white/38 hover:text-white/65"}`}
                >
                  {active && <span className="absolute inset-0 -z-0 rounded-[11px] border border-white/[.11] bg-white/[.11] shadow-[inset_0_1px_0_rgba(255,255,255,.09)]" />}
                  <span className="relative z-10">{tab}</span>
                </button>
              );
            })}
          </nav>

          {activeTab === "Пополнить" ? (
            <div className="mt-6 flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between rounded-2xl border border-white/[.09] bg-white/[.045] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3ab368]/15 text-[#48c579]">
                    <span className="text-[13px] font-bold">T</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/38">Сеть пополнения</p>
                    <p className="mt-0.5 text-[14px] font-medium">USDT TRC20</p>
                  </div>
                </div>
                <ChevronDown size={17} className="text-white/40" />
              </div>

              <div className="mt-5 flex flex-col items-center">
                <div className="qr-grid relative flex h-[180px] w-[180px] items-center justify-center overflow-hidden rounded-[18px] border border-white/[.12] bg-[#0a0d12] shadow-[inset_0_0_34px_rgba(58,179,104,.055),0_12px_28px_rgba(0,0,0,.24)]">
                  <div className="absolute inset-[18px] rounded-md border border-[#3ab368]/20" />
                  <QrCode size={106} strokeWidth={1.05} className="text-white/[.82]" />
                  <div className="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-[#3ab368] shadow-[0_0_12px_rgba(58,179,104,.6)]" />
                </div>
                <p className="mt-4 font-mono text-[13px] tracking-[.04em] text-white/40">TXx...abc</p>
                <button type="button" onClick={copyAddress} className="mt-2 flex items-center gap-2 text-[12px] font-medium text-[#55c97c] transition-opacity hover:opacity-75">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Скопировано" : "Скопировать"}
                </button>
              </div>

              <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/[.06] bg-white/[.025] py-3 text-[11px] text-white/42">
                <span className="text-[13px]">⏱</span>
                <span>00:19:47 до обновления адреса</span>
              </div>

              <div className="mt-auto pt-5">
                <button type="button" onClick={() => undefined} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3ab368] py-[15px] text-[14px] font-semibold text-[#07140b] shadow-[0_8px_22px_rgba(58,179,104,.16)] transition-transform hover:brightness-105 active:scale-[.985]">
                  Подтвердить <ArrowDown size={16} strokeWidth={2.3} />
                </button>
                <p className="mt-3 text-center text-[10px] text-white/25">Отправляйте только USDT в сети TRC20</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-white/35">
              Выберите операцию, чтобы продолжить
            </div>
          )}
        </div>
      </section>
    </main>
  );
}