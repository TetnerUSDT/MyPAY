import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ExternalLink, Loader2, MessageCircle } from 'lucide-react';
import { adminRequest } from '@/lib/adminApi';

interface TelegramUserInfo {
  id: number;
  tgId: string;
  tgUsername: string | null;
  name: string | null;
  img: string | null;
  telegramLink: string | null;
}

interface UserProfilePopoverProps {
  userId: number;
  userName: string | null;
  children: React.ReactNode;
}

export function UserProfilePopover({ userId, userName, children }: UserProfilePopoverProps) {
  const [open, setOpen] = useState(false);

  const { data: userInfo, isLoading } = useQuery<TelegramUserInfo>({
    queryKey: ['/admin/api/users', userId, 'telegram-info'],
    queryFn: () => adminRequest(`/users/${userId}/telegram-info`),
    enabled: open, // Only fetch when popover is open
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : userInfo ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={userInfo.img || undefined} alt={userInfo.name || 'User'} />
                <AvatarFallback className="text-lg">
                  {(userInfo.name || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-lg" data-testid="popover-user-name">
                  {userInfo.name || 'Без имени'}
                </p>
                {userInfo.tgUsername && (
                  <p className="text-sm text-gray-500" data-testid="popover-user-username">
                    @{userInfo.tgUsername}
                  </p>
                )}
                <p className="text-xs text-gray-400" data-testid="popover-user-id">
                  ID: {userInfo.tgId}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {userInfo.telegramLink ? (
                <Button
                  variant="outline"
                  className="w-full"
                  asChild
                  data-testid="button-telegram-profile"
                >
                  <a
                    href={userInfo.telegramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Открыть профиль в Telegram
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-gray-500 text-center" data-testid="text-no-telegram-link">
                  Профиль Telegram недоступен
                </p>
              )}

              <Button
                variant="secondary"
                className="w-full"
                disabled
                data-testid="button-send-message"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Написать (скоро)
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-500">
            Не удалось загрузить данные
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
