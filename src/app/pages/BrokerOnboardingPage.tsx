import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, Mail, Phone, ShieldCheck, Sparkles } from 'lucide-react';
import {
  ApiBillingPlan,
  ApiBillingCouponPreview,
  ApiBrokerSignupState,
  createBrokerOnboardingCheckoutSession,
  getBrokerOnboardingCatalog,
  getBrokerOnboardingState,
  previewBillingCoupon,
  requestBrokerOnboardingPhoneCode,
  resendBrokerOnboardingEmailCode,
  startBrokerOnboarding,
  verifyBrokerOnboardingBusiness,
  verifyBrokerOnboardingEmail,
  verifyBrokerOnboardingPhone,
} from '../api/trustlayerApi';
import { DavlosLogo } from '../components/DavlosLogo';
import { useUiStore } from '../state/uiStore';

type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigateLogin: () => void;
};

type FormState = {
  email: string;
  password: string;
  fullName: string;
  businessName: string;
  gemiNumber: string;
  taxId: string;
  phone: string;
  selectedPlanCode: string;
  selectedBillingInterval: 'monthly' | 'yearly';
};

type StepDefinition = {
  id: number;
  title: string;
  eyebrow: string;
  description: string;
};

const steps: StepDefinition[] = [
  {
    id: 1,
    eyebrow: 'Στοιχεία',
    title: 'Δημιουργία λογαριασμού',
    description: 'Συμπλήρωσε τα βασικά στοιχεία μεσίτη, εταιρείας και το αρχικό πλάνο.',
  },
  {
    id: 2,
    eyebrow: 'Email',
    title: 'Επιβεβαίωση email',
    description: 'Επιβεβαιώνουμε ότι το email ανήκει πράγματι σε εσένα πριν προχωρήσουμε.',
  },
  {
    id: 3,
    eyebrow: 'Τηλέφωνο',
    title: 'Επιβεβαίωση κινητού',
    description: 'Στέλνουμε one-time code στο κινητό ώστε το account να είναι προσβάσιμο και operable.',
  },
  {
    id: 4,
    eyebrow: 'Επιχείρηση',
    title: 'Επιβεβαίωση επιχείρησης',
    description: 'Επιβεβαιώνουμε ΓΕΜΗ, ΑΦΜ και εταιρικά στοιχεία πριν το checkout.',
  },
  {
    id: 5,
    eyebrow: 'Checkout',
    title: 'Συνδρομή και ενεργοποίηση',
    description: 'Ο λογαριασμός ενεργοποιείται μόνο όταν έρθει επιβεβαίωση από τον provider.',
  },
];

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

function addDaysLabel(days: number) {
  const target = new Date();
  target.setDate(target.getDate() + days);
  return target.toLocaleDateString('el-GR');
}

function formatCouponValidity(coupon: ApiBillingCouponPreview | null) {
  if (!coupon) {
    return null;
  }
  const from = coupon.validFrom ? new Date(coupon.validFrom).toLocaleString('el-GR') : 'άμεσα';
  const until = coupon.validUntil ? new Date(coupon.validUntil).toLocaleString('el-GR') : 'χωρίς λήξη';
  return `Ισχύει από ${from} έως ${until}`;
}

function formatVerificationDate(value?: string) {
  if (!value) {
    return null;
  }
  return new Date(value).toLocaleString('el-GR', { timeZone: 'Europe/Athens' });
}

function getCurrentStep(signup: ApiBrokerSignupState | null) {
  if (!signup) return 1;
  if (!signup.emailVerified) return 2;
  if (!signup.phoneVerified) return 3;
  if (!signup.businessVerified) return 4;
  if (!signup.activated) return 5;
  return 5;
}

function statusTone(isDone: boolean, isActive: boolean) {
  if (isDone) {
    return 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]';
  }
  if (isActive) {
    return 'border-[var(--brand-primary)] bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]';
  }
  return 'border-[var(--border-default)] bg-[var(--surface-ambient)] text-[var(--text-tertiary)]';
}

