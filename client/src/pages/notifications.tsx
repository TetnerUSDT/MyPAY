import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Bell, CheckCheck, ExternalLink, Image as ImageIcon, Video, Link as LinkIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  const getTypeBadge = (type: string) => {
    const colors = {
      invoice: 'bg-yellow-500',
      exchange: 'bg-blue-500',
      promotion: 'bg-purple-500',
      info: 'bg-gray-500',
    };
    const color = colors[type as keyof typeof colors] || colors.info;
    const text = t(`notifications.types.${type}`) || t('notifications.types.info');
    return <Badge className={`${color} text-white`}>{text}</Badge>;
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
    <div className="mobile-screen gradient-bg text-white overflow-y-auto pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link href="/home">
              <button className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center" data-testid="button-back">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">{t('notifications.title')}</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-green-200">{t('notifications.unreadCount', { count: unreadCount })}</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="text-white hover:bg-white/10"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="w-16 h-16 text-green-300/50 mb-4" />
            <p className="text-lg font-medium text-white">{t('notifications.noNotifications')}</p>
            <p className="text-sm text-green-200 mt-2">{t('notifications.noNotificationsDesc')}</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`relative bg-card/40 rounded-xl p-4 border ${
                notification.isRead ? 'border-green-600/20' : 'border-yellow-400/50'
              } backdrop-blur-sm cursor-pointer transition-all hover:scale-[1.02]`}
              data-testid={`notification-${notification.id}`}
            >
              {!notification.isRead && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
              )}

              <div className="flex items-start gap-3">
                <div className="text-3xl">{getTypeIcon(notification.type)}</div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getTypeBadge(notification.type)}
                    <span className="text-xs text-green-200">
                      {format(new Date(notification.createdAt), i18n.language === 'ru' ? "dd.MM.yyyy 'в' HH:mm" : "MM/dd/yyyy 'at' HH:mm", { locale: dateLocale })}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-white mb-1">{notification.title}</h3>
                  <p className="text-sm text-green-100">{formatMessage(notification.message)}</p>

                  {/* Media attachments */}
                  <div className="mt-3 space-y-2">
                    {notification.imageUrl && (
                      <div className="rounded-lg overflow-hidden">
                        <img src={notification.imageUrl} alt="Notification" className="w-full h-auto" />
                      </div>
                    )}
                    
                    {notification.videoUrl && (
                      <a href={notification.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-300 hover:text-blue-200">
                        <Video className="w-4 h-4" />
                        <span className="text-sm">{t('notifications.watchVideo')}</span>
                      </a>
                    )}
                    
                    {notification.linkUrl && (
                      <a href={notification.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-300 hover:text-blue-200">
                        <ExternalLink className="w-4 h-4" />
                        <span className="text-sm">{t('notifications.openLink')}</span>
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
