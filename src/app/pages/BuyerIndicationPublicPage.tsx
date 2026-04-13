import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiBuyerIndication,
  getPublicBuyerIndication,
  lookupPublicBuyerProfileByTaxId,
  requestBuyerIndicationRenewal,
  submitBuyerIndicationInterestResponse,
  submitPublicBuyerIndication,
} from '../api/trustlayerApi';
import { SignaturePad } from '../components/SignaturePad';

function tokenFromPath() {
  const match = window.location.pathname.match(/^\/buyer-indication\/([^/]+)/);
  return match?.[1] ?? '';
}

export function BuyerIndicationPublicPage() {
  const token = useMemo(() => tokenFromPath(), []);
  const [indication, setIndication] = useState<ApiBuyerIndication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respondingInterest, setRespondingInterest] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lastLookupTaxId, setLastLookupTaxId] = useState('');
  const [form, setForm] = useState({
    buyerFullName: '',
    buyerGender: 'MALE' as const,
    buyerFatherName: '',
    buyerIdNumber: '',
    buyerTaxId: '',
    buyerCity: '',
    buyerStreet: '',
    buyerStreetNumber: '',
    buyerPhone: '',
    includesThirdParty: false,
    thirdPartyFullName: '',
    thirdPartyIdNumber: '',
    actingMode: 'INDIVIDUAL' as const,
    actingOnBehalfOf: '',
    buyerSignature: '',
  });
  const [interestForm, setInterestForm] = useState({
    interested: true,
    comment: '',
  });

  useEffect(() => {
    getPublicBuyerIndication(token)
      .then((response) => {
        setIndication(response);
        setForm((prev) => ({
          ...prev,
          buyerFullName: response.buyerFullName ?? '',
          buyerGender: response.buyerGender ?? 'MALE',
          buyerFatherName: response.buyerFatherName ?? '',
          buyerIdNumber: response.buyerIdNumber ?? '',
          buyerTaxId: response.buyerTaxId ?? '',
          buyerCity: response.buyerCity ?? '',
          buyerStreet: response.buyerStreet ?? '',
          buyerStreetNumber: response.buyerStreetNumber ?? '',
          buyerPhone: response.buyerPhone ?? '',
          includesThirdParty: Boolean(response.includesThirdParty),
          thirdPartyFullName: response.thirdPartyFullName ?? '',
          thirdPartyIdNumber: response.thirdPartyIdNumber ?? '',
          actingMode: response.actingMode ?? 'INDIVIDUAL',
          actingOnBehalfOf: response.actingOnBehalfOf ?? '',
          buyerSignature: response.buyerSignature ?? '',
        }));
        setInterestForm({
          interested: response.status !== 'NOT_INTERESTED',
          comment: response.buyerInterestComment ?? '',
        });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const canSubmit = indication && !indication.expired && indication.status === 'SENT';

  const handleBuyerTaxIdBlur = async () => {
    const normalizedTaxId = form.buyerTaxId.replace(/\D/g, '');
    if (normalizedTaxId.length !== 9 || normalizedTaxId === lastLookupTaxId) {
      return;
    }
    setLookupLoading(true);
    setLookupMessage(null);
    try {
      const profile = await lookupPublicBuyerProfileByTaxId(token, normalizedTaxId);
      setForm((prev) => ({
        ...prev,
        buyerFullName: profile.buyerFullName ?? prev.buyerFullName,
        buyerGender: profile.buyerGender ?? prev.buyerGender,
        buyerFatherName: profile.buyerFatherName ?? prev.buyerFatherName,
        buyerIdNumber: profile.buyerIdNumber ?? prev.buyerIdNumber,
        buyerTaxId: profile.buyerTaxId ?? normalizedTaxId,
        buyerCity: profile.buyerCity ?? prev.buyerCity,
        buyerStreet: profile.buyerStreet ?? prev.buyerStreet,
        buyerStreetNumber: profile.buyerStreetNumber ?? prev.buyerStreetNumber,
        buyerPhone: profile.buyerPhone ?? prev.buyerPhone,
      }));
      setLookupMessage('Συμπληρώθηκαν γνωστά στοιχεία από προηγούμενη υπόδειξη.');
      setLastLookupTaxId(normalizedTaxId);
    } catch (err) {
      setLastLookupTaxId(normalizedTaxId);
      setLookupMessage(null);
      if (err instanceof Error && /not found/i.test(err.message)) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Αποτυχία ανάκτησης στοιχείων από το ΑΦΜ.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitPublicBuyerIndication(token, {
        ...form,
        thirdPartyFullName: form.includesThirdParty ? form.thirdPartyFullName || undefined : undefined,
        thirdPartyIdNumber: form.includesThirdParty ? form.thirdPartyIdNumber || undefined : undefined,
        actingOnBehalfOf: form.actingMode === 'REPRESENTING_OTHER' ? form.actingOnBehalfOf || undefined : undefined,
      });
      setIndication(updated);
      setMessage('Η εντολή υπόδειξης υποβλήθηκε επιτυχώς.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία υποβολής.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRenewal = async () => {
    setRenewalSubmitting(true);
    setError(null);
    try {
      await requestBuyerIndicationRenewal(token);
      const updated = await getPublicBuyerIndication(token);
      setIndication(updated);
      setMessage('Στάλθηκε αίτημα για νέο link προς τον μεσίτη.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία αιτήματος.');
    } finally {
      setRenewalSubmitting(false);
    }
  };

  const handleSubmitInterestResponse = async (event: FormEvent) => {
    event.preventDefault();
    if (!indication || !indication.interestResponsePending) return;
    setRespondingInterest(true);
    setError(null);
    try {
      const updated = await submitBuyerIndicationInterestResponse(token, {
        interested: interestForm.interested,
        comment: interestForm.comment || undefined,
      });
      setIndication(updated);
      setMessage(
        interestForm.interested
          ? 'Καταγράψαμε ότι σας ενδιαφέρει το ακίνητο.'
          : 'Καταγράψαμε ότι δεν σας ενδιαφέρει το συγκεκριμένο ακίνητο και θα μείνετε για παρόμοια.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία αποστολής της απάντησης.');
    } finally {
      setRespondingInterest(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-secondary)]">Φόρτωση...</div>;
  }

  if (!indication) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--status-danger-text)]">{error ?? 'Το link δεν βρέθηκε.'}</div>;
  }

  const brokerSubject =
    indication.brokerIdentityMode === 'OFFICE'
      ? `Το μεσιτικό γραφείο ${indication.brokerOffice}`
      : indication.brokerGender === 'FEMALE'
        ? `Η μεσίτρια ${indication.brokerName}`
        : `Ο μεσίτης ${indication.brokerName}`;

  return (
    <div className="min-h-screen bg-[var(--surface-ambient)] px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Εντολή Υπόδειξης</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{indication.propertyTitle}</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Μεσιτικό γραφείο {indication.brokerOffice} • Λήξη link {new Date(indication.expiresAt).toLocaleString('el-GR')}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
              <p className="text-xs text-[var(--text-tertiary)]">Υποδειχθέν ακίνητο</p>
              <p className="mt-1 font-semibold text-[var(--text-primary)]">{indication.propertyAddress}</p>
              <p className="text-sm text-[var(--text-secondary)]">{indication.propertyRegion}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
              <p className="text-xs text-[var(--text-tertiary)]">Αμοιβή μεσίτη</p>
              <p className="mt-1 font-semibold text-[var(--text-primary)]">
                {Number(indication.grossFeeWithVat).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {Number(indication.brokerCommissionPct).toLocaleString('el-GR')}% με ενσωματωμένο ΦΠΑ 24%
              </p>
            </div>
          </div>
        </section>

        {message && <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success-text)]">{message}</div>}
        {error && <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-text)]">{error}</div>}

        {indication.interestResponsePending ? (
          <form onSubmit={handleSubmitInterestResponse} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Πώς σας φάνηκε το ακίνητο μετά την υπόδειξη;</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Ακίνητο: {indication.propertyTitle}
              {indication.propertyReferenceListingCode ? ` • Κωδικός ${indication.propertyReferenceListingCode}` : ''}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4 text-sm text-[var(--text-primary)]">
                <input
                  type="radio"
                  checked={interestForm.interested}
                  onChange={() => setInterestForm((prev) => ({ ...prev, interested: true }))}
                />
                <span className="ml-2 font-semibold">Με ενδιαφέρει</span>
              </label>
              <label className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4 text-sm text-[var(--text-primary)]">
                <input
                  type="radio"
                  checked={!interestForm.interested}
                  onChange={() => setInterestForm((prev) => ({ ...prev, interested: false }))}
                />
                <span className="ml-2 font-semibold">Δεν με ενδιαφέρει, ψάχνω κάτι παρόμοιο</span>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Σχόλιο</span>
              <textarea
                value={interestForm.comment}
                onChange={(event) => setInterestForm((prev) => ({ ...prev, comment: event.target.value }))}
                rows={4}
                className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                placeholder={interestForm.interested ? 'Π.χ. θέλω να προχωρήσουμε με προσφορά' : 'Π.χ. ψάχνω κάτι αντίστοιχο σε ίδια περιοχή / budget'}
              />
            </label>
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={respondingInterest}
                className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {respondingInterest ? 'Αποστολή...' : 'Καταχώριση απάντησης'}
              </button>
            </div>
          </form>
        ) : indication.status === 'BROKER_REVIEW' || indication.status === 'APPROVED' || indication.status === 'APPOINTMENT_BOOKED' ? (
          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {indication.status === 'BROKER_REVIEW'
                ? 'Η υποβολή ολοκληρώθηκε και περιμένει έλεγχο.'
                : indication.status === 'APPOINTMENT_BOOKED'
                  ? 'Έχει κλειστεί ραντεβού υπόδειξης.'
                  : 'Η εντολή υπογράφηκε και περιμένει ραντεβού υπόδειξης.'}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {indication.status === 'APPOINTMENT_BOOKED'
                ? `Το ραντεβού είναι με ${indication.appointmentBrokerName ?? indication.brokerName} από ${indication.appointmentStartAt ? new Date(indication.appointmentStartAt).toLocaleString('el-GR') : '-'} έως ${indication.appointmentEndAt ? new Date(indication.appointmentEndAt).toLocaleString('el-GR') : '-'}. 36 ώρες μετά τη λήξη του ραντεβού θα σας σταλεί email για να δηλώσετε αν ενδιαφέρεστε.`
                : 'Δεν μπορείτε να ζητήσετε νέο link ή να ξανακάνετε αίτηση για αυτή την εντολή υπόδειξης. Μετά την έγκριση του μεσίτη θα σας σταλεί αντίγραφο της εντολής και, στη συνέχεια, το ραντεβού υπόδειξης.'}
            </p>
          </section>
        ) : indication.status === 'INTERESTED' || indication.status === 'NOT_INTERESTED' ? (
          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {indication.status === 'INTERESTED' ? 'Καταγράφηκε το ενδιαφέρον σας.' : 'Καταγράφηκε ότι δεν ενδιαφέρεστε για το συγκεκριμένο ακίνητο.'}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {indication.status === 'INTERESTED'
                ? 'Ο μεσίτης θα συνεχίσει μαζί σας τα επόμενα βήματα.'
                : 'Ο μεσίτης θα κρατήσει τα στοιχεία σας για παρόμοια ακίνητα.'}
            </p>
          </section>
        ) : indication.expired ? (
          <section className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--status-warning-text)]">Το link έχει λήξει.</h2>
            <p className="mt-2 text-sm text-[var(--status-warning-text)]">
              Αν θέλετε νέο link, στείλτε αίτημα προς τον μεσίτη.
            </p>
            <button
              onClick={handleRequestRenewal}
              disabled={renewalSubmitting || !indication.renewalAllowed}
              className="mt-4 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {renewalSubmitting ? 'Αποστολή...' : 'Αίτημα για νέο link'}
            </button>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Στοιχεία αγοραστή</h2>
            <div className="mt-4 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning-text)]">
              Απαραίτητα πεδία: Ονοματεπώνυμο, Α.Δ.Τ., Α.Φ.Μ. και τηλέφωνο. Αν η υπόδειξη δεν αφορά μόνο ένα άτομο, ενεργοποιήστε το τρίτο πρόσωπο και συμπληρώστε και το ονοματεπώνυμο και την ταυτότητά του.
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                ['buyerFullName', 'Ονοματεπώνυμο'],
                ['buyerFatherName', 'Πατρώνυμο'],
                ['buyerIdNumber', 'Α.Δ.Τ.'],
                ['buyerCity', 'Κάτοικος'],
                ['buyerStreet', 'Οδός'],
                ['buyerStreetNumber', 'Αριθμός'],
                ['buyerPhone', 'Τηλέφωνο'],
              ].map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {label}{key === 'buyerFullName' || key === 'buyerIdNumber' || key === 'buyerPhone' ? ' *' : ''}
                  </span>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    required={key === 'buyerFullName' || key === 'buyerIdNumber' || key === 'buyerPhone'}
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </label>
              ))}
            </div>

            <label className="mt-4 block space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Α.Φ.Μ. *</span>
                <span className="text-xs text-[var(--text-tertiary)]">{lookupLoading ? 'Αναζήτηση στοιχείων...' : 'Συμπληρώστε ΑΦΜ για αυτόματη ανάκτηση στοιχείων'}</span>
              </div>
              <input
                value={form.buyerTaxId}
                onChange={(event) => {
                  setLookupMessage(null);
                  setLastLookupTaxId('');
                  setForm((prev) => ({ ...prev, buyerTaxId: event.target.value }));
                }}
                onBlur={() => void handleBuyerTaxIdBlur()}
                inputMode="numeric"
                required
                pattern="[\d .-]{9,20}"
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              {lookupMessage && <p className="text-xs text-[var(--text-tertiary)]">{lookupMessage}</p>}
              {indication.buyerTaxVerification && (
                <div className="space-y-1 text-xs text-[var(--text-tertiary)]">
                  <p>
                    Κατάσταση επαλήθευσης: {indication.buyerTaxVerification.status} μέσω {indication.buyerTaxVerification.provider}
                  </p>
                  {indication.buyerTaxVerification.verifiedAt && (
                    <p>Χρόνος ελέγχου: {new Date(indication.buyerTaxVerification.verifiedAt).toLocaleString('el-GR')}</p>
                  )}
                </div>
              )}
              <p className="text-xs text-[var(--text-tertiary)]">Αυτή τη στιγμή το auto-fill γίνεται από ήδη καταχωρημένα στοιχεία της βάσης. Όταν συνδεθεί gov source, θα μπορεί να χρησιμοποιείται και από εκεί.</p>
            </label>

            <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={form.includesThirdParty}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    includesThirdParty: event.target.checked,
                    thirdPartyFullName: event.target.checked ? prev.thirdPartyFullName : '',
                    thirdPartyIdNumber: event.target.checked ? prev.thirdPartyIdNumber : '',
                  }))}
                />
                Υπάρχει και τρίτο πρόσωπο στην υπόδειξη
              </label>
              {form.includesThirdParty && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Ονοματεπώνυμο τρίτου προσώπου *</span>
                    <input
                      value={form.thirdPartyFullName}
                      onChange={(event) => setForm((prev) => ({ ...prev, thirdPartyFullName: event.target.value }))}
                      required={form.includesThirdParty}
                      className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Α.Δ.Τ. τρίτου προσώπου *</span>
                    <input
                      value={form.thirdPartyIdNumber}
                      onChange={(event) => setForm((prev) => ({ ...prev, thirdPartyIdNumber: event.target.value }))}
                      required={form.includesThirdParty}
                      className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Γένος</span>
                <div className="flex gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-3 text-sm text-[var(--text-primary)]">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.buyerGender === 'MALE'}
                      onChange={() => setForm((prev) => ({ ...prev, buyerGender: 'MALE' }))}
                    />
                    Αρσενικό
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.buyerGender === 'FEMALE'}
                      onChange={() => setForm((prev) => ({ ...prev, buyerGender: 'FEMALE' }))}
                    />
                    Θηλυκό
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Τρόπος ενέργειας</span>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-3 text-sm text-[var(--text-primary)]">
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.actingMode === 'INDIVIDUAL'}
                        onChange={() => setForm((prev) => ({ ...prev, actingMode: 'INDIVIDUAL', actingOnBehalfOf: '' }))}
                      />
                      Ενεργώ ατομικά
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.actingMode === 'REPRESENTING_OTHER'}
                        onChange={() => setForm((prev) => ({ ...prev, actingMode: 'REPRESENTING_OTHER' }))}
                      />
                      Ενεργώ για άλλον
                    </label>
                  </div>
                  {form.actingMode === 'REPRESENTING_OTHER' && (
                    <>
                      <input
                        value={form.actingOnBehalfOf}
                        onChange={(event) => setForm((prev) => ({ ...prev, actingOnBehalfOf: event.target.value }))}
                        placeholder="Ονοματεπώνυμο προσώπου"
                        required={form.actingMode === 'REPRESENTING_OTHER'}
                        className="mt-3 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4 text-sm text-[var(--text-secondary)]">
              Δηλώνω ότι {brokerSubject} μπορεί να μου υποδείξει το κατωτέρω ακίνητο και ότι η παρούσα υπόδειξη αποτελεί την πρώτη γνωστοποίησή του σε εμένα.
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Υπογραφή αγοραστή</p>
              <SignaturePad
                value={form.buyerSignature}
                onChange={(buyerSignature) => setForm((prev) => ({ ...prev, buyerSignature }))}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={
                  submitting
                  || !form.buyerSignature
                  || !form.buyerFullName.trim()
                  || !form.buyerIdNumber.trim()
                  || !form.buyerTaxId.trim()
                  || !form.buyerPhone.trim()
                  || form.buyerTaxId.replace(/\D/g, '').length !== 9
                  || (form.actingMode === 'REPRESENTING_OTHER' && !form.actingOnBehalfOf.trim())
                  || (form.includesThirdParty && (!form.thirdPartyFullName.trim() || !form.thirdPartyIdNumber.trim()))
                }
                className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? 'Υποβολή...' : 'Υποβολή εντολής'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
