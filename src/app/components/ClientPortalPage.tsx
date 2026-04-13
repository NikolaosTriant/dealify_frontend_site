import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  Folder,
  HelpCircle,
  Lock,
  Mail,
  Phone,
  Send,
  TriangleAlert,
  User,
  XCircle
} from 'lucide-react';
import {
  ApiDealMember,
  ApiDealStage,
  ApiDeal,
  ApiDealDocumentStatus,
  completePublicDealDocumentUpload,
  createPublicDealDocumentUploadUrl,
  isMockUploadUrl,
  getPublicDeal,
  getPublicDealDocumentDownloadUrl,
  listPublicDealDocuments,
  listPublicDealMembers,
  listPublicDealStages,
  sendPublicNudge
} from '../api/trustlayerApi';
import { DavlosLogo } from './DavlosLogo';
import DocumentDropzone from './DocumentDropzone';

type ClientTaskStatus = 'completed' | 'in-progress' | 'locked' | 'overdue';
type DocumentStatus = 'pending' | 'uploaded' | 'approved' | 'rejected';
type ActivityFilter = 'all' | 'action' | 'milestones';
type ActivityTone = 'info' | 'success' | 'alert';
type PortalTab = 'process' | 'activity' | 'help';
type SubjectOption = 'documents' | 'timeline' | 'legal' | 'other';

type RequiredDocument = {
  id: string;
  name: string;
  description: string;
  category?: string;
  status: DocumentStatus;
  partyRole?: 'BUYER' | 'SELLER';
  fileUrl?: string;
  rejectionComment?: string;
  fileName?: string;
  uploadedAt?: string;
};

type StageTask = {
  id: string;
  title: string;
  role: string;
  status: ClientTaskStatus;
  dueLabel?: string;
  completedOn?: string;
  reminderSentAt?: string;
};

type Stage = {
  id: string;
  title: string;
  role: string;
  status: ClientTaskStatus;
  tasks: StageTask[];
};

type ActivityItem = {
  id: string;
  timestamp: string;
  icon: 'document' | 'checkmark' | 'person' | 'alert';
  title: string;
  description: string;
  tone: ActivityTone;
  actionNeeded: boolean;
  milestone: boolean;
};

type NotificationRecord = {
  id: string;
  type: 'nudge';
  channel: 'email';
  recipientRole: string;
  createdAt: string;
  brokerNotified: boolean;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const REMINDER_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const SETTLEMENT_CATEGORY = 'Ηλεκτρονική ολοκλήρωση';

function statusBadge(status: DocumentStatus) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-success-text)]">
        <CheckCircle2 size={12} /> Εγκεκριμένο
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-danger-text)]">
        <XCircle size={12} /> Απορρίφθηκε
      </span>
    );
  }
  if (status === 'uploaded') {
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

function taskIcon(status: ClientTaskStatus) {
  if (status === 'completed') return <CheckCircle2 size={18} className="text-[var(--status-success-text)]" />;
  if (status === 'in-progress') return <Clock3 size={18} className="text-[var(--status-info-text)]" />;
  if (status === 'overdue') return <TriangleAlert size={18} className="text-[var(--status-danger-text)]" />;
  return <Lock size={18} className="text-[var(--text-tertiary)]" />;
}

function stageStatusLabel(status: ClientTaskStatus) {
  if (status === 'completed') return 'Ολοκληρώθηκε';
  if (status === 'in-progress') return 'Σε Εξέλιξη';
  if (status === 'overdue') return 'Καθυστέρηση';
  return 'Κλειδωμένο';
}

function activityIcon(icon: ActivityItem['icon']) {
  if (icon === 'document') return <FileText size={16} />;
  if (icon === 'checkmark') return <CheckCircle2 size={16} />;
  if (icon === 'person') return <User size={16} />;
  return <AlertCircle size={16} />;
}

function toneClasses(tone: ActivityTone) {
  if (tone === 'success') return 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]';
  if (tone === 'alert') return 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]';
  return 'border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]';
}

function formatShortDate(nowIso: string) {
  const date = new Date(nowIso);
  return date.toLocaleDateString('el-GR');
}

function mapApiDocumentStatus(status: ApiDealDocumentStatus): DocumentStatus {
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  if (status === 'UPLOADED') return 'uploaded';
  return 'pending';
}

function mapClientVisibleDocumentStatus(document: {
  status: ApiDealDocumentStatus;
  reviewedAt?: string;
  uploadedAt?: string;
}): DocumentStatus {
  // Guard against stale/seeded states: approval/rejection is valid only after broker review timestamp.
  if ((document.status === 'APPROVED' || document.status === 'REJECTED') && !document.reviewedAt) {
    return document.uploadedAt ? 'uploaded' : 'pending';
  }
  return mapApiDocumentStatus(document.status);
}

function mapRoleLabel(role?: string) {
  if (role === 'LAWYER') return 'Δικηγόρος';
  if (role === 'ENGINEER') return 'Μηχανικός';
  if (role === 'SURVEYOR') return 'Τοπογράφος';
  if (role === 'NOTARY') return 'Συμβολαιογράφος';
  return 'Μέλος';
}

function mapStageStatus(status: string, deadline?: string): ClientTaskStatus {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'LOCKED') return 'locked';
  if (deadline) {
    const dueDate = new Date(`${deadline}T00:00:00`);
    if (dueDate.getTime() < Date.now()) return 'overdue';
  }
  return 'in-progress';
}

