import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plug, RefreshCw, XCircle } from 'lucide-react';
import {
  ApiBillingCouponPreview,
  ApiBillingOverview,
  ApiBillingPlan,
  ApiBillingPlanUpsertPayload,
  ApiIntegrationConnection,
  ApiIntegrationProvider,
  connectIntegration,
  createBillingPlan,
  createBillingCheckoutSession,
  createBillingPortalSession,
  disconnectIntegration,
  getCurrentUserRole,
  getBillingOverview,
  previewBillingCoupon,
  scheduleBillingSubscriptionDowngrade,
  listIntegrations,
  updateBillingPlan,
} from '../api/trustlayerApi';
import { useUiStore } from '../state/uiStore';

type IntegrationCard = {
  provider: ApiIntegrationProvider;
  title: string;
  description: string;
  instructions: string[];
  fields?: { key: string; label: string; placeholder?: string }[];
};

const CARDS: IntegrationCard[] = [
  {
    provider: 'META_LEADS',
    title: 'Meta / Facebook Lead Ads',
    description: 'Real-time leads από Facebook Ads Lead Forms.',
    instructions: [
      'Δημιούργησε Meta App και ενεργοποίησε permissions leads_retrieval.',
      'Σύνδεσε Page και αντέγραψε Page ID.',
      'Πρόσθεσε το webhook URL και verify token.',
    ],
    fields: [
      { key: 'accessToken', label: 'Page Access Token', placeholder: 'EAAB...' },
      { key: 'page_id', label: 'Page ID', placeholder: '1234567890' },
    ],
  },
  {
    provider: 'GOOGLE_LEADS',
    title: 'Google Ads Lead Form Extensions',
    description: 'Leads από Google Ads Lead Forms.',
    instructions: [
      'Σύνδεσε Google Ads account και ενεργοποίησε lead form extensions.',
      'Πρόσθεσε το webhook URL για lead notifications.',
    ],
    fields: [
      { key: 'accessToken', label: 'OAuth Access Token', placeholder: 'ya29...' },
    ],
  },
  {
    provider: 'EMAIL_GMAIL',
    title: 'Gmail Parsing',
    description: 'Ανάγνωση Gmail leads μέσω OAuth.',
    instructions: [
      'Σύνδεσε Gmail λογαριασμό του μεσίτη.',
      'Δώσε άδεια read-only για lead parsing.',
    ],
    fields: [
      { key: 'accessToken', label: 'OAuth Access Token', placeholder: 'ya29...' },
      { key: 'refreshToken', label: 'Refresh Token', placeholder: '1//0g...' },
    ],
  },
  {
    provider: 'EMAIL_OUTLOOK',
    title: 'Outlook Parsing',
    description: 'Ανάγνωση Outlook leads μέσω OAuth.',
    instructions: [
      'Σύνδεσε Outlook/M365 account.',
      'Ενεργοποίησε webhook subscriptions.',
    ],
    fields: [
      { key: 'accessToken', label: 'OAuth Access Token', placeholder: 'EwB...' },
      { key: 'refreshToken', label: 'Refresh Token', placeholder: '0.AAA...' },
    ],
  },
  {
    provider: 'EMAIL_FORWARDING',
    title: 'Email Forwarding',
    description: 'Προώθηση leads σε ειδικό inbox (χωρίς OAuth).',
    instructions: [
      'Δημιούργησε κανόνα forward από Spitogatos/XE προς το inbound address.',
      'Επιβεβαίωσε ότι τα emails περνούν σε μορφή text.',
    ],
    fields: [
      { key: 'forward_to', label: 'Forwarding Address', placeholder: 'lead+broker@davlos.app' },
    ],
  },
];

function statusPill(status?: string) {
  if (status === 'CONNECTED') {
    return 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]';
  }
  if (status === 'ERROR') {
    return 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]';
  }
  return 'bg-[var(--surface-highlight)] text-[var(--text-secondary)] border-[var(--border-default)]';
}

function healthPill(health?: ApiIntegrationConnection['health']) {
  if (health === 'HEALTHY') {
    return 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]';
  }
  if (health === 'WARNING') {
    return 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]';
  }
  if (health === 'ERROR') {
    return 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]';
  }
  return 'bg-[var(--surface-highlight)] text-[var(--text-secondary)] border-[var(--border-default)]';
}

function subscriptionPill(status?: string) {
  if (status === 'ACTIVE' || status === 'TRIALING') {
    return 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]';
  }
  if (status === 'PAST_DUE') {
    return 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]';
  }
  return 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]';
}

function invoiceStatusPill(status?: string) {
  if (status === 'paid') {
    return 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]';
  }
  if (status === 'open' || status === 'draft') {
    return 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]';
  }
  return 'bg-[var(--surface-highlight)] text-[var(--text-secondary)] border-[var(--border-default)]';
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

function discountedPrice(priceCents: number | null | undefined, percentOff: number | null | undefined) {
  if (priceCents == null || percentOff == null) {
    return priceCents ?? null;
  }
  const multiplier = Math.max(0, 100 - percentOff) / 100;
  return Math.round(priceCents * multiplier);
}

