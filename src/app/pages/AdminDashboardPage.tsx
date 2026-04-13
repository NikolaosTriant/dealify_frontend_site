import { useEffect, useState } from 'react';
import { BarChart3, LogOut, RefreshCw, Shield, Sun, Moon } from 'lucide-react';
import {
  ApiAdminBrokerSubscription,
  ApiAdminBillingDashboard,
  ApiAdminIntegrationDiagnostics,
  ApiAdminSubscriptionEntitlementOverridePayload,
  ApiAdminSubscriptionGracePayload,
  ApiAdminSubscriptionPeriodExtensionPayload,
  ApiAdminSubscriptionSearchResponse,
  ApiBillingCoupon,
  ApiBillingCouponCreatePayload,
  ApiBillingPlan,
  ApiBillingPlanRetirementPayload,
  ApiBillingPlanScheduleUpdatePayload,
  ApiBillingPlanUpsertPayload,
  ApiUnlimitedSafetySettings,
  extendAdminSubscriptionPeriod,
  createBillingCoupon,
  createBillingPlan,
  getAdminBillingDashboard,
  getAdminIntegrationDiagnostics,
  grantAdminSubscriptionGrace,
  listBillingCoupons,
  revokeAdminEntitlementOverride,
  scheduleBillingPlanRetirement,
  scheduleBillingPlanUpdate,
  searchAdminSubscriptions,
  upsertAdminEntitlementOverride,
  updateUnlimitedSafetySettings,
} from '../api/trustlayerApi';
import { DavlosLogo } from '../components/DavlosLogo';
import { useUiStore } from '../state/uiStore';

type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
};

function planFormFromPlan(plan?: ApiBillingPlan): ApiBillingPlanUpsertPayload {
  return {
    code: plan?.code ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    sortOrder: plan?.sortOrder ?? 0,
    monthlyPriceCents: plan?.monthlyPriceCents ?? null,
    yearlyPriceCents: plan?.yearlyPriceCents ?? null,
    stripeMonthlyPriceId: plan?.stripeMonthlyPriceId ?? '',
    stripeYearlyPriceId: plan?.stripeYearlyPriceId ?? '',
    integrationsEnabled: plan?.integrationsEnabled ?? false,
    aiEnabled: plan?.aiEnabled ?? false,
    emailMonthlyLimit: plan?.emailMonthlyLimit ?? null,
    smsMonthlyLimit: plan?.smsMonthlyLimit ?? null,
    apiMonthlyLimit: plan?.apiMonthlyLimit ?? null,
    aiMonthlyLimit: plan?.aiMonthlyLimit ?? null,
    trialDays: plan?.trialDays ?? null,
    gracePeriodDays: plan?.gracePeriodDays ?? null,
    graceIntegrationsEnabled: plan?.graceIntegrationsEnabled ?? false,
    graceAiEnabled: plan?.graceAiEnabled ?? false,
    graceEmailEnabled: plan?.graceEmailEnabled ?? true,
    graceSmsEnabled: plan?.graceSmsEnabled ?? true,
    graceApiEnabled: plan?.graceApiEnabled ?? true,
  };
}

function normalizeNumberInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPrice(priceCents?: number | null) {
  if (priceCents == null) {
    return 'Κατόπιν συμφωνίας';
  }
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function safetyFormFromDashboard(settings?: ApiUnlimitedSafetySettings): ApiUnlimitedSafetySettings {
  return {
    enabled: settings?.enabled ?? true,
    apiCallsWindowMinutes: settings?.apiCallsWindowMinutes ?? 5,
    apiCallsPerWindow: settings?.apiCallsPerWindow ?? 5000,
    emailWindowMinutes: settings?.emailWindowMinutes ?? 60,
    emailsPerWindow: settings?.emailsPerWindow ?? 500,
    smsWindowMinutes: settings?.smsWindowMinutes ?? 60,
    smsPerWindow: settings?.smsPerWindow ?? 100,
    aiWindowMinutes: settings?.aiWindowMinutes ?? 60,
    aiRequestsPerWindow: settings?.aiRequestsPerWindow ?? 1000,
    warningThresholdPercent: settings?.warningThresholdPercent ?? 80,
  };
}

export function AdminDashboardPage({ theme, onToggleTheme, onLogout }: Props) {
  const { showToast } = useUiStore();
  const [dashboard, setDashboard] = useState<ApiAdminBillingDashboard | null>(null);
  const [integrationDiagnostics, setIntegrationDiagnostics] = useState<ApiAdminIntegrationDiagnostics | null>(null);
  const [coupons, setCoupons] = useState<ApiBillingCoupon[]>([]);
  const [subscriptionSearch, setSubscriptionSearch] = useState<ApiAdminSubscriptionSearchResponse | null>(null);
  const [subscriptionFilters, setSubscriptionFilters] = useState({
    query: '',
    planCode: '',
    status: '',
    dunningState: '',
  });
  const [periodExtensionAt, setPeriodExtensionAt] = useState<Record<string, string>>({});
  const [graceExtensionAt, setGraceExtensionAt] = useState<Record<string, string>>({});
  const [entitlementOverrideForm, setEntitlementOverrideForm] = useState<
    Record<string, ApiAdminSubscriptionEntitlementOverridePayload>
  >({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [planEditorState, setPlanEditorState] = useState<Record<string, ApiBillingPlanUpsertPayload>>({});
  const [scheduleUpdateAt, setScheduleUpdateAt] = useState<Record<string, string>>({});
  const [scheduleRetirementAt, setScheduleRetirementAt] = useState<Record<string, string>>({});
  const [safetySettingsForm, setSafetySettingsForm] = useState<ApiUnlimitedSafetySettings>(safetyFormFromDashboard());
  const [newPlanForm, setNewPlanForm] = useState<ApiBillingPlanUpsertPayload>(planFormFromPlan());
  const [newCouponForm, setNewCouponForm] = useState<ApiBillingCouponCreatePayload>({
    code: '',
    name: '',
    description: '',
    percentOff: 10,
    applicablePlanCode: null,
    validFrom: null,
    validUntil: null,
    maxRedemptions: null,
  });

  const loadAdminSubscriptions = (filters = subscriptionFilters) => searchAdminSubscriptions(filters);

  const loadDashboard = () => {
    setLoading(true);
    Promise.all([getAdminBillingDashboard(), listBillingCoupons(), loadAdminSubscriptions(), getAdminIntegrationDiagnostics()])
      .then(([response, couponResponse, subscriptionResponse, integrationDiagnosticsResponse]) => {
        setDashboard(response);
        setIntegrationDiagnostics(integrationDiagnosticsResponse);
        setCoupons(couponResponse);
        setSubscriptionSearch(subscriptionResponse);
        setSafetySettingsForm(safetyFormFromDashboard(response.unlimitedSafetySettings));
        setPlanEditorState(
          Object.fromEntries(
            response.plans.map((plan) => [plan.id ?? plan.code, planFormFromPlan(plan)]),
          ),
        );
        setScheduleUpdateAt((prev) => {
          const next = { ...prev };
          response.plans.forEach((plan) => {
            const key = plan.id ?? plan.code;
            if (!(key in next)) {
              next[key] = '';
            }
          });
          return next;
        });
        setScheduleRetirementAt((prev) => {
          const next = { ...prev };
          response.plans.forEach((plan) => {
            const key = plan.id ?? plan.code;
            if (!(key in next)) {
              next[key] = '';
            }
          });
          return next;
        });
        setPeriodExtensionAt((prev) => {
          const next = { ...prev };
          subscriptionResponse.subscriptions.forEach((subscription) => {
            if (!(subscription.subscriptionId in next)) {
              next[subscription.subscriptionId] = '';
            }
          });
          return next;
        });
        setGraceExtensionAt((prev) => {
          const next = { ...prev };
          subscriptionResponse.subscriptions.forEach((subscription) => {
            if (!(subscription.subscriptionId in next)) {
              next[subscription.subscriptionId] = '';
            }
          });
          return next;
        });
        setEntitlementOverrideForm((prev) => {
          const next = { ...prev };
          subscriptionResponse.subscriptions.forEach((subscription) => {
            next[subscription.subscriptionId] = {
              integrationsEnabled: subscription.overrideIntegrationsEnabled ?? null,
              aiEnabled: subscription.overrideAiEnabled ?? null,
              emailEnabled: subscription.overrideEmailEnabled ?? null,
              smsEnabled: subscription.overrideSmsEnabled ?? null,
              apiEnabled: subscription.overrideApiEnabled ?? null,
              validUntil: subscription.entitlementOverrideValidUntil ?? '',
              reason: subscription.entitlementOverrideReason ?? '',
            };
          });
          return next;
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Αποτυχία φόρτωσης admin dashboard';
        showToast(message, 'error');
      })
      .finally(() => setLoading(false));
  };

  const handleSafetySettingChange = (
    field: keyof ApiUnlimitedSafetySettings,
    value: boolean | number,
  ) => {
    setSafetySettingsForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveSafetySettings = async () => {
    setActionLoading('save-safety-settings');
    try {
      await updateUnlimitedSafetySettings(safetySettingsForm);
      showToast('Τα Unlimited fair-use safety settings αποθηκεύτηκαν.', 'success');
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία αποθήκευσης Unlimited safety settings';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubscriptionFilterChange = (field: keyof typeof subscriptionFilters, value: string) => {
    setSubscriptionFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleOverrideFieldChange = (
    subscriptionId: string,
    field: keyof ApiAdminSubscriptionEntitlementOverridePayload,
    value: string | boolean | null,
  ) => {
    setEntitlementOverrideForm((prev) => ({
      ...prev,
      [subscriptionId]: {
        ...prev[subscriptionId],
        [field]: value,
      },
    }));
  };

  const handleExtendPeriod = async (subscription: ApiAdminBrokerSubscription) => {
    const currentPeriodEnd = periodExtensionAt[subscription.subscriptionId];
    if (!currentPeriodEnd) {
      showToast('Βάλε νέα ημερομηνία λήξης περιόδου.', 'warning');
      return;
    }
    setActionLoading(`extend-period:${subscription.subscriptionId}`);
    try {
      const payload: ApiAdminSubscriptionPeriodExtensionPayload = {
        currentPeriodEnd: new Date(currentPeriodEnd).toISOString(),
        reason: 'Manual support extension',
      };
      await extendAdminSubscriptionPeriod(subscription.subscriptionId, payload);
      showToast(`Η περίοδος του ${subscription.userEmail} επεκτάθηκε.`, 'success');
      setPeriodExtensionAt((prev) => ({ ...prev, [subscription.subscriptionId]: '' }));
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία επέκτασης περιόδου';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGrantGrace = async (subscription: ApiAdminBrokerSubscription) => {
    const gracePeriodEndsAt = graceExtensionAt[subscription.subscriptionId];
    if (!gracePeriodEndsAt) {
      showToast('Βάλε λήξη grace period.', 'warning');
      return;
    }
    setActionLoading(`grant-grace:${subscription.subscriptionId}`);
    try {
      const payload: ApiAdminSubscriptionGracePayload = {
        gracePeriodEndsAt: new Date(gracePeriodEndsAt).toISOString(),
        reason: 'Manual support grace',
      };
      await grantAdminSubscriptionGrace(subscription.subscriptionId, payload);
      showToast(`Δόθηκε grace period στον ${subscription.userEmail}.`, 'success');
      setGraceExtensionAt((prev) => ({ ...prev, [subscription.subscriptionId]: '' }));
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία χορήγησης grace';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveOverride = async (subscription: ApiAdminBrokerSubscription) => {
    const draft = entitlementOverrideForm[subscription.subscriptionId];
    if (!draft?.validUntil) {
      showToast('Βάλε λήξη για το προσωρινό entitlement override.', 'warning');
      return;
    }
    setActionLoading(`override:${subscription.subscriptionId}`);
    try {
      await upsertAdminEntitlementOverride(subscription.subscriptionId, {
        ...draft,
        validUntil: new Date(draft.validUntil).toISOString(),
        reason: draft.reason?.trim() || undefined,
      });
      showToast(`Το entitlement override του ${subscription.userEmail} αποθηκεύτηκε.`, 'success');
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία αποθήκευσης entitlement override';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeOverride = async (subscription: ApiAdminBrokerSubscription) => {
    setActionLoading(`revoke-override:${subscription.subscriptionId}`);
    try {
      await revokeAdminEntitlementOverride(subscription.subscriptionId);
      showToast(`Το entitlement override του ${subscription.userEmail} αφαιρέθηκε.`, 'success');
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία αφαίρεσης entitlement override';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handlePlanFieldChange = (
    key: string,
    field: keyof ApiBillingPlanUpsertPayload,
    value: string | boolean | number | null,
  ) => {
    setPlanEditorState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleCreatePlan = async () => {
    setActionLoading('create-plan');
    try {
      await createBillingPlan(newPlanForm);
      showToast(`Το plan ${newPlanForm.name} δημιουργήθηκε.`, 'success');
      setNewPlanForm(planFormFromPlan());
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία δημιουργίας plan';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateCoupon = async () => {
    setActionLoading('create-coupon');
    try {
      await createBillingCoupon({
        ...newCouponForm,
        code: newCouponForm.code.trim(),
        name: newCouponForm.name.trim(),
        description: newCouponForm.description?.trim() || undefined,
        applicablePlanCode: newCouponForm.applicablePlanCode || null,
        validFrom: newCouponForm.validFrom || null,
        validUntil: newCouponForm.validUntil || null,
      });
      showToast(`Το coupon ${newCouponForm.code.trim().toUpperCase()} δημιουργήθηκε.`, 'success');
      setNewCouponForm({
        code: '',
        name: '',
        description: '',
        percentOff: 10,
        applicablePlanCode: null,
        validFrom: null,
        validUntil: null,
        maxRedemptions: null,
      });
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία δημιουργίας coupon';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleScheduleUpdate = async (plan: ApiBillingPlan) => {
    const key = plan.id ?? plan.code;
    const effectiveAt = scheduleUpdateAt[key];
    const draft = planEditorState[key];
    if (!plan.id || !draft || !effectiveAt) {
      showToast('Βάλε ημερομηνία και ώρα για τον προγραμματισμό της αλλαγής.', 'warning');
      return;
    }
    setActionLoading(`schedule-update:${key}`);
    try {
      const payload: ApiBillingPlanScheduleUpdatePayload = {
        ...draft,
        effectiveAt: new Date(effectiveAt).toISOString(),
      };
      await scheduleBillingPlanUpdate(plan.id, payload);
      showToast(`Η αλλαγή του plan ${plan.name} προγραμματίστηκε.`, 'success');
      setScheduleUpdateAt((prev) => ({ ...prev, [key]: '' }));
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία προγραμματισμού αλλαγής plan';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleScheduleRetirement = async (plan: ApiBillingPlan) => {
    const key = plan.id ?? plan.code;
    const effectiveAt = scheduleRetirementAt[key];
    if (!plan.id || !effectiveAt) {
      showToast('Βάλε ημερομηνία και ώρα για την κατάργηση του plan.', 'warning');
      return;
    }
    setActionLoading(`schedule-retire:${key}`);
    try {
      const payload: ApiBillingPlanRetirementPayload = {
        effectiveAt: new Date(effectiveAt).toISOString(),
      };
      await scheduleBillingPlanRetirement(plan.id, payload);
      showToast(`Η κατάργηση του plan ${plan.name} προγραμματίστηκε.`, 'success');
      setScheduleRetirementAt((prev) => ({ ...prev, [key]: '' }));
      loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία προγραμματισμού κατάργησης plan';
      showToast(message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !dashboard) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--surface-ambient)] text-sm text-[var(--text-secondary)]">Φόρτωση admin dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--surface-ambient)]">
      <div className="border-b border-[var(--border-default)] bg-[var(--surface-glow)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-[#E8913A] to-[#D67D2E] p-3 shadow-lg shadow-[#E8913A]/15">
              <DavlosLogo className="h-7 w-7 text-[#1A1A1A]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary-muted)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                <Shield size={12} />
                Admin Console
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Davlos Admin Dashboard</h1>
            </div>
          </div>

          {integrationDiagnostics && (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Integration health</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Current state ανά broker/provider με last sync, webhook activity και repeated failure count.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-highlight)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                    {integrationDiagnostics.connections.length} connections
                  </div>
                </div>
                <div className="space-y-3">
                  {integrationDiagnostics.connections.slice(0, 12).map((connection) => (
                    <div key={`${connection.userId}-${connection.provider}`} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">{connection.userEmail}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">
                            {connection.userName || 'Unnamed broker'} · {connection.provider}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                          <span className="rounded-full border border-[var(--border-default)] px-2 py-1">{connection.status}</span>
                          <span className="rounded-full border border-[var(--border-default)] px-2 py-1">{connection.health}</span>
                          {connection.consecutiveFailureCount > 0 && (
                            <span className="rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-1 text-[var(--status-warning-text)]">
                              Failures: {connection.consecutiveFailureCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2 xl:grid-cols-4">
                        <div>Connected: {connection.connectedAt ? new Date(connection.connectedAt).toLocaleString('el-GR') : '—'}</div>
                        <div>Credentials: {connection.credentialsUpdatedAt ? new Date(connection.credentialsUpdatedAt).toLocaleString('el-GR') : '—'}</div>
                        <div>Last sync: {connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString('el-GR') : '—'}</div>
                        <div>Last webhook: {connection.lastWebhookAt ? new Date(connection.lastWebhookAt).toLocaleString('el-GR') : '—'}</div>
                        <div>Last error: {connection.lastErrorAt ? new Date(connection.lastErrorAt).toLocaleString('el-GR') : '—'}</div>
                      </div>
                      {connection.lastError && (
                        <div className="mt-3 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-text)]">
                          {connection.lastError}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent integration events</h2>
                <div className="mt-4 space-y-3">
                  {integrationDiagnostics.recentEvents.slice(0, 12).map((event) => (
                    <div key={event.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">{event.provider}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">{event.userEmail || 'System / unmatched'}</div>
                        </div>
                        <div className="text-right text-[11px] text-[var(--text-secondary)]">
                          <div>{event.severity}</div>
                          <div>{new Date(event.createdAt).toLocaleString('el-GR')}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">{event.eventType}</div>
                      <div className="mt-1 text-xs text-[var(--text-primary)]">{event.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] text-[var(--text-tertiary)] shadow-sm transition-colors hover:bg-[var(--surface-glow-hover)] hover:text-[var(--text-primary)]"
            >
              <Moon size={16} className={`absolute transition-all duration-300 ${theme === 'light' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-180'}`} />
              <Sun size={16} className={`absolute transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 rotate-180'}`} />
            </button>
            <button
              onClick={loadDashboard}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-highlight)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]"
            >
              <RefreshCw size={14} />
              Ανανέωση
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm font-semibold text-[var(--status-danger-text)]"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {dashboard && (
        <div className="mx-auto max-w-7xl space-y-6 px-8 py-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              ['Broker users', dashboard.totalBrokerUsers],
              ['Admin users', dashboard.totalAdminUsers],
              ['Plans', dashboard.totalPlans],
              ['Custom plans', dashboard.customPlanCount],
              ['Billing customers', dashboard.billingCustomersLinked],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div>
                <div className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-5 py-4 text-sm text-[var(--status-warning-text)]">
            <div className="font-semibold">Unlimited fair-use protection</div>
            <div className="mt-1">
              Το `Unlimited` δεν μπλοκάρεται από τα κανονικά monthly caps, αλλά προστατεύεται από fixed-window safety throttles για API, email, SMS και AI usage.
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Unlimited safety settings</h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                Global fair-use thresholds για το Unlimited plan. Τα monthly commercial limits παραμένουν ξεχωριστά ανά plan.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4 text-sm text-[var(--text-primary)]">
                <div className="font-medium">Safety throttles enabled</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">Ενεργοποιεί ή απενεργοποιεί το fair-use protection για Unlimited.</div>
                <input
                  type="checkbox"
                  className="mt-3 h-4 w-4 accent-[var(--brand-primary)]"
                  checked={safetySettingsForm.enabled}
                  onChange={(event) => handleSafetySettingChange('enabled', event.target.checked)}
                />
              </label>
              <label className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4 text-sm text-[var(--text-primary)]">
                <div className="font-medium">Warning threshold %</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">Σε ποιο ποσοστό του window γράφουμε προειδοποίηση πριν το block.</div>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={safetySettingsForm.warningThresholdPercent}
                  onChange={(event) => handleSafetySettingChange('warningThresholdPercent', Number(event.target.value) || 1)}
                  className="mt-3 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm"
                />
              </label>
              {[
                ['API calls', 'apiCallsWindowMinutes', 'apiCallsPerWindow'],
                ['Emails', 'emailWindowMinutes', 'emailsPerWindow'],
                ['SMS', 'smsWindowMinutes', 'smsPerWindow'],
                ['AI requests', 'aiWindowMinutes', 'aiRequestsPerWindow'],
              ].map(([label, minutesField, limitField]) => (
                <div key={label} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                  <div className="font-medium text-[var(--text-primary)]">{label}</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-[var(--text-primary)]">
                      <div className="mb-1 text-xs text-[var(--text-tertiary)]">Window minutes</div>
                      <input
                        type="number"
                        min={1}
                        value={safetySettingsForm[minutesField as keyof ApiUnlimitedSafetySettings] as number}
                        onChange={(event) =>
                          handleSafetySettingChange(minutesField as keyof ApiUnlimitedSafetySettings, Number(event.target.value) || 1)
                        }
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm text-[var(--text-primary)]">
                      <div className="mb-1 text-xs text-[var(--text-tertiary)]">Max usage per window</div>
                      <input
                        type="number"
                        min={1}
                        value={safetySettingsForm[limitField as keyof ApiUnlimitedSafetySettings] as number}
                        onChange={(event) =>
                          handleSafetySettingChange(limitField as keyof ApiUnlimitedSafetySettings, Number(event.target.value) || 1)
                        }
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSaveSafetySettings}
                disabled={actionLoading === 'save-safety-settings'}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--brand-on-primary)] disabled:opacity-60"
              >
                {actionLoading === 'save-safety-settings' ? 'Αποθήκευση...' : 'Αποθήκευση safety settings'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent safety events</h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                Πρόσφατα fair-use warnings και temporary blocks από το Unlimited safety layer.
              </p>
            </div>
            {dashboard.recentSafetyEvents.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recentSafetyEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {event.userEmail || event.userId}
                        </div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                          {event.metric} · {new Date(event.createdAt).toLocaleString('el-GR')}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                          event.eventType === 'BLOCKED'
                            ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                            : 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                        }`}
                      >
                        {event.eventType}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-2 xl:grid-cols-4">
                      <div>Threshold: {event.threshold}</div>
                      <div>Observed: {event.observedCount}</div>
                      <div>Window start: {new Date(event.windowStart).toLocaleString('el-GR')}</div>
                      <div>Window end: {new Date(event.windowEnd).toLocaleString('el-GR')}</div>
                    </div>
                    {event.note && (
                      <div className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-highlight)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        {event.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-4 text-sm text-[var(--text-tertiary)]">
                Δεν υπάρχουν ακόμη recorded safety events.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent email deliveries</h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                Outbound transactional email status από το MailerSend delivery lifecycle. Εδώ φαίνονται sent, delivered, bounced και failed states.
              </p>
            </div>
            {dashboard.recentEmailDeliveries.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recentEmailDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{delivery.recipientEmail}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                          {delivery.subject} · {delivery.provider}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                          delivery.status === 'DELIVERED'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : delivery.status === 'FAILED' || delivery.status === 'HARD_BOUNCED' || delivery.status === 'SOFT_BOUNCED'
                              ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                              : 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                        }`}
                      >
                        {delivery.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-2 xl:grid-cols-4">
                      <div>Source: {delivery.source}</div>
                      <div>Event: {delivery.providerEventType || 'n/a'}</div>
                      <div>Sent: {delivery.sentAt ? new Date(delivery.sentAt).toLocaleString('el-GR') : 'n/a'}</div>
                      <div>Last event: {delivery.lastEventAt ? new Date(delivery.lastEventAt).toLocaleString('el-GR') : 'n/a'}</div>
                    </div>
                    {delivery.failureReason && (
                      <div className="mt-3 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-text)]">
                        {delivery.failureReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-4 text-sm text-[var(--text-tertiary)]">
                Δεν υπάρχουν ακόμη recorded outbound email delivery events.
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-[var(--brand-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Subscription overview</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  ['Σύνολο', dashboard.totalSubscriptions],
                  ['Active', dashboard.activeSubscriptions],
                  ['Past due', dashboard.pastDueSubscriptions],
                  ['Canceled', dashboard.canceledSubscriptions],
                  ['Expired', dashboard.expiredSubscriptions],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Plan adoption</h2>
              <div className="mt-4 space-y-3">
                {dashboard.planSummaries.map((summary) => (
                  <div key={summary.code} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{summary.name}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">{summary.code}</div>
                      </div>
                      <div className="text-right text-xs text-[var(--text-secondary)]">
                        <div>Subscribers: {summary.subscriberCount}</div>
                        <div>Active: {summary.activeSubscriberCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Broker subscription operations</h2>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Αναζήτηση broker subscriptions και support actions χωρίς DB edits: period extension, grace και temporary entitlements.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-highlight)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                {subscriptionSearch?.totalCount ?? 0} subscriptions
              </div>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Search</span>
                <input
                  value={subscriptionFilters.query}
                  onChange={(event) => handleSubscriptionFilterChange('query', event.target.value)}
                  placeholder="email, όνομα, εταιρεία"
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Plan</span>
                <select
                  value={subscriptionFilters.planCode}
                  onChange={(event) => handleSubscriptionFilterChange('planCode', event.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="">Όλα</option>
                  {dashboard.plans.map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Status</span>
                <select
                  value={subscriptionFilters.status}
                  onChange={(event) => handleSubscriptionFilterChange('status', event.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="">Όλα</option>
                  {['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Dunning</span>
                <select
                  value={subscriptionFilters.dunningState}
                  onChange={(event) => handleSubscriptionFilterChange('dunningState', event.target.value)}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="">Όλα</option>
                  {['NONE', 'TRIAL_ACTIVE', 'GRACE_ACTIVE', 'GRACE_EXPIRED'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mb-5 flex gap-2">
              <button
                onClick={loadDashboard}
                className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-[var(--brand-on-primary)]"
              >
                Search subscriptions
              </button>
              <button
                onClick={() => {
                  const nextFilters = {
                    query: '',
                    planCode: '',
                    status: '',
                    dunningState: '',
                  };
                  setSubscriptionFilters(nextFilters);
                  setLoading(true);
                  Promise.all([getAdminBillingDashboard(), listBillingCoupons(), loadAdminSubscriptions(nextFilters)])
                    .then(([response, couponResponse, subscriptionResponse]) => {
                      setDashboard(response);
                      setCoupons(couponResponse);
                      setSubscriptionSearch(subscriptionResponse);
                      setSafetySettingsForm(safetyFormFromDashboard(response.unlimitedSafetySettings));
                    })
                    .catch((error) => {
                      const message = error instanceof Error ? error.message : 'Αποτυχία φόρτωσης admin dashboard';
                      showToast(message, 'error');
                    })
                    .finally(() => setLoading(false));
                }}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-highlight)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)]"
              >
                Clear filters
              </button>
            </div>

            {subscriptionSearch && subscriptionSearch.subscriptions.length > 0 ? (
              <div className="space-y-4">
                {subscriptionSearch.subscriptions.map((subscription) => {
                  const overrideDraft = entitlementOverrideForm[subscription.subscriptionId] ?? {
                    integrationsEnabled: subscription.overrideIntegrationsEnabled ?? null,
                    aiEnabled: subscription.overrideAiEnabled ?? null,
                    emailEnabled: subscription.overrideEmailEnabled ?? null,
                    smsEnabled: subscription.overrideSmsEnabled ?? null,
                    apiEnabled: subscription.overrideApiEnabled ?? null,
                    validUntil: subscription.entitlementOverrideValidUntil ?? '',
                    reason: subscription.entitlementOverrideReason ?? '',
                  };
                  return (
                    <div key={subscription.subscriptionId} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">{subscription.userEmail}</div>
                          <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                            {subscription.userName || 'Unnamed broker'}
                            {subscription.company ? ` · ${subscription.company}` : ''}
                            {subscription.phone ? ` · ${subscription.phone}` : ''}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                            <span className="rounded-full border border-[var(--border-default)] px-2 py-1">{subscription.planName || subscription.planCode}</span>
                            <span className="rounded-full border border-[var(--border-default)] px-2 py-1">{subscription.subscriptionStatus}</span>
                            {subscription.dunningState && (
                              <span className="rounded-full border border-[var(--border-default)] px-2 py-1">{subscription.dunningState}</span>
                            )}
                            {subscription.entitlementOverrideActive && (
                              <span className="rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2 py-1 text-[var(--status-info-text)]">
                                Override active
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-[var(--text-secondary)]">
                          <div>Period end: {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleString('el-GR') : 'N/A'}</div>
                          <div>Grace end: {subscription.gracePeriodEndsAt ? new Date(subscription.gracePeriodEndsAt).toLocaleString('el-GR') : 'N/A'}</div>
                          <div>Provider: {subscription.provider || 'LOCAL/none'}</div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-3">
                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">Support extension</div>
                          <div className="mt-3 flex gap-2">
                            <input
                              type="datetime-local"
                              value={periodExtensionAt[subscription.subscriptionId] ?? ''}
                              onChange={(event) => setPeriodExtensionAt((prev) => ({ ...prev, [subscription.subscriptionId]: event.target.value }))}
                              className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                            <button
                              onClick={() => handleExtendPeriod(subscription)}
                              disabled={actionLoading === `extend-period:${subscription.subscriptionId}`}
                              className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-[var(--brand-on-primary)] disabled:opacity-60"
                            >
                              Extend
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">Manual grace</div>
                          <div className="mt-3 flex gap-2">
                            <input
                              type="datetime-local"
                              value={graceExtensionAt[subscription.subscriptionId] ?? ''}
                              onChange={(event) => setGraceExtensionAt((prev) => ({ ...prev, [subscription.subscriptionId]: event.target.value }))}
                              className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                            <button
                              onClick={() => handleGrantGrace(subscription)}
                              disabled={actionLoading === `grant-grace:${subscription.subscriptionId}`}
                              className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-sm font-semibold text-[var(--status-warning-text)] disabled:opacity-60"
                            >
                              Grant grace
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">Temporary entitlements</div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[
                              ['Integrations', 'integrationsEnabled'],
                              ['AI', 'aiEnabled'],
                              ['Email', 'emailEnabled'],
                              ['SMS', 'smsEnabled'],
                              ['API', 'apiEnabled'],
                            ].map(([label, field]) => (
                              <label key={field} className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                                <span>{label}</span>
                                <select
                                  value={overrideDraft[field as keyof ApiAdminSubscriptionEntitlementOverridePayload] == null
                                    ? 'inherit'
                                    : String(overrideDraft[field as keyof ApiAdminSubscriptionEntitlementOverridePayload])}
                                  onChange={(event) =>
                                    handleOverrideFieldChange(
                                      subscription.subscriptionId,
                                      field as keyof ApiAdminSubscriptionEntitlementOverridePayload,
                                      event.target.value === 'inherit' ? null : event.target.value === 'true',
                                    )
                                  }
                                  className="rounded-md border border-[var(--border-default)] bg-[var(--input-bg)] px-2 py-1 text-xs text-[var(--text-primary)]"
                                >
                                  <option value="inherit">inherit</option>
                                  <option value="true">grant</option>
                                  <option value="false">revoke</option>
                                </select>
                              </label>
                            ))}
                          </div>
                          <div className="mt-3 grid gap-2">
                            <input
                              type="datetime-local"
                              value={overrideDraft.validUntil ? toDateTimeLocalValue(overrideDraft.validUntil) : ''}
                              onChange={(event) => handleOverrideFieldChange(subscription.subscriptionId, 'validUntil', event.target.value)}
                              className="rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                            <input
                              value={overrideDraft.reason ?? ''}
                              onChange={(event) => handleOverrideFieldChange(subscription.subscriptionId, 'reason', event.target.value)}
                              placeholder="Reason / ticket / note"
                              className="rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveOverride(subscription)}
                                disabled={actionLoading === `override:${subscription.subscriptionId}`}
                                className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-[var(--brand-on-primary)] disabled:opacity-60"
                              >
                                Save override
                              </button>
                              <button
                                onClick={() => handleRevokeOverride(subscription)}
                                disabled={actionLoading === `revoke-override:${subscription.subscriptionId}`}
                                className="rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm font-semibold text-[var(--status-danger-text)] disabled:opacity-60"
                              >
                                Revoke override
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-4 text-sm text-[var(--text-tertiary)]">
                Δεν βρέθηκαν subscriptions για τα τρέχοντα φίλτρα.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Plan catalog</h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                Οι αλλαγές σε υπάρχοντα plans εφαρμόζονται μόνο με προγραμματισμό για μελλοντική ημερομηνία. Δεν υποστηρίζεται άμεση μεταβολή ή άμεση κατάργηση από το UI.
              </p>
            </div>

            <div className="space-y-4">
              {dashboard.plans.map((plan) => {
                const key = plan.id ?? plan.code;
                const draft = planEditorState[key] ?? planFormFromPlan(plan);
                return (
                  <div key={key} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{plan.name}</h3>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          Code: {plan.code} · {formatPrice(plan.monthlyPriceCents)} / μήνα · {plan.active ? 'Ενεργό' : 'Ανενεργό'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-highlight)] px-3 py-2 text-[11px] font-medium text-[var(--text-secondary)]">
                        Μόνο προγραμματισμένες αλλαγές
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Code</span>
                        <input value={draft.code} disabled className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-highlight)] px-3 py-2 text-xs text-[var(--text-primary)] opacity-70" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Όνομα</span>
                        <input value={draft.name} onChange={(event) => handlePlanFieldChange(key, 'name', event.target.value)} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Sort order</span>
                        <input value={draft.sortOrder} onChange={(event) => handlePlanFieldChange(key, 'sortOrder', Number(event.target.value) || 0)} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Μηνιαία τιμή (cents)</span>
                        <input value={draft.monthlyPriceCents ?? ''} onChange={(event) => handlePlanFieldChange(key, 'monthlyPriceCents', normalizeNumberInput(event.target.value))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)] md:col-span-2">
                        <span className="mb-1 block font-semibold">Περιγραφή</span>
                        <input value={draft.description ?? ''} onChange={(event) => handlePlanFieldChange(key, 'description', event.target.value)} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Ετήσια τιμή (cents)</span>
                        <input value={draft.yearlyPriceCents ?? ''} onChange={(event) => handlePlanFieldChange(key, 'yearlyPriceCents', normalizeNumberInput(event.target.value))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Stripe monthly price ID</span>
                        <input value={draft.stripeMonthlyPriceId ?? ''} onChange={(event) => handlePlanFieldChange(key, 'stripeMonthlyPriceId', event.target.value)} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Stripe yearly price ID</span>
                        <input value={draft.stripeYearlyPriceId ?? ''} onChange={(event) => handlePlanFieldChange(key, 'stripeYearlyPriceId', event.target.value)} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Emails / μήνα</span>
                        <input value={draft.emailMonthlyLimit ?? ''} onChange={(event) => handlePlanFieldChange(key, 'emailMonthlyLimit', normalizeNumberInput(event.target.value))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">SMS / μήνα</span>
                        <input value={draft.smsMonthlyLimit ?? ''} onChange={(event) => handlePlanFieldChange(key, 'smsMonthlyLimit', normalizeNumberInput(event.target.value))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">API calls / μήνα</span>
                        <input value={draft.apiMonthlyLimit ?? ''} onChange={(event) => handlePlanFieldChange(key, 'apiMonthlyLimit', normalizeNumberInput(event.target.value))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">AI requests / μήνα</span>
                        <input value={draft.aiMonthlyLimit ?? ''} onChange={(event) => handlePlanFieldChange(key, 'aiMonthlyLimit', normalizeNumberInput(event.target.value))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Trial days</span>
                        <input value={draft.trialDays ?? ''} onChange={(event) => handlePlanFieldChange(key, 'trialDays', normalizeNumberInput(event.target.value))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Grace period days</span>
                        <input value={draft.gracePeriodDays ?? ''} onChange={(event) => handlePlanFieldChange(key, 'gracePeriodDays', normalizeNumberInput(event.target.value))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={draft.integrationsEnabled} onChange={(event) => handlePlanFieldChange(key, 'integrationsEnabled', event.target.checked)} />
                        Integrations enabled
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={draft.aiEnabled} onChange={(event) => handlePlanFieldChange(key, 'aiEnabled', event.target.checked)} />
                        AI enabled
                      </label>
                    </div>

                    <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                      <div className="text-xs font-semibold text-[var(--text-primary)]">Grace-period access rules</div>
                      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                        Όρισε τι μένει διαθέσιμο όταν μια συνδρομή πέσει σε `past_due` και βρίσκεται ακόμη μέσα στο grace window.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={draft.graceIntegrationsEnabled} onChange={(event) => handlePlanFieldChange(key, 'graceIntegrationsEnabled', event.target.checked)} />
                          Integrations during grace
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={draft.graceAiEnabled} onChange={(event) => handlePlanFieldChange(key, 'graceAiEnabled', event.target.checked)} />
                          AI during grace
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={draft.graceEmailEnabled} onChange={(event) => handlePlanFieldChange(key, 'graceEmailEnabled', event.target.checked)} />
                          Emails during grace
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={draft.graceSmsEnabled} onChange={(event) => handlePlanFieldChange(key, 'graceSmsEnabled', event.target.checked)} />
                          SMS during grace
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={draft.graceApiEnabled} onChange={(event) => handlePlanFieldChange(key, 'graceApiEnabled', event.target.checked)} />
                          API during grace
                        </label>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[var(--text-primary)]">Μελλοντική έναρξη αλλαγών</div>
                        <input
                          type="datetime-local"
                          value={scheduleUpdateAt[key] ?? ''}
                          onChange={(event) => setScheduleUpdateAt((prev) => ({ ...prev, [key]: event.target.value }))}
                          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        />
                        <button
                          type="button"
                          disabled={actionLoading !== null}
                          onClick={() => handleScheduleUpdate(plan)}
                          className="rounded-lg border border-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-[var(--brand-primary)] disabled:opacity-60"
                        >
                          {actionLoading === `schedule-update:${key}` ? 'Προγραμματισμός...' : 'Προγραμματισμός αλλαγών'}
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[var(--text-primary)]">Μελλοντική κατάργηση πλάνου</div>
                        <input
                          type="datetime-local"
                          value={scheduleRetirementAt[key] ?? ''}
                          onChange={(event) => setScheduleRetirementAt((prev) => ({ ...prev, [key]: event.target.value }))}
                          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        />
                        <button
                          type="button"
                          disabled={actionLoading !== null || !plan.active}
                          onClick={() => handleScheduleRetirement(plan)}
                          className="rounded-lg border border-[var(--status-warning-border)] px-3 py-2 text-xs font-semibold text-[var(--status-warning-text)] disabled:opacity-60"
                        >
                          {actionLoading === `schedule-retire:${key}` ? 'Προγραμματισμός...' : 'Προγραμματισμός κατάργησης'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-[11px] text-[var(--status-warning-text)]">
                      Οι τιμές και τα όρια που αλλάζεις εδώ δεν αποθηκεύονται άμεσα. Χρησιμοποίησε τον προγραμματισμό αλλαγών ή τον προγραμματισμό κατάργησης πιο κάτω.
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {dashboard.scheduledChanges.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Προγραμματισμένες αλλαγές πλάνων</h2>
                <p className="text-sm text-[var(--text-tertiary)]">Οι pending αλλαγές θα εφαρμοστούν αυτόματα στην αντίστοιχη ημερομηνία και ώρα.</p>
              </div>
              <div className="space-y-3">
                {dashboard.scheduledChanges.map((change) => (
                  <div key={change.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[var(--text-primary)]">{change.planName} · {change.action}</div>
                        <div className="text-xs text-[var(--text-tertiary)]">
                          Έναρξη: {toDateTimeLocalValue(change.effectiveAt).replace('T', ' ')}
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-[var(--text-secondary)]">{change.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Coupons & discounts</h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                Issue percentage discounts per plan or globally. Τα coupons εφαρμόζονται μόνο στα checkout flows.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Code</span>
                <input
                  value={newCouponForm.code}
                  onChange={(event) => setNewCouponForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Όνομα</span>
                <input
                  value={newCouponForm.name}
                  onChange={(event) => setNewCouponForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">% έκπτωση</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newCouponForm.percentOff}
                  onChange={(event) => setNewCouponForm((prev) => ({ ...prev, percentOff: Number(event.target.value) || 0 }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Plan</span>
                <select
                  value={newCouponForm.applicablePlanCode ?? ''}
                  onChange={(event) => setNewCouponForm((prev) => ({ ...prev, applicablePlanCode: event.target.value || null }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                >
                  <option value="">Όλα τα plans</option>
                  {dashboard.plans.map((plan) => (
                    <option key={plan.code} value={plan.code}>{plan.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--text-secondary)] md:col-span-2">
                <span className="mb-1 block font-semibold">Περιγραφή</span>
                <input
                  value={newCouponForm.description ?? ''}
                  onChange={(event) => setNewCouponForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Valid from</span>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(newCouponForm.validFrom)}
                  onChange={(event) => setNewCouponForm((prev) => ({ ...prev, validFrom: event.target.value ? new Date(event.target.value).toISOString() : null }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Valid until</span>
                <input
                  type="datetime-local"
                  value={toDateTimeLocalValue(newCouponForm.validUntil)}
                  onChange={(event) => setNewCouponForm((prev) => ({ ...prev, validUntil: event.target.value ? new Date(event.target.value).toISOString() : null }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Max redemptions</span>
                <input
                  type="number"
                  min={0}
                  value={newCouponForm.maxRedemptions ?? ''}
                  onChange={(event) => setNewCouponForm((prev) => ({ ...prev, maxRedemptions: normalizeNumberInput(event.target.value) }))}
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() => void handleCreateCoupon()}
                className="rounded-lg border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
              >
                {actionLoading === 'create-coupon' ? 'Δημιουργία...' : 'Issue coupon'}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {coupons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-5 text-sm text-[var(--text-tertiary)]">
                  Δεν έχουν εκδοθεί coupons ακόμη.
                </div>
              ) : (
                coupons.map((coupon) => (
                  <div key={coupon.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">{coupon.code}</div>
                          <span className="rounded-full bg-[var(--brand-primary-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-primary)]">
                            {coupon.percentOff}% off
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">{coupon.name}</div>
                        {coupon.description && (
                          <div className="mt-1 text-xs text-[var(--text-tertiary)]">{coupon.description}</div>
                        )}
                      </div>
                      <div className="text-right text-xs text-[var(--text-tertiary)]">
                        <div>{coupon.applicablePlanCode ? `Plan: ${coupon.applicablePlanCode}` : 'Όλα τα plans'}</div>
                        <div>Redeemed: {coupon.redemptionCount}{coupon.maxRedemptions != null ? ` / ${coupon.maxRedemptions}` : ''}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--text-tertiary)]">
                      <span>From: {coupon.validFrom ? toDateTimeLocalValue(coupon.validFrom).replace('T', ' ') : 'Άμεσα'}</span>
                      <span>Until: {coupon.validUntil ? toDateTimeLocalValue(coupon.validUntil).replace('T', ' ') : 'Χωρίς λήξη'}</span>
                      <span>{coupon.active ? 'Ενεργό' : 'Ανενεργό'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Νέο custom plan</h2>
              <p className="text-sm text-[var(--text-tertiary)]">Δημιούργησε νέο plan χωρίς code αλλαγή.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Code</span>
                <input value={newPlanForm.code} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, code: event.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Όνομα</span>
                <input value={newPlanForm.name} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Sort order</span>
                <input value={newPlanForm.sortOrder} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Μηνιαία τιμή (cents)</span>
                <input value={newPlanForm.monthlyPriceCents ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, monthlyPriceCents: normalizeNumberInput(event.target.value) }))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)] md:col-span-2">
                <span className="mb-1 block font-semibold">Περιγραφή</span>
                <input value={newPlanForm.description ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, description: event.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Ετήσια τιμή (cents)</span>
                <input value={newPlanForm.yearlyPriceCents ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, yearlyPriceCents: normalizeNumberInput(event.target.value) }))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Stripe monthly price ID</span>
                <input value={newPlanForm.stripeMonthlyPriceId ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, stripeMonthlyPriceId: event.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Stripe yearly price ID</span>
                <input value={newPlanForm.stripeYearlyPriceId ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, stripeYearlyPriceId: event.target.value }))} className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Emails / μήνα</span>
                <input value={newPlanForm.emailMonthlyLimit ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, emailMonthlyLimit: normalizeNumberInput(event.target.value) }))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">SMS / μήνα</span>
                <input value={newPlanForm.smsMonthlyLimit ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, smsMonthlyLimit: normalizeNumberInput(event.target.value) }))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">API calls / μήνα</span>
                <input value={newPlanForm.apiMonthlyLimit ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, apiMonthlyLimit: normalizeNumberInput(event.target.value) }))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">AI requests / μήνα</span>
                <input value={newPlanForm.aiMonthlyLimit ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, aiMonthlyLimit: normalizeNumberInput(event.target.value) }))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Trial days</span>
                <input value={newPlanForm.trialDays ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, trialDays: normalizeNumberInput(event.target.value) }))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                <span className="mb-1 block font-semibold">Grace period days</span>
                <input value={newPlanForm.gracePeriodDays ?? ''} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, gracePeriodDays: normalizeNumberInput(event.target.value) }))} type="number" className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={newPlanForm.integrationsEnabled} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, integrationsEnabled: event.target.checked }))} />
                Integrations enabled
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={newPlanForm.aiEnabled} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, aiEnabled: event.target.checked }))} />
                AI enabled
              </label>
            </div>
            <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
              <div className="text-xs font-semibold text-[var(--text-primary)]">Grace-period access rules</div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={newPlanForm.graceIntegrationsEnabled} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, graceIntegrationsEnabled: event.target.checked }))} />
                  Integrations during grace
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={newPlanForm.graceAiEnabled} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, graceAiEnabled: event.target.checked }))} />
                  AI during grace
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={newPlanForm.graceEmailEnabled} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, graceEmailEnabled: event.target.checked }))} />
                  Emails during grace
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={newPlanForm.graceSmsEnabled} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, graceSmsEnabled: event.target.checked }))} />
                  SMS during grace
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={newPlanForm.graceApiEnabled} onChange={(event) => setNewPlanForm((prev) => ({ ...prev, graceApiEnabled: event.target.checked }))} />
                  API during grace
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={handleCreatePlan}
                className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
              >
                {actionLoading === 'create-plan' ? 'Δημιουργία...' : 'Δημιουργία custom plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
