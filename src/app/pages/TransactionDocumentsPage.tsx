import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  ApiDeal,
  ApiDealDocument,
  ApiDealDocumentStatus,
  ApiMemberRole,
  ApiMemberDocument,
  ApiDealMember,
  ApiDealStage,
  assignDealDocumentRole,
  listDealMembers,
  listProperties,
  getDealMemberDocumentDownloadUrl,
  getDealDocumentDownloadUrl,
  getDeal,
  advanceDealDocumentsPhase,
  listDealDocuments,
  listDealMemberDocuments,
  listDealStages,
  reviewDealMemberDocument,
  reviewDealDocument,
  startDealProcess
} from '../api/trustlayerApi';
import { useUiStore } from '../state/uiStore';

function formatDateLabel(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('el-GR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function brokerStatusLabel(status: ApiDealDocumentStatus) {
  if (status === 'UPLOADED') return 'IN_REVIEW';
  return status;
}

const ROLE_OPTIONS: Array<{ value: ApiMemberRole; label: string }> = [
  { value: 'LAWYER', label: 'Δικηγόρος' },
  { value: 'ENGINEER', label: 'Μηχανικός' },
  { value: 'SURVEYOR', label: 'Τοπογράφος' },
  { value: 'NOTARY', label: 'Συμβολαιογράφος' },
  { value: 'OTHER', label: 'Λοιπός ρόλος' },
];

const SETTLEMENT_CATEGORY = 'Ηλεκτρονική ολοκλήρωση';

export function TransactionDocumentsPage({ transactionId }: { transactionId: string }) {
  const { showToast } = useUiStore();
  const [deal, setDeal] = useState<ApiDeal | null>(null);
  const [documents, setDocuments] = useState<ApiDealDocument[]>([]);
  const [stages, setStages] = useState<ApiDealStage[]>([]);
  const [memberDocuments, setMemberDocuments] = useState<ApiMemberDocument[]>([]);
  const [dealMembers, setDealMembers] = useState<ApiDealMember[]>([]);
  const [propertyReferenceCode, setPropertyReferenceCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewingDocId, setReviewingDocId] = useState<string | null>(null);
  const [reviewingMemberStageId, setReviewingMemberStageId] = useState<string | null>(null);
  const [rejectModalDoc, setRejectModalDoc] = useState<ApiDealDocument | null>(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState('');
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const buyerPortalUrl = useMemo(() => {
    const token = deal?.buyerLinkToken ?? deal?.clientLinkToken ?? transactionId;
    return `${window.location.origin}/client/${token}`;
  }, [deal, transactionId]);
  const sellerPortalUrl = useMemo(() => {
    if (!deal?.sellerLinkToken) return null;
    return `${window.location.origin}/seller/${deal.sellerLinkToken}`;
  }, [deal]);

  const refreshData = async () => {
    const [dealResponse, documentResponse, stageResponse, properties] = await Promise.all([
      getDeal(transactionId),
      listDealDocuments(transactionId),
      listDealStages(transactionId),
      listProperties().catch(() => []),
    ]);
    const [memberDocumentResponse, dealMembersResponse] = await Promise.all([
      listDealMemberDocuments(transactionId).catch(() => []),
      listDealMembers(transactionId).catch(() => []),
    ]);
    setDeal(dealResponse);
    setDocuments(documentResponse);
    setStages(stageResponse);
    setMemberDocuments(memberDocumentResponse);
    setDealMembers(dealMembersResponse);
    const matchingProperty = properties.find((property) => property.id === dealResponse.propertyId);
    setPropertyReferenceCode(matchingProperty?.referenceListingCode ?? null);
  };

  useEffect(() => {
    setLoading(true);
    refreshData()
      .catch(() => {
        showToast('Αποτυχία φόρτωσης εγγράφων συναλλαγής.', 'error');
      })
      .finally(() => setLoading(false));
  }, [transactionId, showToast]);


  const settlementDocuments = useMemo(
    () => documents.filter((doc) => doc.category === SETTLEMENT_CATEGORY),
    [documents]
  );

  const collectionDocuments = useMemo(
    () => documents.filter((doc) => doc.category !== SETTLEMENT_CATEGORY),
    [documents]
  );

  const counts = useMemo(() => {
    const approved = collectionDocuments.filter((d) => d.status === 'APPROVED').length;
    const rejected = collectionDocuments.filter((d) => d.status === 'REJECTED').length;
    const uploaded = collectionDocuments.filter((d) => d.status === 'UPLOADED').length;
    const pending = collectionDocuments.filter((d) => d.status === 'PENDING').length;
    return { approved, rejected, uploaded, pending, total: collectionDocuments.length };
  }, [collectionDocuments]);

  const buyerDocuments = useMemo(
    () => collectionDocuments.filter((doc) => doc.partyRole !== 'SELLER'),
    [collectionDocuments]
  );

  const sellerDocuments = useMemo(
    () => collectionDocuments.filter((doc) => doc.partyRole === 'SELLER'),
    [collectionDocuments]
  );

  const progress = counts.total > 0 ? Math.round((counts.approved / counts.total) * 100) : 0;
  const inDocumentsPhase = deal?.status === 'DOCUMENTS_PHASE';
  const inProcessPhase = deal?.status === 'PROCESS_PHASE' || deal?.status === 'SETTLEMENT_PHASE' || deal?.status === 'COMPLETED';
  const groupedMemberDocuments = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        role: string;
        memberName: string;
        documents: ApiMemberDocument[];
      }
    >();

    memberDocuments.forEach((document) => {
      const role = document.role?.trim() || 'Μέλος';
      const memberName = document.memberName?.trim() || 'Μη ορισμένο μέλος';
      const key = `${role}|${memberName}`;
      const group = groups.get(key) ?? { key, role, memberName, documents: [] };
      group.documents.push(document);
      groups.set(key, group);
    });

    return Array.from(groups.values()).sort((left, right) => {
      const leftKey = `${left.role} ${left.memberName}`;
      const rightKey = `${right.role} ${right.memberName}`;
      return leftKey.localeCompare(rightKey, 'el');
    });
  }, [memberDocuments]);

  const memberByRole = useMemo(() => {
    const map = new Map<ApiMemberRole, string>();
    dealMembers.forEach((member) => {
      if (!map.has(member.role)) {
        map.set(member.role, member.name);
      }
    });
    return map;
  }, [dealMembers]);

  const roleLabel = (role?: ApiMemberRole) => {
    if (!role) return 'Μη ορισμένο μέλος';
    const mapped = memberByRole.get(role);
    if (mapped) return mapped;
    const fallback = ROLE_OPTIONS.find((opt) => opt.value === role)?.label;
    return fallback ?? 'Μη ορισμένο μέλος';
  };

  const sellerApproved = useMemo(
    () => sellerDocuments.length > 0 && sellerDocuments.every((doc) => doc.status === 'APPROVED'),
    [sellerDocuments]
  );
  const buyerApproved = useMemo(
    () => buyerDocuments.length > 0 && buyerDocuments.every((doc) => doc.status === 'APPROVED'),
    [buyerDocuments]
  );
  const settlementApproved = useMemo(
    () => settlementDocuments.length > 0 && settlementDocuments.every((doc) => doc.status === 'APPROVED'),
    [settlementDocuments]
  );

  const updateDocumentStatus = async (doc: ApiDealDocument, status: 'APPROVED' | 'REJECTED' | 'PENDING', comment?: string) => {
    setReviewingDocId(doc.id);
    try {
      const updated = await reviewDealDocument(transactionId, doc.id, {
        status,
        reviewerComment: comment,
      });
      setDocuments((prev) => prev.map((entry) => (entry.id === doc.id ? updated : entry)));
    } catch {
      showToast('Αποτυχία ενημέρωσης κατάστασης εγγράφου.', 'error');
    } finally {
      setReviewingDocId(null);
    }
  };

  const updateDocumentAssignee = async (doc: ApiDealDocument, role: ApiMemberRole) => {
    try {
      const updated = await assignDealDocumentRole(transactionId, doc.id, { role });
      setDocuments((prev) => prev.map((entry) => (entry.id === doc.id ? updated : entry)));
      showToast('Η ανάθεση ρόλου αποθηκεύτηκε.', 'success');
    } catch {
      showToast('Αποτυχία ανάθεσης ρόλου.', 'error');
    }
  };

  const confirmReject = async () => {
    if (!rejectModalDoc) return;
    const reason = rejectReasonDraft.trim();
    if (reason.length < 10) return;
    await updateDocumentStatus(rejectModalDoc, 'REJECTED', reason);
    setRejectModalDoc(null);
    setRejectReasonDraft('');
  };

  const handleOpenFile = async (document: ApiDealDocument) => {
    if (!document.fileUrl) return;
    setOpeningDocId(document.id);
    try {
      const res = await getDealDocumentDownloadUrl(transactionId, document.id);
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('Αποτυχία ανοίγματος αρχείου.', 'error');
    } finally {
      setOpeningDocId(null);
    }
  };

  const handleOpenMemberFile = async (document: ApiMemberDocument) => {
    if (!document.fileUrl) return;
    setOpeningDocId(document.id);
    try {
      const res = await getDealMemberDocumentDownloadUrl(transactionId, document.id);
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('Αποτυχία ανοίγματος αρχείου μέλους.', 'error');
    } finally {
      setOpeningDocId(null);
    }
  };

  const updateMemberDocumentStatus = async (
    document: ApiMemberDocument,
    status: 'APPROVED' | 'REJECTED' | 'PENDING',
    reviewerComment?: string,
  ) => {
    setReviewingMemberStageId(document.id);
    try {
      const updated = await reviewDealMemberDocument(transactionId, document.id, { status, reviewerComment });
      setMemberDocuments((prev) => prev.map((entry) => (entry.id === document.id ? updated : entry)));
    } catch {
      showToast('Αποτυχία ενημέρωσης κατάστασης member εγγράφου.', 'error');
    } finally {
      setReviewingMemberStageId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[var(--page-bg)]">
      <header className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-4 text-[var(--text-primary)] dark:bg-[var(--surface-darkness)] dark:text-[var(--text-on-dark)]">
        <h1 className="text-xl font-semibold">Έλεγχος Εγγράφων</h1>
        <p className="text-sm text-[var(--text-secondary)] dark:text-[var(--text-on-dark-muted)]">Broker review phase για τη συναλλαγή</p>
      </header>

      <section className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-[var(--text-tertiary)]">Ακίνητο</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{deal?.propertyTitle ?? '-'}</p>
            {propertyReferenceCode && (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Ref ID: {propertyReferenceCode}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--text-tertiary)]">Πελάτης</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{deal?.clientName ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--text-tertiary)]">Κατάσταση Deal</p>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{deal?.status ?? '-'}</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Φάση συλλογής εγγράφων: {deal?.documentsPhase === 'SELLER'
                ? 'Πωλητής'
                : deal?.documentsPhase === 'BUYER'
                  ? 'Αγοραστής'
                  : deal?.documentsPhase === 'COMPLETE'
                    ? 'Ολοκληρωμένη'
                    : '-'}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">ID Συναλλαγής: {transactionId}</p>
        <div className="mt-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Links Πελατών</p>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-tertiary)]">Αγοραστής</span>
              <code className="rounded bg-[var(--surface-glow)] px-2 py-1 text-xs text-[var(--text-primary)]">{buyerPortalUrl}</code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(buyerPortalUrl);
                    showToast('Το link αγοραστή αντιγράφηκε.', 'success');
                  } catch {
                    showToast('Αποτυχία αντιγραφής link.', 'error');
                  }
                }}
                className="rounded-md bg-[var(--brand-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                Αντιγραφή
              </button>
              <a
                href={buyerPortalUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
              >
                Άνοιγμα
              </a>
            </div>
            {sellerPortalUrl && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-tertiary)]">Πωλητής</span>
                <code className="rounded bg-[var(--surface-glow)] px-2 py-1 text-xs text-[var(--text-primary)]">{sellerPortalUrl}</code>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(sellerPortalUrl);
                      showToast('Το link πωλητή αντιγράφηκε.', 'success');
                    } catch {
                      showToast('Αποτυχία αντιγραφής link.', 'error');
                    }
                  }}
                  className="rounded-md bg-[var(--brand-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                >
                  Αντιγραφή
                </button>
                <a
                  href={sellerPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                >
                  Άνοιγμα
                </a>
              </div>
            )}
          </div>
        </div>
      </section>

      {inProcessPhase && settlementDocuments.length > 0 && (
        <section className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ηλεκτρονική Ολοκλήρωση</h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                Αποδεικτικά πληρωμής που πρέπει να ανέβουν από αγοραστή και πωλητή πριν το broker completion.
              </p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${
              settlementApproved
                ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                : 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
            }`}>
              {settlementApproved ? 'Έτοιμο για ολοκλήρωση' : 'Εκκρεμούν αποδεικτικά'}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {settlementDocuments.map((document) => (
              <article
                key={document.id}
                className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{document.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      Υπόχρεος: {document.partyRole === 'SELLER' ? 'Πωλητής' : 'Αγοραστής'}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--border-default)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {brokerStatusLabel(document.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {document.fileUrl && (
                    <button
                      onClick={() => void handleOpenFile(document)}
                      disabled={openingDocId === document.id}
                      className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                    >
                      Άνοιγμα
                    </button>
                  )}
                  <button
                    onClick={() => void updateDocumentStatus(document, 'APPROVED')}
                    disabled={reviewingDocId === document.id || document.status !== 'UPLOADED'}
                    className="rounded-md bg-[var(--status-success-text)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Έγκριση
                  </button>
                  <button
                    onClick={() => {
                      setRejectModalDoc(document);
                      setRejectReasonDraft(document.reviewerComment ?? '');
                    }}
                    disabled={reviewingDocId === document.id || document.status !== 'UPLOADED'}
                    className="rounded-md bg-[var(--status-danger-text)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Απόρριψη
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                  {document.uploadedAt ? `Ανέβηκε: ${formatDateLabel(document.uploadedAt)}` : 'Δεν έχει ανέβει ακόμη αρχείο.'}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <main className="flex-1 overflow-x-auto p-6">
        <section className="mb-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Έγγραφα Αγοραστή & Πωλητή</h2>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {counts.approved}/{counts.total} εγκρίθηκαν · {counts.uploaded} για review · {counts.pending} εκκρεμούν upload · {counts.rejected} απορρίφθηκαν
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--text-secondary)]">{progress}%</span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border-default)]">
            <div className="h-full rounded-full bg-[var(--brand-primary)] transition-all" style={{ width: `${progress}%` }} />
          </div>

          {deal?.documentsPhase === 'COMPLETE' && inDocumentsPhase && (
            <div className="mt-4 rounded-lg border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3">
              <p className="text-sm font-semibold text-[var(--status-success-text)]">✓ Ολοκληρώθηκε η συλλογή εγγράφων. Η διαδικασία μπορεί να ξεκινήσει.</p>
              <button
                className="mt-2 rounded-md bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                onClick={async () => {
                  try {
                    await startDealProcess(transactionId);
                    await refreshData();
                    showToast('Η φάση εγγράφων ολοκληρώθηκε. Το deal πέρασε στη PROCESS_PHASE.', 'success');
                  } catch {
                    showToast('Αποτυχία μετάβασης σε PROCESS_PHASE.', 'error');
                  }
                }}
              >
                Μετάβαση σε Φάση 2 →
              </button>
            </div>
          )}
          {inDocumentsPhase && deal?.documentsPhase === 'SELLER' && (
            <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Στάδιο Πωλητή</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">Ολοκληρώστε πρώτα όλα τα έγγραφα του πωλητή.</p>
              <button
                className="mt-2 rounded-md bg-[var(--surface-highlight)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-glow-active)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!sellerApproved}
                onClick={async () => {
                  try {
                    await advanceDealDocumentsPhase(transactionId);
                    await refreshData();
                    showToast('Προχωρήσαμε στη φάση εγγράφων αγοραστή.', 'success');
                  } catch {
                    showToast('Αποτυχία μετάβασης στη φάση αγοραστή.', 'error');
                  }
                }}
              >
                Μετάβαση σε Φάση Αγοραστή →
              </button>
            </div>
          )}
          {inDocumentsPhase && deal?.documentsPhase === 'BUYER' && (
            <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Στάδιο Αγοραστή</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">Ολοκληρώστε τα έγγραφα αγοραστή πριν ξεκινήσει η διαδικασία.</p>
              <button
                className="mt-2 rounded-md bg-[var(--surface-highlight)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-glow-active)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!buyerApproved}
                onClick={async () => {
                  try {
                    await advanceDealDocumentsPhase(transactionId);
                    await refreshData();
                    showToast('Ολοκληρώθηκε η συλλογή εγγράφων.', 'success');
                  } catch {
                    showToast('Αποτυχία ολοκλήρωσης συλλογής εγγράφων.', 'error');
                  }
                }}
              >
                Ολοκλήρωση Συλλογής Εγγράφων →
              </button>
            </div>
          )}
          {inProcessPhase && (
            <div className="mt-4 rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-3">
              <p className="text-sm font-semibold text-[var(--status-info-text)]">
                Η συναλλαγή βρίσκεται σε φάση διαδικασίας.
              </p>
              <p className="mt-1 text-xs text-[var(--status-info-text)]">
                Τα έγγραφα πελάτη έχουν κλειδώσει. Παρακάτω ελέγχεις ξεχωριστά τα έγγραφα των μελών.
              </p>
            </div>
          )}

          {loading ? (
            <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 text-sm text-[var(--text-secondary)]">
              Φόρτωση...
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {[{ label: 'Έγγραφα Πωλητή', docs: sellerDocuments }, { label: 'Έγγραφα Αγοραστή', docs: buyerDocuments }].map((group) => (
                <div key={group.label} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)]">
                  <div className="border-b border-[var(--border-subtle)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                    {group.label}
                  </div>
                  <table className="min-w-full text-sm">
                    <thead className="bg-[var(--surface-ambient)] text-left text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
                      <tr>
                        <th className="px-4 py-3">Έγγραφο</th>
                        <th className="px-4 py-3">Κατάσταση</th>
                        <th className="px-4 py-3">Αρχείο</th>
                        <th className="px-4 py-3">Τελευταία Ενημέρωση</th>
                        <th className="px-4 py-3">Ανάθεση ρόλου</th>
                        <th className="px-4 py-3">Ενέργειες</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.docs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-xs text-[var(--text-tertiary)]">
                            Δεν υπάρχουν έγγραφα σε αυτή την ομάδα.
                          </td>
                        </tr>
                      )}
                      {group.docs.map((document) => {
                        const isBusy = reviewingDocId === document.id;
                        const isReviewable = inDocumentsPhase && document.status === 'UPLOADED' && !document.assignedRole;
                        const canUndo = inDocumentsPhase && !document.assignedRole && (document.status === 'APPROVED' || document.status === 'REJECTED');

                        return (
                          <tr key={document.id} className="border-t border-[var(--border-default)] align-top bg-[var(--surface-glow)]">
                            <td className="px-4 py-3">
                              <p className="font-medium text-[var(--text-primary)]">{document.name}</p>
                              {document.reviewerComment && (
                                <p className="mt-1 text-xs italic text-[var(--text-tertiary)]">{document.reviewerComment}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-[var(--surface-highlight)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                                {brokerStatusLabel(document.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {document.fileUrl ? (
                                <button
                                  onClick={() => handleOpenFile(document)}
                                  disabled={openingDocId === document.id}
                                  className="text-xs font-semibold text-[var(--text-link)] hover:underline disabled:opacity-40"
                                >
                                  {openingDocId === document.id ? 'Άνοιγμα...' : 'Προβολή αρχείου'}
                                </button>
                              ) : (
                                <span className="text-xs text-[var(--text-tertiary)]">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                              {formatDateLabel(document.reviewedAt || document.uploadedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative">
                                <select
                                  value={document.assignedRole ?? ''}
                                  onChange={(event) => {
                                    const value = event.target.value as ApiMemberRole;
                                    if (!value) return;
                                    void updateDocumentAssignee(document, value);
                                  }}
                                  className="w-full appearance-none rounded-lg border border-[var(--border-strong)] bg-[var(--surface-glow)] px-3 py-2 pr-8 text-xs font-semibold text-[var(--text-secondary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                                >
                                  <option value="">Χωρίς ανάθεση</option>
                                  {ROLE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-tertiary)]">
                                  ▾
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {isReviewable && (
                                <div className="flex items-center gap-2">
                                  <button
                                    className="rounded-md bg-[var(--status-success)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => updateDocumentStatus(document, 'APPROVED')}
                                  >
                                    Έγκριση
                                  </button>
                                  <button
                                    className="rounded-md border border-[var(--status-danger-border)] px-2.5 py-1 text-xs font-semibold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] disabled:opacity-50"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setRejectModalDoc(document);
                                      setRejectReasonDraft('');
                                    }}
                                  >
                                    Απόρριψη
                                  </button>
                                </div>
                              )}

                              {document.assignedRole && (
                                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                                  Ανατέθηκε στον {roleLabel(document.assignedRole)}
                                </p>
                              )}

                              {canUndo && (
                                <button
                                  onClick={() => updateDocumentStatus(document, 'PENDING')}
                                  disabled={isBusy}
                                  className="text-xs text-[var(--text-tertiary)] underline disabled:opacity-40"
                                >
                                  Αναίρεση σε PENDING
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>

        {inProcessPhase && (
          <div className="mb-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Πρόοδος Process Phase</h3>
            <div className="mt-3 space-y-2">
              {stages.length === 0 && <p className="text-xs text-[var(--text-tertiary)]">Δεν έχουν δημιουργηθεί στάδια ακόμη.</p>}
              {stages.map((stage) => (
                <div key={stage.id} className="flex items-center justify-between rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{stage.title}</p>
                    <p className="text-[var(--text-tertiary)]">{stage.memberName ?? 'Μη ορισμένο μέλος'}</p>
                  </div>
                  <span className="rounded-full bg-[var(--surface-highlight)] px-2 py-1 font-semibold text-[var(--text-secondary)]">{stage.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {inProcessPhase && (
          <section className="mb-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Έγγραφα Μελών Διαδικασίας</h3>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Ομαδοποιημένα ανά ρόλο και υπεύθυνο μέλος.</p>
              </div>
              <span className="rounded-full bg-[var(--surface-highlight)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                {memberDocuments.length} αρχεία
              </span>
            </div>

            {memberDocuments.length === 0 ? (
              <p className="mt-3 text-xs text-[var(--text-tertiary)]">Δεν υπάρχουν uploads από μέλη ακόμη.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {groupedMemberDocuments.map((group) => (
                  <div key={group.key} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{group.role}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{group.memberName}</p>
                      </div>
                      <span className="rounded-full bg-[var(--surface-glow)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                        {group.documents.length} έγγραφα
                      </span>
                    </div>

                    <table className="min-w-full overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] text-xs">
                      <thead className="bg-[var(--surface-ambient)] text-[var(--text-tertiary)]">
                        <tr>
                          <th className="px-3 py-2 text-left">Στάδιο</th>
                          <th className="px-3 py-2 text-left">Έγγραφο</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Αρχείο</th>
                          <th className="px-3 py-2 text-left">Ενέργειες</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.documents.map((document) => {
                          const canReview = document.status === 'UPLOADED';
                          const canUndo = document.status === 'APPROVED' || document.status === 'REJECTED';
                          const busy = reviewingMemberStageId === document.id;
                          return (
                            <tr key={`member-doc-${document.id}`} className="border-t border-[var(--border-default)] align-top">
                              <td className="px-3 py-2 text-[var(--text-secondary)]">{document.stageTitle}</td>
                              <td className="px-3 py-2">
                                <p className="font-semibold text-[var(--text-primary)]">{document.name}</p>
                                {document.reviewerComment && (
                                  <p className="mt-1 italic text-[var(--status-danger-text)]">{document.reviewerComment}</p>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span className="rounded-full bg-[var(--surface-highlight)] px-2 py-1 font-semibold text-[var(--text-secondary)]">
                                  {brokerStatusLabel(document.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {document.fileUrl ? (
                                  <button
                                    onClick={() => void handleOpenMemberFile(document)}
                                    disabled={openingDocId === document.id}
                                    className="font-semibold text-[var(--text-link)] hover:underline disabled:opacity-50"
                                  >
                                    {openingDocId === document.id ? 'Άνοιγμα...' : 'Προβολή αρχείου'}
                                  </button>
                                ) : (
                                  <span className="text-[var(--text-tertiary)]">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {canReview && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => void updateMemberDocumentStatus(document, 'APPROVED')}
                                      disabled={busy}
                                      className="rounded-md bg-[var(--status-success)] px-2 py-1 font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                    >
                                      Έγκριση
                                    </button>
                                    <button
                                      onClick={() => {
                                        const reason = window.prompt('Λόγος απόρριψης:');
                                        if (!reason || reason.trim().length < 5) return;
                                        void updateMemberDocumentStatus(document, 'REJECTED', reason.trim());
                                      }}
                                      disabled={busy}
                                      className="rounded-md border border-[var(--status-danger-border)] px-2 py-1 font-semibold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
                                    >
                                      Απόρριψη
                                    </button>
                                  </div>
                                )}
                                {canUndo && (
                                  <button
                                    onClick={() => void updateMemberDocumentStatus(document, 'PENDING')}
                                    disabled={busy}
                                    className="text-[var(--text-tertiary)] underline"
                                  >
                                    Αναίρεση σε PENDING
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {rejectModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <div className="border-b border-[var(--border-default)] px-5 py-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Απόρριψη Εγγράφου</h3>
              <p className="mt-1 text-sm text-[var(--text-tertiary)]">{rejectModalDoc.name}</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div>
                <label className="text-sm font-medium text-[var(--text-secondary)]">Λόγος Απόρριψης *</label>
                <textarea
                  value={rejectReasonDraft}
                  onChange={(event) => setRejectReasonDraft(event.target.value)}
                  className="mt-1 min-h-[110px] w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-5 py-4">
              <button
                onClick={() => setRejectModalDoc(null)}
                className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)]"
              >
                Ακύρωση
              </button>
              <button
                onClick={confirmReject}
                disabled={rejectReasonDraft.trim().length < 10}
                className="rounded-lg bg-[var(--status-danger)] px-3 py-2 text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Απόρριψη
              </button>
            </div>
          </div>
        </div>
      )}

      {documents.some((doc) => doc.status === 'APPROVED') && (
        <div className="pointer-events-none fixed bottom-5 right-5 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3 text-[var(--status-success-text)]">
          <CheckCircle2 size={18} />
        </div>
      )}
      {documents.some((doc) => doc.status === 'REJECTED') && (
        <div className="pointer-events-none fixed bottom-5 left-5 rounded-full border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-[var(--status-danger-text)]">
          <XCircle size={18} />
        </div>
      )}

    </div>
  );
}
