import { useMemo, useState } from 'react';
import {
  Building2,
  Calculator,
  ChevronDown,
  FileStack,
  FileSignature,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Moon,
  Sun,
  Bell,
  Radio,
  Settings,
  Target,
  Users2,
} from 'lucide-react';
import { BrokerScreenId } from '../screens';
import { DavlosLogo } from './DavlosLogo';

interface SidebarProps {
  activeItem?: BrokerScreenId;
  onNavigate?: (item: BrokerScreenId) => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  notificationsOpen?: boolean;
  integrationsEnabled?: boolean;
  profileName?: string;
  profileSubtitle?: string;
}

export function Sidebar({
  activeItem = 'broker-dashboard',
  onNavigate,
  onOpenSettings,
  onLogout,
  theme = 'dark',
  onToggleTheme,
  onOpenNotifications,
  unreadCount = 0,
  notificationsOpen = false,
  integrationsEnabled = true,
  profileName = 'Broker Account',
  profileSubtitle = 'Workspace access',
}: SidebarProps) {
  const isTransactionsActive = activeItem === 'broker-transaction-detail' || activeItem === 'broker-document-review';
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileInitials = useMemo(() => {
    const parts = profileName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (parts.length === 0) {
      return 'BR';
    }
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('').slice(0, 2) || 'BR';
  }, [profileName]);

  const menuItems = useMemo(
    () => [
      { id: 'broker-dashboard' as const, icon: LayoutDashboard, label: '1. Dashboard' },
      { id: 'broker-listings' as const, icon: Building2, label: '2. Ακίνητα' },
      { id: 'broker-leads-matching' as const, icon: Target, label: '3. Πελάτες & Matching' },
      { id: 'broker-orders' as const, icon: FileSignature, label: '4. Εντολές' },
      { id: 'broker-transaction-detail' as const, icon: GitBranch, label: '5. Συναλλαγές / Skill Tree' },
      { id: 'broker-member-task-view' as const, icon: ListChecks, label: '6. Εργασίες Μελών' },
      { id: 'broker-template-builder' as const, icon: FileStack, label: '7. Templates' },
      { id: 'broker-member-teams' as const, icon: Users2, label: '8. Ομάδες & Μέλη' },
      ...(integrationsEnabled
        ? [
            { id: 'broker-lead-sources' as const, icon: Radio, label: '8.1 Πηγές Leads' },
            { id: 'public-calculator' as const, icon: Calculator, label: '9. Υπολογιστής Κόστους' },
          ]
        : []),
    ],
    [integrationsEnabled],
  );

  return (
    <aside className="davlos-sidebar fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col bg-[var(--surface-darkness)]">
      <div className="border-b border-[var(--border-subtle)] p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-[#E8913A] to-[#D67D2E] p-2 shadow-lg shadow-[#E8913A]/10">
            <DavlosLogo className="h-5 w-5 text-[#1A1A1A]" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--brand-primary)]">Δαυλός</h1>
          {!notificationsOpen && (
            <div className="ml-auto inline-flex items-center gap-2">
              <button
                onClick={onToggleTheme}
                aria-label={theme === 'light' ? 'Ενεργοποίηση dark mode' : 'Ενεργοποίηση light mode'}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-glow)] text-[var(--text-tertiary)] shadow-sm transition-colors hover:bg-[var(--surface-glow-hover)] hover:text-[var(--text-primary)]"
              >
                <Moon
                  size={14}
                  className={`absolute transition-all duration-300 ${
                    theme === 'light' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-180'
                  }`}
                />
                <Sun
                  size={14}
                  className={`absolute transition-all duration-300 ${
                    theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 rotate-180'
                  }`}
                />
              </button>
              <button
                onClick={onOpenNotifications}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-glow)] text-[var(--text-tertiary)] shadow-sm transition-colors hover:bg-[var(--surface-glow-hover)] hover:text-[var(--text-primary)]"
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--status-danger)] text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Broker Workspace</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Κύριο Μενού</p>
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.id === activeItem ||
              (item.id === 'broker-transaction-detail' && isTransactionsActive);

            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate?.(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                    isActive
                      ? 'border border-[var(--border-brand)] bg-[var(--surface-glow-active)] text-[var(--text-primary)] shadow-[inset_3px_0_0_var(--brand-primary)]'
                      : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-darkness-hover)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon
                    size={20}
                    className={isActive ? 'text-[var(--brand-warm)]' : 'text-[var(--text-tertiary)]'}
                  />
                  <span className={`text-left text-sm ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                </button>

                {item.id === 'broker-transaction-detail' && (
                  <button
                    onClick={() => onNavigate?.('broker-document-review')}
                    className={`mt-1 ml-10 w-[calc(100%-2.5rem)] rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                      activeItem === 'broker-document-review'
                        ? 'border border-[var(--border-brand)] bg-[var(--surface-glow-active)] font-semibold text-[var(--text-primary)] shadow-[inset_3px_0_0_var(--brand-primary)]'
                        : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-darkness-hover)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    Έλεγχος Εγγράφων
                  </button>
                )}
              </li>
            );
          })}

        </ul>
      </nav>

      <div className="relative z-50 mb-0 mt-auto border-t border-[var(--border-subtle)] bg-[var(--surface-glow)] p-4 dark:bg-[var(--surface-darkness-hover)]">
        <div className="relative">
          <button
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-[var(--surface-highlight)] dark:hover:bg-[var(--surface-glow)]/5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-highlight)] dark:bg-[var(--surface-glow)]/20">
              <span className="text-sm font-medium text-[var(--text-primary)]">{profileInitials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{profileName}</p>
              <p className="truncate text-xs text-[var(--text-secondary)]">{profileSubtitle}</p>
            </div>
            <ChevronDown
              size={14}
              className={`text-[var(--text-secondary)] transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {profileMenuOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-40 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-1 shadow-lg">
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  onOpenSettings?.();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-glow-hover)]"
              >
                <Settings size={14} />
                Settings
              </button>
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  onLogout?.();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--status-danger-text)] hover:bg-[var(--surface-glow-hover)]"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
