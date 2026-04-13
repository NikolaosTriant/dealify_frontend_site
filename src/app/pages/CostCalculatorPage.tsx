import { type ReactNode, useMemo, useState } from 'react';
import { Calculator, ChevronDown, Mail, ReceiptText } from 'lucide-react';

type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'new-build';
type Region = 'attica' | 'thessaloniki' | 'other';

type CalculatorForm = {
  propertyValue: number;
  propertyType: PropertyType;
  region: Region;
  firstTimeBuyer: boolean;
  mortgage: boolean;
  brokerCommissionRate: number;
  email: string;
};

const initialForm: CalculatorForm = {
  propertyValue: 280000,
  propertyType: 'apartment',
  region: 'attica',
  firstTimeBuyer: false,
  mortgage: false,
  brokerCommissionRate: 2,
  email: '',
};

function calcNotaryFees(value: number) {
  if (value <= 120000) return value * 0.008;
  if (value <= 380000) return 960 + (value - 120000) * 0.007;
  return 2780 + (value - 380000) * 0.006;
}

function calcLawyerFees(value: number, region: Region) {
  if (region === 'attica') return value * 0.01;
  if (region === 'thessaloniki') return value * 0.008;
  return value * 0.006;
}

function calcEngineerFees(propertyType: PropertyType) {
  if (propertyType === 'land') return 300;
  if (propertyType === 'commercial') return 800;
  if (propertyType === 'new-build') return 650;
  return 500;
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2.5 pr-10 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
      />
    </div>
  );
}