function formatCouponValidity(coupon: ApiBillingCouponPreview | null) {
  if (!coupon) {
    return null;
  }
  const from = coupon.validFrom ? new Date(coupon.validFrom).toLocaleString('el-GR') : 'άμεσα';
  const until = coupon.validUntil ? new Date(coupon.validUntil).toLocaleString('el-GR') : 'χωρίς λήξη';
  return `Ισχύει από ${from} έως ${until}`;
}

function formatUsageLimit(value?: number | null) {
  if (value == null) {
    return 'Unlimited';
  }
  return new Intl.NumberFormat('el-GR').format(value);
}

function formatDateTime(value?: string) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('el-GR');
}

function usageMetricLabel(metric: ApiBillingOverview['usage'][number]['metric']) {
  if (metric === 'EMAILS') return 'Emails';
  if (metric === 'SMS') return 'SMS';
  if (metric === 'API_CALLS') return 'API calls';
  return 'AI requests';
}

function usageState(item: ApiBillingOverview['usage'][number]) {
  if (item.unlimited || !item.limit || item.limit <= 0) {
    return { percentage: 0, tone: 'normal' as const, text: 'Unlimited usage' };
  }
  const percentage = Math.min(100, Math.round((item.usedCount / item.limit) * 100));
  if (percentage >= 100) {
    return { percentage, tone: 'exhausted' as const, text: 'Το όριο εξαντλήθηκε' };
  }
  if (percentage >= 80) {
    return { percentage, tone: 'warning' as const, text: 'Πλησιάζει το όριο' };
  }
  return { percentage, tone: 'normal' as const, text: 'Εντός ορίου' };
}

function nextUpgradePlan(
  plans: ApiBillingPlan[],
  currentPlan: ApiBillingPlan,
  predicate: (plan: ApiBillingPlan) => boolean,
) {
  return plans
    .filter((plan) => plan.active)
    .filter((plan) => plan.purchasable)
    .filter((plan) => plan.sortOrder > currentPlan.sortOrder)
    .filter(predicate)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
}

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

