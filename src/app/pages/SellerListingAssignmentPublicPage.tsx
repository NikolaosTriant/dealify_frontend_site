import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import {
  ApiSellerListingAssignment,
  attachPublicSellerListingDocument,
  createPublicSellerListingDocumentUploadUrl,
  isMockUploadUrl,
  getPublicSellerListingAssignment,
  requestSellerListingAssignmentRenewal,
  submitPublicSellerListingAssignment,
} from '../api/trustlayerApi';
import DocumentDropzone from '../components/DocumentDropzone';
import { SignaturePad } from '../components/SignaturePad';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const PROPERTY_TYPE_OPTIONS = ['Διαμέρισμα', 'Επαγγελματικός χώρος', 'Γη', 'Διάφορα ακίνητα'] as const;
const PROPERTY_INTENT_OPTIONS = ['Ενοικίαση', 'Αγορά'] as const;
const ACTING_AUTHORITY_OPTIONS = ['Υπεύθυνη δήλωση', 'Πληρεξούσιο'] as const;
type SellerListingTextField =
  | 'sellerFullName'
  | 'sellerPhone'
  | 'sellerFatherName'
  | 'sellerIdNumber'
  | 'sellerTaxId'
  | 'sellerStreet'
  | 'sellerStreetNumber'
  | 'actingOnBehalfOf'
  | 'sellerSignature'
  | 'propertyTitle'
  | 'propertyRegion'
  | 'propertyStreet'
  | 'propertyStreetNumber'
  | 'propertyType'
  | 'propertyIntent'
  | 'propertyFloor'
  | 'propertyPrice'
  | 'propertyArea'
  | 'listingUrl'
  | 'propertyMapsUrl'
  | 'propertyDescription'
  | 'propertyDefects'
  | 'sellerNotes';

function tokenFromPath() {
  const match = window.location.pathname.match(/^\/seller-listing-assignment\/([^/]+)/);
  return match?.[1] ?? '';
}

function formatAthensDateTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('el-GR', { timeZone: 'Europe/Athens' });
}

