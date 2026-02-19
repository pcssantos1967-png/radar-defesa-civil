'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Radio,
  AlertTriangle,
  MapPin,
  CloudRain,
  Settings,
  Users,
  FileText,
  Zap,
} from 'lucide-react';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Radares',
    href: '/radares',
    icon: Radio,
  },
  {
    label: 'Alertas',
    href: '/alertas',
    icon: AlertTriangle,
  },
  {
    label: 'Municípios',
    href: '/municipios',
    icon: MapPin,
  },
  {
    label: 'Precipitação',
    href: '/precipitacao',
    icon: CloudRain,
  },
  {
    label: 'Nowcasting',
    href: '/nowcasting',
    icon: Zap,
  },
  {
    label: 'Relatórios',
    href: '/relatorios',
    icon: FileText,
  },
];

const adminItems = [
  {
    label: 'Usuários',
    href: '/admin/usuarios',
    icon: Users,
  },
  {
    label: 'Configurações',
    href: '/admin/configuracoes',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-background-secondary border-r border-border flex flex-col">
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-background-tertiary hover:text-text'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 pb-2">
          <div className="text-xs font-medium text-text-muted px-3 mb-2">
            Administração
          </div>
          {adminItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:bg-background-tertiary hover:text-text'
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Version info */}
      <div className="p-4 border-t border-border">
        <div className="text-xs text-text-muted">
          <div>Versão 1.0.0</div>
          <div className="mt-1">Última atualização: agora</div>
        </div>
      </div>
    </aside>
  );
}
