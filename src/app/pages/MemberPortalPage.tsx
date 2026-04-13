import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Folder, XCircle } from 'lucide-react';
import {
  ApiDealMember,
  ApiDealDocumentStatus,
  ApiDealDocument,
  ApiMemberDocument,
  completePublicMemberDocumentUpload,
  createPublicMemberDocumentUploadUrl,
  isMockUploadUrl,
  getPublicMemberDocumentDownloadUrl,
  getPublicMemberRoleDocumentDownloadUrl,
  getPublicMemberSellerDocumentDownloadUrl,
  getPublicMember,
  listPublicMemberDocuments,
  listPublicMemberRoleDocuments,
  listPublicMemberSellerDocuments,
  reviewPublicMemberRoleDocument,
} from '../api/trustlayerApi';
import DocumentDropzone from '../components/DocumentDropzone';
import { useUiStore } from '../state/uiStore';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function statusBadge(status: ApiDealDocumentStatus) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-success-text)]">
        <CheckCircle2 size={12} /> Εγκεκριμένο
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-danger-text)]">
        <XCircle size={12} /> Απορρίφθηκε
      </span>
    );
  }
  if (status === 'UPLOADED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-info-text)]">
        <Clock3 size={12} /> Σε Έλεγχο
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-warning-text)]">
      <AlertCircle size={12} /> Εκκρεμεί
    </span>
  );
}

function roleLabel(role?: string) {
  if (role === 'LAWYER') return 'Δικηγόρος';
  if (role === 'ENGINEER') return 'Μηχανικός';
  if (role === 'SURVEYOR') return 'Τοπογράφος';
  if (role === 'NOTARY') return 'Συμβολαιογράφος';
  return 'Μέλος';
}

function uploadStateLabel(doc: ApiMemberDocument) {
  if (doc.stageStatus === 'LOCKED') {
    return 'Το στάδιο είναι κλειδωμένο μέχρι να ολοκληρωθεί το προηγούμενο βήμα.';
  }
  if (doc.stageStatus === 'COMPLETED') {
    return 'Το στάδιο έχει ήδη ολοκληρωθεί και δεν δέχεται νέο upload.';
  }
  return 'Σύρετε PDF/JPG/PNG εδώ ή πατήστε για επιλογή.';
}

