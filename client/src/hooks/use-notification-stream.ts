import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

interface NotificationStreamEvent {
  type: 'notification' | 'invoice' | 'ping';
  data: any;
}

interface UseNotificationStreamOptions {
  onInvoice?: (invoice: any) => void;
  onNotification?: (notification: any) => void;
  enabled?: boolean;
}

export function useNotificationStream(options: UseNotificationStreamOptions = {}) {
  const { onInvoice, onNotification, enabled = true } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const RECONNECT_DELAY = 3000; // 3 seconds
  const RECONNECT_MAX_DELAY = 30000; // 30 seconds max

  // Function to get SSE token
  const getSSEToken = useCallback(async (): Promise<string | null> => {
    // Don't get token on admin pages
    if (window.location.pathname.startsWith('/admin')) {
      return null;
    }

    const apiKey = localStorage.getItem('userApiKey');
    if (!apiKey) {
      return null;
    }

    try {
      const response = await fetch('/api/notifications/sse-token', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey
        }
      });

      if (!response.ok) {
        console.error('[SSE] Failed to get token:', response.statusText);
        return null;
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('[SSE] Error getting token:', error);
      return null;
    }
  }, []);

  const connect = useCallback(async () => {
    // Don't connect on admin pages
    if (window.location.pathname.startsWith('/admin')) {
      console.log('[SSE] Skipping connection on admin page');
      return;
    }

    const apiKey = localStorage.getItem('userApiKey');
    if (!enabled || !apiKey) {
      console.log('[SSE] Connection disabled or no API key', { enabled, hasApiKey: !!apiKey });
      return;
    }

    // Don't reconnect if already connected
    if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
      return;
    }

    console.log('[SSE] Getting SSE token...');
    const token = await getSSEToken();

    if (!token) {
      console.error('[SSE] Failed to get token');
      // Retry after delay
      const delay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current), RECONNECT_MAX_DELAY);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current++;
        connect();
      }, delay);
      return;
    }

    console.log('[SSE] Connecting to notification stream...');

    // Create EventSource with one-time token
    const url = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('[SSE] Connected to notification stream');
      reconnectAttemptsRef.current = 0;
    };

    // Handle ping events (keep-alive)
    eventSource.addEventListener('ping', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Ping received:', data.timestamp);
      } catch (error) {
        console.error('[SSE] Error parsing ping event:', error);
      }
    });

    // Handle notification events
    eventSource.addEventListener('notification', (event) => {
      try {
        const notification = JSON.parse(event.data);
        console.log('[SSE] Notification received:', notification);
        
        // Invalidate notifications cache to refetch
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
        
        // Call callback if provided
        if (onNotification) {
          onNotification(notification);
        }
      } catch (error) {
        console.error('[SSE] Error processing notification event:', error);
      }
    });

    // Handle invoice events (triggers Bottom Sheet)
    eventSource.addEventListener('invoice', (event) => {
      try {
        const invoiceData = JSON.parse(event.data);
        console.log('[SSE] Invoice received:', invoiceData);
        
        // Invalidate related caches
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        
        // Call invoice callback to open Bottom Sheet
        if (onInvoice) {
          onInvoice(invoiceData);
        }
      } catch (error) {
        console.error('[SSE] Error processing invoice event:', error);
      }
    });

    // Handle errors
    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      
      // Close current connection
      eventSource.close();
      eventSourceRef.current = null;
      
      // Attempt reconnection with exponential backoff (unlimited attempts)
      reconnectAttemptsRef.current += 1;
      const delay = Math.min(RECONNECT_DELAY * Math.pow(2, Math.min(reconnectAttemptsRef.current - 1, 5)), RECONNECT_MAX_DELAY);
      
      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [enabled, onInvoice, onNotification, getSSEToken]);

  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting from notification stream');
    
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    // Don't connect on admin pages
    if (window.location.pathname.startsWith('/admin')) {
      return;
    }

    const apiKey = localStorage.getItem('userApiKey');
    if (enabled && apiKey) {
      // Small delay to ensure authentication is fully set up
      const timer = setTimeout(() => {
        connect();
      }, 500);

      return () => {
        clearTimeout(timer);
        disconnect();
      };
    }
  }, [enabled, connect, disconnect]);

  // Reconnect when browser comes back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('[SSE] Browser back online, reconnecting...');
      connect();
    };

    const handleOffline = () => {
      console.log('[SSE] Browser offline, disconnecting...');
      disconnect();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connect, disconnect]);

  return {
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
    reconnect: connect,
    disconnect
  };
}
