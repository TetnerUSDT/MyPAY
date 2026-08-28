import { useState } from 'react';

type Tab = 'Пополнить' | 'Перевести' | 'Обмен';

const tabs: Tab[] = ['Пополнить', 'Перевести', 'Обмен'];

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrонMark() {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
      style={{ background: '#e94654', color: '#fff' }}
      aria-hidden="true"
    >
      T
    </span>
  );
}

function QrPlaceholder() {
  const blocks = [
    '111111100101101111111',
    '100000101110101000001',
    '101110101011101011101',
    '101110100110101011101',
    '101110101101101011101',
    '100000101010101000001',
    '111111101010101111111',
    '000000001111100000000',
    '110101111010111010101',
    '001110010111001110100',
    '101011111001111101011',
    '011101001110100010110',
    '111010111011101111010',
    '000000001011100000000',
    '111111101110101111111',
    '100000100011101000001',
    '101110101111101011101',
    '101110100101001011101',
    '101110101110101011101',
    '100000101001101000001',
    '111111101110101111111',
  ];
  return (
    <div
      className="flex h-[180px] w-[180px] items-center justify-center rounded-[10px]"
      style={{ background: '#10121a', border: '1px solid rgba(58,179,104,.52)', boxShadow: '0 0 0 1px rgba(58,179,104,.08)' }}
      aria-label="QR-код адреса кошелька"
    >
      <div className="grid h-[140px] w-[140px] grid-cols-21 gap-0">
        {blocks.join('').split('').map((bit, i) => (
          <span key={i} style={{ background: bit === '1' ? '#d9e8dc' : 'transparent' }} />
        ))}
      </div>
    </div>
  );
}

export function SolidDark() {
  const [activeTab, setActiveTab] = useState<Tab>('Пополнить');
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main
      className="relative mx-auto min-h-[100dvh] w-full max-w-[390px] overflow-hidden font-sans"
      style={{ background: '#0D0F16', color: '#fff' }}
    >
      {/* Wallet glimpsed beneath the modal: intentionally quiet and heavily obscured. */}
      <div className="absolute inset-0 px-5 pt-12" style={{ filter: 'blur(8px)', opacity: 0.56 }}>
        <div className="flex items-center justify-between">
          <div className="h-9 w-9 rounded-full" style={{ background: '#202531' }} />
          <div className="h-3 w-20 rounded-full" style={{ background: '#272b36' }} />
          <div className="h-9 w-9 rounded-full" style={{ background: '#202531' }} />
        </div>
        <p className="mt-12 text-[13px]" style={{ color: 'rgba(255,255,255,.44)' }}>Баланс кошелька</p>
        <p className="mt-2 text-[38px] font-semibold tracking-[-1.8px]">12 480.56 <span className="text-[17px]">USDT</span></p>
        <div className="mt-9 h-28 rounded-2xl" style={{ background: '#171b25' }} />
        <div className="mt-5 grid grid-cols-2 gap-3"><div className="h-20 rounded-2xl" style={{ background: '#171b25' }} /><div className="h-20 rounded-2xl" style={{ background: '#171b25' }} /></div>
      </div>
      <div className="absolute inset-0" style={{ background: 'rgba(3,5,9,.72)', backdropFilter: 'blur(3px)' }} />

      {!open ? (
        <button onClick={() => setOpen(true)} className="absolute bottom-8 left-5 right-5 h-14 rounded-xl text-[15px] font-semibold" style={{ background: '#3ab368', color: '#07130b' }}>
          Открыть пополнение
        </button>
      ) : (
        <section
          className="absolute inset-x-0 bottom-0 h-[96%] overflow-hidden rounded-t-[24px]"
          style={{ background: '#0A0B10', boxShadow: '0 -16px 40px rgba(0,0,0,.28)' }}
          aria-label="Пополнение кошелька"
        >
          <div className="h-full overflow-y-auto px-5 pb-5 pt-4">
            <button
              onClick={() => setOpen(false)}
              aria-label="Закрыть"
              className="absolute right-5 top-4 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: '#1C1E28', border: '1px solid rgba(255,255,255,.1)', color: '#fff' }}
            >
              <CloseIcon />
            </button>
            <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ background: 'rgba(255,255,255,.16)' }} />
            <h1 className="text-[20px] font-semibold tracking-[-.4px]">Операции</h1>
            <nav className="relative mt-5 flex border-b" style={{ borderColor: 'rgba(255,255,255,.09)' }}>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="relative flex-1 pb-3 text-[13px] font-medium transition-colors"
                  style={{ color: activeTab === tab ? '#fff' : 'rgba(255,255,255,.4)' }}
                >
                  {tab}
                  {activeTab === tab && <span className="absolute bottom-[-1px] left-0 right-0 h-[2px]" style={{ background: '#3ab368' }} />}
                </button>
              ))}
            </nav>

            {activeTab === 'Пополнить' ? (
              <div className="pt-5">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[.11em]" style={{ color: 'rgba(255,255,255,.4)' }}>Сеть</p>
                <button className="flex w-full items-center gap-3 rounded-xl p-3 text-left" style={{ background: '#141620' }}>
                  <TrонMark />
                  <span className="flex-1"><span className="block text-[14px] font-semibold">USDT TRC20</span><span className="mt-0.5 block text-[11px]" style={{ color: 'rgba(255,255,255,.4)' }}>Сеть Tron</span></span>
                  <span style={{ color: 'rgba(255,255,255,.5)' }}><ChevronDown /></span>
                </button>
                <div className="mt-5 flex flex-col items-center">
                  <QrPlaceholder />
                  <div className="mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: '#141620' }}>
                    <code className="flex-1 truncate text-[13px]" style={{ color: 'rgba(255,255,255,.58)' }}>TXx...abc</code>
                    <button onClick={copyAddress} className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium" style={{ color: '#3ab368' }}><CopyIcon />{copied ? 'Скопировано' : 'Скопировать'}</button>
                  </div>
                  <p className="mt-3 text-[11px]" style={{ color: 'rgba(255,255,255,.4)' }}>⏱ 00:19:47 до обновления адреса</p>
                </div>
                <div className="mt-7">
                  <button className="h-14 w-full rounded-xl text-[15px] font-semibold" style={{ background: '#3ab368', color: '#06120a' }}>Подтвердить</button>
                  <p className="mt-3 text-center text-[11px] leading-4" style={{ color: 'rgba(255,255,255,.3)' }}>Отправляйте только USDT в сети TRC20</p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[390px] items-center justify-center text-center">
                <div><div className="mx-auto mb-3 h-10 w-10 rounded-full" style={{ background: '#141620' }} /><p className="text-[14px]" style={{ color: 'rgba(255,255,255,.48)' }}>Раздел «{activeTab}» готовится</p></div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}