export function MemberPortalPage() {
  const { showToast } = useUiStore();
  const token = useMemo(() => {
    const match = window.location.pathname.match(/^\/member\/([^/]+)/i);
    return match?.[1] ?? '';
  }, []);
  const [member, setMember] = useState<ApiDealMember | null>(null);
  const [documents, setDocuments] = useState<ApiMemberDocument[]>([]);
  const [sellerDocuments, setSellerDocuments] = useState<ApiDealDocument[]>([]);
  const [roleDocuments, setRoleDocuments] = useState<ApiDealDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingStageId, setUploadingStageId] = useState<string | null>(null);
  const [reviewingRoleDocId, setReviewingRoleDocId] = useState<string | null>(null);

  const loadData = async () => {
    const [memberRes, docsRes] = await Promise.all([
      getPublicMember(token),
      listPublicMemberDocuments(token),
    ]);
    const [sellerDocsRes, roleDocsRes] = await Promise.all([
      listPublicMemberSellerDocuments(token).catch(() => []),
      listPublicMemberRoleDocuments(token).catch(() => []),
    ]);
    setMember(memberRes);
    setDocuments(docsRes);
    setSellerDocuments(sellerDocsRes);
    setRoleDocuments(roleDocsRes);
  };

  useEffect(() => {
    setLoading(true);
    loadData()
      .catch(() => showToast('Αποτυχία φόρτωσης member link.', 'error'))
      .finally(() => setLoading(false));
  }, [token, showToast]);

  const handleUpload = async (doc: ApiMemberDocument, file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('Επιτρέπονται μόνο PDF/JPG/PNG.', 'warning');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showToast('Μέγιστο μέγεθος αρχείου: 10MB.', 'warning');
      return;
    }
    setUploadingStageId(doc.id);
    try {
      const upload = await createPublicMemberDocumentUploadUrl(token, doc.id, {
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (!isMockUploadUrl(upload.uploadUrl)) {
        const put = await fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!put.ok) {
          throw new Error('Upload failed');
        }
      }
      const updated = await completePublicMemberDocumentUpload(token, doc.id, { fileUrl: upload.fileUrl });
      setDocuments((prev) => prev.map((entry) => (entry.id === doc.id ? updated : entry)));
      showToast('Το αρχείο ανέβηκε και είναι σε έλεγχο.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία upload αρχείου.', 'error');
    } finally {
      setUploadingStageId(null);
    }
  };

  const sellerFolders = useMemo(() => {
    const groups = new Map<string, ApiDealDocument[]>();
    sellerDocuments.forEach((doc) => {
      const category = doc.category?.trim() || 'Λοιπά Έγγραφα';
      const group = groups.get(category) ?? [];
      group.push(doc);
      groups.set(category, group);
    });
    return Array.from(groups.entries()).map(([category, docs]) => ({
      category,
      docs: docs.sort((a, b) => a.name.localeCompare(b.name, 'el')),
    })).sort((a, b) => a.category.localeCompare(b.category, 'el'));
  }, [sellerDocuments]);

  const roleFolders = useMemo(() => {
    const groups = new Map<string, ApiDealDocument[]>();
    roleDocuments.forEach((doc) => {
      const category = doc.category?.trim() || 'Λοιπά Έγγραφα';
      const group = groups.get(category) ?? [];
      group.push(doc);
      groups.set(category, group);
    });
    return Array.from(groups.entries()).map(([category, docs]) => ({
      category,
      docs: docs.sort((a, b) => a.name.localeCompare(b.name, 'el')),
    })).sort((a, b) => a.category.localeCompare(b.category, 'el'));
  }, [roleDocuments]);

  return (
    <div className="min-h-screen bg-[var(--surface-ambient)]">
      <header className="border-b border-[var(--border-dark)] bg-[#1A1612] px-6 py-4 text-white">
        <h1 className="text-xl font-semibold">Portal Μέλους</h1>
        <p className="text-sm text-[var(--text-on-dark-muted)]">Υποβολή αρχείων ρόλου και παρακολούθηση review status</p>
      </header>

      <main className="mx-auto w-full max-w-4xl p-6">
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Στοιχεία Μέλους</h2>
          {member ? (
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
              <p><span className="text-[var(--text-tertiary)]">Ονοματεπώνυμο:</span> <strong>{member.name}</strong></p>
              <p><span className="text-[var(--text-tertiary)]">Ρόλος:</span> <strong>{roleLabel(member.role)}</strong></p>
              <p><span className="text-[var(--text-tertiary)]">Deal:</span> <strong>{member.dealId}</strong></p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--text-tertiary)]">-</p>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Αρχεία Προς Υποβολή</h2>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">Φόρτωση...</p>
          ) : documents.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-tertiary)]">Δεν υπάρχουν tasks/έγγραφα για τον ρόλο σου.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {documents.map((doc) => (
                <article key={doc.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{doc.stageTitle}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{doc.name}</p>
                      {doc.reviewerComment && <p className="mt-1 text-xs italic text-[var(--status-danger-text)]">{doc.reviewerComment}</p>}
                      {doc.stageStatus === 'LOCKED' && (
                        <p className="mt-1 text-xs font-semibold text-[var(--status-warning-text)]">Κλειδωμένο στάδιο</p>
                      )}
                    </div>
                    {statusBadge(doc.status)}
                  </div>

                  <div className="mt-3 space-y-2">
                    <DocumentDropzone
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      disabled={uploadingStageId === doc.id || doc.uploadAllowed === false}
                      uploading={uploadingStageId === doc.id}
                      title="Ανέβασμα αρχείου"
                      subtitle={uploadStateLabel(doc)}
                      onFileSelected={(file) => {
                        if (!file) return;
                        return handleUpload(doc, file);
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {doc.fileUrl && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await getPublicMemberDocumentDownloadUrl(token, doc.id);
                              window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
                            } catch {
                              showToast('Αποτυχία ανοίγματος αρχείου.', 'error');
                            }
                          }}
                          className="text-xs font-semibold text-[var(--text-link)] hover:underline"
                        >
                          Προβολή τελευταίου αρχείου
                        </button>
                      )}
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {doc.uploadedAt ? `Τελευταίο upload: ${new Date(doc.uploadedAt).toLocaleString('el-GR')}` : 'Δεν έχει γίνει upload'}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Έγγραφα Πωλητή (Review)</h2>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">Φόρτωση...</p>
          ) : sellerFolders.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-tertiary)]">Δεν υπάρχουν διαθέσιμα έγγραφα πωλητή.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {sellerFolders.map((folder) => (
                <div key={folder.category} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-elevated)]">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      <Folder size={16} className="text-[var(--text-tertiary)]" />
                      {folder.category}
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">{folder.docs.length} αρχεία</span>
                  </div>
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {folder.docs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between px-4 py-2 text-xs">
                        <div className="space-y-1">
                          <p className="font-semibold text-[var(--text-primary)]">{doc.name}</p>
                          <p className="text-[var(--text-tertiary)]">{doc.fileUrl ? 'Αρχείο διαθέσιμο' : 'Χωρίς αρχείο'}</p>
                        </div>
                        {doc.fileUrl && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await getPublicMemberSellerDocumentDownloadUrl(token, doc.id);
                                window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
                              } catch {
                                showToast('Αποτυχία ανοίγματος εγγράφου πωλητή.', 'error');
                              }
                            }}
                            className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                          >
                            Προβολή
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Έγγραφα Ρόλου (Πελάτη)</h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                Μπορείς να κάνεις review μόνο στα έγγραφα που σου έχει αναθέσει ο μεσίτης.
              </p>
            </div>
            <span className="rounded-full bg-[var(--surface-highlight)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
              {roleDocuments.length} αρχεία
            </span>
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">Φόρτωση...</p>
          ) : roleFolders.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-tertiary)]">Δεν υπάρχουν διαθέσιμα έγγραφα ρόλου.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {roleFolders.map((folder) => (
                <div key={`role-folder-${folder.category}`} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      <Folder size={16} /> {folder.category}
                    </div>
                    <span className="rounded-full bg-[var(--surface-glow)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {folder.docs.length} έγγραφα
                    </span>
                  </div>
                  <div className="space-y-2">
                    {folder.docs.map((doc) => {
                      const canReview = member?.role && doc.assignedRole === member.role && doc.status === 'UPLOADED';
                      const canUndo = member?.role && doc.assignedRole === member.role && (doc.status === 'APPROVED' || doc.status === 'REJECTED');
                      return (
                        <article key={`role-doc-${doc.id}`} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[var(--text-primary)]">{doc.name}</p>
                              {doc.reviewerComment && (
                                <p className="mt-1 text-xs italic text-[var(--status-danger-text)]">{doc.reviewerComment}</p>
                              )}
                            </div>
                            {statusBadge(doc.status)}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {doc.fileUrl ? (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await getPublicMemberRoleDocumentDownloadUrl(token, doc.id);
                                    window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
                                  } catch {
                                    showToast('Αποτυχία ανοίγματος αρχείου.', 'error');
                                  }
                                }}
                                className="text-xs font-semibold text-[var(--text-link)] hover:underline"
                              >
                                Προβολή αρχείου
                              </button>
                            ) : (
                              <span className="text-xs text-[var(--text-tertiary)]">Δεν έχει ανέβει αρχείο ακόμη.</span>
                            )}
                            {canReview && (
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={reviewingRoleDocId === doc.id}
                                  onClick={async () => {
                                    try {
                                      setReviewingRoleDocId(doc.id);
                                      const updated = await reviewPublicMemberRoleDocument(token, doc.id, { status: 'APPROVED' });
                                      setRoleDocuments((prev) => prev.map((entry) => (entry.id === doc.id ? updated : entry)));
                                      showToast('Το έγγραφο εγκρίθηκε.', 'success');
                                    } catch {
                                      showToast('Αποτυχία έγκρισης.', 'error');
                                    } finally {
                                      setReviewingRoleDocId(null);
                                    }
                                  }}
                                  className="rounded-md bg-[var(--status-success)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                >
                                  Έγκριση
                                </button>
                                <button
                                  disabled={reviewingRoleDocId === doc.id}
                                  onClick={async () => {
                                    const reason = window.prompt('Λόγος απόρριψης:');
                                    if (!reason || reason.trim().length < 5) return;
                                    try {
                                      setReviewingRoleDocId(doc.id);
                                      const updated = await reviewPublicMemberRoleDocument(token, doc.id, {
                                        status: 'REJECTED',
                                        reviewerComment: reason.trim(),
                                      });
                                      setRoleDocuments((prev) => prev.map((entry) => (entry.id === doc.id ? updated : entry)));
                                      showToast('Το έγγραφο απορρίφθηκε.', 'success');
                                    } catch {
                                      showToast('Αποτυχία απόρριψης.', 'error');
                                    } finally {
                                      setReviewingRoleDocId(null);
                                    }
                                  }}
                                  className="rounded-md border border-[var(--status-danger-border)] px-2.5 py-1 text-xs font-semibold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] disabled:opacity-50"
                                >
                                  Απόρριψη
                                </button>
                              </div>
                            )}
                            {canUndo && (
                              <button
                                disabled={reviewingRoleDocId === doc.id}
                                onClick={async () => {
                                  try {
                                    setReviewingRoleDocId(doc.id);
                                    const updated = await reviewPublicMemberRoleDocument(token, doc.id, { status: 'PENDING' });
                                    setRoleDocuments((prev) => prev.map((entry) => (entry.id === doc.id ? updated : entry)));
                                    showToast('Το έγγραφο επανήλθε σε Pending.', 'success');
                                  } catch {
                                    showToast('Αποτυχία αναίρεσης.', 'error');
                                  } finally {
                                    setReviewingRoleDocId(null);
                                  }
                                }}
                                className="text-xs font-semibold text-[var(--text-tertiary)] underline disabled:opacity-40"
                              >
                                Αναίρεση σε PENDING
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
