import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, FileText, Info, XCircle } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Deal } from './components/DealCard';
import { BrokerDashboardPage } from './pages/BrokerDashboardPage';
import { BrokerTransactionDetailPage } from './pages/BrokerTransactionDetailPage';
import { BrokerClientPortalPage } from './pages/BrokerClientPortalPage';
import { BrokerMemberTaskViewPage } from './pages/BrokerMemberTaskViewPage';
import { BrokerTemplateBuilderPage } from './pages/BrokerTemplateBuilderPage';
import { BrokerMemberTeamsPage } from './pages/BrokerMemberTeamsPage';
import { LeadsMatchingPage } from './pages/LeadsMatchingPage';
import { LeadSourcesPage } from './pages/LeadSourcesPage';
import { MyListingsPage } from './pages/MyListingsPage';
import { BrokerOrdersPage } from './pages/BrokerOrdersPage';
import { TransactionDocumentsPage } from './pages/TransactionDocumentsPage';
import { CostCalculatorPage } from './pages/CostCalculatorPage';
import { BrokerSettingsPage } from './pages/BrokerSettingsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { BrokerOnboardingPage } from './pages/BrokerOnboardingPage';
import { MemberPortalPage } from './pages/MemberPortalPage';
import { BuyerIndicationPublicPage } from './pages/BuyerIndicationPublicPage';
import { SellerListingAssignmentPublicPage } from './pages/SellerListingAssignmentPublicPage';
import { UiStoreProvider, useUiStore } from './state/uiStore';
import LandingPage from '../pages/LandingPage';
import {
  ApiBillingOverview,
  ApiCurrentUser,
  ApiNotificationFeedItem,
  clearStoredToken,
  ensureAuthenticated,
  getBillingOverview,
  getCurrentUser,
  login,
  loginAdmin,
  getDeal,
  isAuthenticated,
  listDeals,
  listDealStages,
  listNotificationFeed,
  markNotificationFeedReadAll
} from './api/trustlayerApi';
import {
  BrokerScreenId,
  DEFAULT_TRANSACTION_ID,
  pathForScreen,
  resolveScreenFromPath
} from './screens';

const THEME_STORAGE_KEY = 'davlos-theme';

