import { FormEvent, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { DavlosLogo } from '../components/DavlosLogo';
import { confirmPasswordReset, requestPasswordReset } from '../api/trustlayerApi';

type Props = {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  mode?: 'broker' | 'admin';
  onLogin: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  onLoginSuccess: () => void;
  onNavigateRegister?: () => void;
};

type HiddenSnippet = {
  text: string;
  x: number;
  y: number;
  rotation: number;
};

const hiddenSnippets: HiddenSnippet[] = [
  { text: '📊 3 νέα leads σήμερα — Spitogatos', x: 15, y: 25, rotation: -2 },
  { text: '⏰ Εκκρεμεί: ΗΤΚ μηχανικού (12 ημέρες)', x: 72, y: 18, rotation: 1 },
  { text: '✓ Δικηγόρος: Έλεγχος τίτλων ολοκληρώθηκε', x: 45, y: 35, rotation: -1 },
  { text: "⚠️ Ο πελάτης ρώτησε 'πού βρισκόμαστε;' — 2 φορές", x: 82, y: 45, rotation: 2 },
  { text: '💰 €3.200 αμοιβή — 42 ημέρες αντί 90', x: 25, y: 55, rotation: -3 },
  { text: '📩 Υπενθύμιση στάλθηκε → Λογιστής', x: 68, y: 62, rotation: 1 },
  { text: '🏠 Παπαδόπουλος: Φάση 2 — Skill Tree ενεργό', x: 12, y: 72, rotation: -1 },
  { text: '📋 4/6 έγγραφα εγκρίθηκαν', x: 55, y: 78, rotation: 2 },
  { text: '🔔 Συμβολαιογράφος επιβεβαίωσε ημερομηνία', x: 78, y: 85, rotation: -2 },
  { text: '⚡ Μέσος χρόνος κλεισίματος: 38 ημέρες', x: 35, y: 88, rotation: 1 },
];

export function LoginPage({ theme, onToggleTheme, mode = 'broker', onLogin, onLoginSuccess, onNavigateRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isFocusedEmail, setIsFocusedEmail] = useState(false);
  const [isFocusedPassword, setIsFocusedPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [actualPos, setActualPos] = useState({ x: 0, y: 0 });
  const darkPanelRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resetToken');
    setResetToken(token);
    if (token) {
      setForgotMode(false);
      setError(null);
      setResetSuccess(null);
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!darkPanelRef.current) return;
      const rect = darkPanelRef.current.getBoundingClientRect();
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        setMousePos({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }
    };

    if (window.innerWidth >= 1024) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const animate = () => {
      setActualPos((prev) => ({
        x: prev.x + (mousePos.x - prev.x) * 0.12,
        y: prev.y + (mousePos.y - prev.y) * 0.12,
      }));
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [mousePos]);

  const getSnippetOpacity = (snippetX: number, snippetY: number) => {
    if (!darkPanelRef.current) return 0;

    const rect = darkPanelRef.current.getBoundingClientRect();
    const snippetPosX = (snippetX / 100) * rect.width;
    const snippetPosY = (snippetY / 100) * rect.height;
    const distance = Math.sqrt(
      Math.pow(actualPos.x - snippetPosX, 2) + Math.pow(actualPos.y - snippetPosY, 2),
    );

    const maxDistance = 150;
    const peakDistance = 80;

    if (distance > maxDistance) return 0;
    if (distance < peakDistance) {
      return 0.7 * (1 - (distance / peakDistance) * 0.3);
    }

    return 0.7 * (1 - (distance - peakDistance) / (maxDistance - peakDistance));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onLogin(email, password, rememberMe);
      onLoginSuccess();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Λάθος στοιχεία σύνδεσης.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: FormEvent) => {
    event.preventDefault();
    setForgotSubmitting(true);
    setError(null);
    setForgotSuccess(null);
    try {
      await requestPasswordReset(forgotEmail);
      setForgotSuccess('Αν υπάρχει λογαριασμός για αυτό το email, στάλθηκε link επαναφοράς κωδικού.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Αποτυχία αποστολής link επαναφοράς.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetToken) {
      return;
    }
    setResetSubmitting(true);
    setError(null);
    setResetSuccess(null);
    try {
      if (resetPassword !== resetPasswordConfirm) {
        throw new Error('Οι κωδικοί δεν ταιριάζουν.');
      }
      await confirmPasswordReset(resetToken, resetPassword);
      setResetSuccess('Ο κωδικός άλλαξε. Μπορείς τώρα να συνδεθείς με τον νέο κωδικό.');
      setResetPassword('');
      setResetPasswordConfirm('');
      const url = new URL(window.location.href);
      url.searchParams.delete('resetToken');
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      setResetToken(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Αποτυχία επαναφοράς κωδικού.');
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen bg-[var(--surface-ambient)]">
      <div className="fixed right-6 top-4 z-50 inline-flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          aria-label={theme === 'light' ? 'Ενεργοποίηση dark mode' : 'Ενεργοποίηση light mode'}
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] text-[var(--text-tertiary)] shadow-sm transition-colors hover:bg-[var(--surface-glow-hover)] hover:text-[var(--text-primary)]"
        >
          <Moon
            size={16}
            className={`absolute transition-all duration-300 ${
              theme === 'light' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-180'
            }`}
          />
          <Sun
            size={16}
            className={`absolute transition-all duration-300 ${
              theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 rotate-180'
            }`}
          />
        </button>
      </div>

      <div
        ref={darkPanelRef}
        className="relative hidden overflow-hidden bg-[#1A1612] lg:flex lg:w-[60%]"
      >
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: `
              radial-gradient(80px at ${actualPos.x}px ${actualPos.y}px, rgba(232,145,58,0.15), transparent),
              radial-gradient(140px at ${actualPos.x}px ${actualPos.y}px, rgba(232,145,58,0.06), transparent),
              radial-gradient(200px at ${actualPos.x}px ${actualPos.y}px, rgba(232,145,58,0.02), transparent)
            `,
          }}
        />

        {hiddenSnippets.map((snippet, index) => (
          <div
            key={index}
            className="absolute text-xs font-mono pointer-events-none transition-opacity duration-400 ease-out"
            style={{
              left: `${snippet.x}%`,
              top: `${snippet.y}%`,
              transform: `rotate(${snippet.rotation}deg)`,
              opacity: getSnippetOpacity(snippet.x, snippet.y),
              color: '#E8913A',
            }}
          >
            {snippet.text}
          </div>
        ))}

        <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-[#E8913A] opacity-[0.03] blur-[120px] rounded-full" />

        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          <div>
            <div className="flex items-center gap-4 mb-16">
              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-[#E8913A] blur-lg opacity-20" />
                <div className="relative bg-gradient-to-br from-[#E8913A] to-[#D67D2E] p-3 rounded-2xl shadow-lg shadow-[#E8913A]/10">
                  <DavlosLogo className="h-8 w-8 text-[#1A1A1A]" />
                </div>
              </div>
              <h1 className="text-3xl font-semibold text-[#f8f6f2] tracking-tight">Δαυλός</h1>
            </div>

            <div className="max-w-md space-y-10">
              <div>
                <h2 className="text-4xl font-medium text-[#f8f6f2] leading-tight mb-2">
                  Ρίχνουμε φως σε κάθε συναλλαγή.
                </h2>
                <p className="text-sm text-[#f8f6f2]/50 leading-relaxed mt-2">
                  Η πλατφόρμα που μετατρέπει τον μεσίτη από τηλεφωνητή σε project manager.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E8913A] mt-2.5" />
                  <p className="text-sm text-[#f8f6f2]/75 leading-relaxed">
                    Ο πελάτης δεν θα ξαναρωτήσει "πού βρισκόμαστε;"
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E8913A] mt-2.5" />
                  <p className="text-sm text-[#f8f6f2]/75 leading-relaxed">
                    15 τηλέφωνα την εβδομάδα → 0
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E8913A] mt-2.5" />
                  <p className="text-sm text-[#f8f6f2]/75 leading-relaxed">
                    Κάθε deal, ένα dashboard. Όχι 4 Viber groups.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[#f8f6f2]/30 text-sm">© 2026 Δαυλός</div>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-[var(--surface-ambient)] p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#E8913A]/3 blur-[100px] rounded-full" />

        <div className="w-full max-w-md relative z-10">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="relative">
              <div className="absolute inset-0 bg-[#E8913A] blur-lg opacity-20" />
              <div className="relative bg-gradient-to-br from-[#E8913A] to-[#D67D2E] p-2.5 rounded-xl">
                <DavlosLogo className="h-6 w-6 text-[#1A1A1A]" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Δαυλός</h1>
          </div>

          <div className="space-y-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-glow)] p-8 shadow-sm">
            <div className="space-y-3">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary-muted)] px-3 py-1.5">
                <DavlosLogo className="h-3.5 w-3.5 text-[#E8913A]" />
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  {mode === 'admin' ? 'Δαυλός Admin Console' : 'Δαυλός Broker Workspace'}
                </span>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                {mode === 'admin' ? 'Σύνδεση Admin' : 'Σύνδεση Μεσίτη'}
              </h2>
              <p className="text-[var(--text-secondary)]">
                {mode === 'admin'
                  ? 'Συνδεθείτε μόνο από το admin portal για πρόσβαση στον πίνακα διαχείρισης.'
                  : 'Συνδεθείτε για πρόσβαση στο dashboard και στα deals σας.'}
              </p>
            </div>

            {!resetToken && !forgotMode && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-[var(--text-secondary)]">
                  EMAIL
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    placeholder={mode === 'admin' ? 'admin@davlos.app' : 'broker@davlos.app'}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onFocus={() => setIsFocusedEmail(true)}
                    onBlur={() => setIsFocusedEmail(false)}
                    className="h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[#E8913A]/15"
                    required
                  />
                  {isFocusedEmail && (
                    <div className="absolute inset-0 -z-10 bg-[#E8913A]/[0.03] blur-sm rounded-md" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-[var(--text-secondary)]">
                  ΚΩΔΙΚΟΣ
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onFocus={() => setIsFocusedPassword(true)}
                    onBlur={() => setIsFocusedPassword(false)}
                    className="h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 pr-11 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[#E8913A]/15"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {isFocusedPassword && (
                    <div className="absolute inset-0 -z-10 bg-[#E8913A]/[0.03] blur-sm rounded-md" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border border-[var(--border-default)] bg-[var(--surface-glow)] text-[#E8913A] focus:ring-2 focus:ring-[#E8913A]/20"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">Να με θυμάσαι</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setForgotEmail(email);
                    setError(null);
                    setForgotSuccess(null);
                  }}
                  className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[#E8913A]"
                >
                  Ξέχασα κωδικό
                </button>
              </div>

              {error && (
                <p className="text-sm text-[#B42318]">{error}</p>
              )}

              {mode === 'broker' && onNavigateRegister && (
                <button
                  type="button"
                  onClick={onNavigateRegister}
                  className="h-11 w-full rounded-md border border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] font-medium transition-colors hover:bg-[var(--surface-glow-hover)]"
                >
                  Δημιουργία λογαριασμού
                </button>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-md bg-[#1A1A1A] text-[#f8f6f2] font-medium transition-colors hover:bg-[#1A1A1A]/90 disabled:opacity-60"
              >
                {submitting ? 'Σύνδεση...' : mode === 'admin' ? 'Είσοδος στο Admin' : 'Είσοδος'}
              </button>
            </form>
            )}

            {forgotMode && !resetToken && (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-[var(--text-primary)]">Επαναφορά κωδικού</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Βάλε το email σου και θα στείλουμε link επαναφοράς κωδικού.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="forgot-email" className="text-sm font-medium text-[var(--text-secondary)]">
                    EMAIL
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    className="h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[#E8913A]/15"
                    required
                  />
                </div>

                {error && <p className="text-sm text-[#B42318]">{error}</p>}
                {forgotSuccess && <p className="text-sm text-[var(--status-success-text)]">{forgotSuccess}</p>}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false);
                      setError(null);
                      setForgotSuccess(null);
                    }}
                    className="h-11 flex-1 rounded-md border border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] font-medium transition-colors hover:bg-[var(--surface-glow-hover)]"
                  >
                    Πίσω
                  </button>
                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    className="h-11 flex-1 rounded-md bg-[#1A1A1A] text-[#f8f6f2] font-medium transition-colors hover:bg-[#1A1A1A]/90 disabled:opacity-60"
                  >
                    {forgotSubmitting ? 'Αποστολή...' : 'Αποστολή link'}
                  </button>
                </div>
              </form>
            )}

            {resetToken && (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-[var(--text-primary)]">Ορισμός νέου κωδικού</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Το link είναι ενεργό. Όρισε νέο κωδικό για να συνδεθείς ξανά.
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="reset-password" className="text-sm font-medium text-[var(--text-secondary)]">
                    ΝΕΟΣ ΚΩΔΙΚΟΣ
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    className="h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[#E8913A]/15"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="reset-password-confirm" className="text-sm font-medium text-[var(--text-secondary)]">
                    ΕΠΙΒΕΒΑΙΩΣΗ ΚΩΔΙΚΟΥ
                  </label>
                  <input
                    id="reset-password-confirm"
                    type="password"
                    value={resetPasswordConfirm}
                    onChange={(event) => setResetPasswordConfirm(event.target.value)}
                    className="h-11 w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 text-sm text-[var(--text-primary)] outline-none transition-all duration-200 placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[#E8913A]/15"
                    required
                  />
                </div>

                {error && <p className="text-sm text-[#B42318]">{error}</p>}
                {resetSuccess && <p className="text-sm text-[var(--status-success-text)]">{resetSuccess}</p>}

                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="h-11 w-full rounded-md bg-[#1A1A1A] text-[#f8f6f2] font-medium transition-colors hover:bg-[#1A1A1A]/90 disabled:opacity-60"
                >
                  {resetSubmitting ? 'Αποθήκευση...' : 'Αποθήκευση νέου κωδικού'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
