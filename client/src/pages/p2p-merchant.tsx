import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Star, Shield, CheckCircle2, Clock, TrendingUp, MessageSquare, BadgeCheck } from "lucide-react";

const COLORS = ["#e63946","#2a9d8f","#e9c46a","#f4a261","#3ab368","#4361ee","#7209b7"];

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#1A1D24] rounded-2xl p-3 flex flex-col items-center gap-0.5">
      <span className="text-[15px] font-bold text-white">{value}</span>
      <span className="text-[10px] text-white/40 text-center leading-tight">{label}</span>
      {sub && <span className="text-[10px] text-[#3ab368]">{sub}</span>}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star
          key={s}
          className={`w-3.5 h-3.5 ${rating >= s ? "text-[#e9c46a] fill-[#e9c46a]" : "text-white/15"}`}
        />
      ))}
    </div>
  );
}

function formatReleaseTime(seconds: number): string {
  if (seconds === 0) return "—";
  if (seconds < 60) return `${seconds} сек`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
  return `${Math.round(seconds / 3600)} ч`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { year: "numeric", month: "long" });
}

const MERCHANT_LEVEL_LABEL: Record<string, string> = {
  none: "",
  basic: "Мерчант",
  verified: "Верифицированный",
  pro: "Про мерчант",
};

const MERCHANT_LEVEL_COLOR: Record<string, string> = {
  none: "",
  basic: "text-white/50",
  verified: "text-[#3ab368]",
  pro: "text-[#e9c46a]",
};

export default function P2PMerchantScreen() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: merchant, isLoading } = useQuery<any>({
    queryKey: ["/api/p2p/user", id],
    queryFn: () => fetch(`/api/p2p/user/${id}`, {
      headers: { "x-api-key": localStorage.getItem("userApiKey") || "" }
    }).then(r => r.json()),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-[#3ab368] animate-spin" />
      </div>
    );
  }

  if (!merchant || merchant.message) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex flex-col items-center justify-center gap-4">
        <p className="text-white/40 text-sm">Пользователь не найден</p>
        <button onClick={() => setLocation("/p2p")} className="text-[#3ab368] text-sm">← Назад</button>
      </div>
    );
  }

  const avatarColor = COLORS[merchant.id % COLORS.length];
  const initial = (merchant.name || "?").substring(0, 2).toUpperCase();
  const rating = parseFloat(merchant.rating) || 0;
  const successPct = parseFloat(merchant.successfulPercent) || 0;
  const hasMerchantBadge = merchant.merchantLevel !== "none";

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <button
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white/70" />
        </button>
        <h1 className="text-[17px] font-semibold text-white">Профиль мерчанта</h1>
        <div className="w-10" />
      </div>

      <div className="px-5 space-y-4">
        {/* Profile card */}
        <div className="bg-[#13151A] border border-white/5 rounded-3xl p-5">
          <div className="flex items-center gap-4 mb-4">
            {merchant.img ? (
              <img src={merchant.img} alt={merchant.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {initial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[17px] font-bold text-white truncate">{merchant.name}</span>
                {hasMerchantBadge && (
                  <span className={`flex items-center gap-1 text-xs font-semibold ${MERCHANT_LEVEL_COLOR[merchant.merchantLevel]}`}>
                    <BadgeCheck className="w-3.5 h-3.5" />
                    {MERCHANT_LEVEL_LABEL[merchant.merchantLevel]}
                  </span>
                )}
              </div>
              {merchant.tgUsername && (
                <p className="text-xs text-white/40 mt-0.5">@{merchant.tgUsername}</p>
              )}
              <p className="text-xs text-white/30 mt-1">С {formatDate(merchant.registeredAt)}</p>
            </div>
          </div>

          {/* Rating row */}
          <div className="flex items-center gap-3 py-3 border-t border-white/5">
            <StarRating rating={Math.round(rating)} />
            <span className="font-bold text-white text-sm">{rating.toFixed(1)}</span>
            <span className="text-xs text-white/30">·</span>
            <span className="text-xs text-white/40">{merchant.reviews?.length ?? 0} отзывов</span>
            {merchant.activeAdsCount > 0 && (
              <>
                <span className="text-xs text-white/30">·</span>
                <span className="text-xs text-[#3ab368]">{merchant.activeAdsCount} объявл.</span>
              </>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Всего сделок" value={merchant.totalOrders} />
          <StatBox label="Успешных" value={`${successPct.toFixed(1)}%`} sub={`${merchant.completedOrders} завершено`} />
          <StatBox
            label="Ср. время выпуска"
            value={formatReleaseTime(merchant.avgReleaseTimeSeconds)}
          />
          <StatBox label="Споров" value={merchant.disputesTotal} />
        </div>

        {/* Reputation */}
        <div className="bg-[#13151A] border border-white/5 rounded-3xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Репутация</h3>
          <div className="flex gap-3">
            <div className="flex-1 flex items-center gap-2 bg-[#3ab368]/10 border border-[#3ab368]/20 rounded-2xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#3ab368] shrink-0" />
              <div>
                <div className="text-sm font-bold text-[#3ab368]">{merchant.positiveReviews ?? 0}</div>
                <div className="text-[10px] text-white/40">Положит.</div>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl px-3 py-2.5">
              <TrendingUp className="w-4 h-4 text-red-400 shrink-0 rotate-180" />
              <div>
                <div className="text-sm font-bold text-red-400">{merchant.negativeReviews ?? 0}</div>
                <div className="text-[10px] text-white/40">Отрицат.</div>
              </div>
            </div>
          </div>

          {/* Response time badge */}
          {merchant.avgReleaseTimeSeconds > 0 && merchant.avgReleaseTimeSeconds < 3600 && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Clock className="w-3.5 h-3.5 text-[#3ab368]" />
              Отвечает в среднем за {formatReleaseTime(merchant.avgReleaseTimeSeconds)}
            </div>
          )}
        </div>

        {/* Reviews */}
        {(merchant.reviews?.length ?? 0) > 0 && (
          <div className="bg-[#13151A] border border-white/5 rounded-3xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-white/30" />
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Отзывы</h3>
            </div>
            {merchant.reviews.map((review: any, i: number) => (
              <div key={i} className="space-y-1.5 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {review.fromImg ? (
                      <img src={review.fromImg} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: COLORS[(review.fromName || "?").charCodeAt(0) % COLORS.length] }}
                      >
                        {(review.fromName || "?").substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-semibold text-white/70">{review.fromName || "Пользователь"}</span>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="text-xs text-white/50 leading-relaxed pl-9">{review.comment}</p>
                )}
                <p className="text-[10px] text-white/25 pl-9">
                  {review.createdAt ? new Date(review.createdAt).toLocaleDateString("ru-RU") : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Security note */}
        <div className="flex items-start gap-3 bg-[#13151A] border border-white/5 rounded-3xl p-4">
          <Shield className="w-4 h-4 text-[#3ab368] shrink-0 mt-0.5" />
          <p className="text-xs text-white/40 leading-relaxed">
            Данные обновляются после каждой сделки. Рейтинг рассчитывается на основе реальных отзывов участников.
          </p>
        </div>
      </div>
    </div>
  );
}