export function BrokerOnboardingPage({ theme, onToggleTheme, onNavigateLogin }: Props) {
  const { showToast } = useUiStore();
  const [catalog, setCatalog] = useState<ApiBillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [signup, setSignup] = useState<ApiBrokerSignupState | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponPreview, setCouponPreview] = useState<ApiBillingCouponPreview | null>(null);
  const [couponPreviewError, setCouponPreviewError] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    fullName: '',
    businessName: '',
    gemiNumber: '',
    taxId: '',
    phone: '',
    selectedPlanCode: '',
    selectedBillingInterval: 'monthly',
  });
  const purchasableCatalog = useMemo(() => catalog.filter((plan) => plan.purchasable), [catalog]);

  const loadState = async (token: string) => {
    const state = await getBrokerOnboardingState(token);
    setSignup(state);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const status = params.get('status');

    getBrokerOnboardingCatalog()
      .then((response) => {
        setCatalog(response.plans);
        const defaultPlanCode = response.plans.find((plan) => plan.purchasable)?.code ?? '';
        setForm((prev) => ({
          ...prev,
          selectedPlanCode: prev.selectedPlanCode || defaultPlanCode,
        }));
      })
      .catch((error) => {
        showToast(error instanceof Error ? error.message : 'Αποτυχία φόρτωσης πλάνων.', 'error');
      })
      .finally(() => setLoading(false));

    if (token) {
      loadState(token).catch((error) => {
        showToast(error instanceof Error ? error.message : 'Αποτυχία φόρτωσης onboarding.', 'error');
      });
    }

    if (status === 'success') {
      showToast('Η πληρωμή ολοκληρώθηκε. Περιμένουμε επιβεβαίωση από τον provider για την ενεργοποίηση.', 'success');
    } else if (status === 'canceled') {
      showToast('Η διαδικασία checkout ακυρώθηκε πριν ολοκληρωθεί.', 'warning');
    }
  }, []);

  const selectedPlan = useMemo(
    () => catalog.find((plan) => plan.code === (signup?.selectedPlanCode || form.selectedPlanCode)) ?? null,
    [catalog, signup?.selectedPlanCode, form.selectedPlanCode],
  );
  const selectedInterval = (signup?.selectedBillingInterval || form.selectedBillingInterval || 'monthly') as 'monthly' | 'yearly';
  const selectedBasePrice = selectedPlan
    ? selectedInterval === 'yearly'
      ? selectedPlan.yearlyPriceCents
      : selectedPlan.monthlyPriceCents
    : null;
  const selectedDiscountedPrice = couponPreview && selectedPlan
    && (!couponPreview.applicablePlanCode || couponPreview.applicablePlanCode === selectedPlan.code)
      ? discountedPrice(selectedBasePrice, couponPreview.percentOff)
      : selectedBasePrice;
  const couponValidityLabel = formatCouponValidity(couponPreview);
  const postTrialDisplayPrice = selectedDiscountedPrice ?? selectedBasePrice;
  const selectedPlanTrialDays = selectedPlan?.trialDays ?? null;
  const hasSelectedPlanTrial = selectedPlanTrialDays != null && selectedPlanTrialDays > 0;
  const trialEndsLabel = hasSelectedPlanTrial ? addDaysLabel(selectedPlanTrialDays) : null;

  const currentStep = getCurrentStep(signup);
  const progress = signup?.activated ? 100 : Math.round((currentStep / steps.length) * 100);

  useEffect(() => {
    const normalizedCode = couponCode.trim();
    if (!normalizedCode) {
      setCouponPreview(null);
      setCouponPreviewError(null);
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      previewBillingCoupon(normalizedCode)
        .then((preview) => {
          if (cancelled) {
            return;
          }
          setCouponPreview(preview);
          setCouponPreviewError(null);
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          setCouponPreview(null);
          setCouponPreviewError(error instanceof Error ? error.message : 'Το coupon δεν είναι διαθέσιμο.');
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [couponCode]);

  const handleStart = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting('start');
    try {
      const response = await startBrokerOnboarding(form);
      setSignup(response.signup);
      showToast('Το onboarding ξεκίνησε. Στείλαμε κωδικό επιβεβαίωσης στο email σου.', 'success');
      const nextUrl = `/register?token=${response.signup.token}`;
      window.history.replaceState({}, '', nextUrl);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία εκκίνησης onboarding.', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const handleEmailRequest = async () => {
    if (!signup) return;
    setSubmitting('email-request');
    try {
      const response = await resendBrokerOnboardingEmailCode(signup.token);
      setSignup(response.signup);
      showToast('Στάλθηκε νέος κωδικός επιβεβαίωσης email.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία αποστολής email code.', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const handleEmailVerify = async () => {
    if (!signup || !emailCode.trim()) return;
    setSubmitting('email-verify');
    try {
      const response = await verifyBrokerOnboardingEmail(signup.token, emailCode.trim());
      setSignup(response.signup);
      setEmailCode('');
      showToast('Το email επιβεβαιώθηκε.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία επιβεβαίωσης email.', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const handlePhoneRequest = async () => {
    if (!signup) return;
    setSubmitting('phone-request');
    try {
      const response = await requestBrokerOnboardingPhoneCode(signup.token);
      setSignup(response.signup);
      showToast(
        response.debugCode
          ? `Στάλθηκε phone code. Debug code: ${response.debugCode}`
          : 'Στάλθηκε κωδικός επιβεβαίωσης τηλεφώνου.',
        'success',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία αποστολής phone code.', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const handlePhoneVerify = async () => {
    if (!signup || !phoneCode.trim()) return;
    setSubmitting('phone-verify');
    try {
      const response = await verifyBrokerOnboardingPhone(signup.token, phoneCode.trim());
      setSignup(response.signup);
      setPhoneCode('');
      showToast('Το τηλέφωνο επιβεβαιώθηκε.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία επιβεβαίωσης τηλεφώνου.', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const handleBusinessVerify = async () => {
    if (!signup) return;
    setSubmitting('business-verify');
    try {
      const response = await verifyBrokerOnboardingBusiness(signup.token);
      setSignup(response);
      showToast('Η επιχείρηση επιβεβαιώθηκε για το onboarding.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία business verification.', 'error');
    } finally {
      setSubmitting(null);
    }
  };

  const handleCheckout = async () => {
    if (!signup) return;
    setSubmitting('checkout');
    try {
      const response = await createBrokerOnboardingCheckoutSession(signup.token, {
        planCode: signup.selectedPlanCode,
        interval: (signup.selectedBillingInterval as 'monthly' | 'yearly') || 'monthly',
        couponCode: couponCode.trim() || undefined,
      });
      window.location.href = response.url;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία δημιουργίας checkout session.', 'error');
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-ambient)] text-sm text-[var(--text-secondary)]">
        Φόρτωση onboarding...
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[var(--surface-ambient)]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-16 top-8 h-64 w-64 rounded-full bg-[var(--brand-primary)] opacity-[0.12] blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-[var(--surface-glow-hover)] opacity-70 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[var(--status-info-bg)] opacity-60 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:flex-row lg:gap-8 lg:px-8">
        <aside className="mb-6 rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-glow)]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur lg:mb-0 lg:w-[360px] lg:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[var(--brand-primary)] p-3 text-[var(--text-on-brand)] shadow-sm">
                <DavlosLogo className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Davlos</div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">Broker Onboarding</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          <div className="mt-8 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Progress</div>
                <div className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{progress}%</div>
              </div>
              <div className="rounded-full border border-[var(--brand-primary)] bg-[var(--brand-primary-muted)] px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">
                {signup?.activated ? 'Ενεργό' : `Βήμα ${currentStep}/5`}
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-[var(--surface-glow)]">
              <div
                className="h-2 rounded-full bg-[var(--brand-primary)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {steps.map((step) => {
              const isDone = signup?.activated ? true : step.id < currentStep || (step.id === 5 && signup?.activated);
              const isActive = !signup?.activated && step.id === currentStep;
              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border p-4 transition-colors ${statusTone(isDone, isActive)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-current/20 bg-white/20 text-sm font-semibold">
                      {isDone ? <CheckCircle2 size={16} /> : step.id}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">{step.eyebrow}</div>
                      <div className="mt-1 text-sm font-semibold">{step.title}</div>
                      <p className="mt-1 text-xs opacity-80">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <Sparkles size={16} className="text-[var(--brand-primary)]" />
              Τι ενεργοποιείται
            </div>
            <div className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
              <div>Ο λογαριασμός δημιουργείται μόνο μετά από επιβεβαίωση email, κινητού, επιχείρησης και πληρωμής.</div>
              <div>Το plan και το billing interval αποθηκεύονται από την αρχή, ώστε το checkout να έρθει στο σωστό commercial path.</div>
              <div>Αν γυρίσεις αργότερα με το ίδιο onboarding token, συνεχίζεις από το σωστό βήμα.</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateLogin}
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Έχω ήδη λογαριασμό
            <ChevronRight size={16} />
          </button>
        </aside>

        <main className="flex-1">
          <div className="rounded-[32px] border border-[var(--border-default)] bg-[var(--surface-glow)]/95 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.08)] backdrop-blur md:p-8 lg:min-h-[calc(100vh-4rem)] lg:p-10">
            {!signup && (
              <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <div className="max-w-2xl">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-primary)]">Step 1</div>
                    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-primary)] lg:text-5xl">
                      Δημιούργησε το broker workspace σου με λιγότερο friction.
                    </h1>
                    <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
                      Ξεκινάς με τα βασικά στοιχεία, κλειδώνεις το plan σου, και μετά περνάς μόνο από τις απαραίτητες επιβεβαιώσεις
                      πριν το checkout.
                    </p>
                  </div>

                  <form onSubmit={handleStart} className="mt-8 space-y-8">
                    <section>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Στοιχεία broker</div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {[
                          ['Ονοματεπώνυμο', 'fullName'],
                          ['Email', 'email'],
                          ['Κωδικός πρόσβασης', 'password'],
                          ['Κινητό', 'phone'],
                        ].map(([label, key]) => (
                          <label key={key} className="text-sm text-[var(--text-secondary)]">
                            <span className="mb-2 block font-medium text-[var(--text-primary)]">{label}</span>
                            <input
                              type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
                              value={form[key as keyof FormState] as string}
                              onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none transition-colors focus:border-[var(--brand-primary)]"
                              required
                            />
                          </label>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Στοιχεία εταιρείας</div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {[
                          ['Επωνυμία / Business name', 'businessName'],
                          ['ΓΕΜΗ', 'gemiNumber'],
                          ['ΑΦΜ', 'taxId'],
                        ].map(([label, key]) => (
                          <label key={key} className="text-sm text-[var(--text-secondary)]">
                            <span className="mb-2 block font-medium text-[var(--text-primary)]">{label}</span>
                            <input
                              type="text"
                              value={form[key as keyof FormState] as string}
                              onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                              className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none transition-colors focus:border-[var(--brand-primary)]"
                              required
                            />
                          </label>
                        ))}
                      </div>
                    </section>

                    <section>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Plan</div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)]">
                            Για το πρώτο launch ενεργοποιείται μόνο το Core. Τα υπόλοιπα premium plans παραμένουν ορατά ως Coming soon.
                          </div>
                        </div>
                        <div className="inline-flex rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-1">
                          {(['monthly', 'yearly'] as const).map((interval) => (
                            <button
                              key={interval}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, selectedBillingInterval: interval }))}
                              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                                form.selectedBillingInterval === interval
                                  ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)]'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              {interval === 'monthly' ? 'Μηνιαία' : 'Ετήσια'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 2xl:grid-cols-2">
                        {catalog.map((plan) => {
                          const isSelected = form.selectedPlanCode === plan.code;
                          const isPurchasable = plan.purchasable;
                          const price =
                            form.selectedBillingInterval === 'yearly'
                              ? formatPrice(plan.yearlyPriceCents)
                              : formatPrice(plan.monthlyPriceCents);
                          const hasTrial = plan.trialDays != null && plan.trialDays > 0;
                          return (
                            <button
                              key={plan.code}
                              type="button"
                              onClick={() => {
                                if (!isPurchasable) {
                                  return;
                                }
                                setForm((prev) => ({ ...prev, selectedPlanCode: plan.code }));
                              }}
                              className={`rounded-[24px] border p-5 text-left transition-all ${
                                isSelected
                                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-muted)] shadow-[0_10px_30px_rgba(0,0,0,0.06)]'
                                  : isPurchasable
                                    ? 'border-[var(--border-default)] bg-[var(--surface-ambient)] hover:border-[var(--brand-primary)]/40'
                                    : 'border-[var(--border-default)] bg-[var(--surface-ambient)] opacity-80'
                              }`}
                              disabled={!isPurchasable}
                            >
                              <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-base font-semibold text-[var(--text-primary)]">{plan.name}</div>
                                    {!isPurchasable && (
                                      <span className="rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--status-warning-text)]">
                                        Coming soon
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{plan.description}</div>
                                  {!isPurchasable && (
                                    <div className="mt-2 text-xs text-[var(--text-tertiary)]">
                                      Η εμπορική ενεργοποίηση αυτού του plan θα ακολουθήσει μετά το initial launch.
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="w-fit rounded-full bg-[var(--brand-primary)] px-3 py-1 text-xs font-semibold text-[var(--text-on-brand)]">
                                    Επιλεγμένο
                                  </div>
                                )}
                              </div>
                              <div className="mt-5 flex flex-col gap-2 2xl:flex-row 2xl:items-end 2xl:justify-between">
                                <div className="min-w-0">
                                  {hasTrial ? (
                                    <>
                                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--status-success-text)]">
                                        {plan.trialDays} ημέρες δωρεάν
                                      </div>
                                      <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Σήμερα 0€</div>
                                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                                        Έπειτα {price} {form.selectedBillingInterval === 'yearly' ? 'ανά έτος' : 'ανά μήνα'}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-2xl font-semibold text-[var(--text-primary)]">{price}</div>
                                  )}
                                </div>
                                <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                                  {hasTrial
                                    ? 'trial πρώτα'
                                    : form.selectedBillingInterval === 'yearly'
                                      ? 'ανά έτος'
                                      : 'ανά μήνα'}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-6">
                      <div className="max-w-xl text-sm text-[var(--text-secondary)]">
                        Δεν δημιουργείται ακόμη ενεργός λογαριασμός. Στο επόμενο βήμα θα στείλουμε verification code στο email που δήλωσες.
                      </div>
                      <button
                        type="submit"
                        disabled={submitting !== null || !form.selectedPlanCode}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition-opacity disabled:opacity-60"
                      >
                        {submitting === 'start' ? 'Έναρξη...' : 'Συνέχεια'}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </form>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-6">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Flow</div>
                    <div className="mt-4 space-y-4">
                      {[
                        'Στοιχεία broker και εταιρείας',
                        'Email verification',
                        'Phone verification',
                        'Business verification',
                        'Checkout και activation',
                      ].map((item, index) => (
                        <div key={item} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-glow)] text-sm font-semibold text-[var(--text-primary)]">
                            {index + 1}
                          </div>
                          <div className="text-sm text-[var(--text-secondary)]">{item}</div>
                        </div>
                      ))}
                    </div>
                    {catalog.length > purchasableCatalog.length && (
                      <div className="mt-4 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-xs text-[var(--status-warning-text)]">
                        Premium plans όπως Integrations, AI και Unlimited είναι ήδη ορατά στο catalog, αλλά προς το παρόν παραμένουν Coming soon και δεν ανοίγουν checkout path.
                      </div>
                    )}
                  </div>

                  {selectedPlan && (
                    <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-6">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Selected Plan</div>
                      <div className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{selectedPlan.name}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{selectedPlan.description}</div>
                      <div className="mt-6 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] px-4 py-4">
                        <div className="text-sm text-[var(--text-secondary)]">
                          {hasSelectedPlanTrial
                            ? `Δωρεάν trial ${selectedPlanTrialDays} ημερών`
                            : form.selectedBillingInterval === 'yearly' ? 'Ετήσια χρέωση' : 'Μηνιαία χρέωση'}
                        </div>
                        {hasSelectedPlanTrial ? (
                          <>
                            <div className="mt-2 text-3xl font-semibold text-[var(--status-success-text)]">0€ σήμερα</div>
                            <div className="mt-2 text-sm text-[var(--text-secondary)]">
                              Το checkout γίνεται για επιβεβαίωση κάρτας. Η κανονική χρέωση θα ξεκινήσει μετά τις {trialEndsLabel}.
                            </div>
                            <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">
                              Μετά το trial: {formatPrice(postTrialDisplayPrice)} {form.selectedBillingInterval === 'yearly' ? 'ανά έτος' : 'ανά μήνα'}
                            </div>
                          </>
                        ) : (
                          <div className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
                            {form.selectedBillingInterval === 'yearly'
                              ? formatPrice(selectedPlan.yearlyPriceCents)
                              : formatPrice(selectedPlan.monthlyPriceCents)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {signup && (
              <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <div className="max-w-2xl">
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-primary)]">
                      {signup.activated ? 'Ολοκληρώθηκε' : `Step ${currentStep}`}
                    </div>
                    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-primary)] lg:text-5xl">
                      {signup.activated
                        ? 'Ο λογαριασμός σου ενεργοποιήθηκε.'
                        : steps[currentStep - 1]?.title || 'Συνέχισε το onboarding'}
                    </h1>
                    <p className="mt-4 text-base leading-7 text-[var(--text-secondary)]">
                      {signup.activated
                        ? 'Έχει δημιουργηθεί πλέον ο πραγματικός broker λογαριασμός σου. Μπορείς να προχωρήσεις σε login.'
                        : steps[currentStep - 1]?.description}
                    </p>
                  </div>

                  {currentStep === 2 && !signup.activated && (
                    <div className="mt-8 rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-ambient)] p-6">
                      <div className="flex items-center gap-3 text-[var(--text-primary)]">
                        <Mail size={18} className="text-[var(--brand-primary)]" />
                        <div className="text-lg font-semibold">Επιβεβαίωση email</div>
                      </div>
                      <p className="mt-3 text-sm text-[var(--text-secondary)]">
                        Στείλαμε verification code στο <span className="font-semibold text-[var(--text-primary)]">{signup.email}</span>.
                      </p>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <input
                          value={emailCode}
                          onChange={(event) => setEmailCode(event.target.value)}
                          placeholder="Κωδικός email"
                          className="flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--brand-primary)]"
                        />
                        <button
                          type="button"
                          onClick={handleEmailVerify}
                          disabled={submitting !== null || signup.emailVerified}
                          className="rounded-2xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
                        >
                          Επιβεβαίωση
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleEmailRequest}
                        disabled={submitting !== null}
                        className="mt-4 text-sm font-semibold text-[var(--brand-primary)]"
                      >
                        Επαναποστολή κωδικού
                      </button>
                    </div>
                  )}

                  {currentStep === 3 && !signup.activated && (
                    <div className="mt-8 rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-ambient)] p-6">
                      <div className="flex items-center gap-3 text-[var(--text-primary)]">
                        <Phone size={18} className="text-[var(--brand-primary)]" />
                        <div className="text-lg font-semibold">Επιβεβαίωση κινητού</div>
                      </div>
                      <p className="mt-3 text-sm text-[var(--text-secondary)]">
                        Χρησιμοποιούμε το <span className="font-semibold text-[var(--text-primary)]">{signup.phone}</span> για OTP και operational notifications.
                      </p>
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <input
                          value={phoneCode}
                          onChange={(event) => setPhoneCode(event.target.value)}
                          placeholder="Κωδικός κινητού"
                          className="flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--brand-primary)]"
                        />
                        <button
                          type="button"
                          onClick={handlePhoneVerify}
                          disabled={submitting !== null || signup.phoneVerified}
                          className="rounded-2xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
                        >
                          Επιβεβαίωση
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handlePhoneRequest}
                        disabled={submitting !== null}
                        className="mt-4 text-sm font-semibold text-[var(--brand-primary)]"
                      >
                        Αποστολή phone code
                      </button>
                    </div>
                  )}

                  {currentStep === 4 && !signup.activated && (
                    <div className="mt-8 rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-ambient)] p-6">
                      <div className="flex items-center gap-3 text-[var(--text-primary)]">
                        <ShieldCheck size={18} className="text-[var(--brand-primary)]" />
                        <div className="text-lg font-semibold">Επιβεβαίωση επιχείρησης</div>
                      </div>
                      <div className="mt-5 grid gap-4 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-glow)] p-5 md:grid-cols-3">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Επωνυμία</div>
                          <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{signup.businessName}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">ΓΕΜΗ</div>
                          <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{signup.gemiNumber}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">ΑΦΜ</div>
                          <div className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{signup.taxId}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleBusinessVerify}
                        disabled={submitting !== null || signup.businessVerified}
                        className="mt-5 rounded-2xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
                      >
                        Επιβεβαίωση στοιχείων επιχείρησης
                      </button>
                      {(signup.businessVerificationMessage || signup.businessVerificationCheckedAt || signup.verifiedBusinessName) && (
                        <div className="mt-5 rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-glow)] p-5">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Verification Result</div>
                          <div className="mt-3 grid gap-3 text-sm text-[var(--text-secondary)] md:grid-cols-2">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Provider</div>
                              <div className="mt-1 font-semibold text-[var(--text-primary)]">{signup.businessVerificationSource || 'Εκκρεμεί'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Κατάσταση</div>
                              <div className="mt-1 font-semibold text-[var(--text-primary)]">{signup.businessVerificationStatus || (signup.businessVerified ? 'VERIFIED' : 'PENDING')}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Επαληθευμένη επωνυμία</div>
                              <div className="mt-1 font-semibold text-[var(--text-primary)]">{signup.verifiedBusinessName || '-'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Provider reference</div>
                              <div className="mt-1 font-semibold text-[var(--text-primary)]">{signup.businessVerificationReference || '-'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Χρόνος ελέγχου</div>
                              <div className="mt-1 font-semibold text-[var(--text-primary)]">{formatVerificationDate(signup.businessVerificationCheckedAt) || '-'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Επαληθευμένο ΑΦΜ / ΓΕΜΗ</div>
                              <div className="mt-1 font-semibold text-[var(--text-primary)]">
                                {[signup.verifiedTaxId, signup.verifiedGemiNumber].filter(Boolean).join(' / ') || '-'}
                              </div>
                            </div>
                          </div>
                          {signup.businessVerificationMessage && (
                            <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-ambient)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                              {signup.businessVerificationMessage}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 5 && !signup.activated && (
                    <div className="mt-8 rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-ambient)] p-6">
                      <div className="text-lg font-semibold text-[var(--text-primary)]">Checkout και ενεργοποίηση</div>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
                        Όλες οι απαραίτητες επιβεβαιώσεις έχουν ολοκληρωθεί. Προχωράς σε checkout και ο λογαριασμός ενεργοποιείται όταν
                        επιβεβαιωθεί η συνδρομή από τον billing provider.
                        {hasSelectedPlanTrial && selectedPlanTrialDays
                          ? ` Για το συγκεκριμένο plan οι πρώτες ${selectedPlanTrialDays} ημέρες είναι δωρεάν, άρα σήμερα γίνεται μόνο επιβεβαίωση κάρτας και η κανονική χρέωση ξεκινά μετά τις ${trialEndsLabel}.`
                          : ''}
                      </p>
                      <div className="mt-5 max-w-md">
                        <label className="text-sm text-[var(--text-secondary)]">
                          <span className="mb-2 block font-medium text-[var(--text-primary)]">Coupon code</span>
                          <input
                            value={couponCode}
                            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                            placeholder="Προαιρετικό"
                            className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm outline-none transition-colors focus:border-[var(--brand-primary)]"
                          />
                        </label>
                        <div className="mt-2 text-xs text-[var(--text-tertiary)]">
                          Προαιρετικός κωδικός έκπτωσης που έχει εκδοθεί από το admin portal.
                        </div>
                        {couponPreview && (
                          <div className="mt-3 rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success-text)]">
                            <div className="font-semibold">{couponPreview.code} · {couponPreview.percentOff}% έκπτωση</div>
                            {couponPreview.applicablePlanCode && (
                              <div className="mt-1 text-xs opacity-90">Ισχύει μόνο για plan {couponPreview.applicablePlanCode}.</div>
                            )}
                            {couponValidityLabel && (
                              <div className="mt-1 text-xs opacity-90">{couponValidityLabel}</div>
                            )}
                          </div>
                        )}
                        {couponPreviewError && (
                          <div className="mt-3 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning-text)]">
                            {couponPreviewError}
                          </div>
                        )}
                      </div>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleCheckout}
                          disabled={submitting !== null || signup.activated}
                          className="rounded-2xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-on-brand)] disabled:opacity-60"
                        >
                          {submitting === 'checkout' ? 'Μετάβαση...' : 'Συνέχεια σε checkout'}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadState(signup.token).catch(() => undefined)}
                          className="rounded-2xl border border-[var(--border-default)] px-5 py-3 text-sm font-semibold text-[var(--text-secondary)]"
                        >
                          Ανανέωση κατάστασης
                        </button>
                      </div>
                    </div>
                  )}

                  {signup.activated && (
                    <div className="mt-8 rounded-[28px] border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-6">
                      <div className="flex items-center gap-3 text-[var(--status-success-text)]">
                        <CheckCircle2 size={20} />
                        <div className="text-lg font-semibold">Ενεργός λογαριασμός</div>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[var(--status-success-text)]">
                        Το onboarding ολοκληρώθηκε και μπορείς να μπεις στο broker login με το email που δήλωσες.
                      </p>
                      <button
                        type="button"
                        onClick={onNavigateLogin}
                        className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[var(--status-success-border)] bg-white/80 px-5 py-3 text-sm font-semibold text-[var(--status-success-text)]"
                      >
                        Μετάβαση σε login
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-6">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Current State</div>
                    <div className="mt-4 space-y-3">
                      {[
                        ['Email', signup.emailVerified, signup.email],
                        ['Κινητό', signup.phoneVerified, signup.phone],
                        ['Επιχείρηση', signup.businessVerified, signup.businessVerificationSource
                          ? `${signup.businessVerificationSource}${signup.businessVerificationCheckedAt ? ` • ${formatVerificationDate(signup.businessVerificationCheckedAt)}` : ''}`
                          : 'Εκκρεμεί'],
                      ].map(([label, done, value]) => (
                        <div key={label as string} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
                              <div className="mt-1 text-xs text-[var(--text-secondary)]">{value as string}</div>
                            </div>
                            <div
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                done
                                  ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                                  : 'bg-[var(--surface-ambient)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {done ? 'ΟΚ' : 'Εκκρεμεί'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedPlan && (
                    <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-6">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Plan Summary</div>
                      <div className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{selectedPlan.name}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{selectedPlan.description}</div>
                      <div className="mt-5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                        <div className="text-sm text-[var(--text-secondary)]">
                          {hasSelectedPlanTrial
                            ? `Σήμερα πληρώνεις`
                            : selectedInterval === 'yearly' ? 'Ετήσια χρέωση' : 'Μηνιαία χρέωση'}
                        </div>
                        {hasSelectedPlanTrial ? (
                          <div className="mt-2">
                            <div className="text-3xl font-semibold text-[var(--status-success-text)]">0€</div>
                            <div className="mt-2 text-sm text-[var(--text-secondary)]">
                              Μετά το δωρεάν trial των {selectedPlanTrialDays} ημερών:
                            </div>
                            <div className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                              {formatPrice(postTrialDisplayPrice)} {selectedInterval === 'yearly' ? 'ανά έτος' : 'ανά μήνα'}
                            </div>
                            {trialEndsLabel && (
                              <div className="mt-2 text-xs text-[var(--text-secondary)]">
                                Η κανονική χρέωση ξεκινά μετά τις {trialEndsLabel}.
                              </div>
                            )}
                            {couponValidityLabel && couponPreview && (
                              <div className="mt-2 text-xs text-[var(--text-secondary)]">{couponValidityLabel}</div>
                            )}
                          </div>
                        ) : couponPreview && selectedDiscountedPrice !== selectedBasePrice ? (
                          <div className="mt-2">
                            <div className="text-sm text-[var(--text-tertiary)] line-through">
                              {formatPrice(selectedBasePrice)}
                            </div>
                            <div className="text-3xl font-semibold text-[var(--status-success-text)]">
                              {formatPrice(selectedDiscountedPrice)}
                            </div>
                            {couponValidityLabel && (
                              <div className="mt-2 text-xs text-[var(--text-secondary)]">{couponValidityLabel}</div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
                            {formatPrice(selectedBasePrice)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-6">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Status</div>
                    <div className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{signup.status}</div>
                    <div className="mt-2 text-sm text-[var(--text-secondary)]">
                      Token-based onboarding state. Μπορείς να επιστρέψεις και να συνεχίσεις από εδώ χωρίς να ξαναγράψεις τα πάντα.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
