import { useState } from "react";
import "./_group.css";

const tabs = ["Пополнить", "Перевести", "Обмен"];

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.2" y="4.2" width="7.1" height="8.1" rx="1.4" stroke="currentColor" strokeWidth="1.25" />
      <path d="M3.7 10.3H3.5a1.3 1.3 0 0 1-1.3-1.3V3.5a1.3 1.3 0 0 1 1.3-1.3h5.4a1.3 1.3 0 0 1 1.3 1.3v.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function Chevron() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m3.5 5.25 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function AuroraMesh() {
  const [activeTab, setActiveTab] = useState("Пополнить");
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (closed) {
    return (
      <main className="relative min-h-[100dvh] w-full overflow-hidden bg-[#0d0f16] text-white" style={{ fontFamily: "system-ui, sans-serif" }}>
        <div className="absolute inset-0 bg-[#0d0f16]" />
        <div className="relative z-10 px-6 pt-12">
          <p className="text-[11px] uppercase tracking-[.22em] text-white/35">MY PAY / wallet</p>
          <p className="mt-10 text-4xl font-semibold tracking-tight">12 480.62 <span className="text-base font-medium text-white/40">USDT</span></p>
          <button onClick={() => setClosed(false)} className="mt-8 rounded-xl bg-[#3ab368] px-5 py-3 text-sm font-semibold text-[#07110b]">Открыть пополнение</button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-[#0b0d13] text-white" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Wallet content remains visible beneath the frosted backdrop. */}
      <div className="absolute inset-0 bg-[#0d0f16] px-6 pt-11 opacity-60">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/55">Мой кошелёк</span>
          <span className="h-8 w-8 rounded-full bg-white/10" />
        </div>
        <p className="mt-16 text-[11px] uppercase tracking-[.2em] text-white/30">Общий баланс</p>
        <p className="mt-3 text-4xl font-semibold tracking-tight">12 480.62 <span className="text-base text-white/40">USDT</span></p>
        <div className="mt-10 h-24 rounded-2xl border border-white/5 bg-white/[.035]" />
      </div>
      <div className="absolute inset-0 bg-[#07090d]/65 backdrop-blur-[10px]" />

      <section className="aurora-mesh absolute inset-x-0 bottom-0 h-[96%] overflow-hidden rounded-t-[24px] bg-[#0d0f16] shadow-[0_-16px_55px_rgba(0,0,0,.45)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[170px] overflow-hidden opacity-25">
          <div className="aurora-mesh__glow absolute -inset-x-[15%] -top-16 h-52 bg-[radial-gradient(ellipse_at_18%_15%,#1a0a2e_0%,transparent_52%),radial-gradient(ellipse_at_64%_0%,#0a1a2e_0%,transparent_55%),radial-gradient(ellipse_at_90%_20%,#0d1f14_0%,transparent_52%)] blur-[22px]" />
        </div>
        <div className="relative z-10 flex h-full flex-col px-5">
          <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-white/20" />
          <button aria-label="Закрыть" onClick={() => setClosed(true)} className="absolute right-5 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/[.08] bg-white/[.05] text-white shadow-[0_0_18px_rgba(58,179,104,.24)] transition-transform hover:scale-105 active:scale-95">
            <CloseIcon />
          </button>

          <div className="mt-8 flex items-center gap-1 rounded-2xl bg-white/[.025] p-1">
            {tabs.map((tab) => {
              const active = activeTab === tab;
              return <button key={tab} onClick={() => setActiveTab(tab)} className={`relative flex-1 rounded-xl py-2.5 text-[13px] font-medium transition-colors ${active ? "bg-[#3ab368]/[.15] text-[#62d58a] shadow-[0_0_18px_rgba(58,179,104,.1)]" : "text-white/40 hover:text-white/65"}`}>{tab}</button>;
            })}
          </div>

          {activeTab === "Пополнить" ? (
            <div className="flex flex-1 flex-col pt-7">
              <p className="mb-2 text-[11px] uppercase tracking-[.17em] text-white/35">Выберите сеть</p>
              <button className="flex w-full items-center justify-between rounded-2xl border border-white/[.08] bg-[linear-gradient(105deg,rgba(13,31,20,.65),rgba(26,10,46,.25))] px-4 py-3.5 text-left">
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#b6f0cc] text-[14px] font-black text-[#18261c]">T</span>
                  <span><span className="block text-sm font-semibold">USDT TRC20</span><span className="mt-0.5 block text-[11px] text-white/35">TRON network</span></span>
                </span>
                <span className="text-white/45"><Chevron /></span>
              </button>

              <div className="mt-7 flex flex-col items-center">
                <div className="relative h-[180px] w-[180px] overflow-hidden rounded-xl border border-[#3ab368]/25 bg-[#11151b] p-3 shadow-[0_0_0_1px_rgba(123,63,150,.18)]">
                  <div className="h-full w-full opacity-80" style={{ backgroundImage: "linear-gradient(90deg,#d9f3dc 1px,transparent 1px),linear-gradient(#d9f3dc 1px,transparent 1px),radial-gradient(circle at 20% 80%,#d9f3dc 0 8%,transparent 9%),radial-gradient(circle at 75% 26%,#d9f3dc 0 10%,transparent 11%)", backgroundSize: "12px 12px,12px 12px,38px 38px,42px 42px" }} />
                  <div className="absolute inset-5 border-2 border-[#11151b] opacity-70" />
                </div>
                <p className="mt-4 font-mono text-[13px] tracking-wide text-white/45">TXx...abc</p>
                <button onClick={() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }} className="mt-3 flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#62d58a] hover:bg-[#3ab368]/10">
                  <CopyIcon /> {copied ? "Скопировано" : "Скопировать"}
                </button>
              </div>

              <p className="mt-auto pb-5 text-center text-[12px] text-white/35"><span className="mr-1 text-white/55">⏱</span>00:19:47 до обновления адреса</p>
              <button onClick={() => setClosed(true)} className="mb-5 w-full rounded-xl bg-[linear-gradient(110deg,#3ab368,#4acb7b)] py-3.5 text-sm font-bold text-[#07110b] shadow-[0_8px_26px_rgba(58,179,104,.18)] transition-transform hover:scale-[1.01] active:scale-[.99]">Подтвердить</button>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-white/40">Раздел «{activeTab}» готов к работе</div>
          )}
        </div>
      </section>
    </main>
  );
}