export function SellerListingAssignmentPublicPage() {
  const token = useMemo(() => tokenFromPath(), []);
  const [assignment, setAssignment] = useState<ApiSellerListingAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapsInfoOpen, setMapsInfoOpen] = useState(false);
  const [actingInfoOpen, setActingInfoOpen] = useState(false);
  const [form, setForm] = useState({
    sellerFullName: '',
    sellerPhone: '',
    sellerGender: 'MALE' as const,
    sellerFatherName: '',
    sellerIdNumber: '',
    sellerTaxId: '',
    sellerStreet: '',
    sellerStreetNumber: '',
    actingMode: 'INDIVIDUAL' as const,
    actingOnBehalfOf: '',
    actingAuthorityType: 'Υπεύθυνη δήλωση',
    sellerSignature: '',
    propertyTitle: '',
    propertyRegion: '',
    propertyStreet: '',
    propertyStreetNumber: '',
    propertyType: '',
    propertyIntent: 'Αγορά',
    propertyFloor: '',
    propertyPrice: '',
    propertyArea: '',
    listingUrl: '',
    propertyMapsUrl: '',
    propertyDescription: '',
    propertyDefects: '',
    sellerNotes: '',
    sellerRejectsLoanBuyers: false,
  });
  const visibleSupportingDocuments = useMemo(
    () => (assignment?.supportingDocuments ?? []).filter((document) => (
      document.documentType !== 'AUTHORIZATION' || form.actingMode === 'REPRESENTING_OTHER'
    )),
    [assignment?.supportingDocuments, form.actingMode],
  );

  useEffect(() => {
    getPublicSellerListingAssignment(token)
      .then((response) => {
        setAssignment(response);
        setForm({
          sellerFullName: response.sellerFullName ?? response.clientName ?? '',
          sellerPhone: response.sellerPhone ?? '',
          sellerGender: response.sellerGender ?? 'MALE',
          sellerFatherName: response.sellerFatherName ?? '',
          sellerIdNumber: response.sellerIdNumber ?? '',
          sellerTaxId: response.sellerTaxId ?? '',
          sellerStreet: response.sellerStreet ?? '',
          sellerStreetNumber: response.sellerStreetNumber ?? '',
          actingMode: response.actingMode ?? 'INDIVIDUAL',
          actingOnBehalfOf: response.actingOnBehalfOf ?? '',
          actingAuthorityType: response.actingAuthorityType ?? 'Υπεύθυνη δήλωση',
          sellerSignature: response.sellerSignature ?? '',
          propertyTitle: response.propertyTitle ?? '',
          propertyRegion: response.propertyRegion ?? '',
          propertyStreet: response.propertyStreet ?? '',
          propertyStreetNumber: response.propertyStreetNumber ?? '',
          propertyType: response.propertyType ?? '',
          propertyIntent: response.propertyIntent ?? 'Αγορά',
          propertyFloor: response.propertyFloor ?? '',
          propertyPrice: response.propertyPrice != null ? String(response.propertyPrice) : '',
          propertyArea: response.propertyArea != null ? String(response.propertyArea) : '',
          listingUrl: response.listingUrl ?? '',
          propertyMapsUrl: response.propertyMapsUrl ?? '',
          propertyDescription: response.propertyDescription ?? '',
          propertyDefects: response.propertyDefects ?? '',
          sellerNotes: response.sellerNotes ?? '',
          sellerRejectsLoanBuyers: Boolean(response.sellerRejectsLoanBuyers),
        });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const canSubmit = assignment && !assignment.expired && assignment.status === 'SENT';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitPublicSellerListingAssignment(token, {
        sellerFullName: form.sellerFullName,
        sellerPhone: form.sellerPhone,
        sellerGender: form.sellerGender,
        sellerFatherName: form.sellerFatherName,
        sellerIdNumber: form.sellerIdNumber,
        sellerTaxId: form.sellerTaxId,
        sellerStreet: form.sellerStreet,
        sellerStreetNumber: form.sellerStreetNumber,
        actingMode: form.actingMode,
        actingOnBehalfOf: form.actingMode === 'REPRESENTING_OTHER' ? form.actingOnBehalfOf || undefined : undefined,
        actingAuthorityType: form.actingMode === 'REPRESENTING_OTHER' ? form.actingAuthorityType : undefined,
        sellerSignature: form.sellerSignature,
        propertyTitle: form.propertyTitle,
        propertyRegion: form.propertyRegion,
        propertyStreet: form.propertyStreet,
        propertyStreetNumber: form.propertyStreetNumber,
        propertyType: form.propertyType,
        propertyIntent: form.propertyIntent,
        propertyFloor: form.propertyFloor || undefined,
        propertyPrice: Number(form.propertyPrice),
        propertyArea: form.propertyArea ? Number(form.propertyArea) : undefined,
        listingUrl: form.listingUrl || undefined,
        propertyMapsUrl: form.propertyMapsUrl || undefined,
        propertyDescription: form.propertyDescription || undefined,
        propertyDefects: form.propertyDefects || undefined,
        sellerNotes: form.sellerNotes || undefined,
        sellerRejectsLoanBuyers: form.sellerRejectsLoanBuyers,
      });
      setAssignment(updated);
      setMessage('Η εντολή παραχώρησης υποβλήθηκε επιτυχώς.');
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
      await requestSellerListingAssignmentRenewal(token);
      const updated = await getPublicSellerListingAssignment(token);
      setAssignment(updated);
      setMessage('Στάλθηκε αίτημα για νέο link προς τον μεσίτη.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία αιτήματος.');
    } finally {
      setRenewalSubmitting(false);
    }
  };

  const handleUploadSupportingDocument = async (documentId: string, file: File | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Τα έγγραφα πρέπει να είναι PDF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('Μέγιστο μέγεθος αρχείου 10MB.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const { uploadUrl, fileUrl } = await createPublicSellerListingDocumentUploadUrl(token, documentId, {
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!isMockUploadUrl(uploadUrl)) {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!response.ok) {
          throw new Error(`Upload failed (${response.status})`);
        }
      }
      const updated = await attachPublicSellerListingDocument(token, documentId, { fileUrl });
      setAssignment(updated);
      setMessage('Το έγγραφο ανέβηκε και περιμένει έλεγχο.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία μεταφόρτωσης εγγράφου.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text-secondary)]">Φόρτωση...</div>;
  }

  if (!assignment) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--status-danger-text)]">{error ?? 'Το link δεν βρέθηκε.'}</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--surface-ambient)] px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Εντολή Παραχώρησης</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">
            {assignment.propertyTitle || 'Νέο ακίνητο προς παραχώρηση'}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Link λήγει στις {formatAthensDateTime(assignment.expiresAt)}
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Συμφωνημένη αμοιβή μεσίτη: {assignment.brokerCommissionPct}%{assignment.grossFeeWithVat != null ? ` • ${Number(assignment.grossFeeWithVat).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })} με ΦΠΑ` : ''}
          </p>
        </section>

        {message && <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success-text)]">{message}</div>}
        {error && <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-text)]">{error}</div>}

        {assignment.status === 'BROKER_REVIEW' || assignment.status === 'APPROVED' || assignment.status === 'IMPORTED' ? (
          <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {assignment.status === 'IMPORTED'
                ? 'Το ακίνητο εισήχθη στο σύστημα.'
                : assignment.status === 'APPROVED'
                  ? 'Η εντολή εγκρίθηκε από τον μεσίτη.'
                  : 'Η υποβολή ολοκληρώθηκε και περιμένει έλεγχο.'}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Δεν απαιτείται άλλη ενέργεια από εσάς. Ο μεσίτης μπορεί πλέον να ολοκληρώσει την εισαγωγή του ακινήτου και να το δημοσιεύσει.
            </p>
          </section>
        ) : assignment.expired ? (
          <section className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--status-warning-text)]">Το link έχει λήξει.</h2>
            <p className="mt-2 text-sm text-[var(--status-warning-text)]">
              Αν θέλετε νέο link, στείλτε αίτημα προς τον μεσίτη.
            </p>
            <button
              onClick={handleRequestRenewal}
              disabled={renewalSubmitting || !assignment.renewalAllowed}
              className="mt-4 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {renewalSubmitting ? 'Αποστολή...' : 'Αίτημα για νέο link'}
            </button>
          </section>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Στοιχεία πωλητή</h2>
            <div className="mt-4 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning-text)]">
              Απαραίτητα πεδία πωλητή: Ονοματεπώνυμο, Πατρώνυμο, Α.Δ.Τ., Α.Φ.Μ., κινητό τηλέφωνο και πλήρη στοιχεία διεύθυνσης. Το πεδίο «Κάτοικος» δεν χρησιμοποιείται.
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                ['sellerFullName', 'Ονοματεπώνυμο ιδιοκτήτη'],
                ['sellerFatherName', 'Πατρώνυμο'],
                ['sellerIdNumber', 'Α.Δ.Τ.'],
                ['sellerStreet', 'Οδός'],
                ['sellerStreetNumber', 'Αριθμός'],
                ['sellerPhone', 'Τηλέφωνο'],
              ].map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">{label} *</span>
                  <input
                    value={form[key as SellerListingTextField]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key as SellerListingTextField]: event.target.value }))}
                    required
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </label>
              ))}
              <div className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Α.Φ.Μ. *</span>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    value={form.sellerTaxId}
                    onChange={(event) => setForm((prev) => ({ ...prev, sellerTaxId: event.target.value }))}
                    required
                    inputMode="numeric"
                    pattern="[\d .-]{9,20}"
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                {assignment.sellerTaxVerification && (
                  <div className="space-y-1 text-xs text-[var(--text-tertiary)]">
                    <p>
                      Κατάσταση επαλήθευσης: {assignment.sellerTaxVerification.status} μέσω {assignment.sellerTaxVerification.provider}
                    </p>
                    {assignment.sellerTaxVerification.verifiedAt && (
                      <p>Χρόνος ελέγχου: {formatAthensDateTime(assignment.sellerTaxVerification.verifiedAt)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-3 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={form.sellerRejectsLoanBuyers}
                onChange={(event) => setForm((prev) => ({ ...prev, sellerRejectsLoanBuyers: event.target.checked }))}
                className="mt-0.5"
              />
              <span>
                Δεν επιθυμώ αγοραστή με δάνειο.
              </span>
            </label>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Γένος</span>
                <div className="flex gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-3 text-sm text-[var(--text-primary)]">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.sellerGender === 'MALE'}
                      onChange={() => setForm((prev) => ({ ...prev, sellerGender: 'MALE' }))}
                    />
                    Αρσενικό
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.sellerGender === 'FEMALE'}
                      onChange={() => setForm((prev) => ({ ...prev, sellerGender: 'FEMALE' }))}
                    />
                    Θηλυκό
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">Τρόπος ενέργειας</span>
                  <button
                    type="button"
                    onClick={() => setActingInfoOpen((prev) => !prev)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    aria-label="Πληροφορίες για τον τρόπο ενέργειας"
                  >
                    <Info size={14} />
                  </button>
                </div>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-3 text-sm text-[var(--text-primary)]">
                  {actingInfoOpen && (
                    <div className="mb-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      Αν ενεργείτε για άλλον, επιλέξτε «Ενεργώ για άλλον», γράψτε το πρόσωπο που εκπροσωπείτε και δηλώστε αν υπάρχει υπεύθυνη δήλωση ή πληρεξούσιο.
                    </div>
                  )}
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
                    <div className="mt-3 space-y-3">
                      <input
                        value={form.actingOnBehalfOf}
                        onChange={(event) => setForm((prev) => ({ ...prev, actingOnBehalfOf: event.target.value }))}
                        placeholder="Ονοματεπώνυμο προσώπου"
                        required
                        className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                      <select
                        value={form.actingAuthorityType}
                        onChange={(event) => setForm((prev) => ({ ...prev, actingAuthorityType: event.target.value }))}
                        className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      >
                        {ACTING_AUTHORITY_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <h2 className="mt-6 text-lg font-semibold text-[var(--text-primary)]">Στοιχεία ακινήτου</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                ['propertyTitle', 'Τίτλος ακινήτου'],
                ['propertyRegion', 'Περιοχή'],
                ['propertyStreet', 'Οδός ακινήτου'],
                ['propertyStreetNumber', 'Αριθμός ακινήτου'],
                ['propertyPrice', 'Ζητούμενη τιμή'],
                ['propertyArea', 'Τετραγωνικά'],
                ['listingUrl', 'Listing URL (προαιρετικό)'],
              ].map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
                  <input
                    value={form[key as SellerListingTextField]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key as SellerListingTextField]: event.target.value }))}
                    required={key !== 'listingUrl'}
                    className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </label>
              ))}
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Τύπος ακινήτου</span>
                <select
                  value={form.propertyType}
                  onChange={(event) => setForm((prev) => ({ ...prev, propertyType: event.target.value }))}
                  required
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  <option value="" disabled>Επιλέξτε τύπο</option>
                  {PROPERTY_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Πρόθεση ακινήτου</span>
                <select
                  value={form.propertyIntent}
                  onChange={(event) => setForm((prev) => ({ ...prev, propertyIntent: event.target.value }))}
                  required
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  {PROPERTY_INTENT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Maps URL (προαιρετικό)</span>
                <button
                  type="button"
                  onClick={() => setMapsInfoOpen((prev) => !prev)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  aria-label="Πληροφορίες για το Maps URL"
                >
                  <Info size={14} />
                </button>
              </div>
              {mapsInfoOpen && (
                <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                  Για να βρείτε σωστά το μέρος, ανοίξτε το Google Maps, εντοπίστε το ακίνητο, πατήστε «Κοινοποίηση» και επικολλήστε εδώ το link.
                </div>
              )}
              <input
                value={form.propertyMapsUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, propertyMapsUrl: event.target.value }))}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>

            <label className="mt-4 block space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Περιγραφή ακινήτου</span>
              <textarea
                value={form.propertyDescription}
                onChange={(event) => setForm((prev) => ({ ...prev, propertyDescription: event.target.value }))}
                rows={4}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>

            <label className="mt-4 block space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Πραγματικά ελαττώματα / παρατηρήσεις ακινήτου</span>
              <textarea
                value={form.propertyDefects}
                onChange={(event) => setForm((prev) => ({ ...prev, propertyDefects: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Συνοδευτικά έγγραφα ιδιοκτησίας</p>
                <p className="text-xs text-[var(--text-tertiary)]">Το συμβόλαιο, το ΠΕΑ και τυχόν εξουσιοδοτήσεις ανεβαίνουν ξεχωριστά και ελέγχονται από τον μεσίτη.</p>
              </div>
              <div className="grid gap-3">
                {visibleSupportingDocuments.map((document) => (
                  <div key={document.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{document.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {document.required ? 'Απαιτείται για την προετοιμασία συναλλαγής.' : 'Προαιρετικό, μόνο αν ενεργείτε για άλλον ή υπάρχει σχετικό πληρεξούσιο.'}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">Status: {document.status}</p>
                        {document.reviewerComment && (
                          <p className="mt-1 text-xs text-[var(--status-warning-text)]">Σχόλιο μεσίτη: {document.reviewerComment}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {document.filePreviewUrl && (
                          <a
                            href={document.filePreviewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                          >
                            Προβολή PDF
                          </a>
                        )}
                        <div className="min-w-[230px]">
                          <DocumentDropzone
                            accept="application/pdf"
                            disabled={uploading}
                            uploading={uploading}
                            title="Ανέβασμα PDF"
                            subtitle="Σύρετε PDF εδώ ή πατήστε για επιλογή."
                            onFileSelected={(file) => handleUploadSupportingDocument(document.id, file)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-4 block space-y-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Σημειώσεις προς μεσίτη</span>
              <textarea
                value={form.sellerNotes}
                onChange={(event) => setForm((prev) => ({ ...prev, sellerNotes: event.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </label>

            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Υπογραφή ιδιοκτήτη</p>
              <p className="mb-3 text-xs leading-6 text-[var(--text-secondary)]">
                Συναινώ ρητά στη συλλογή και επεξεργασία των ανωτέρω προσωπικών μου δεδομένων και των στοιχείων του ακινήτου
                αποκλειστικά για τους σκοπούς εκτέλεσης της παρούσας εντολής και εξεύρεσης ενδιαφερόμενου πελάτη, σύμφωνα με
                τον Κανονισμό (ΕΕ) 2016/679.
              </p>
              <SignaturePad
                value={form.sellerSignature}
                onChange={(sellerSignature) => setForm((prev) => ({ ...prev, sellerSignature }))}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !form.sellerSignature}
                className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? 'Υποβολή...' : 'Υποβολή προς έλεγχο'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
