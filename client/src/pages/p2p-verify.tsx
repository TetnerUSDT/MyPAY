import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Shield, ShieldCheck, CheckCircle2, Clock, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const userApiKey = () => localStorage.getItem("userApiKey") || "";

function fetchP2P(path: string) {
  return fetch(path, { headers: { "x-api-key": userApiKey() } }).then(r => r.json());
}

const LEVELS = [
  {
    key: "basic",
    label: "Базовый мерчант",
    color: "#4361ee",
    icon: Shield,
    perks: [
      "Значок мерчанта в профиле",
      "Приоритет в каталоге объявлений",
      "Повышенный лимит сделок",
    ],
    requirements: "Минимум 10 завершённых сделок, отсутствие активных споров",
  },
  {
    key: "verified",
    label: "Верифицированный",
    color: "#3ab368",
    icon: ShieldCheck,
    perks: [
      "Зелёный значок верификации",
      "Топ позиции в выдаче",
      "Пониженная комиссия 0.1%",
      "Расширенные лимиты",
    ],
    requirements: "Минимум 50 сделок, успешность > 95%, возраст аккаунта > 30 дней",
  },
  {
    key: "pro",
    label: "Про мерчант",
    color: "#e9c46a",
    icon: Star,
    perks: [
      "Золотой значок Pro",
      "Первые позиции всегда",
      "Нулевая комиссия",
      "API доступ",
      "Персональный менеджер",
    ],
    requirements: "Минимум 200 сделок, успешность > 98%, рейтинг > 4.5",
  },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:  { label: "На рассмотрении", color: "text-yellow-400" },
  approved: { label: "Одобрено",        color: "text-[#3ab368]" },
  rejected: { label: "Отклонено",       color: "text-red-400" },
};

export default function P2PVerifyScreen() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const { data: verifyData, isLoading } = useQuery<any>({
    queryKey: ["/api/p2p/verify"],
    queryFn: () => fetchP2P("/api/p2p/verify"),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/p2p/dashboard"],
    queryFn: () => fetchP2P("/api/p2p/dashboard"),
  });

  const submitRequest = useMutation({
    mutationFn: ({ level, note }: { level: string; note: string }) =>
      apiRequest("POST", "/api/p2p/verify", { requestedLevel: level, note }).then(r => r.json()),
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Заявка отправлена", description: "Мы рассмотрим её в течение 24 часов" });
        qc.invalidateQueries({ queryKey: ["/api/p2p/verify"] });
        setSelectedLevel(null);
        setNote("");
      } else {
        toast({ title: "Ошибка", description: data.message, variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const currentLevel = stats?.merchantLevel || "none";
  const requests: any[] = verifyData?.requests || [];

  const pendingRequest = requests.find(r => r.status === "pending");
  const lastRequest = requests[0];

  const levelOrder = ["none", "basic", "verified", "pro"];
  const currentIdx = levelOrder.indexOf(currentLevel);

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <button
          onClick={() => setLocation("/p2p/dashboard")}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white/70" />
        </button>
        <div>
          <h1 className="text-[17px] font-semibold text-white">Верификация мерчанта</h1>
          <p className="text-[12px] text-white/40">Повысьте уровень доверия</p>
        </div>
      </div>

      <div className="flex-1 px-5 pb-10 overflow-y-auto">
        {/* Current level */}
        <div className="bg-[#13151A] border border-white/5 rounded-2xl p-4 mb-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3ab368]/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#3ab368]" />
          </div>
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-wide">Текущий уровень</p>
            <p className="text-[15px] font-bold text-white">
              {currentLevel === "none" ? "Обычный пользователь" :
               currentLevel === "basic" ? "Базовый мерчант" :
               currentLevel === "verified" ? "Верифицированный" : "Про мерчант"}
            </p>
          </div>
        </div>

        {/* Pending request banner */}
        {pendingRequest && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4 mb-5 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-400">Заявка на рассмотрении</p>
              <p className="text-xs text-white/40">Уровень: {LEVELS.find(l => l.key === pendingRequest.requestedLevel)?.label}</p>
            </div>
          </div>
        )}

        {/* Last rejected */}
        {lastRequest && lastRequest.status === "rejected" && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-5">
            <p className="text-sm font-semibold text-red-400 mb-1">Последняя заявка отклонена</p>
            {lastRequest.adminComment && (
              <p className="text-xs text-white/40">{lastRequest.adminComment}</p>
            )}
          </div>
        )}

        {/* Level cards */}
        {!isLoading && LEVELS.map((level, idx) => {
          const levelIdx = levelOrder.indexOf(level.key);
          const isCurrent = level.key === currentLevel;
          const isAvailable = levelIdx === currentIdx + 1;
          const isAchieved = levelIdx <= currentIdx;
          const hasPendingForThis = pendingRequest?.requestedLevel === level.key;
          const Icon = level.icon;

          return (
            <div
              key={level.key}
              className={`rounded-2xl border p-4 mb-3 transition-all ${
                isAchieved ? "bg-[#13151A] border-[#3ab368]/30 opacity-70" :
                isAvailable && selectedLevel === level.key ? "bg-[#13151A] border-white/20" :
                isAvailable ? "bg-[#13151A] border-white/8 cursor-pointer hover:border-white/20" :
                "bg-[#13151A] border-white/5 opacity-40"
              }`}
              onClick={() => {
                if (isAvailable && !pendingRequest) {
                  setSelectedLevel(selectedLevel === level.key ? null : level.key);
                }
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: level.color + "15" }}>
                  <Icon className="w-5 h-5" style={{ color: level.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{level.label}</span>
                    {isAchieved && <CheckCircle2 className="w-4 h-4 text-[#3ab368]" />}
                    {hasPendingForThis && <Clock className="w-4 h-4 text-yellow-400" />}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                {level.perks.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full" style={{ background: level.color }} />
                    <span className="text-[12px] text-white/60">{p}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white/3 rounded-xl p-3">
                <p className="text-[11px] text-white/30">{level.requirements}</p>
              </div>

              {/* Apply form */}
              {isAvailable && selectedLevel === level.key && !pendingRequest && (
                <div className="mt-4 border-t border-white/5 pt-4">
                  <p className="text-[12px] text-white/40 mb-2">Примечание (необязательно)</p>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Расскажите о себе..."
                    rows={3}
                    className="w-full bg-[#1A1D24] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-[#3ab368]/50 mb-3"
                  />
                  <button
                    onClick={e => { e.stopPropagation(); submitRequest.mutate({ level: level.key, note }); }}
                    disabled={submitRequest.isPending}
                    className="w-full py-3 rounded-xl font-bold text-sm text-[#0B0C10]"
                    style={{ background: level.color }}
                  >
                    {submitRequest.isPending ? "Отправка..." : "Подать заявку"}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* History */}
        {requests.length > 1 && (
          <div className="mt-4">
            <p className="text-[12px] text-white/40 uppercase tracking-wide mb-3">История заявок</p>
            {requests.slice(0, 5).map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 py-3 border-b border-white/5">
                <div className="flex-1">
                  <p className="text-sm text-white">{LEVELS.find(l => l.key === r.requestedLevel)?.label || r.requestedLevel}</p>
                  <p className="text-[11px] text-white/30">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("ru-RU") : "—"}</p>
                </div>
                <span className={`text-xs font-semibold ${STATUS_LABEL[r.status]?.color || "text-white/40"}`}>
                  {STATUS_LABEL[r.status]?.label || r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
