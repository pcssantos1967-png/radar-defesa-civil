'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth-context';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (channel: string, id?: string) => void;
  unsubscribe: (channel: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(WS_URL, {
      path: '/api/v1/stream',
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('authenticate', token);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('authenticated', () => {
      // Auto-subscribe to alerts
      newSocket.emit('subscribe:alerts', user.consortiumId);
      newSocket.emit('subscribe:radar');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const subscribe = useCallback((channel: string, id?: string) => {
    if (socket && isConnected) {
      socket.emit(`subscribe:${channel}`, id);
    }
  }, [socket, isConnected]);

  const unsubscribe = useCallback((channel: string) => {
    if (socket && isConnected) {
      socket.emit('unsubscribe', channel);
    }
  }, [socket, isConnected]);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}