function AppShell() {
  const {
    notifications,
    markAllNotificationsRead,
    showToast,
    toastMessage,
    clearToast,
  } = useUiStore();
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.toLowerCase());
  const initialRoute = resolveScreenFromPath(currentPath);
  const [activeView, setActiveView] = useState<BrokerScreenId>(initialRoute.screen);
  const [activeTransactionId, setActiveTransactionId] = useState<string>(
    initialRoute.transactionId ?? DEFAULT_TRANSACTION_ID
  );
  const [authenticated, setAuthenticated] = useState<boolean>(isAuthenticated('broker'));
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(isAuthenticated('admin'));
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'all' | 'unread'>('all');
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [apiNotifications, setApiNotifications] = useState<ApiNotificationFeedItem[]>([]);
  const [apiNotificationsEnabled, setApiNotificationsEnabled] = useState(false);
  const [billingOverview, setBillingOverview] = useState<ApiBillingOverview | null>(null);
  const [currentUser, setCurrentUser] = useState<ApiCurrentUser | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === 'dark' ? 'dark' : 'light';
  });
  const useApiNotifications = backendConnected === true && apiNotificationsEnabled;

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const hasValidTransactionId = isUuid(activeTransactionId);
  const isAdminPath = currentPath === '/admin' || currentPath === '/admin/' || currentPath === '/admin/login';
  const isLandingPath = currentPath === '/';
  const isBrokerLoginPath = currentPath === '/login';
  const isBrokerRegisterPath = currentPath === '/register';
  const activeRole = currentPath.startsWith('/client/') || currentPath.startsWith('/seller/')
    ? 'client'
    : currentPath.startsWith('/member/')
      ? 'member'
      : currentPath.startsWith('/buyer-indication/')
        || currentPath.startsWith('/seller-listing-assignment/')
        ? 'public'
      : 'broker';
  const brokerSessionRequired = activeRole === 'broker' && !isLandingPath;
  const adminSessionRequired = isAdminPath;
  const integrationsEnabled = billingOverview ? billingOverview.integrationsEnabled : false;
  const isIntegrationsScreen = activeView === 'broker-lead-sources' || activeView === 'public-calculator';

  const navigatePath = useCallback((nextPath: string, replace = false) => {
    const normalizedPath = nextPath.toLowerCase();
    if (window.location.pathname !== nextPath) {
      if (replace) {
        window.history.replaceState({}, '', nextPath);
      } else {
        window.history.pushState({}, '', nextPath);
      }
    }
    setCurrentPath(normalizedPath);
  }, []);

  const loadNotificationFeed = useCallback(async () => {
    try {
      const feed = await listNotificationFeed();
      setApiNotifications(feed);
      setApiNotificationsEnabled(true);
    } catch {
      setApiNotificationsEnabled(false);
    }
  }, []);

  const loadBillingOverview = useCallback(async () => {
    try {
      const overview = await getBillingOverview();
      setBillingOverview(overview);
    } catch {
      setBillingOverview(null);
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setCurrentUser(me.authenticated ? me : null);
    } catch {
      setCurrentUser(null);
    }
  }, []);

  const navigateTo = useCallback(
    (screen: BrokerScreenId, transactionId?: string) => {
      const nextTransactionId = transactionId ?? activeTransactionId;
      setActiveView(screen);
      if (transactionId) {
        setActiveTransactionId(transactionId);
      }

      const nextPath = pathForScreen(screen, nextTransactionId);
      navigatePath(nextPath);
    },
    [activeTransactionId, navigatePath]
  );

  useEffect(() => {
    if (adminSessionRequired) {
      return;
    }
    if (!brokerSessionRequired) {
      return;
    }
    if (!authenticated) {
      setBackendConnected(null);
      return;
    }
    ensureAuthenticated('broker')
      .then(() => setBackendConnected(true))
      .catch(() => setBackendConnected(false));
  }, [authenticated, brokerSessionRequired, adminSessionRequired]);

  useEffect(() => {
    if (!adminSessionRequired) {
      return;
    }
    if (!adminAuthenticated) {
      setBackendConnected(null);
      return;
    }
    ensureAuthenticated('admin')
      .then(() => setBackendConnected(true))
      .catch(() => setBackendConnected(false));
  }, [adminAuthenticated, adminSessionRequired]);

  useEffect(() => {
    if (!backendConnected || !authenticated || !brokerSessionRequired) return;
    if (isUuid(activeTransactionId)) return;
    listDeals()
      .then(async (deals) => {
        if (deals.length > 0) {
          const ordered = [
            ...deals.filter((deal) => deal.status === 'SETTLEMENT_PHASE'),
            ...deals.filter((deal) => deal.status === 'PROCESS_PHASE'),
            ...deals.filter((deal) => deal.status === 'DOCUMENTS_PHASE'),
            ...deals.filter(
              (deal) => deal.status !== 'SETTLEMENT_PHASE' && deal.status !== 'PROCESS_PHASE' && deal.status !== 'DOCUMENTS_PHASE'
            ),
          ];

          for (const deal of ordered) {
            try {
              const stages = await listDealStages(deal.id);
              if (stages.length > 0) {
                setActiveTransactionId(deal.id);
                if (activeView === 'broker-transaction-detail') {
                  window.history.replaceState({}, '', pathForScreen('broker-transaction-detail', deal.id));
                }
                return;
              }
            } catch {
              // Try next deal candidate.
            }
          }

          setActiveTransactionId(ordered[0].id);
          if (activeView === 'broker-transaction-detail') {
            window.history.replaceState({}, '', pathForScreen('broker-transaction-detail', ordered[0].id));
          }
        }
      })
      .catch(() => {
        // Keep existing id if deals cannot be loaded.
      });
  }, [backendConnected, activeTransactionId, authenticated, brokerSessionRequired]);

  useEffect(() => {
    if (!backendConnected || !authenticated || !brokerSessionRequired) return;
    if (activeView !== 'broker-transaction-detail') return;
    if (!isUuid(activeTransactionId)) return;

    getDeal(activeTransactionId)
      .catch(async () => {
        const deals = await listDeals();
        if (deals.length === 0) return;
        const fallbackId = deals[0].id;
        setActiveTransactionId(fallbackId);
        window.history.replaceState({}, '', pathForScreen('broker-transaction-detail', fallbackId));
      })
      .catch(() => {
        // Keep current state when fallback cannot be determined.
      });
  }, [backendConnected, authenticated, brokerSessionRequired, activeView, activeTransactionId]);

  useEffect(() => {
    if (!backendConnected || !authenticated || !brokerSessionRequired) return;
    loadNotificationFeed().catch(() => setApiNotificationsEnabled(false));
  }, [backendConnected, loadNotificationFeed, authenticated, brokerSessionRequired]);

  useEffect(() => {
    if (!backendConnected || !authenticated || !brokerSessionRequired) {
      setBillingOverview(null);
      return;
    }
    void loadBillingOverview();
  }, [backendConnected, authenticated, brokerSessionRequired, loadBillingOverview]);

  useEffect(() => {
    if (!backendConnected || !authenticated || !brokerSessionRequired) {
      setCurrentUser(null);
      return;
    }
    void loadCurrentUser();
  }, [backendConnected, authenticated, brokerSessionRequired, loadCurrentUser]);

  useEffect(() => {
    if (!notificationsOpen || !useApiNotifications) return;
    loadNotificationFeed().catch(() => setApiNotificationsEnabled(false));
  }, [notificationsOpen, useApiNotifications, loadNotificationFeed]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (adminSessionRequired) {
      return;
    }
    if (brokerSessionRequired && authenticated && isBrokerLoginPath) {
      setActiveView('broker-dashboard');
      navigatePath('/dashboard', true);
    }
  }, [authenticated, brokerSessionRequired, isBrokerLoginPath, adminSessionRequired, navigatePath]);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname.toLowerCase();
      setCurrentPath(nextPath);
      const resolved = resolveScreenFromPath(nextPath);
      setActiveView(resolved.screen);
      if (resolved.transactionId) {
        setActiveTransactionId(resolved.transactionId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleDealClick = (deal: Deal) => {
    setActiveTransactionId(deal.id);
    navigateTo('broker-transaction-detail', deal.id);
  };

  const handleBackToDashboard = () => {
    navigateTo('broker-dashboard');
  };

  const handleOpenSettings = () => {
    navigateTo('broker-settings');
  };

  const handleLogout = () => {
    clearStoredToken('broker');
    setAuthenticated(false);
    setActiveView('broker-dashboard');
    setNotificationsOpen(false);
    navigatePath('/login');
  };

  const handleAdminLogout = () => {
    clearStoredToken('admin');
    setAdminAuthenticated(false);
    navigatePath('/admin/login');
  };

  const uiNotifications = useMemo(
    () =>
      useApiNotifications
        ? apiNotifications.map((n) => ({
            id: n.id,
            type: n.type,
            message: n.message,
            timestamp: new Date(n.sentAt).toLocaleString('el-GR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }),
            read: Boolean(n.readAt),
          }))
        : notifications,
    [useApiNotifications, apiNotifications, notifications]
  );

  const unreadCount = uiNotifications.filter((n) => !n.read).length;
  const visibleNotifications =
    notificationTab === 'unread' ? uiNotifications.filter((n) => !n.read) : uiNotifications;
  const sidebarProfileName = currentUser?.name?.trim() || currentUser?.email?.trim() || 'Broker Account';
  const sidebarProfileSubtitle = currentUser?.company?.trim() || 'Broker workspace';

  const notificationIcon = (type: string) => {
    if (type === 'overdue') return <AlertTriangle size={16} className="text-[var(--status-danger-text)]" />;
    if (type === 'completed') return <CheckCircle2 size={16} className="text-[var(--status-success-text)]" />;
    if (type === 'reminder') return <Bell size={16} className="text-[var(--status-warning-text)]" />;
    if (type === 'document') return <FileText size={16} className="text-[var(--status-info-text)]" />;
    return <ArrowRight size={16} className="text-[var(--text-link)]" />;
  };

  const toastIcon = () => {
    if (!toastMessage) return null;
    if (toastMessage.variant === 'success') return <CheckCircle2 size={16} />;
    if (toastMessage.variant === 'error') return <XCircle size={16} />;
    if (toastMessage.variant === 'warning') return <AlertTriangle size={16} />;
    return <Info size={16} />;
  };

  const handleMarkAllNotificationsRead = async () => {
    if (useApiNotifications) {
      try {
        await markNotificationFeedReadAll();
        setApiNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      } catch {
        markAllNotificationsRead();
      }
      return;
    }

    markAllNotificationsRead();
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => clearToast(), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  if (adminSessionRequired && !adminAuthenticated) {
    return (
      <LoginPage
        theme={theme}
        mode="admin"
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
        onLogin={loginAdmin}
        onLoginSuccess={() => {
          setAdminAuthenticated(true);
          navigatePath('/admin');
        }}
      />
    );
  }

  if (adminSessionRequired && adminAuthenticated) {
    return (
      <AdminDashboardPage
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
        onLogout={handleAdminLogout}
      />
    );
  }

  if (isLandingPath) {
    return <LandingPage />;
  }

  if (brokerSessionRequired && isBrokerRegisterPath && !authenticated) {
    return (
      <BrokerOnboardingPage
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
        onNavigateLogin={() => {
          navigatePath('/login');
        }}
      />
    );
  }

  if (brokerSessionRequired && isBrokerLoginPath) {
    return (
      <LoginPage
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
        onLogin={login}
        onNavigateRegister={() => navigatePath('/register')}
        onLoginSuccess={() => {
          setAuthenticated(true);
          setActiveView('broker-dashboard');
          navigatePath('/dashboard');
        }}
      />
    );
  }

  if (brokerSessionRequired && !authenticated) {
    return (
      <LoginPage
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
        onLogin={login}
        onNavigateRegister={() => navigatePath('/register')}
        onLoginSuccess={() => {
          setAuthenticated(true);
          setActiveView('broker-dashboard');
          navigatePath('/dashboard');
        }}
      />
    );
  }

  return (
    <div className="davlos-app davlos-theme-transition min-h-screen bg-[var(--page-bg)]">
      {activeRole === 'broker' && (
        <Sidebar
          activeItem={activeView}
          onNavigate={(screen) => navigateTo(screen)}
          onOpenSettings={handleOpenSettings}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
          onOpenNotifications={() => setNotificationsOpen(true)}
          unreadCount={unreadCount}
          notificationsOpen={notificationsOpen}
          integrationsEnabled={integrationsEnabled}
          profileName={sidebarProfileName}
          profileSubtitle={sidebarProfileSubtitle}
        />
      )}

      <div
        className={`min-w-0 overflow-x-hidden overflow-y-visible ${activeRole === 'broker' ? 'ml-64' : 'w-full'}`}
        style={activeRole === 'broker' ? { width: 'calc(100% - 16rem)' } : undefined}
      >
        {activeRole !== 'broker' && activeRole !== 'public' && (
          <div className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-2 text-sm text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateTo('broker-dashboard')}
                className="font-medium text-[var(--brand-primary)] hover:underline"
              >
                ← Επιστροφή στο Broker View
              </button>
            </div>
          </div>
        )}

        {activeRole === 'broker' && activeView === 'broker-dashboard' && (
          <BrokerDashboardPage onDealClick={handleDealClick} />
        )}
        {activeRole === 'broker' && activeView === 'broker-member-task-view' && <BrokerMemberTaskViewPage />}
        {activeRole === 'broker' && activeView === 'broker-listings' && <MyListingsPage />}
        {activeRole === 'broker' && activeView === 'broker-orders' && <BrokerOrdersPage />}
        {activeRole === 'broker' && activeView === 'broker-leads-matching' && <LeadsMatchingPage />}
        {activeRole === 'broker' && activeView === 'broker-lead-sources' && integrationsEnabled && <LeadSourcesPage />}
        {activeRole === 'broker' && activeView === 'broker-transaction-detail' && hasValidTransactionId && (
          <BrokerTransactionDetailPage
            transactionId={activeTransactionId}
            onBack={handleBackToDashboard}
          />
        )}

        {activeRole === 'broker' && activeView === 'broker-transaction-detail' && !hasValidTransactionId && (
          <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
            Φόρτωση συναλλαγής...
          </div>
        )}
        {activeRole === 'broker' && activeView === 'broker-template-builder' && <BrokerTemplateBuilderPage />}
        {activeRole === 'broker' && activeView === 'broker-member-teams' && <BrokerMemberTeamsPage />}
        {activeRole === 'broker' && activeView === 'broker-settings' && <BrokerSettingsPage />}
        {activeRole === 'broker' && activeView === 'broker-document-review' && hasValidTransactionId && (
          <TransactionDocumentsPage transactionId={activeTransactionId} />
        )}

        {activeRole === 'broker' && activeView === 'broker-document-review' && !hasValidTransactionId && (
          <div className="flex min-h-screen items-center justify-center text-sm text-gray-600">
            Φόρτωση συναλλαγής...
          </div>
        )}
        {activeRole === 'broker' && activeView === 'broker-client-portal' && <BrokerClientPortalPage />}
        {activeRole === 'broker' && activeView === 'public-calculator' && integrationsEnabled && <CostCalculatorPage />}
        {activeRole === 'broker' && isIntegrationsScreen && !integrationsEnabled && (
          <div className="m-8 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-6 text-[var(--status-warning-text)]">
            <p className="text-base font-semibold">Αυτή η λειτουργία ανήκει στο Integrations plan.</p>
            <p className="mt-2 text-sm">
              Οι `Πηγές Leads` και ο `Υπολογισμός Κόστους` με live integration δεδομένα παραμένουν Coming soon στο initial launch και δεν ανοίγουν ακόμη commercial upgrade path.
            </p>
          </div>
        )}

        {activeRole === 'client' && <BrokerClientPortalPage />}
        {activeRole === 'member' && <MemberPortalPage />}
        {activeRole === 'public' && currentPath.startsWith('/seller-listing-assignment/')
          && <SellerListingAssignmentPublicPage />}
        {activeRole === 'public' && currentPath.startsWith('/buyer-indication/')
          && <BuyerIndicationPublicPage />}
      </div>

      {toastMessage && (
        <div
          className={`fixed bottom-20 left-1/2 z-[120] flex min-w-[220px] -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2 text-sm shadow-lg ${
            toastMessage.variant === 'success'
              ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
              : toastMessage.variant === 'error'
                ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                : toastMessage.variant === 'warning'
                  ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                  : 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]'
          }`}
        >
          <span className="shrink-0">{toastIcon()}</span>
          <span>{toastMessage.message}</span>
        </div>
      )}

      {notificationsOpen && (
        <div className="fixed inset-0 z-40">
          <button className="absolute inset-0 bg-black/20" onClick={() => setNotificationsOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-96 flex-col border-l border-[var(--border-default)] bg-[var(--surface-glow)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ειδοποιήσεις</h3>
              <button onClick={handleMarkAllNotificationsRead} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
                Σήμανση Όλων ως Αναγνωσμένα
              </button>
            </div>
            <div className="inline-flex gap-2 border-b border-[var(--border-default)] px-4 py-3">
              <button
                onClick={() => setNotificationTab('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${notificationTab === 'all' ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)]' : 'bg-[var(--surface-highlight)] text-[var(--text-secondary)]'}`}
              >
                Όλες
              </button>
              <button
                onClick={() => setNotificationTab('unread')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${notificationTab === 'unread' ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)]' : 'bg-[var(--surface-highlight)] text-[var(--text-secondary)]'}`}
              >
                Μη Αναγνωσμένες
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {visibleNotifications.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-[var(--surface-highlight)]" />
                    <p className="text-sm text-[var(--text-secondary)]">Δεν υπάρχουν ειδοποιήσεις</p>
                  </div>
                </div>
              ) : (
                visibleNotifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                    <div className="mt-0.5">{notificationIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)]">{n.message}</p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">{n.timestamp}</p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--brand-primary)]" />}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <UiStoreProvider>
      <AppShell />
    </UiStoreProvider>
  );
}
