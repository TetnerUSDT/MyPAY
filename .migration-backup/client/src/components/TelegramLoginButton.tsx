import { useEffect, useRef } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  botUsername: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  requestAccess?: boolean;
  lang?: string;
}

export default function TelegramLoginButton({
  botUsername,
  onAuth,
  buttonSize = 'large',
  cornerRadius = 10,
  requestAccess = true,
  lang = 'ru',
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create global callback function
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      onAuth(user);
    };

    // Load Telegram Widget script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-radius', cornerRadius.toString());
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', requestAccess ? 'write' : '');
    script.setAttribute('data-lang', lang);

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      // Cleanup
      if (containerRef.current && script.parentNode === containerRef.current) {
        containerRef.current.removeChild(script);
      }
      delete (window as any).onTelegramAuth;
    };
  }, [botUsername, buttonSize, cornerRadius, requestAccess, lang, onAuth]);

  return <div ref={containerRef} data-testid="telegram-login-widget" />;
}