export function BrokerSettingsPage() {
  const { showToast } = useUiStore();
  const [integrations, setIntegrations] = useState<ApiIntegrationConnection[]>([]);
  const [billingOverview, setBillingOverview] = useState<ApiBillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingActionLoading, setBillingActionLoading] = useState<string | null>(null);
  const [billingCouponCode, setBillingCouponCode] = useState('');
  const [billingCouponPreview, setBillingCouponPreview] = useState<ApiBillingCouponPreview | null>(null);
  const [billingCouponPreviewError, setBillingCouponPreviewError] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, Record<string, string>>>({});
  const [planEditorState, setPlanEditorState] = useState<Record<string, ApiBillingPlanUpsertPayload>>({});
  const [newPlanForm, setNewPlanForm] = useState<ApiBillingPlanUpsertPayload>(planFormFromPlan());

  const currentUserRole = getCurrentUserRole();
  const isAdmin = currentUserRole === 'ADMIN';

  const integrationByProvider = useMemo(() => {
    const map = new Map<ApiIntegrationProvider, ApiIntegrationConnection>();
    integrations.forEach((item) => map.set(item.provider, item));
    return map;
  }, [integrations]);

  const loadIntegrations = () => {
    listIntegrations()
      .then(setIntegrations)
      .catch(() => showToast('Αποτυχία φόρτωσης integrations.', 'error'))
      .finally(() => setLoading(false));
  };

  const loadBillingOverview = () => {
    getBillingOverview()
      .then(setBillingOverview)
      .catch(() => showToast('Αποτυχία φόρτωσης billing στοιχείων.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    loadBillingOverview();
    loadIntegrations();
  }, []);

  useEffect(() => {
    if (!billingOverview) {
      return;
    }
    setPlanEditorState(
      Object.fromEntries(
        billingOverview.availablePlans.map((plan) => [plan.id ?? plan.code, planFormFromPlan(plan)]),
      ),
    );
  }, [billingOverview]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingState = params.get('billing');
    if (!billingState) {
      return;
    }
    if (billingState === 'success') {
      showToast('Η συνδρομή ενεργοποιήθηκε ή ενημερώθηκε. Γίνεται συγχρονισμός στοιχείων.', 'success');
    } else if (billingState === 'canceled') {
      showToast('Η πληρωμή δεν ολοκληρώθηκε.', 'warning');
    }
    params.delete('billing');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, [showToast]);

  const handleConnect = async (provider: ApiIntegrationProvider) => {
    const values = formState[provider] ?? {};
    try {
      await connectIntegration(provider, {
        accessToken: values.accessToken,
        refreshToken: values.refreshToken,
        metadata: values,
      });
      showToast('Το integration συνδέθηκε.', 'success');
      loadIntegrations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία σύνδεσης integration';
      showToast(message, 'error');
    }
  };

  const handleDisconnect = async (provider: ApiIntegrationProvider) => {
    try {
      await disconnectIntegration(provider, 'Disconnected by broker');
      showToast('Το integration αποσυνδέθηκε.', 'info');
      loadIntegrations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία αποσύνδεσης integration';
      showToast(message, 'error');
    }
  };

  const handleCheckout = async (planCode: ApiBillingPlan['code']) => {
    const targetPlan = billingOverview?.availablePlans.find((plan) => plan.code === planCode);
    if (targetPlan && !targetPlan.purchasable) {
      showToast('Το plan δεν είναι ακόμη διαθέσιμο για εμπορική ενεργοποίηση.', 'warning');
      return;
    }
    setBillingActionLoading(`checkout:${planCode}`);
    try {
      const session = await createBillingCheckoutSession({
        planCode,
        interval: 'monthly',
        couponCode: billingCouponCode.trim() || undefined,
        successUrl: `${window.location.origin}/settings?billing=success`,
        cancelUrl: `${window.location.origin}/settings?billing=canceled`,
      });
      window.location.assign(session.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία δημιουργίας checkout session';
      showToast(message, 'error');
      setBillingActionLoading(null);
    }
  };

  const handlePlanChange = async (plan: ApiBillingPlan) => {
    if (!billingOverview) {
      return;
    }
    if (plan.sortOrder > billingOverview.currentPlan.sortOrder) {
      await handleCheckout(plan.code);
      return;
    }

    setBillingActionLoading(`downgrade:${plan.code}`);
    try {
      const change = await scheduleBillingSubscriptionDowngrade({ planCode: plan.code });
      const effectiveDate = change.effectiveAt
        ? new Date(change.effectiveAt).toLocaleString('el-GR')
        : 'στο τέλος της τρέχουσας περιόδου';
      showToast(`Το downgrade προγραμματίστηκε για ${effectiveDate}.`, 'success');
      loadBillingOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία προγραμματισμού downgrade';
      showToast(message, 'error');
    } finally {
      setBillingActionLoading(null);
    }
  };

  const handleBillingPortal = async () => {
    setBillingActionLoading('portal');
    try {
      const session = await createBillingPortalSession();
      window.location.assign(session.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία ανοίγματος billing portal';
      showToast(message, 'error');
      setBillingActionLoading(null);
    }
  };

  const integrationsLocked = billingOverview ? !billingOverview.integrationsEnabled : false;
  const aiLocked = billingOverview ? !billingOverview.aiEnabled : false;
  const exhaustedUsageItems = billingOverview
    ? billingOverview.usage.filter((item) => !item.unlimited && !!item.limit && item.limit > 0 && item.usedCount >= item.limit)
    : [];
  const inTrial = billingOverview?.subscriptionStatus === 'TRIALING';
  const inGracePeriod =
    billingOverview?.subscriptionStatus === 'PAST_DUE' && billingOverview?.dunningState === 'GRACE_ACTIVE';
  const integrationsUpgradePlan = billingOverview
    ? nextUpgradePlan(billingOverview.availablePlans, billingOverview.currentPlan, (plan) => plan.integrationsEnabled)
    : null;
  const autoDisconnectedIntegrations = integrations.filter(
    (integration) =>
      integration.status === 'DISCONNECTED'
      && integration.lastError?.includes('billing plan no longer includes integrations'),
  );
  const aiUpgradePlan = billingOverview
    ? nextUpgradePlan(billingOverview.availablePlans, billingOverview.currentPlan, (plan) => plan.aiEnabled)
    : null;
  const hasPurchasableUpgradePlans = billingOverview
    ? billingOverview.availablePlans.some(
        (plan) => plan.active && plan.purchasable && plan.sortOrder > billingOverview.currentPlan.sortOrder,
      )
    : false;
  const billingCouponValidityLabel = formatCouponValidity(billingCouponPreview);
  const currentPlanCatalogAmount = billingOverview?.catalogAmountCents ?? billingOverview?.currentPlan.monthlyPriceCents ?? null;
  const currentPlanEffectiveAmount = billingOverview?.effectiveAmountCents ?? currentPlanCatalogAmount;
  const isUnlimitedPlan = billingOverview?.currentPlan.code === 'UNLIMITED';
  const appliedCouponValidUntilDate = billingOverview?.appliedCouponValidUntil
    ? new Date(billingOverview.appliedCouponValidUntil)
    : null;
  const couponSuppressesChargeUntil =
    billingOverview?.subscriptionStatus === 'ACTIVE' &&
    billingOverview?.appliedDiscountPercent === 100 &&
    currentPlanEffectiveAmount === 0 &&
    appliedCouponValidUntilDate !== null &&
    !Number.isNaN(appliedCouponValidUntilDate.getTime()) &&
    appliedCouponValidUntilDate.getTime() > Date.now();
  const appliedCouponValidityLabel = billingOverview?.appliedCouponCode
    ? formatCouponValidity({
        validFrom: billingOverview.appliedCouponValidFrom ?? null,
        validUntil: billingOverview.appliedCouponValidUntil ?? null,
      })
    : null;

  useEffect(() => {
    const normalizedCode = billingCouponCode.trim();
    if (!normalizedCode) {
      setBillingCouponPreview(null);
      setBillingCouponPreviewError(null);
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      previewBillingCoupon(normalizedCode)
        .then((preview) => {
          if (cancelled) {
            return;
          }
          setBillingCouponPreview(preview);
          setBillingCouponPreviewError(null);
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          setBillingCouponPreview(null);
          setBillingCouponPreviewError(error instanceof Error ? error.message : 'Το coupon δεν είναι διαθέσιμο.');
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [billingCouponCode]);

  const handlePlanFieldChange = (
    key: string,
    field: keyof ApiBillingPlanUpsertPayload,
    value: string | boolean,
  ) => {
    setPlanEditorState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleSavePlan = async (plan: ApiBillingPlan) => {
    const key = plan.id ?? plan.code;
    const draft = planEditorState[key];
    if (!plan.id || !draft) {
      return;
    }
    setBillingActionLoading(`save-plan:${key}`);
    try {
      await updateBillingPlan(plan.id, draft);
      showToast(`Το plan ${draft.name} ενημερώθηκε.`, 'success');
      loadBillingOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία ενημέρωσης plan';
      showToast(message, 'error');
    } finally {
      setBillingActionLoading(null);
    }
  };

  const handleCreatePlan = async () => {
    setBillingActionLoading('create-plan');
    try {
      await createBillingPlan(newPlanForm);
      showToast(`Το plan ${newPlanForm.name} δημιουργήθηκε.`, 'success');
      setNewPlanForm(planFormFromPlan());
      loadBillingOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία δημιουργίας plan';
      showToast(message, 'error');
    } finally {
      setBillingActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-ambient)]">
      <div className="p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--text-primary)]">Billing & Integrations</h1>
            <p className="text-[var(--text-tertiary)]">
              Παρακολούθησε το current plan, τα usage limits και την κατάσταση κάθε integration.
            </p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              loadBillingOverview();
              loadIntegrations();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-glow)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]"
          >
            <RefreshCw size={14} />
            Ανανέωση
          </button>
        </div>

        {billingOverview && (
          <div className="mb-8 space-y-4">
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                      Plan: {billingOverview.currentPlan.name}
                    </h2>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${subscriptionPill(billingOverview.subscriptionStatus)}`}>
                      {billingOverview.subscriptionStatus}
                    </span>
                    {inTrial && (
                      <span className="rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--status-info-text)]">
                        Trial active
                      </span>
                    )}
                    {inGracePeriod && (
                      <span className="rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--status-warning-text)]">
                        Grace period
                      </span>
                    )}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                    {billingOverview.currentPlan.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--text-tertiary)]">
                    <span>
                      {(billingOverview.billingInterval || 'monthly') === 'yearly' ? 'Ετήσια τιμή:' : 'Μηνιαία τιμή:'}{' '}
                      {billingOverview.appliedDiscountPercent && currentPlanEffectiveAmount !== currentPlanCatalogAmount ? (
                        <>
                          <span className="line-through">{formatPrice(currentPlanCatalogAmount)}</span>{' '}
                          <span className="font-semibold text-[var(--status-success-text)]">{formatPrice(currentPlanEffectiveAmount)}</span>
                        </>
                      ) : (
                        formatPrice(currentPlanEffectiveAmount)
                      )}
                    </span>
                    {billingOverview.appliedCouponCode && (
                      <span>
                        Coupon: {billingOverview.appliedCouponCode} ({billingOverview.appliedDiscountPercent ?? 0}% off)
                        {appliedCouponValidityLabel ? ` • Ισχύς: ${appliedCouponValidityLabel}` : ''}
                      </span>
                    )}
                    {!inTrial && billingOverview.currentPeriodEnd && (
                      <span>Τρέχουσα περίοδος έως: {new Date(billingOverview.currentPeriodEnd).toLocaleDateString('el-GR')}</span>
                    )}
                    {inTrial && billingOverview.trialEndsAt && (
                      <span>Trial ends: {new Date(billingOverview.trialEndsAt).toLocaleDateString('el-GR')}</span>
                    )}
                    {inTrial && billingOverview.currentPeriodStart && billingOverview.currentPeriodEnd && (
                      <span>
                        Πρώτη κανονική περίοδος: {new Date(billingOverview.currentPeriodStart).toLocaleDateString('el-GR')} έως {new Date(billingOverview.currentPeriodEnd).toLocaleDateString('el-GR')}
                      </span>
                    )}
                    {inGracePeriod && billingOverview.gracePeriodEndsAt && (
                      <span>Grace ends: {new Date(billingOverview.gracePeriodEndsAt).toLocaleDateString('el-GR')}</span>
                    )}
                    <span>Integrations: {billingOverview.integrationsEnabled ? 'Ναι' : 'Όχι'}</span>
                    <span>AI: {billingOverview.aiEnabled ? 'Ναι' : 'Όχι'}</span>
                    {isUnlimitedPlan && (
                      <span>Unlimited policy: χωρίς κανονικό monthly cap, αλλά με fair-use safety throttles για προστασία της πλατφόρμας.</span>
                    )}
                  </div>
                  {billingOverview.entitlementOverrideActive && (
                    <div className="mt-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-3 text-xs text-[var(--status-info-text)]">
                      Σας έχουν δοθεί επιπλέον δυνατότητες πέρα από το τρέχον πλάνο σας από τη διοίκηση ως ένδειξη ευγνωμοσύνης
                      {billingOverview.entitlementOverrideValidUntil
                        ? ` έως ${new Date(billingOverview.entitlementOverrideValidUntil).toLocaleString('el-GR')}`
                        : ''}
                      {billingOverview.entitlementOverrideReason ? ` · ${billingOverview.entitlementOverrideReason}` : ''}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                    {inTrial
                      ? billingOverview.trialEndsAt
                        ? `Βρίσκεσαι σε δωρεάν trial. Η κανονική χρέωση/ενεργοποίηση ξεκινά μετά τις ${new Date(billingOverview.trialEndsAt).toLocaleDateString('el-GR')}.`
                        : 'Βρίσκεσαι σε δωρεάν trial του πλάνου.'
                      : inGracePeriod
                        ? billingOverview.gracePeriodEndsAt
                          ? `Υπάρχει θέμα πληρωμής, αλλά η πρόσβαση που επιτρέπει το grace παραμένει ενεργή έως ${new Date(billingOverview.gracePeriodEndsAt).toLocaleDateString('el-GR')}.`
                          : 'Υπάρχει θέμα πληρωμής και η συνδρομή βρίσκεται σε grace period.'
                      : billingOverview.subscriptionStatus === 'PAST_DUE'
                        ? 'Απαιτείται ενημέρωση τρόπου πληρωμής για να παραμείνει ενεργή η συνδρομή.'
                      : billingOverview.subscriptionStatus === 'CANCELED' || billingOverview.subscriptionStatus === 'EXPIRED'
                        ? 'Η συνδρομή δεν είναι ενεργή. Μπορείς να επανεκκινήσεις το Core checkout.'
                        : couponSuppressesChargeUntil && appliedCouponValidUntilDate
                          ? `Το coupon μηδενίζει τις χρεώσεις έως ${appliedCouponValidUntilDate.toLocaleDateString('el-GR')}. Η επόμενη κανονική χρέωση θα ξεκινήσει μετά τη λήξη του.`
                        : billingOverview.currentPeriodEnd
                          ? `Η επόμενη χρέωση είναι στις ${new Date(billingOverview.currentPeriodEnd).toLocaleDateString('el-GR')}.`
                          : 'Η συνδρομή συγχρονίζεται με το billing provider.'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Στο initial launch μόνο το Core checkout είναι εμπορικά ενεργό. Τα premium plans παραμένουν Coming soon μέχρι το επόμενο rollout.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={billingActionLoading !== null}
                  onClick={billingOverview.billingCustomerLinked ? handleBillingPortal : () => handleCheckout(billingOverview.currentPlan.code)}
                  className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-highlight)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-60"
                >
                  {billingOverview.billingCustomerLinked
                    ? billingActionLoading === 'portal'
                      ? 'Άνοιγμα billing portal...'
                      : billingOverview.subscriptionStatus === 'PAST_DUE'
                        ? 'Retry payment'
                        : 'Manage billing'
                      : billingActionLoading?.startsWith('checkout:')
                        ? 'Μετάβαση στο checkout...'
                      : billingOverview.subscriptionStatus === 'CANCELED' || billingOverview.subscriptionStatus === 'EXPIRED'
                        ? 'Reactivate subscription'
                        : 'Core checkout'}
                </button>
              </div>
            </div>

            {exhaustedUsageItems.length > 0 && (
              <div className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 text-[var(--status-danger-text)]" />
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--status-danger-text)]">
                      Έχουν εξαντληθεί usage limits
                    </h2>
                    <p className="mt-1 text-sm text-[var(--status-danger-text)]">
                      Έχεις φτάσει το μηνιαίο όριο για {exhaustedUsageItems.map((item) => usageMetricLabel(item.metric)).join(', ')}.
                      Κάποια actions θα μπλοκάρονται μέχρι τον επόμενο κύκλο.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {billingOverview.pendingChange && billingOverview.pendingChange.status === 'PENDING' && (
              <div className="rounded-2xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 text-[var(--status-info-text)]" />
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--status-info-text)]">
                      Προγραμματισμένο downgrade στο τέλος του billing cycle
                    </h2>
                    <p className="mt-1 text-sm text-[var(--status-info-text)]">
                      Το πλάνο θα αλλάξει από {billingOverview.pendingChange.currentPlanName} σε {billingOverview.pendingChange.targetPlanName}
                      {billingOverview.pendingChange.effectiveAt
                        ? ` στις ${new Date(billingOverview.pendingChange.effectiveAt).toLocaleString('el-GR')}.`
                        : '.'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--status-info-text)]/80">
                      Μέχρι τότε διατηρείς τα σημερινά entitlements. Μετά την αλλαγή θα κλειδώσουν αυτόματα:
                      {' '}
                      {billingOverview.pendingChange.lockedFeaturesAfterChange?.length
                        ? billingOverview.pendingChange.lockedFeaturesAfterChange.join(', ')
                        : 'μόνο τα limits/entitlements του νέου πλάνου'}
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Usage αυτού του μήνα</h2>
                <div className="mt-4 space-y-3">
                  {billingOverview.usage.map((item) => {
                    const state = usageState(item);
                    const barColor =
                      state.tone === 'exhausted'
                        ? 'var(--status-danger-text)'
                        : state.tone === 'warning'
                          ? 'var(--status-warning-text)'
                          : 'var(--brand-primary)';
                    const helperTextColor =
                      state.tone === 'exhausted'
                        ? 'text-[var(--status-danger-text)]'
                        : state.tone === 'warning'
                          ? 'text-[var(--status-warning-text)]'
                          : 'text-[var(--text-tertiary)]';
                    return (
                      <div key={item.metric} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <span>{usageMetricLabel(item.metric)}</span>
                          <span>
                            {new Intl.NumberFormat('el-GR').format(item.usedCount)} / {formatUsageLimit(item.limit)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--surface-highlight)]">
                          <div
                            className="h-2 rounded-full bg-[var(--brand-primary)] transition-all"
                            style={{ width: item.unlimited ? '12%' : `${state.percentage}%`, backgroundColor: barColor }}
                          />
                        </div>
                        <div className={`mt-2 text-[11px] ${helperTextColor}`}>
                          {state.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Billing management</h2>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Διαχειρίζεσαι κάρτα, τιμολόγια, ακύρωση και επανενεργοποίηση της συνδρομής χωρίς παρέμβαση admin.
                  </p>
                  {inGracePeriod && (
                    <div className="mt-4 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
                      Το account βρίσκεται σε grace period. Λύσε το payment issue πριν από τη λήξη του grace window για να μη χαθεί η πρόσβαση στα επιτρεπόμενα features.
                    </div>
                  )}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={billingActionLoading !== null || !billingOverview.billingCustomerLinked}
                      onClick={handleBillingPortal}
                      className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-4 py-3 text-left disabled:opacity-60"
                    >
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {billingOverview.subscriptionStatus === 'PAST_DUE' ? 'Retry payment / κάρτα' : 'Payment method'}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                        Άνοιγμα provider portal για αλλαγή κάρτας και payment recovery.
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={billingActionLoading !== null || !billingOverview.billingCustomerLinked}
                      onClick={handleBillingPortal}
                      className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-4 py-3 text-left disabled:opacity-60"
                    >
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {billingOverview.subscriptionStatus === 'CANCELED' || billingOverview.subscriptionStatus === 'EXPIRED'
                          ? 'Reactivate / resume'
                          : 'Cancel / manage subscription'}
                      </div>
                      <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                        Η ακύρωση ή επανενεργοποίηση γίνεται από το hosted billing portal του provider.
                      </div>
                    </button>
                  </div>
                  {!billingOverview.billingCustomerLinked && (
                    <div className="mt-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
                      Billing portal θα γίνει διαθέσιμο μόλις συνδεθεί billing customer με το πρώτο επιτυχημένο checkout.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Available plans</h2>
                  {hasPurchasableUpgradePlans && (
                    <div className="mt-3 max-w-sm">
                      <label className="text-xs text-[var(--text-secondary)]">
                        <span className="mb-1 block font-semibold">Coupon code</span>
                        <input
                          value={billingCouponCode}
                          onChange={(event) => setBillingCouponCode(event.target.value.toUpperCase())}
                          placeholder="Προαιρετικό"
                          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        />
                      </label>
                      <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                        Εφαρμόζεται μόνο στα ενεργά checkout paths.
                      </div>
                      {billingCouponPreview && (
                        <div className="mt-3 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-3 text-xs text-[var(--status-success-text)]">
                          <div className="font-semibold">{billingCouponPreview.code} · {billingCouponPreview.percentOff}% έκπτωση</div>
                          {billingCouponPreview.applicablePlanCode && (
                            <div className="mt-1 opacity-90">Ισχύει μόνο για plan {billingCouponPreview.applicablePlanCode}.</div>
                          )}
                          {billingCouponValidityLabel && (
                            <div className="mt-1 opacity-90">{billingCouponValidityLabel}</div>
                          )}
                        </div>
                      )}
                      {billingCouponPreviewError && (
                        <div className="mt-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-3 text-xs text-[var(--status-warning-text)]">
                          {billingCouponPreviewError}
                        </div>
                      )}
                    </div>
                  )}
                  {!hasPurchasableUpgradePlans && (
                    <div className="mt-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-3 text-xs text-[var(--status-info-text)]">
                      Για το initial launch το μόνο εμπορικά ενεργό πλάνο είναι το Core. Τα premium plans παραμένουν ορατά ως Coming soon χωρίς checkout path.
                    </div>
                  )}
                  <div className="mt-4 space-y-3">
                    {billingOverview.availablePlans.map((plan: ApiBillingPlan) => {
                      const current = plan.code === billingOverview.currentPlan.code;
                      const comingSoon = !plan.purchasable;
                      const couponApplies = Boolean(
                        billingCouponPreview
                          && (!billingCouponPreview.applicablePlanCode
                            || billingCouponPreview.applicablePlanCode === plan.code),
                      );
                      const discountedMonthlyPrice = couponApplies
                        ? discountedPrice(plan.monthlyPriceCents, billingCouponPreview?.percentOff)
                        : plan.monthlyPriceCents;
                      return (
                        <div
                          key={plan.code}
                          className={`rounded-xl border p-3 ${
                            current
                              ? 'border-[var(--brand-primary)] bg-[var(--surface-highlight)]'
                              : 'border-[var(--border-default)] bg-[var(--surface-ambient)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{plan.name}</h3>
                                {current && (
                                  <span className="rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-on-brand)]">
                                    Current
                                  </span>
                                )}
                                {comingSoon && (
                                  <span className="rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--status-warning-text)]">
                                    Coming soon
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-[var(--text-tertiary)]">{plan.description}</p>
                              {comingSoon && (
                                <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                                  Η εμπορική ενεργοποίηση αυτού του plan δεν έχει ανοίξει ακόμη.
                                </p>
                              )}
                            </div>
                            <div className="text-right text-xs text-[var(--text-secondary)]">
                              {couponApplies && discountedMonthlyPrice !== plan.monthlyPriceCents ? (
                                <>
                                  <div className="text-[var(--text-tertiary)] line-through">{formatPrice(plan.monthlyPriceCents)}</div>
                                  <div className="font-semibold text-[var(--status-success-text)]">{formatPrice(discountedMonthlyPrice)}</div>
                                  <div className="text-[var(--text-tertiary)]">/ μήνα</div>
                                </>
                              ) : (
                                <>
                                  <div>{formatPrice(plan.monthlyPriceCents)}</div>
                                  <div className="text-[var(--text-tertiary)]">/ μήνα</div>
                                </>
                              )}
                            </div>
                          </div>
                          {couponApplies && billingCouponValidityLabel && (
                            <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">{billingCouponValidityLabel}</div>
                          )}
                          {!current && !comingSoon && (
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                disabled={billingActionLoading !== null}
                                onClick={() => void handlePlanChange(plan)}
                                className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
                              >
                                {billingActionLoading === `checkout:${plan.code}`
                                  ? 'Μετάβαση στο checkout...'
                                  : billingActionLoading === `downgrade:${plan.code}`
                                    ? 'Προγραμματισμός...'
                                    : plan.sortOrder > billingOverview.currentPlan.sortOrder
                                      ? 'Upgrade τώρα'
                                      : 'Downgrade next cycle'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">Invoice history</h2>
                    {billingOverview.billingCustomerLinked && (
                      <button
                        type="button"
                        disabled={billingActionLoading !== null}
                        onClick={handleBillingPortal}
                        className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-60"
                      >
                        {billingActionLoading === 'portal' ? 'Άνοιγμα...' : 'Άνοιγμα portal'}
                      </button>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    {billingOverview.invoices && billingOverview.invoices.length > 0 ? (
                      billingOverview.invoices.map((invoice) => (
                        <div key={invoice.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3 text-xs">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-[var(--text-primary)]">{invoice.providerInvoiceId}</div>
                              <div className="mt-1 text-[var(--text-tertiary)]">
                                Έκδοση: {formatDateTime(invoice.createdAt)}
                              </div>
                              <div className="mt-1 text-[var(--text-tertiary)]">
                                {invoice.amountDueCents != null ? formatPrice(invoice.amountDueCents) : '—'}
                                {invoice.currency ? ` • ${invoice.currency.toUpperCase()}` : ''}
                              </div>
                            </div>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${invoiceStatusPill(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {invoice.hostedInvoiceUrl && (
                              <a
                                href={invoice.hostedInvoiceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                              >
                                Προβολή invoice
                              </a>
                            )}
                            {invoice.invoicePdfUrl && (
                              <a
                                href={invoice.invoicePdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                              >
                                PDF
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-4 text-sm text-[var(--text-tertiary)]">
                        Δεν υπάρχουν ακόμη invoices για αυτόν τον λογαριασμό.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {billingOverview && isAdmin && (
          <div className="mb-8 space-y-4">
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Admin plan catalog</h2>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Διαχειρίσου catalog, τιμές, Stripe price IDs, feature flags και usage caps χωρίς code change.
                </p>
              </div>

              <div className="space-y-4">
                {billingOverview.availablePlans.map((plan) => {
                  const key = plan.id ?? plan.code;
                  const draft = planEditorState[key] ?? planFormFromPlan(plan);
                  return (
                    <div key={key} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{plan.name}</h3>
                          <p className="text-xs text-[var(--text-tertiary)]">Code: {plan.code}</p>
                        </div>
                        <button
                          type="button"
                          disabled={billingActionLoading !== null}
                          onClick={() => handleSavePlan(plan)}
                          className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
                        >
                          {billingActionLoading === `save-plan:${key}` ? 'Αποθήκευση...' : 'Αποθήκευση'}
                        </button>
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
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Νέο custom plan</h2>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Δημιούργησε νέο plan με custom code, pricing, feature flags και usage caps.
                </p>
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
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={billingActionLoading !== null}
                  onClick={handleCreatePlan}
                  className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
                >
                  {billingActionLoading === 'create-plan' ? 'Δημιουργία...' : 'Δημιουργία custom plan'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Integrations</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Σύνδεσε τα κανάλια leads και παρακολούθησε την κατάσταση κάθε integration.
          </p>
        </div>

        {integrationsLocked && (
          <div className="mb-4 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-4 text-sm text-[var(--status-warning-text)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Το current plan δεν περιλαμβάνει integrations.</div>
                <div className="mt-1">
                  Τα connect actions είναι κλειδωμένα μέχρι να ενεργοποιηθεί plan με integrations entitlement.
                </div>
                {autoDisconnectedIntegrations.length > 0 && (
                  <div className="mt-2">
                    {autoDisconnectedIntegrations.length === 1
                      ? 'Μία υπάρχουσα integration αποσυνδέθηκε αυτόματα λόγω αλλαγής πλάνου.'
                      : `${autoDisconnectedIntegrations.length} υπάρχουσες integrations αποσυνδέθηκαν αυτόματα λόγω αλλαγής πλάνου.`}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {billingOverview && (
          <div className="mb-6 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">AI entitlements</h2>
                <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                  Το AI gate εφαρμόζεται στο backend και το usage μετριέται στο monthly quota του plan.
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  aiLocked
                    ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                    : 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                }`}
              >
                {aiLocked ? 'AI locked' : 'AI enabled'}
              </span>
            </div>
            {aiLocked && (
              <div className="mt-4 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning-text)]">
                Το current launch δεν περιλαμβάνει ακόμη εμπορική ενεργοποίηση AI features. Τα AI suggestions και το AI request quota θα ανοίξουν σε επόμενο premium rollout.
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {CARDS.map((card) => {
            const integration = integrationByProvider.get(card.provider);
            const status = integration?.status ?? 'DISCONNECTED';
            const health = integration?.health ?? 'DISCONNECTED';
            const fields = card.fields ?? [];

            return (
              <div key={card.provider} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Plug size={16} className="text-[var(--brand-warm)]" />
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">{card.title}</h2>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">{card.description}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusPill(status)}`}>
                    {status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span className={`rounded-full border px-2 py-1 font-semibold ${healthPill(health)}`}>
                    {health}
                  </span>
                  {integration?.connectedAt && (
                    <span className="rounded-full border border-[var(--border-default)] px-2 py-1">
                      Connected: {formatDateTime(integration.connectedAt)}
                    </span>
                  )}
                  {integration?.credentialsUpdatedAt && (
                    <span className="rounded-full border border-[var(--border-default)] px-2 py-1">
                      Credentials: {formatDateTime(integration.credentialsUpdatedAt)}
                    </span>
                  )}
                  {integration?.lastSyncAt && (
                    <span className="rounded-full border border-[var(--border-default)] px-2 py-1">
                      Last sync: {formatDateTime(integration.lastSyncAt)}
                    </span>
                  )}
                  {integration?.lastWebhookAt && (
                    <span className="rounded-full border border-[var(--border-default)] px-2 py-1">
                      Last webhook: {formatDateTime(integration.lastWebhookAt)}
                    </span>
                  )}
                  {integration && integration.consecutiveFailureCount > 0 && (
                    <span className="rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-1 text-[var(--status-warning-text)]">
                      Failures: {integration.consecutiveFailureCount}
                    </span>
                  )}
                </div>

                <ul className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                  {card.instructions.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>

                {fields.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {fields.map((field) => (
                      <div key={field.key}>
                        <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
                          {field.label}
                        </label>
                        <input
                          value={formState[card.provider]?.[field.key] ?? ''}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              [card.provider]: {
                                ...prev[card.provider],
                                [field.key]: event.target.value,
                              },
                            }))
                          }
                          placeholder={field.placeholder}
                          disabled={integrationsLocked}
                          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {integrationsLocked && status !== 'CONNECTED' && (
                  <div className="mt-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs text-[var(--status-warning-text)]">
                    Αυτό το integration είναι locked από το current plan. Χρειάζεται plan με integrations entitlement για σύνδεση.
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    {status === 'CONNECTED' ? (
                      <>
                        <CheckCircle2 size={14} className="text-[var(--status-success-text)]" />
                        Συνδεδεμένο
                      </>
                    ) : status === 'ERROR' ? (
                      <>
                        <XCircle size={14} className="text-[var(--status-danger-text)]" />
                        Σφάλμα
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} className="text-[var(--text-tertiary)]" />
                        Ανενεργό
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {status === 'CONNECTED' ? (
                      <button
                        onClick={() => handleDisconnect(card.provider)}
                        className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                      >
                        Αποσύνδεση
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleConnect(card.provider)}
                          disabled={integrationsLocked}
                          className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
                        >
                          Σύνδεση
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {integration?.lastError && (
                  <div className="mt-3 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-text)]">
                    <div className="font-semibold">Last error</div>
                    <div>{integration.lastError}</div>
                    {integration.lastErrorAt && (
                      <div className="mt-1 text-[11px] opacity-80">
                        {formatDateTime(integration.lastErrorAt)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="mt-4 text-xs text-[var(--text-tertiary)]">Loading integrations...</div>
        )}
      </div>
    </div>
  );
}