export function CostCalculatorPage() {
  const [form, setForm] = useState<CalculatorForm>(initialForm);
  const [showResults, setShowResults] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);

  const results = useMemo(() => {
    const transferTax = form.propertyType === 'new-build' ? form.propertyValue * 0.24 : form.propertyValue * 0.03;
    const notary = calcNotaryFees(form.propertyValue);
    const lawyer = calcLawyerFees(form.propertyValue, form.region);
    const engineer = calcEngineerFees(form.propertyType);
    const broker = form.propertyValue * (form.brokerCommissionRate / 100);
    const mortgageEstimate = form.mortgage ? 400 : 0;
    const firstTimeDiscount = form.firstTimeBuyer && form.propertyType !== 'new-build' ? transferTax * 0.15 : 0;

    const total = transferTax + notary + lawyer + engineer + broker + mortgageEstimate - firstTimeDiscount;

    return {
      transferTax,
      notary,
      lawyer,
      engineer,
      broker,
      mortgageEstimate,
      firstTimeDiscount,
      total,
    };
  }, [form]);

  const lineItems = [
    { label: 'Φόρος μεταβίβασης / ΦΠΑ', value: results.transferTax },
    { label: 'Αμοιβή συμβολαιογράφου', value: results.notary },
    { label: 'Αμοιβή δικηγόρου', value: results.lawyer },
    { label: 'Αμοιβή μηχανικού', value: results.engineer },
    { label: 'Μεσιτική αμοιβή', value: results.broker },
  ];

  return (
    <div className="min-h-screen bg-[var(--surface-ambient)] px-6 py-6">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-glow)] text-[var(--text-primary)] shadow-[0_28px_80px_rgba(15,23,42,0.12)] dark:bg-[var(--surface-darkness)] dark:text-[var(--text-on-dark)]">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-highlight)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-primary)] dark:border-white/10 dark:bg-white/5">
                <Calculator size={14} />
                Υπολογιστής Κόστους
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">Υπολόγισε άμεσα το εκτιμώμενο κόστος αγοραπωλησίας.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] dark:text-[var(--text-on-dark-muted)]">
                Χρησιμοποίησε το preset σαν γρήγορη αφετηρία ή προσαρμόσε όλα τα πεδία για να δώσεις στον πελάτη άμεση εικόνα για φόρους, αμοιβές και συνολικό κόστος.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-highlight)] p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] dark:text-[var(--text-on-dark-muted)]">Preset</p>
                <p className="mt-2 text-lg font-semibold">Βούλα · 3ος όροφος</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-highlight)] p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] dark:text-[var(--text-on-dark-muted)]">Τιμή</p>
                <p className="mt-2 text-lg font-semibold">{formatEuro(form.propertyValue)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-highlight)] p-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] dark:text-[var(--text-on-dark-muted)]">Σύνολο</p>
                <p className="mt-2 text-lg font-semibold">{formatEuro(results.total)}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[var(--brand-warm-muted)] p-3 text-[var(--brand-warm)]">
                <ReceiptText size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Στοιχεία Υπολογισμού</h2>
                <p className="text-sm text-[var(--text-tertiary)]">Προσαρμόζεις τις παραμέτρους και το αποτέλεσμα ενημερώνεται άμεσα.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Αξία ακινήτου (€)</span>
                <input
                  type="number"
                  min={0}
                  value={form.propertyValue}
                  onChange={(event) => setForm((prev) => ({ ...prev, propertyValue: Number(event.target.value) || 0 }))}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Μεσιτική αμοιβή (%)</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.brokerCommissionRate}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      brokerCommissionRate: Number(event.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Τύπος ακινήτου</span>
                <SelectField
                  value={form.propertyType}
                  onChange={(value) => setForm((prev) => ({ ...prev, propertyType: value as PropertyType }))}
                >
                  <option value="apartment">Διαμέρισμα</option>
                  <option value="house">Μονοκατοικία</option>
                  <option value="land">Οικόπεδο</option>
                  <option value="commercial">Επαγγελματικό</option>
                  <option value="new-build">Νεόδμητο</option>
                </SelectField>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Περιοχή</span>
                <SelectField
                  value={form.region}
                  onChange={(value) => setForm((prev) => ({ ...prev, region: value as Region }))}
                >
                  <option value="attica">Αττική</option>
                  <option value="thessaloniki">Θεσσαλονίκη</option>
                  <option value="other">Λοιπή Ελλάδα</option>
                </SelectField>
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, firstTimeBuyer: !prev.firstTimeBuyer }))}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  form.firstTimeBuyer
                    ? 'border-[var(--border-brand)] bg-[var(--brand-warm-muted)] text-[var(--text-primary)]'
                    : 'border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]'
                }`}
              >
                <p className="text-sm font-semibold">Πρώτη κατοικία</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Εφαρμόζει εκτιμώμενη έκπτωση στον φόρο μεταβίβασης.</p>
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, mortgage: !prev.mortgage }))}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  form.mortgage
                    ? 'border-[var(--border-brand)] bg-[var(--brand-warm-muted)] text-[var(--text-primary)]'
                    : 'border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]'
                }`}
              >
                <p className="text-sm font-semibold">Με στεγαστικό</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Προσθέτει εκτιμώμενο κόστος δανείου.</p>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowResults(true)}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)]"
            >
              <Calculator size={16} />
              Υπολογισμός
            </button>
          </section>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Ανάλυση Κόστους</h2>
                  <p className="text-sm text-[var(--text-tertiary)]">Το breakdown ενημερώνεται με βάση τα τρέχοντα inputs.</p>
                </div>
                <span className="rounded-full bg-[var(--surface-highlight)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                  Live estimate
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {lineItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 py-3">
                    <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{formatEuro(item.value)}</span>
                  </div>
                ))}
                {results.mortgageEstimate > 0 && (
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 py-3">
                    <span className="text-sm text-[var(--text-secondary)]">Έξτρα στεγαστικού</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{formatEuro(results.mortgageEstimate)}</span>
                  </div>
                )}
                {results.firstTimeDiscount > 0 && (
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3">
                    <span className="text-sm text-[var(--status-success-text)]">Έκπτωση πρώτης κατοικίας</span>
                    <span className="text-sm font-semibold text-[var(--status-success-text)]">-{formatEuro(results.firstTimeDiscount)}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-[24px] border border-[var(--border-brand)] bg-[var(--brand-warm-muted)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Συνολικό Εκτιμώμενο Κόστος</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{formatEuro(results.total)}</p>
                {!showResults && <p className="mt-1 text-xs text-[var(--text-tertiary)]">Πάτησε «Υπολογισμός» για να δεις άμεσα το συνολικό σενάριο κόστους.</p>}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[var(--surface-highlight)] p-3 text-[var(--brand-primary)]">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Lead Capture</h3>
                  <p className="text-sm text-[var(--text-tertiary)]">Αν ο πελάτης θέλει follow-up, αφήνει email και ο μεσίτης συνεχίζει από εκεί.</p>
                </div>
              </div>

              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="you@example.com"
                className="mt-5 w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
              />
              <button
                type="button"
                onClick={() => setLeadCaptured(Boolean(form.email.trim()))}
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-[var(--brand-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)]"
              >
                Αποστολή
              </button>
              {leadCaptured && (
                <p className="mt-3 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-2 text-sm text-[var(--status-success-text)]">
                  Το email καταχωρήθηκε.
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
