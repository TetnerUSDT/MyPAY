import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ChevronLeft, Bell, CheckCheck, ExternalLink, Image as ImageIcon, Video, Link as LinkIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { formatBalance } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface Notification {
  id: number;
  userId: number | null;
  type: 'info' | 'invoice' | 'exchange' | 'promotion';
  title: string;
  message: string;
  imageUrl?: string;
  videoUrl?: string;
  linkUrl?: string;
  redirectTo?: string;
  invoiceId?: number;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const dateLocale = i18n.language === 'ru' ? ru : enUS;

  // Get all notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/notifications/read-all", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }

    if (notification.redirectTo) {
      setLocation(notification.redirectTo);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return '💰';
      case 'exchange':
        return '🔄';
      case 'promotion':
        return '🎁';
      default:
        return '📢';
    }
  };

  const getTypeIconBg = (type: string) => {
    switch (type) {
      case 'invoice':   return 'bg-yellow-400/10';
      case 'exchange':  return 'bg-blue-400/10';
      case 'promotion': return 'bg-purple-400/10';
      default:          return 'bg-white/5';
    }
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      invoice:   'bg-yellow-400/10 border-yellow-400/20 text-yellow-400',
      exchange:  'bg-blue-400/10 border-blue-400/20 text-blue-400',
      promotion: 'bg-purple-400/10 border-purple-400/20 text-purple-400',
      info:      'bg-white/5 border-white/10 text-white/40',
    };
    const style = styles[type] || styles.info;
    const text = t(`notifications.types.${type}`) || t('notifications.types.info');
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${style}`}>
        {text}
      </span>
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Format amounts in notification messages
  const formatMessage = (message: string): string => {
    // Match patterns like "109.00000000 USDT" and format them
    return message.replace(/(\d+\.\d+)\s*(USDT|RUB|USD|EUR|TRY)/g, (match, amount, currency) => {
      return `${formatBalance(amount)} ${currency}`;
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#E2E8F0] pb-28 font-sans">
      <div className="sticky top-0 z-10 bg-[#0B0C10]/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <Link href="/home">
            <button className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors" data-testid="button-back">
              <ChevronLeft className="w-5 h-5 text-white/70" />
            </button>
          </Link>
          <div className="text-center">
            <h1 className="text-[17px] font-semibold tracking-tight text-white">{t('notifications.title')}</h1>
            {unreadCount > 0 && (
              <p className="text-[11px] text-[#3ab368] mt-0.5">{t('notifications.unreadCount', { count: unreadCount })}</p>
            )}
          </div>
          {unreadCount > 0 ? (
            <button
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="w-10 h-10 rounded-full bg-[#3ab368]/10 border border-[#3ab368]/20 flex items-center justify-center hover:bg-[#3ab368]/20 transition-colors disabled:opacity-50"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-4 h-4 text-[#3ab368]" />
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}
        </div>
      </div>

      <div className="px-5 pt-4 space-y-3">
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-[#13151A] border border-white/5 rounded-3xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/5 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/5 animate-pulse rounded-full w-1/3" />
                  <div className="h-4 bg-white/5 animate-pulse rounded-full w-2/3" />
                </div>
              </div>
              <div className="h-3 bg-white/5 animate-pulse rounded-full w-full" />
              <div className="h-3 bg-white/5 animate-pulse rounded-full w-4/5" />
            </div>
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-5">
              <Bell className="w-10 h-10 text-white/10" />
            </div>
            <p className="text-white/40 font-medium">{t('notifications.noNotifications')}</p>
            <p className="text-white/20 text-sm mt-2">{t('notifications.noNotificationsDesc')}</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`relative bg-[#13151A] border rounded-3xl p-5 cursor-pointer transition-all active:scale-[0.99] ${
                notification.isRead
                  ? 'border-white/5 hover:border-white/10'
                  : 'border-[#3ab368]/20 hover:border-[#3ab368]/30'
              }`}
              data-testid={`notification-${notification.id}`}
            >
              {!notification.isRead && (
                <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-[#3ab368] rounded-full animate-pulse shadow-[0_0_8px_#3ab368]" />
              )}

              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 ${getTypeIconBg(notification.type)}`}>
                  {getTypeIcon(notification.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    {getTypeBadge(notification.type)}
                    <span className="text-[11px] text-white/30 ml-auto flex-shrink-0">
                      {format(new Date(notification.createdAt), i18n.language === 'ru' ? "dd.MM 'в' HH:mm" : "MM/dd HH:mm", { locale: dateLocale })}
                    </span>
                  </div>

                  <h3 className="font-semibold text-white text-[15px] leading-snug mb-1">{notification.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{formatMessage(notification.message)}</p>

                  <div className="mt-3 space-y-2">
                    {notification.imageUrl && (
                      <div className="rounded-2xl overflow-hidden border border-white/5">
                        <img src={notification.imageUrl} alt="Notification" className="w-full h-auto" />
                      </div>
                    )}
                    {notification.videoUrl && (
                      <a href={notification.videoUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#3ab368] hover:text-[#3ab368]/80 text-sm">
                        <Video className="w-4 h-4" />
                        <span>{t('notifications.watchVideo')}</span>
                      </a>
                    )}
                    {notification.linkUrl && (
                      <a href={notification.linkUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#3ab368] hover:text-[#3ab368]/80 text-sm">
                        <ExternalLink className="w-4 h-4" />
                        <span>{t('notifications.openLink')}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
