import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await api.get<{ success: boolean; data: { user: User } }>('/auth/me');
      setUser(response.data.user);
    } catch {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    const response = await api.post<{
      success: boolean;
      data: {
        user: User;
        tokens: { accessToken: string; refreshToken: string };
      };
    }>('/auth/login', { email, password }, { skipAuth: true });

    const { user, tokens } = response.data;

    await SecureStore.setItemAsync('accessToken', tokens.accessToken);
    await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);

    setUser(user);
  };

  const logout = async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Ignore errors on logout
    } finally {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      setUser(null);
    }
  };

  const refreshToken = async () => {
    const token = await SecureStore.getItemAsync('refreshToken');
    if (!token) throw new Error('No refresh token');

    const response = await api.post<{
      success: boolean;
      data: { tokens: { accessToken: string; refreshToken: string } };
    }>('/auth/refresh', { refreshToken: token }, { skipAuth: true });

    const { tokens } = response.data;

    await SecureStore.setItemAsync('accessToken', tokens.accessToken);
    await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
