'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useWebSocket } from '@/contexts/websocket-context';
import { RadarLogo } from '@/components/ui/RadarLogo';
import { Button } from '@/components/ui/Button';
import {
  User,
  Settings,
  LogOut,
  Bell,
  Wifi,
  WifiOff,
  ChevronDown,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isConnected } = useWebSocket();
  const [notificationCount] = useState(0);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="h-14 bg-background-secondary border-b border-border flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <RadarLogo className="w-8 h-8" />
        <span className="font-semibold text-text">Radar Defesa Civil</span>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 ml-auto">
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
            isConnected
              ? 'bg-accent-success/10 text-accent-success'
              : 'bg-accent-error/10 text-accent-error'
          }`}
        >
          {isConnected ? (
            <>
              <Wifi className="w-3 h-3" />
              <span>Conectado</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              <span>Desconectado</span>
            </>
          )}
        </div>

        {/* Current time */}
        <div className="text-text-secondary text-sm font-mono">
          {new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-error rounded-full text-[10px] flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </Button>

        {/* User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                <User className="w-3 h-3 text-accent" />
              </div>
              <span className="text-sm">{user?.name}</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="bg-background-elevated border border-border rounded-lg p-1 shadow-lg min-w-[180px] z-50"
              sideOffset={5}
              align="end"
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-text rounded cursor-pointer hover:bg-background-tertiary outline-none"
              >
                <User className="w-4 h-4" />
                Meu Perfil
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-text rounded cursor-pointer hover:bg-background-tertiary outline-none"
              >
                <Settings className="w-4 h-4" />
                Configurações
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="h-px bg-border my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-accent-error rounded cursor-pointer hover:bg-accent-error/10 outline-none"
                onSelect={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Sair
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