function CircularProgress({ value }: { value: number }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} stroke="var(--border-default)" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="var(--brand-primary)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-[var(--brand-primary)]">
          {safeValue}%
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">Ολοκλήρωση</div>
      </div>
    </div>
  );
}

export function ClientPortalPage() {
  const publicToken = useMemo(() => {
    const match = window.location.pathname.match(/^\/(client|seller)\/([^/]+)/i);
    return match?.[2] ?? 'preview-client-link';
  }, []);
  const [documents, setDocuments] = useState<RequiredDocument[]>([]);
  const [publicDeal, setPublicDeal] = useState<ApiDeal | null>(null);
  const [publicMembers, setPublicMembers] = useState<ApiDealMember[]>([]);
  const [publicStages, setPublicStages] = useState<ApiDealStage[]>([]);
  const [usingBackendDocuments, setUsingBackendDocuments] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingByDoc, setUploadingByDoc] = useState<Record<string, boolean>>({});
  const [uploadErrorByDoc, setUploadErrorByDoc] = useState<Record<string, string>>({});
  const [expandedStage, setExpandedStage] = useState<string>('');
  const [activityOpen, setActivityOpen] = useState(true);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [activeTab, setActiveTab] = useState<PortalTab>('process');
  const [taskReminderModal, setTaskReminderModal] = useState<{ taskId: string; role: string; memberId?: string } | null>(null);
  const [tasks, setTasks] = useState<Stage[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [faqOpen, setFaqOpen] = useState<string>('faq-1');
  const [messageSubject, setMessageSubject] = useState<SubjectOption>('documents');
  const [messageBody, setMessageBody] = useState('');
  const [messageSent, setMessageSent] = useState(false);

  useEffect(() => {
    setDocumentsLoading(true);
    Promise.all([
      getPublicDeal(publicToken),
      listPublicDealDocuments(publicToken),
      listPublicDealMembers(publicToken),
      listPublicDealStages(publicToken),
    ])
      .then(([deal, apiDocuments, apiMembers, apiStages]) => {
        setPublicDeal(deal);
        setPublicMembers(apiMembers);
        setPublicStages(apiStages);
        setDocuments(
          apiDocuments.map((document) => ({
            id: document.id,
            name: document.name,
            description: 'Υποβολή εγγράφου μέσω του portal.',
            category: document.category,
            status: mapClientVisibleDocumentStatus(document),
            partyRole: document.partyRole ?? 'BUYER',
            fileUrl: document.fileUrl,
            rejectionComment: document.reviewerComment,
            fileName: document.fileUrl ? document.fileUrl.split('/').pop() : undefined,
            uploadedAt: document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString('el-GR') : undefined,
          }))
        );

        const roleByMemberId = new Map(apiMembers.map((member) => [member.id, mapRoleLabel(member.role)]));
        const mappedStages: Stage[] = apiStages.map((stage) => {
          const status = mapStageStatus(stage.status, stage.deadline);
          const dueLabel = stage.deadline
            ? `${new Date(`${stage.deadline}T00:00:00`).getTime() < Date.now() ? 'Έληξε' : 'Προθεσμία'}: ${new Date(stage.deadline).toLocaleDateString('el-GR')}`
            : undefined;
          return {
            id: stage.id,
            title: stage.title,
            role: roleByMemberId.get(stage.memberId ?? '') ?? 'Μέλος',
            status,
            tasks: [
              {
                id: stage.id,
                title: stage.title,
                role: roleByMemberId.get(stage.memberId ?? '') ?? 'Μέλος',
                status,
                dueLabel,
                completedOn: stage.completedAt ? new Date(stage.completedAt).toLocaleDateString('el-GR') : undefined,
              },
            ],
          };
        });
        setTasks(mappedStages);
        if (mappedStages.length > 0) {
          setExpandedStage(mappedStages[0].id);
        }

        const generatedActivity: ActivityItem[] = [];
        apiDocuments.forEach((document) => {
          if (document.uploadedAt) {
            generatedActivity.push({
              id: `doc-${document.id}`,
              timestamp: new Date(document.uploadedAt).toLocaleString('el-GR'),
              icon: 'document',
              title: `Υποβολή εγγράφου: ${document.name}`,
              description: 'Το έγγραφο υποβλήθηκε στο portal.',
              tone: 'info',
              actionNeeded: false,
              milestone: false,
            });
          }
          if (document.status === 'APPROVED' && document.reviewedAt) {
            generatedActivity.push({
              id: `doc-approved-${document.id}`,
              timestamp: new Date(document.reviewedAt).toLocaleString('el-GR'),
              icon: 'checkmark',
              title: `Έγκριση εγγράφου: ${document.name}`,
              description: 'Ο μεσίτης ενέκρινε το έγγραφο.',
              tone: 'success',
              actionNeeded: false,
              milestone: true,
            });
          }
          if (document.status === 'REJECTED' && document.reviewedAt) {
            generatedActivity.push({
              id: `doc-rejected-${document.id}`,
              timestamp: new Date(document.reviewedAt).toLocaleString('el-GR'),
              icon: 'alert',
              title: `Απόρριψη εγγράφου: ${document.name}`,
              description: document.reviewerComment ?? 'Απαιτείται νέα υποβολή.',
              tone: 'alert',
              actionNeeded: true,
              milestone: false,
            });
          }
        });
        apiStages.forEach((stage) => {
          if (stage.completedAt) {
            generatedActivity.push({
              id: `stage-${stage.id}`,
              timestamp: new Date(stage.completedAt).toLocaleString('el-GR'),
              icon: 'checkmark',
              title: `Ολοκλήρωση σταδίου: ${stage.title}`,
              description: `Ολοκληρώθηκε από ${stage.memberName ?? 'μέλος'}.`,
              tone: 'success',
              actionNeeded: false,
              milestone: true,
            });
          }
        });
        setActivity(generatedActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setUsingBackendDocuments(true);
      })
      .catch(() => {
        setUsingBackendDocuments(false);
        setDocuments([]);
        setPublicDeal(null);
        setPublicMembers([]);
        setPublicStages([]);
        setTasks([]);
        setActivity([]);
      })
      .finally(() => {
        setDocumentsLoading(false);
      });
  }, [publicToken]);

  const viewerRole = publicDeal?.publicRole ?? 'BUYER';
  const settlementDocuments = useMemo(
    () => documents.filter((doc) => doc.category === SETTLEMENT_CATEGORY),
    [documents]
  );
  const collectionDocuments = useMemo(
    () => documents.filter((doc) => doc.category !== SETTLEMENT_CATEGORY),
    [documents]
  );
  const buyerDocuments = useMemo(
    () => collectionDocuments.filter((doc) => doc.partyRole !== 'SELLER'),
    [collectionDocuments]
  );
  const sellerDocuments = useMemo(
    () => collectionDocuments.filter((doc) => doc.partyRole === 'SELLER'),
    [collectionDocuments]
  );
  const viewerDocuments = viewerRole === 'SELLER' ? sellerDocuments : buyerDocuments;
  const documentsPhase = publicDeal?.documentsPhase ?? (viewerRole === 'SELLER' ? 'SELLER' : 'BUYER');
  const visibleGroups = useMemo(
    () =>
      viewerRole === 'SELLER'
        ? [{ label: 'Έγγραφα Πωλητή', docs: sellerDocuments }]
        : [
            { label: 'Έγγραφα Αγοραστή', docs: buyerDocuments },
            { label: 'Έγγραφα Πωλητή', docs: sellerDocuments },
          ],
    [buyerDocuments, sellerDocuments, viewerRole]
  );
  const sellerFolders = useMemo(() => {
    const groups = new Map<string, RequiredDocument[]>();
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

  const approvedCount = useMemo(() => viewerDocuments.filter((doc) => doc.status === 'approved').length, [viewerDocuments]);
  const submittedCount = useMemo(() => viewerDocuments.filter((doc) => doc.status !== 'pending').length, [viewerDocuments]);
  const allApproved = viewerDocuments.length > 0 && approvedCount === viewerDocuments.length;
  const settlementReady = useMemo(
    () => publicDeal?.status === 'SETTLEMENT_PHASE' || publicDeal?.status === 'COMPLETED',
    [publicDeal?.status]
  );

  const totalTasks = useMemo(() => tasks.flatMap((stage) => stage.tasks).length, [tasks]);
  const completedTasks = useMemo(
    () => tasks.flatMap((stage) => stage.tasks).filter((task) => task.status === 'completed').length,
    [tasks]
  );
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const dealHealth = useMemo(() => {
    const overdue = tasks.flatMap((stage) => stage.tasks).filter((task) => task.status === 'overdue').length;
    if (overdue >= 2) {
      return {
        color: 'bg-[var(--status-danger)]',
        title: 'Κόκκινο',
        message: 'Υπάρχουν πολλαπλές καθυστερήσεις που επηρεάζουν το χρονοδιάγραμμα.'
      };
    }
    if (overdue === 1) {
      return {
        color: 'bg-[var(--status-warning)]',
        title: 'Κίτρινο',
        message: 'Μία εκκρεμότητα χρειάζεται υπενθύμιση για να αποφύγουμε καθυστέρηση.'
      };
    }
    return {
      color: 'bg-[var(--status-success)]',
      title: 'Πράσινο',
      message: 'Η διαδικασία προχωρά ομαλά σύμφωνα με το πλάνο.'
    };
  }, [tasks]);

  const visibleActivity = useMemo(() => {
    if (activityFilter === 'action') return activity.filter((entry) => entry.actionNeeded);
    if (activityFilter === 'milestones') return activity.filter((entry) => entry.milestone);
    return activity;
  }, [activity, activityFilter]);

  const memberIdByStageId = useMemo(
    () => new Map(publicStages.map((stage) => [stage.id, stage.memberId])),
    [publicStages],
  );

  const handleFileUpload = async (docId: string, file: File | null) => {
    if (!file) return;

    const targetDoc = documents.find((doc) => doc.id === docId);
    const isSettlementDoc = targetDoc?.category === SETTLEMENT_CATEGORY;
    if (targetDoc?.partyRole && targetDoc.partyRole !== viewerRole) {
      setUploadErrorByDoc((prev) => ({ ...prev, [docId]: 'Δεν μπορείτε να ανεβάσετε έγγραφα άλλης πλευράς.' }));
      return;
    }
    if (isSettlementDoc) {
      if (publicDeal?.status !== 'SETTLEMENT_PHASE') {
        setUploadErrorByDoc((prev) => ({ ...prev, [docId]: 'Η φάση ηλεκτρονικής ολοκλήρωσης δεν είναι ακόμη ενεργή.' }));
        return;
      }
    } else {
      if (publicDeal?.status !== 'DOCUMENTS_PHASE') {
        setUploadErrorByDoc((prev) => ({ ...prev, [docId]: 'Η φάση εγγράφων έχει ολοκληρωθεί.' }));
        return;
      }
      if (viewerRole === 'SELLER' && documentsPhase !== 'SELLER') {
        setUploadErrorByDoc((prev) => ({ ...prev, [docId]: 'Δεν είναι ενεργή η φάση εγγράφων πωλητή.' }));
        return;
      }
      if (viewerRole === 'BUYER' && documentsPhase !== 'BUYER') {
        setUploadErrorByDoc((prev) => ({ ...prev, [docId]: 'Δεν είναι ενεργή η φάση εγγράφων αγοραστή.' }));
        return;
      }
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadErrorByDoc((prev) => ({ ...prev, [docId]: 'Επιτρέπονται μόνο PDF, JPG, PNG.' }));
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadErrorByDoc((prev) => ({ ...prev, [docId]: 'Μέγιστο μέγεθος αρχείου 10MB.' }));
      return;
    }

    setUploadErrorByDoc((prev) => ({ ...prev, [docId]: '' }));

    if (usingBackendDocuments) {
      setUploadingByDoc((prev) => ({ ...prev, [docId]: true }));
      try {
        const contentType = file.type || 'application/octet-stream';
        const { uploadUrl, fileUrl } = await createPublicDealDocumentUploadUrl(publicToken, docId, {
          fileName: file.name,
          contentType,
          sizeBytes: file.size,
        });
        if (!isMockUploadUrl(uploadUrl)) {
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed (${uploadResponse.status})`);
          }
        }

        const updated = await completePublicDealDocumentUpload(publicToken, docId, { fileUrl });
        const now = new Date();
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === docId
              ? {
                  ...doc,
                  status: mapApiDocumentStatus(updated.status),
                  rejectionComment: updated.reviewerComment,
                  fileName: file.name,
                  uploadedAt: updated.uploadedAt ? new Date(updated.uploadedAt).toLocaleDateString('el-GR') : now.toLocaleDateString('el-GR'),
                }
              : doc
          )
        );
        setActivity((prev) => [
          {
            id: `act-upload-${Date.now()}`,
            timestamp: `${now.toLocaleDateString('el-GR')} ${now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}`,
            icon: 'document',
            title: `Υποβολή εγγράφου: ${file.name}`,
            description: 'Το έγγραφο υποβλήθηκε και περιμένει έλεγχο από τον μεσίτη.',
            tone: 'info',
            actionNeeded: false,
            milestone: false
          },
          ...prev
        ]);
      } catch (error) {
        const details = error instanceof Error ? ` ${error.message}` : '';
        setUploadErrorByDoc((prev) => ({ ...prev, [docId]: `Αποτυχία μεταφόρτωσης.${details}` }));
      } finally {
        setUploadingByDoc((prev) => ({ ...prev, [docId]: false }));
      }
      return;
    }

    const today = new Date().toLocaleDateString('el-GR');
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              status: 'uploaded',
              fileName: file.name,
              uploadedAt: today,
              rejectionComment: undefined
            }
          : doc
      )
    );
    setActivity((prev) => [
      {
        id: `act-upload-${Date.now()}`,
        timestamp: `${today} ${new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}`,
        icon: 'document',
        title: `Υποβολή εγγράφου: ${file.name}`,
        description: 'Το έγγραφο υποβλήθηκε και περιμένει έλεγχο από τον μεσίτη.',
        tone: 'info',
        actionNeeded: false,
        milestone: false
      },
      ...prev
    ]);
  };

  const handleOpenSellerDocument = async (doc: RequiredDocument) => {
    if (!doc.id || !doc.fileUrl) return;
    try {
      const res = await getPublicDealDocumentDownloadUrl(publicToken, doc.id);
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setUploadErrorByDoc((prev) => ({ ...prev, [doc.id]: 'Αποτυχία ανοίγματος εγγράφου.' }));
    }
  };

  const canSendReminder = (task: StageTask) => {
    if (!task.reminderSentAt) return true;
    return Date.now() - new Date(task.reminderSentAt).getTime() >= REMINDER_COOLDOWN_MS;
  };

  const handleConfirmReminder = async () => {
    if (!taskReminderModal) return;

    const nowIso = new Date().toISOString();
    const today = formatShortDate(nowIso);

    setTasks((prev) =>
      prev.map((stage) => ({
        ...stage,
        tasks: stage.tasks.map((task) =>
          task.id === taskReminderModal.taskId
            ? {
                ...task,
                reminderSentAt: nowIso
              }
            : task
        )
      }))
    );

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        type: 'nudge',
        channel: 'email',
        recipientRole: taskReminderModal.role,
        createdAt: nowIso,
        brokerNotified: true
      },
      ...prev
    ]);

    setActivity((prev) => [
      {
        id: `act-nudge-${Date.now()}`,
        timestamp: `${today} ${new Date(nowIso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}`,
        icon: 'alert',
        title: `Υπενθύμιση στάλθηκε σε ${taskReminderModal.role}`,
        description: 'Το αίτημα στάλθηκε με email και ο μεσίτης ενημερώθηκε.',
        tone: 'info',
        actionNeeded: false,
        milestone: false
      },
      ...prev
    ]);

    if (usingBackendDocuments && taskReminderModal.memberId) {
      try {
        await sendPublicNudge(publicToken, taskReminderModal.memberId, {
          message: `Παρακαλώ προχωρήστε το στάδιο: ${taskReminderModal.role}`,
        });
      } catch {
        // Keep local activity log even if nudge API fails.
      }
    }

    setTaskReminderModal(null);
  };

  const handleSendMessage = () => {
    if (!messageBody.trim()) return;

    const now = new Date();
    const dateStr = `${now.toLocaleDateString('el-GR')} ${now.toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    setActivity((prev) => [
      {
        id: `act-msg-${Date.now()}`,
        timestamp: dateStr,
        icon: 'person',
        title: 'Νέο μήνυμα προς μεσίτη',
        description: `Θέμα: ${subjectLabels[messageSubject]}`,
        tone: 'info',
        actionNeeded: false,
        milestone: false
      },
      ...prev
    ]);

    setMessageBody('');
    setMessageSent(true);
    setTimeout(() => setMessageSent(false), 2500);
  };

  const phase = publicDeal?.status === 'PROCESS_PHASE' || publicDeal?.status === 'SETTLEMENT_PHASE' || publicDeal?.status === 'COMPLETED'
    ? 'process'
    : 'submission';

  return (
    <div className="min-h-screen bg-[var(--surface-ambient)]">
      <header className="px-4 pb-4 pt-5 text-white bg-[#1A1612]">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-white/8 p-1.5">
                  <DavlosLogo className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                </div>
                <p className="text-xs text-[var(--text-on-dark-muted)]">Δαυλός</p>
              </div>
              <h1 className="text-base font-semibold">Υπεύθυνος Μεσίτης</h1>
            </div>
            <a href="tel:+302105550199" className="rounded-lg bg-[var(--surface-glow)]/15 px-3 py-1.5 text-xs font-semibold">
              +30 210 555 0199
            </a>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-[var(--surface-glow)] text-[var(--text-primary)] shadow-sm">
            <div className="h-32 w-full bg-[var(--surface-highlight)]" />
            <div className="space-y-1 p-3">
              <p className="text-sm font-semibold">{publicDeal?.propertyTitle ?? 'Αγοραπωλησία - Βούλα, 3ος Όροφος'}</p>
              <p className="text-xs text-[var(--text-secondary)]">Αγοραστής: {publicDeal?.clientName ?? 'Μαρία & Νίκος'}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Ρόλος: {viewerRole === 'SELLER' ? 'Πωλητής' : 'Αγοραστής'}
              </p>
              <p className="text-xs font-semibold text-[var(--text-tertiary)]">Token: {publicToken}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {phase === 'submission' && (
          <section className="rounded-2xl bg-[var(--surface-glow)] p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Υποβολή Εγγράφων</h2>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Ανεβάστε τα έγγραφα για να ξεκινήσει η διαδικασία.</p>
            <p className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">
              Τρέχουσα φάση συλλογής: {documentsPhase === 'SELLER' ? 'Πωλητής' : documentsPhase === 'BUYER' ? 'Αγοραστής' : 'Ολοκληρωμένη'}
            </p>
            {documentsLoading && <p className="mt-2 text-xs text-[var(--text-tertiary)]">Φόρτωση εγγράφων...</p>}

            <div className="mt-4 space-y-4">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {group.label}
                  </p>
                  {viewerRole === 'BUYER' && group.label === 'Έγγραφα Πωλητή' && (
                    <div className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-3 text-xs text-[var(--text-secondary)]">
                      Τα έγγραφα του πωλητή εμφανίζονται ανά φάκελο. Μπορείτε μόνο να τα προβάλετε.
                    </div>
                  )}
                  {viewerRole === 'BUYER' && group.label === 'Έγγραφα Πωλητή' && (
                    <div className="space-y-3">
                      {sellerFolders.length === 0 && (
                        <p className="text-xs text-[var(--text-tertiary)]">Δεν υπάρχουν διαθέσιμοι φάκελοι.</p>
                      )}
                      {sellerFolders.map((folder) => (
                        <div key={folder.category} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)]">
                          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                              <Folder size={16} className="text-[var(--text-tertiary)]" />
                              {folder.category}
                            </div>
                            <span className="text-xs text-[var(--text-tertiary)]">{folder.docs.length} αρχεία</span>
                          </div>
                          <div className="divide-y divide-[var(--border-subtle)]">
                            {folder.docs.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between px-3 py-2 text-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold text-[var(--text-primary)]">{doc.name}</p>
                                  <p className="text-[var(--text-tertiary)]">{doc.fileName ?? (doc.fileUrl ? 'Αρχείο διαθέσιμο' : 'Χωρίς αρχείο')}</p>
                                </div>
                                {doc.fileUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSellerDocument(doc)}
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
                  {!(viewerRole === 'BUYER' && group.label === 'Έγγραφα Πωλητή') && (
                  <div className="space-y-3">
                    {group.docs.length === 0 && (
                      <p className="text-xs text-[var(--text-tertiary)]">Δεν υπάρχουν έγγραφα σε αυτή την ομάδα.</p>
                    )}
                    {group.docs.map((doc) => {
                      const approvedRow = doc.status === 'approved';
                      const rejectedRow = doc.status === 'rejected';
                      const canUpload = doc.partyRole === viewerRole
                        && publicDeal?.status === 'DOCUMENTS_PHASE'
                        && ((viewerRole === 'SELLER' && documentsPhase === 'SELLER')
                          || (viewerRole === 'BUYER' && documentsPhase === 'BUYER'));

                      return (
                        <div
                          key={doc.id}
                          className={`rounded-xl border p-3 ${
                            approvedRow
                              ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)]'
                              : rejectedRow
                              ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]'
                              : 'border-[var(--border-default)] bg-[var(--surface-glow)]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-[var(--text-primary)]">{doc.name}</p>
                              <p className="text-xs text-[var(--text-tertiary)]">{doc.description}</p>
                            </div>
                            {statusBadge(doc.status)}
                          </div>

                          {doc.rejectionComment && (
                            <p className="mt-2 rounded-lg bg-[var(--status-danger-bg)] px-2 py-1 text-xs text-[var(--status-danger-text)]">{doc.rejectionComment}</p>
                          )}

                          {canUpload ? (
                            <DocumentDropzone
                              accept=".pdf,.jpg,.jpeg,.png"
                              disabled={Boolean(uploadingByDoc[doc.id])}
                              uploading={Boolean(uploadingByDoc[doc.id])}
                              title="Μεταφόρτωση εγγράφου"
                              subtitle="Σύρετε PDF/JPG/PNG εδώ ή πατήστε για επιλογή. Μέγιστο 10MB."
                              onFileSelected={(file) => handleFileUpload(doc.id, file)}
                            />
                          ) : (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-ambient)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
                              <Lock size={14} /> Μόνο προβολή για την άλλη πλευρά.
                            </div>
                          )}

                          {uploadErrorByDoc[doc.id] && (
                            <p className="mt-1 text-xs font-medium text-[var(--status-danger-text)]">
                              {uploadErrorByDoc[doc.id]}
                            </p>
                          )}

                          {doc.fileName && (
                            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                              Αρχείο: <span className="font-medium text-[var(--text-secondary)]">{doc.fileName}</span>
                              {doc.uploadedAt ? ` • ${doc.uploadedAt}` : ''}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-[var(--text-secondary)]">
                <span>Πρόοδος υποβολής</span>
                <span className="font-semibold">{submittedCount}/{viewerDocuments.length}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--border-default)]">
                <div
                  className="h-2 rounded-full"
                  style={{ backgroundColor: 'var(--brand-primary)', width: `${viewerDocuments.length > 0 ? Math.round((submittedCount / viewerDocuments.length) * 100) : 0}%` }}
                />
              </div>
            </div>
          </section>
        )}

        {phase === 'process' && activeTab === 'process' && (
          <>
            <section className="rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4">
              <p className="text-sm font-semibold text-[var(--status-success-text)]">Το αρχείο σας είναι πλήρες.</p>
              <p className="mt-1 text-xs text-[var(--status-success-text)]">Τα έγγραφά σας έχουν εγκριθεί και η διαδικασία ξεκίνησε.</p>
            </section>

            {settlementDocuments.length > 0 && settlementReady && (
              <section className="rounded-2xl bg-[var(--surface-glow)] p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ηλεκτρονική Ολοκλήρωση</h2>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Ανεβάστε το αποδεικτικό πληρωμής σας. Η συναλλαγή ολοκληρώνεται όταν ο μεσίτης εγκρίνει και τα δύο αποδεικτικά.
                </p>

                <div className="mt-3 space-y-3">
                  {settlementDocuments.map((doc) => {
                    const canUpload = doc.partyRole === viewerRole && publicDeal?.status === 'SETTLEMENT_PHASE';
                    return (
                      <div key={doc.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{doc.name}</p>
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {viewerRole === 'SELLER' ? 'Αποδεικτικό πληρωμής πωλητή προς μεσίτη' : 'Αποδεικτικό πληρωμής αγοραστή προς μεσίτη'}
                            </p>
                          </div>
                          {statusBadge(doc.status)}
                        </div>

                        {canUpload ? (
                          <DocumentDropzone
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={Boolean(uploadingByDoc[doc.id])}
                            uploading={Boolean(uploadingByDoc[doc.id])}
                            title="Μεταφόρτωση αποδεικτικού"
                            subtitle="Σύρετε PDF/JPG/PNG εδώ ή πατήστε για επιλογή."
                            onFileSelected={(file) => handleFileUpload(doc.id, file)}
                          />
                        ) : (
                          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-glow)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
                            <Lock size={14} /> Αναμένεται το αποδεικτικό της άλλης πλευράς ή ο έλεγχος του μεσίτη.
                          </div>
                        )}

                        {doc.fileName && (
                          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                            Αρχείο: <span className="font-medium text-[var(--text-secondary)]">{doc.fileName}</span>
                            {doc.uploadedAt ? ` • ${doc.uploadedAt}` : ''}
                          </p>
                        )}
                        {uploadErrorByDoc[doc.id] && (
                          <p className="mt-1 text-xs font-medium text-[var(--status-danger-text)]">{uploadErrorByDoc[doc.id]}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="rounded-2xl bg-[var(--surface-glow)] p-4 shadow-sm">
              <div className="flex items-center justify-center">
                <CircularProgress value={progressPercent} />
              </div>

              <div className="mt-4 space-y-3">
                {tasks.map((stage, index) => {
                  const expanded = expandedStage === stage.id;

                  return (
                    <div key={stage.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)]">
                      <button
                        type="button"
                        onClick={() => setExpandedStage(expanded ? '' : stage.id)}
                        className="flex w-full items-center gap-3 px-3 py-3 text-left"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-ambient)] text-xs font-bold text-[var(--text-secondary)]">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{stage.title}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">Υπεύθυνος ρόλος: {stage.role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {taskIcon(stage.status)}
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              stage.status === 'overdue'
                                ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]'
                                : stage.status === 'completed'
                                ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]'
                                : stage.status === 'locked'
                                ? 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border border-[var(--status-neutral-border)]'
                                : 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]'
                            }`}
                          >
                            {stageStatusLabel(stage.status)}
                          </span>
                          {expanded ? <ChevronUp size={16} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={16} className="text-[var(--text-tertiary)]" />}
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-[var(--border-subtle)] px-3 py-3">
                          <div className="space-y-2">
                            {stage.tasks.map((task) => {
                              const reminderAllowed = canSendReminder(task);

                              return (
                                <div
                                  key={task.id}
                                  className={`rounded-lg border p-2.5 ${
                                    task.status === 'overdue'
                                      ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]'
                                      : task.status === 'completed'
                                      ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)]'
                                      : 'border-[var(--border-default)] bg-[var(--surface-ambient)]'
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="mt-0.5">{taskIcon(task.status)}</div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-[var(--text-primary)]">{task.title}</p>
                                      <p className="text-xs text-[var(--text-tertiary)]">Ρόλος: {task.role}</p>
                                      {task.completedOn && <p className="text-xs text-[var(--status-success-text)]">Ολοκλήρωση: {task.completedOn}</p>}
                                      {task.dueLabel && (
                                        <p className={`text-xs ${task.status === 'overdue' ? 'font-semibold text-[var(--status-danger-text)]' : 'text-[var(--text-tertiary)]'}`}>
                                          {task.dueLabel}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {(task.status === 'overdue' || task.status === 'in-progress') && (
                                    <button
                                      type="button"
                                      disabled={!reminderAllowed}
                                      onClick={() =>
                                        setTaskReminderModal({
                                          taskId: task.id,
                                          role: task.role,
                                          memberId: memberIdByStageId.get(task.id),
                                        })
                                      }
                                      className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold ${
                                        reminderAllowed
                                          ? 'text-white'
                                          : 'cursor-not-allowed bg-[var(--border-default)] text-[var(--text-tertiary)]'
                                      }`}
                                      style={reminderAllowed ? { backgroundColor: 'var(--status-danger)' } : {}}
                                    >
                                      {task.reminderSentAt
                                        ? `Υπενθύμιση στάλθηκε ${formatShortDate(task.reminderSentAt)}`
                                        : 'Αποστολή Υπενθύμισης'}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Υγεία Συναλλαγής</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full ${dealHealth.color}`} />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{dealHealth.title}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{dealHealth.message}</p>
              </div>
            </section>
          </>
        )}

        {phase === 'process' && activeTab === 'activity' && (
          <section className="rounded-2xl bg-[var(--surface-glow)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActivityOpen((prev) => !prev)}
                className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
              >
                Ιστορικό Δραστηριότητας
                {activityOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <div className="flex gap-1 rounded-lg bg-[var(--surface-ambient)] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActivityFilter('all')}
                  className={`rounded-md px-2 py-1 ${activityFilter === 'all' ? 'bg-[var(--surface-glow)] font-semibold text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}
                >
                  Όλα
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter('action')}
                  className={`rounded-md px-2 py-1 ${activityFilter === 'action' ? 'bg-[var(--surface-glow)] font-semibold text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}
                >
                  Ενέργεια
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter('milestones')}
                  className={`rounded-md px-2 py-1 ${activityFilter === 'milestones' ? 'bg-[var(--surface-glow)] font-semibold text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}
                >
                  Ορόσημα
                </button>
              </div>
            </div>

            {activityOpen && (
              <div className="mt-3 space-y-2">
                {visibleActivity.map((entry) => (
                  <div key={entry.id} className={`rounded-xl border p-3 ${toneClasses(entry.tone)}`}>
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">{activityIcon(entry.icon)}</div>
                      <div className="flex-1">
                        <p className="text-xs font-medium opacity-80">{entry.timestamp}</p>
                        <p className="text-sm font-semibold">{entry.title}</p>
                        <p className="text-xs">{entry.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {phase === 'process' && activeTab === 'help' && (
          <section className="rounded-2xl bg-[var(--surface-glow)] p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <HelpCircle size={16} />
              Επικοινωνία & Βοήθεια
            </div>

            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-[#D9C9B5]" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Υπεύθυνος Μεσίτης</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                    <DavlosLogo className="h-3 w-3 text-[var(--brand-primary)]" />
                    <p>Γραφείο Μεσίτη</p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <a href="tel:+302105550199" className="inline-flex items-center gap-1 text-[var(--text-link)]">
                      <Phone size={12} /> +30 210 555 0199
                    </a>
                    <a href="mailto:support@davlos.app" className="inline-flex items-center gap-1 text-[var(--text-link)]">
                      <Mail size={12} /> support@davlos.app
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {faqItems.map((faq) => {
                const open = faqOpen === faq.id;
                return (
                  <div key={faq.id} className="rounded-lg border border-[var(--border-default)]">
                    <button
                      type="button"
                      onClick={() => setFaqOpen(open ? '' : faq.id)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-[var(--text-primary)]"
                    >
                      {faq.question}
                      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {open && <p className="border-t border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">{faq.answer}</p>}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded-lg border border-[var(--border-default)] p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Στείλτε μήνυμα</p>
              <div className="relative mt-2">
                <select
                  value={messageSubject}
                  onChange={(event) => setMessageSubject(event.target.value as SubjectOption)}
                  className="w-full appearance-none rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] px-3 py-2 pr-10 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                >
                  <option value="documents">Έγγραφα</option>
                  <option value="timeline">Χρονοδιάγραμμα</option>
                  <option value="legal">Νομικά</option>
                  <option value="other">Άλλο</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                />
              </div>
              <textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--text-primary)]"
                placeholder="Γράψτε το μήνυμά σας..."
              />
              <button
                type="button"
                onClick={handleSendMessage}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                <Send size={14} /> Αποστολή
              </button>
              {messageSent && <p className="mt-2 text-xs font-medium text-[var(--status-success-text)]">Το μήνυμα στάλθηκε στον μεσίτη.</p>}
            </div>
          </section>
        )}

        {phase === 'process' && (
          <nav className="sticky bottom-2 z-10 mt-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-1 shadow-sm">
            <div className="grid grid-cols-3 gap-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('process')}
                className={`rounded-lg px-2 py-2 font-semibold ${activeTab === 'process' ? 'text-white' : 'text-[var(--text-secondary)]'}`}
                style={activeTab === 'process' ? { backgroundColor: 'var(--brand-primary)' } : {}}
              >
                Διαδικασία
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('activity');
                  setActivityOpen(true);
                }}
                className={`rounded-lg px-2 py-2 font-semibold ${activeTab === 'activity' ? 'text-white' : 'text-[var(--text-secondary)]'}`}
                style={activeTab === 'activity' ? { backgroundColor: 'var(--brand-primary)' } : {}}
              >
                Δραστηριότητα
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('help')}
                className={`rounded-lg px-2 py-2 font-semibold ${activeTab === 'help' ? 'text-white' : 'text-[var(--text-secondary)]'}`}
                style={activeTab === 'help' ? { backgroundColor: 'var(--brand-primary)' } : {}}
              >
                Βοήθεια
              </button>
            </div>
          </nav>
        )}

        {taskReminderModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-[var(--surface-primary)] p-4 shadow-lg">
              <p className="text-base font-semibold text-[var(--text-primary)]">Αποστολή υπενθύμισης</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Αποστολή υπενθύμισης σε {taskReminderModal.role} μέσω email;
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmReminder}
                  className="flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  Αποστολή
                </button>
                <button
                  type="button"
                  onClick={() => setTaskReminderModal(null)}
                  className="flex-1 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]"
                >
                  Ακύρωση
                </button>
              </div>
            </div>
          </div>
        )}

        {notifications.length > 0 && (
          <p className="pb-4 text-center text-[11px] text-[var(--text-tertiary)]">
            Καταγεγραμμένες ειδοποιήσεις: {notifications.length} (type=nudge, channel=email)
          </p>
        )}
      </main>
    </div>
  );
}

const faqItems = [
  {
    id: 'faq-1',
    question: 'Πόσο θα διαρκέσει η διαδικασία;',
    answer: 'Συνήθως 6-12 εβδομάδες, ανάλογα με την ανταπόκριση όλων των μερών και τις δημόσιες υπηρεσίες.'
  },
  {
    id: 'faq-2',
    question: 'Τι έγγραφα χρειάζομαι;',
    answer: 'Θα δείτε τη λίστα ακριβώς πάνω στο στάδιο Υποβολή Εγγράφων και ενημερώνεται δυναμικά από τον μεσίτη.'
  },
  {
    id: 'faq-3',
    question: 'Ποιοι συμμετέχουν;',
    answer: 'Συμμετέχουν μεσίτης, δικηγόρος, μηχανικός, τοπογράφος και συμβολαιογράφος ανά περίπτωση.'
  },
  {
    id: 'faq-4',
    question: 'Τι γίνεται στον συμβολαιογράφο;',
    answer: 'Γίνεται η τελική ανάγνωση και υπογραφή του συμβολαίου και στη συνέχεια η μεταγραφή.'
  },
  {
    id: 'faq-5',
    question: 'Τι γίνεται αν υπάρξει καθυστέρηση;',
    answer: 'Η Υγεία Συναλλαγής δείχνει άμεσα την κατάσταση και μπορείτε να στείλετε υπενθύμιση στο αντίστοιχο μέλος.'
  }
];

const subjectLabels: Record<SubjectOption, string> = {
  documents: 'Έγγραφα',
  timeline: 'Χρονοδιάγραμμα',
  legal: 'Νομικά',
  other: 'Άλλο'
};
