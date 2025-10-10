import type { Response } from 'express';
import { randomBytes } from 'crypto';

interface SSEConnection {
  userId: string;
  response: Response;
}

interface NotificationEvent {
  type: 'invoice' | 'notification' | 'ping';
  data: any;
}

interface SSEToken {
  userId: string;
  createdAt: number;
}

class NotificationService {
  private connections: Map<string, Response[]> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private sseTokens: Map<string, SSEToken> = new Map();
  private readonly TOKEN_EXPIRY = 60000; // 1 minute

  constructor() {
    // Start heartbeat to keep connections alive
    this.startHeartbeat();
    // Start token cleanup
    this.startTokenCleanup();
  }

  /**
   * Register a new SSE connection for a user
   */
  addConnection(userId: string, response: Response): void {
    console.log(`[SSE] New connection for user ${userId}`);
    
    // Get existing connections for this user
    const userConnections = this.connections.get(userId) || [];
    userConnections.push(response);
    this.connections.set(userId, userConnections);

    // Setup cleanup on connection close
    response.on('close', () => {
      this.removeConnection(userId, response);
    });

    // Send initial connection success event
    this.sendToConnection(response, {
      type: 'ping',
      data: { message: 'Connected', timestamp: Date.now() }
    });
  }

  /**
   * Remove a connection when client disconnects
   */
  private removeConnection(userId: string, response: Response): void {
    console.log(`[SSE] Connection closed for user ${userId}`);
    
    const userConnections = this.connections.get(userId) || [];
    const filtered = userConnections.filter(conn => conn !== response);
    
    if (filtered.length === 0) {
      this.connections.delete(userId);
    } else {
      this.connections.set(userId, filtered);
    }
  }

  /**
   * Send event to a specific connection
   */
  private sendToConnection(response: Response, event: NotificationEvent): boolean {
    try {
      response.write(`event: ${event.type}\n`);
      response.write(`data: ${JSON.stringify(event.data)}\n\n`);
      return true;
    } catch (error) {
      console.error('[SSE] Error sending to connection:', error);
      return false;
    }
  }

  /**
   * Send event to all connections of a specific user
   */
  sendToUser(userId: string, event: NotificationEvent): void {
    const userConnections = this.connections.get(userId);
    
    if (!userConnections || userConnections.length === 0) {
      console.log(`[SSE] No active connections for user ${userId}`);
      return;
    }

    console.log(`[SSE] Sending ${event.type} event to ${userConnections.length} connection(s) for user ${userId}`);
    
    // Send to all user's connections
    userConnections.forEach(conn => {
      this.sendToConnection(conn, event);
    });
  }

  /**
   * Send notification event to user
   */
  notifyUser(userId: string, notification: any): void {
    this.sendToUser(userId, {
      type: 'notification',
      data: notification
    });
  }

  /**
   * Send invoice event to user (triggers Bottom Sheet)
   */
  notifyInvoice(userId: string, invoice: any): void {
    this.sendToUser(userId, {
      type: 'invoice',
      data: invoice
    });
  }

  /**
   * Send heartbeat ping to all connections to keep them alive
   */
  private startHeartbeat(): void {
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      let totalConnections = 0;
      
      this.connections.forEach((connections, userId) => {
        totalConnections += connections.length;
        connections.forEach(conn => {
          this.sendToConnection(conn, {
            type: 'ping',
            data: { timestamp: Date.now() }
          });
        });
      });

      if (totalConnections > 0) {
        console.log(`[SSE] Heartbeat sent to ${totalConnections} connection(s)`);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Generate a one-time SSE token for a user
   */
  generateSSEToken(userId: string): string {
    const token = randomBytes(32).toString('hex');
    this.sseTokens.set(token, {
      userId,
      createdAt: Date.now()
    });
    console.log(`[SSE] Generated token for user ${userId}`);
    return token;
  }

  /**
   * Validate and consume an SSE token (one-time use)
   */
  validateSSEToken(token: string): string | null {
    const tokenData = this.sseTokens.get(token);
    
    if (!tokenData) {
      console.log('[SSE] Invalid token - not found');
      return null;
    }

    // Check if token is expired
    if (Date.now() - tokenData.createdAt > this.TOKEN_EXPIRY) {
      console.log('[SSE] Token expired');
      this.sseTokens.delete(token);
      return null;
    }

    // Token is valid - consume it (delete after use)
    this.sseTokens.delete(token);
    console.log(`[SSE] Token validated for user ${tokenData.userId}`);
    return tokenData.userId;
  }

  /**
   * Periodically clean up expired tokens
   */
  private startTokenCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [token, data] of this.sseTokens.entries()) {
        if (now - data.createdAt > this.TOKEN_EXPIRY) {
          this.sseTokens.delete(token);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[SSE] Cleaned ${cleaned} expired token(s)`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Get statistics about active connections
   */
  getStats(): { users: number; connections: number; tokens: number } {
    let totalConnections = 0;
    this.connections.forEach(conns => {
      totalConnections += conns.length;
    });

    return {
      users: this.connections.size,
      connections: totalConnections,
      tokens: this.sseTokens.size
    };
  }

  /**
   * Cleanup on server shutdown
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    this.connections.forEach((connections) => {
      connections.forEach(conn => {
        try {
          conn.end();
        } catch (error) {
          // Ignore errors during shutdown
        }
      });
    });

    this.connections.clear();
    this.sseTokens.clear();
    console.log('[SSE] Notification service shut down');
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
