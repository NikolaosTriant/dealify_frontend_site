import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, Clock, Download, Eye, Lock, Trophy } from 'lucide-react';
import { BranchTask } from './BranchNode';
import { BranchDependencyGraph } from './BranchDependencyGraph';
import { TaskSlidePanel } from './TaskSlidePanel';
import { TaskTimelineList } from './TaskTimelineList';
import { TransactionDetailSidebar } from './TransactionDetailSidebar';
import {
  ApiDeal,
  ApiDealAnalytics,
  ApiDealDocument,
  ApiDealMember,
  ApiMemberDocument,
  ApiNotificationFeedItem,
  ApiDealStage,
  advanceDealDocumentsPhase,
  completeDeal,
  downloadDealAuditExport,
  getDeal,
  getDealAnalytics,
  getDealMemberDocumentDownloadUrl,
  listDealDocuments,
  listDealMemberDocuments,
  listProperties,
  listNotificationFeed,
  listDealMembers,
  listDealStages,
  reviewDealMemberDocument,
  sendBrokerNudge,
  startDealProcess,
  updateDealStageStatus
} from '../api/trustlayerApi';
import { useUiStore } from '../state/uiStore';

interface TransactionDetailPageProps {
  transactionId: string;
  onBack?: () => void;
}

type DisplayAuditEntry = {
  id: string;
  category: 'approvals' | 'overdue' | 'reminders' | 'phases' | 'all';
  message: string;
  sentAt: string;
  channel: string;
};

function mapRoleLabel(role?: string) {
  if (role === 'LAWYER') return 'Δικηγόρος';
  if (role === 'ENGINEER') return 'Μηχανικός';
  if (role === 'SURVEYOR') return 'Τοπογράφος';
  if (role === 'NOTARY') return 'Συμβολαιογράφος';
  return 'Μέλος';
}

function mapNodeStatus(stage: ApiDealStage, memberDocumentStatuses: string[] = []): BranchTask['status'] {
  if (memberDocumentStatuses.some((status) => status === 'UPLOADED')) return 'pending-review';
  if (stage.status === 'COMPLETED') return 'completed';
  if (stage.status === 'LOCKED') return 'blocked';
  if (stage.deadline && new Date(`${stage.deadline}T00:00:00`).getTime() < Date.now()) return 'overdue';
  return 'in-progress';
}

function toBranchTask(stage: ApiDealStage, memberDocumentStatuses: string[] = []): BranchTask {
  return {
    id: stage.id,
    name: stage.title,
    status: mapNodeStatus(stage, memberDocumentStatuses),
    assignee: stage.memberName ?? 'Μη ορισμένο μέλος',
    dueDate: stage.deadline,
    completedAt: stage.completedAt,
    notes: stage.comment,
    documents: stage.requiredDocuments ?? [],
    activityLog: stage.completedAt
      ? [{
          id: `completed-${stage.id}`,
          user: stage.memberName ?? 'Μέλος',
          action: 'ολοκλήρωσε το στάδιο',
          timestamp: new Date(stage.completedAt).toLocaleString('el-GR')
        }]
      : undefined,
  };
}

export function TransactionDetailPage({ transactionId, onBack }: TransactionDetailPageProps) {
  const { showToast } = useUiStore();
  const [deal, setDeal] = useState<ApiDeal | null>(null);
  const [members, setMembers] = useState<ApiDealMember[]>([]);
  const [stages, setStages] = useState<ApiDealStage[]>([]);
  const [auditEntries, setAuditEntries] = useState<ApiNotificationFeedItem[]>([]);
  const [analytics, setAnalytics] = useState<ApiDealAnalytics | null>(null);
  const [dealDocuments, setDealDocuments] = useState<ApiDealDocument[]>([]);
  const [memberDocuments, setMemberDocuments] = useState<ApiMemberDocument[]>([]);
  const [propertyPrice, setPropertyPrice] = useState<number | null>(null);
  const [propertyReferenceCode, setPropertyReferenceCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [auditFilter, setAuditFilter] = useState<'all' | 'approvals' | 'overdue' | 'reminders' | 'phases'>('all');
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<'timeline' | 'members' | 'bottlenecks'>('timeline');
  const [completingDeal, setCompletingDeal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BranchTask | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [reviewingMemberDoc, setReviewingMemberDoc] = useState(false);
  const [completingStage, setCompletingStage] = useState(false);
  const [shareMember, setShareMember] = useState<ApiDealMember | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [exportingAuditFormat, setExportingAuditFormat] = useState<'csv' | 'xlsx' | null>(null);

  const statusLegend = [
    { label: 'Ολοκληρωμένο', icon: CheckCircle2, iconClass: 'text-[var(--status-success-text)]' },
    { label: 'Σε Εξέλιξη', icon: Clock, iconClass: 'text-[var(--status-info-text)]' },
    { label: 'Εκκρεμεί', icon: Circle, iconClass: 'text-[var(--text-tertiary)]' },
    { label: 'Αναμονή Ελέγχου', icon: Eye, iconClass: 'text-[var(--status-warning-text)]' },
    { label: 'Εκπρόθεσμο', icon: AlertTriangle, iconClass: 'text-[var(--status-danger-text)]' },
    { label: 'Κλειδωμένο', icon: Lock, iconClass: 'text-[var(--text-tertiary)]' },
  ];

  const loadTransaction = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [dealRes, membersRes, stagesRes, analyticsRes, auditRes, dealDocsRes, memberDocsRes] = await Promise.all([
        getDeal(transactionId),
        listDealMembers(transactionId),
        listDealStages(transactionId),
        getDealAnalytics(transactionId),
        listNotificationFeed(),
        listDealDocuments(transactionId),
        listDealMemberDocuments(transactionId).catch(() => []),
      ]);
      setDeal(dealRes);
      setMembers(membersRes);
      setStages(stagesRes);
      setAuditEntries(auditRes.filter((item) => item.dealId === transactionId));
      setAnalytics(analyticsRes);
      setDealDocuments(dealDocsRes);
      setMemberDocuments(memberDocsRes);
      const properties = await listProperties().catch(() => []);
      const matchingProperty = properties.find((property) => property.id === dealRes.propertyId);
      setPropertyPrice(matchingProperty?.price ?? null);
      setPropertyReferenceCode(matchingProperty?.referenceListingCode ?? null);
    } catch {
      setLoadError('Αποτυχία φόρτωσης συναλλαγής. Ελέγξτε ότι υπάρχει έγκυρο deal id.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTransaction();
  }, [transactionId]);

  const roleByMemberId = useMemo(
    () => new Map(members.map((member) => [member.id, mapRoleLabel(member.role)])),
    [members]
  );

  const branchData = useMemo(() => {
    const memberDocumentByStageId = memberDocuments.reduce<Map<string, string[]>>((acc, doc) => {
      const current = acc.get(doc.stageId) ?? [];
      current.push(doc.status);
      acc.set(doc.stageId, current);
      return acc;
    }, new Map());
    const nonNotaryStages = stages.filter((stage) => {
      const role = roleByMemberId.get(stage.memberId ?? '');
      return role !== 'Συμβολαιογράφος';
    });
    const notaryStages = stages.filter((stage) => roleByMemberId.get(stage.memberId ?? '') === 'Συμβολαιογράφος');

    const legal = nonNotaryStages
      .filter((stage) => roleByMemberId.get(stage.memberId ?? '') === 'Δικηγόρος')
      .map((stage) => toBranchTask(stage, memberDocumentByStageId.get(stage.id) ?? []));
    const technical = nonNotaryStages
      .filter((stage) => ['Μηχανικός', 'Τοπογράφος'].includes(roleByMemberId.get(stage.memberId ?? '') ?? ''))
      .map((stage) => toBranchTask(stage, memberDocumentByStageId.get(stage.id) ?? []));
    const operational = nonNotaryStages
      .filter((stage) => {
        const role = roleByMemberId.get(stage.memberId ?? '');
        return !['Δικηγόρος', 'Μηχανικός', 'Τοπογράφος'].includes(role);
      })
      .map((stage) => toBranchTask(stage, memberDocumentByStageId.get(stage.id) ?? []));

    const convergence = notaryStages.map((stage) => toBranchTask(stage, memberDocumentByStageId.get(stage.id) ?? []));
    const allCompleted = stages.length > 0 && stages.every((stage) => stage.status === 'COMPLETED');
    convergence.push({
      id: 'deal-completion',
      name: 'Ολοκλήρωση',
      status: allCompleted ? 'completed' : 'blocked',
      assignee: 'Μεσίτης',
    });

    return {
      branches: [
        { id: 'legal', name: 'Νομικός Κλάδος', dotColorClass: 'bg-green-500', tasks: legal },
        { id: 'tech', name: 'Τεχνικός Κλάδος', dotColorClass: 'bg-blue-500', tasks: technical },
        { id: 'ops', name: 'Οργανωτικός Κλάδος', dotColorClass: 'bg-amber-500', tasks: operational },
      ],
      convergenceNodes: convergence,
      allTasks: [...legal, ...technical, ...operational, ...convergence],
    };
  }, [stages, roleByMemberId, memberDocuments]);

  const sidebarMembers = useMemo(() => {
    const countsByMember = stages.reduce<Record<string, { total: number; completed: number; overdue: number }>>((acc, stage) => {
      if (!stage.memberId) return acc;
      const current = acc[stage.memberId] ?? { total: 0, completed: 0, overdue: 0 };
      current.total += 1;
      if (stage.status === 'COMPLETED') current.completed += 1;
      if (stage.deadline && stage.status !== 'COMPLETED' && new Date(`${stage.deadline}T00:00:00`).getTime() < Date.now()) {
        current.overdue += 1;
      }
      acc[stage.memberId] = current;
      return acc;
    }, {});

    return members
      .map((member) => ({
        id: member.id,
        name: member.name,
        role: mapRoleLabel(member.role),
        status: 'active' as const,
        initials: (member.name ?? 'Μ').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
        linkToken: member.linkToken,
        phone: member.phone,
        email: member.email,
        completedTasks: countsByMember[member.id]?.completed ?? 0,
        totalTasks: countsByMember[member.id]?.total ?? 0,
        overdueTasks: countsByMember[member.id]?.overdue ?? 0,
      }))
      .filter((member) => (member.totalTasks ?? 0) > 0);
  }, [members, stages]);

  const settlementDocuments = useMemo(
    () => dealDocuments.filter((document) => document.category === 'Ηλεκτρονική ολοκλήρωση'),
    [dealDocuments]
  );
  const settlementApproved = useMemo(
    () => settlementDocuments.length > 0 && settlementDocuments.every((document) => document.status === 'APPROVED'),
    [settlementDocuments]
  );
  const isDealCompleted = deal?.status === 'COMPLETED';
  const canCompleteDeal = deal?.status === 'SETTLEMENT_PHASE' && settlementApproved;
  const awaitingCompletion = deal?.status === 'SETTLEMENT_PHASE' && canCompleteDeal;
  const phase = deal?.status === 'DOCUMENTS_PHASE'
    ? (deal?.documentsPhase === 'SELLER' ? 1 : 2)
    : deal?.status === 'PROCESS_PHASE'
      ? 3
      : 4;
  const displayPhase = isDealCompleted ? 5 : phase;
  const shareLink = shareMember ? `${window.location.origin}/member/${shareMember.linkToken}` : '';
  const selectedMemberDocuments = selectedTask
    ? memberDocuments.filter((doc) => doc.stageId === selectedTask.id)
    : [];

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportAudit = async (format: 'csv' | 'xlsx') => {
    setExportingAuditFormat(format);
    try {
      const blob = await downloadDealAuditExport(transactionId, format);
      const safeRef = propertyReferenceCode?.trim() || transactionId;
      triggerBlobDownload(blob, `deal-audit-${safeRef}.${format}`);
      showToast(`Το audit trail εξήχθη σε ${format.toUpperCase()}.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία εξαγωγής audit trail.';
      showToast(message, 'error');
    } finally {
      setExportingAuditFormat(null);
    }
  };
  const stageDurationByTitle = analytics?.stageDurationsMinutes ?? {};
  const totalProcessMinutes = Object.values(stageDurationByTitle)
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0)
    .reduce((acc, minutes) => acc + minutes, 0);
  const remainingProcessMinutes = stages
    .filter((stage) => stage.status !== 'COMPLETED')
    .map((stage) => stageDurationByTitle[stage.title] ?? 0)
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0)
    .reduce((acc, minutes) => acc + minutes, 0);

  const formatDurationFromMinutes = (totalMinutes?: number) => {
    if (totalMinutes === undefined || totalMinutes === null || totalMinutes < 0) return '-';
    const d = Math.floor(totalMinutes / (24 * 60));
    const h = Math.floor((totalMinutes % (24 * 60)) / 60);
    const m = totalMinutes % 60;
    return `${d}η ${h}ω ${m}λ`;
  };

  const slowestDuration = analytics?.slowestStageMinutes
    ?? (analytics?.slowestStage ? stageDurationByTitle[analytics.slowestStage] : undefined);
  const fastestDuration = analytics?.fastestStageMinutes
    ?? (analytics?.fastestStage ? stageDurationByTitle[analytics.fastestStage] : undefined);
  const fallbackExtremes = useMemo(() => {
    if (!analytics?.stageDurationsMinutes) {
      return { slowest: undefined, fastest: undefined, slowestMinutes: undefined, fastestMinutes: undefined };
    }
    const entries = Object.entries(analytics.stageDurationsMinutes)
      .map(([title, minutes]) => ({ title, minutes }))
      .filter((entry) => Number.isFinite(entry.minutes) && entry.minutes > 0);
    if (entries.length === 0) {
      return { slowest: undefined, fastest: undefined, slowestMinutes: undefined, fastestMinutes: undefined };
    }
    let slowest = entries[0];
    let fastest = entries[0];
    for (const entry of entries) {
      if (entry.minutes > slowest.minutes) slowest = entry;
      if (entry.minutes < fastest.minutes) fastest = entry;
    }
    return {
      slowest: slowest.title,
      fastest: fastest.title,
      slowestMinutes: slowest.minutes,
      fastestMinutes: fastest.minutes,
    };
  }, [analytics?.stageDurationsMinutes]);
  const slowestStageLabel = analytics?.slowestStage ?? fallbackExtremes.slowest;
  const fastestStageLabel = analytics?.fastestStage ?? fallbackExtremes.fastest;
  const resolvedSlowestDuration = slowestDuration ?? fallbackExtremes.slowestMinutes;
  const resolvedFastestDuration = fastestDuration ?? fallbackExtremes.fastestMinutes;
  const showCompletionExtremes = deal?.status === 'COMPLETED';

  const displayAuditEntries = useMemo<DisplayAuditEntry[]>(() => {
    const notificationRows: DisplayAuditEntry[] = auditEntries.map((entry) => {
      const message = (entry.message ?? '').toLowerCase();
      const category: DisplayAuditEntry['category'] =
        entry.type === 'status_change'
          ? 'phases'
          : entry.type === 'reminder' || entry.type === 'nudge'
            ? 'reminders'
            : message.includes('καθυστ') || message.includes('overdue')
              ? 'overdue'
              : message.includes('εγκρ') || message.includes('απόρρι') || message.includes('review')
                ? 'approvals'
                : 'all';
      return {
        id: `feed-${entry.id}`,
        category,
        message: entry.message,
        sentAt: entry.sentAt,
        channel: entry.channel,
      };
    });

    const dealDocumentRows: DisplayAuditEntry[] = dealDocuments
      .filter((document) => document.reviewedAt && (document.status === 'APPROVED' || document.status === 'REJECTED'))
      .map((document) => ({
        id: `deal-doc-${document.id}`,
        category: 'approvals',
        message:
          `${document.status === 'APPROVED' ? 'Αποδοχή' : 'Απόρριψη'} εγγράφου "${document.name}" από ${document.reviewerName || 'Μεσίτη'}`
          + (document.reviewerComment ? ` · Σχόλιο: ${document.reviewerComment}` : ''),
        sentAt: document.reviewedAt as string,
        channel: 'deal_document_review',
      }));

    const memberDocumentRows: DisplayAuditEntry[] = memberDocuments
      .filter((document) => document.reviewedAt && (document.status === 'APPROVED' || document.status === 'REJECTED'))
      .map((document) => ({
        id: `member-doc-${document.id}`,
        category: 'approvals',
        message:
          `${document.status === 'APPROVED' ? 'Αποδοχή' : 'Απόρριψη'} εγγράφου μέλους "${document.name}" για το στάδιο "${document.stageTitle}" από ${document.reviewerName || 'Μεσίτη'}`
          + (document.reviewerComment ? ` · Σχόλιο: ${document.reviewerComment}` : ''),
        sentAt: document.reviewedAt as string,
        channel: 'member_document_review',
      }));

    const overdueStageRows: DisplayAuditEntry[] = stages
      .filter((stage) => stage.deadline && stage.status !== 'COMPLETED' && new Date(`${stage.deadline}T00:00:00`).getTime() < Date.now())
      .map((stage) => {
        const overdueMs = Date.now() - new Date(`${stage.deadline}T00:00:00`).getTime();
        const overdueDays = Math.max(1, Math.floor(overdueMs / (1000 * 60 * 60 * 24)));
        return {
          id: `overdue-stage-${stage.id}`,
          category: 'overdue' as const,
          message: `Εκπρόθεσμο στάδιο "${stage.title}"${stage.memberName ? ` · Υπεύθυνος: ${stage.memberName}` : ''} (+${overdueDays} ημέρες)`,
          sentAt: new Date(`${stage.deadline}T00:00:00`).toISOString(),
          channel: 'stage_deadline',
        };
      });

    return [...notificationRows, ...dealDocumentRows, ...memberDocumentRows, ...overdueStageRows]
      .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime());
  }, [auditEntries, dealDocuments, memberDocuments, stages]);

  const filteredAudit = useMemo(() => {
    if (auditFilter === 'all') return displayAuditEntries;
    return displayAuditEntries.filter((entry) => entry.category === auditFilter);
  }, [displayAuditEntries, auditFilter]);

  const phaseMeta: Record<1 | 2 | 3 | 4, string> = {
    1: 'Συλλογή Εγγράφων Πωλητή',
    2: 'Συλλογή Εγγράφων Αγοραστή',
    3: 'Διαδικασία Μελών',
    4: isDealCompleted ? 'Ολοκλήρωση' : 'Ηλεκτρονική Ολοκλήρωση',
  };

  const handleStartProcess = async () => {
    setTransitioning(true);
    try {
      await startDealProcess(transactionId);
      await loadTransaction();
    } catch {
      setLoadError('Αποτυχία μετάβασης σε φάση διαδικασίας.');
    } finally {
      setTransitioning(false);
    }
  };

  const handleAdvanceDocumentsPhase = async () => {
    setTransitioning(true);
    try {
      await advanceDealDocumentsPhase(transactionId);
      await loadTransaction();
    } catch {
      setLoadError('Αποτυχία μετάβασης σε επόμενο στάδιο εγγράφων.');
    } finally {
      setTransitioning(false);
    }
  };

  const handleCompleteDeal = async () => {
    setCompletingDeal(true);
    try {
      await completeDeal(transactionId);
      await loadTransaction();
      setCompletionModalOpen(false);
    } catch {
      setLoadError('Αποτυχία επιβεβαίωσης ολοκλήρωσης συναλλαγής.');
    } finally {
      setCompletingDeal(false);
    }
  };

  const handleOpenSelectedMemberDocument = async (document: ApiMemberDocument) => {
    if (!document?.id) return;
    try {
      const res = await getDealMemberDocumentDownloadUrl(transactionId, document.id);
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setLoadError('Αποτυχία ανοίγματος αρχείου μέλους.');
    }
  };

  const reviewSelectedMemberDocument = async (document: ApiMemberDocument, status: 'APPROVED' | 'REJECTED') => {
    if (!document?.id) return;
    let reviewerComment: string | undefined;
    if (status === 'REJECTED') {
      const reason = window.prompt('Λόγος απόρριψης');
      if (!reason || reason.trim().length < 5) return;
      reviewerComment = reason.trim();
    }

    setReviewingMemberDoc(true);
    try {
      await reviewDealMemberDocument(transactionId, document.id, {
        status,
        reviewerComment,
      });
      await loadTransaction();
    } catch {
      setLoadError('Αποτυχία review εγγράφου μέλους.');
    } finally {
      setReviewingMemberDoc(false);
    }
  };

  const completeSelectedStage = async () => {
    if (!selectedTask) return;
    setCompletingStage(true);
    try {
      await updateDealStageStatus(transactionId, selectedTask.id, { status: 'COMPLETED' });
      await loadTransaction();
    } catch {
      setLoadError('Αποτυχία ολοκλήρωσης σταδίου.');
    } finally {
      setCompletingStage(false);
    }
  };

  const copyMemberLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      showToast('Το link αντιγράφηκε.', 'success');
    } catch {
      showToast('Αποτυχία αντιγραφής link.', 'error');
    }
  };

  const sendMemberLink = async (channel: 'email' | 'sms') => {
    if (!shareMember) return;
    if (channel === 'email' && !shareMember.email) {
      showToast('Το μέλος δεν έχει email.', 'warning');
      return;
    }
    if (channel === 'sms' && !shareMember.phone) {
      showToast('Το μέλος δεν έχει κινητό.', 'warning');
      return;
    }

    const roleLabel = mapRoleLabel(shareMember.role);
    const message = `Γεια σας ${shareMember.name},\n\nΓια τη συναλλαγή ${deal?.propertyTitle ?? ''}, χρησιμοποιήστε το link του ρόλου σας (${roleLabel}):\n${shareLink}\n\nTrustLayer`;

    setShareBusy(true);
    try {
      await sendBrokerNudge({
        dealId: transactionId,
        memberId: shareMember.id,
        message,
        channel,
      });
      showToast(channel === 'sms' ? 'Το SMS στάλθηκε.' : 'Το email στάλθηκε.', 'success');
    } catch {
      showToast('Αποτυχία αποστολής.', 'error');
    } finally {
      setShareBusy(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] text-sm text-[var(--text-secondary)]">Φόρτωση συναλλαγής...</div>;
  }

  if (loadError) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] text-sm text-[var(--status-danger-text)]">{loadError}</div>;
  }

  return (
    <div className="flex min-h-screen bg-[var(--page-bg)]">
      <TransactionDetailSidebar
        address={deal?.propertyTitle ?? '-'}
        propertyReferenceCode={propertyReferenceCode ?? undefined}
        propertyType="Ακίνητο"
        price={propertyPrice === null ? '-' : new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(propertyPrice)}
        startDate={deal?.createdAt ? new Date(deal.createdAt).toLocaleDateString('el-GR') : '-'}
        daysRemaining={Math.ceil(remainingProcessMinutes / (24 * 60))}
        teamMembers={sidebarMembers}
        estimatedCompletionDate={formatDurationFromMinutes(remainingProcessMinutes)}
        scheduleHealth="on-track"
        onShareLink={(member) => {
          const fullMember = members.find((entry) => entry.id === member.id) ?? null;
          setShareMember(fullMember);
        }}
      />

      <main className="min-w-0 flex-1 overflow-hidden">
        <div className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="rounded-lg p-2 hover:bg-[var(--surface-highlight)]">
                <ArrowLeft size={20} className="text-[var(--text-secondary)]" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">Λεπτομέρεια Συναλλαγής</h1>
              <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{deal?.propertyTitle ?? '-'} · {deal?.clientName ?? '-'}</p>
              {propertyReferenceCode && (
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  Ref ID: {propertyReferenceCode}
                </p>
              )}
            </div>
          </div>
          {analytics && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
              <span>Συνολικός χρόνος: <strong className="text-[var(--text-primary)]">{formatDurationFromMinutes(analytics.totalMinutes ?? totalProcessMinutes)}</strong></span>
              {!showCompletionExtremes && (
                <span>Αναμενόμενη ολοκλήρωση: <strong className="text-[var(--text-primary)]">{formatDurationFromMinutes(remainingProcessMinutes)}</strong></span>
              )}
              {showCompletionExtremes && (
                <span>Πιο αργό: <strong className="text-[var(--text-primary)]">{slowestStageLabel ?? '-'} ({formatDurationFromMinutes(resolvedSlowestDuration)})</strong></span>
              )}
              {showCompletionExtremes && (
                <span>Πιο γρήγορο: <strong className="text-[var(--text-primary)]">{fastestStageLabel ?? '-'} ({formatDurationFromMinutes(resolvedFastestDuration)})</strong></span>
              )}
              {deal?.status === 'SETTLEMENT_PHASE' && !settlementApproved && (
                <span className="ml-auto rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-1.5 text-[var(--status-warning-text)]">
                  Εκκρεμούν τα αποδεικτικά πληρωμής.
                </span>
              )}
              {awaitingCompletion && (
                <button
                  onClick={() => setCompletionModalOpen(true)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[var(--status-success)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  <Trophy size={14} />
                  Επιβεβαίωση Ολοκλήρωσης
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-4">
            <div className="grid grid-cols-4 items-start gap-4">
              {[1, 2, 3, 4].map((phaseNumber, idx) => {
                const current = phaseNumber as 1 | 2 | 3 | 4;
                const isCompleted = displayPhase > current;
                const isActive = displayPhase === current && !isDealCompleted;
                return (
                  <div key={current} className="relative flex flex-col items-center">
                    {idx < 3 && (
                      <div
                        className={`absolute top-4 h-0.5 ${
                          displayPhase > idx + 1 ? 'bg-[var(--status-success)]' : 'bg-[var(--border-default)]'
                        }`}
                        style={{
                          left: 'calc(50% + 1.1rem)',
                          right: 'calc(-50% + 1.1rem)',
                        }}
                      />
                    )}
                    <div
                      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                        isCompleted
                          ? 'border-[var(--status-success)] bg-[var(--status-success)] text-white'
                          : isActive
                            ? 'animate-pulse border-[var(--border-brand)] bg-[var(--brand-primary)] text-white'
                            : 'border-[var(--border-strong)] bg-[var(--surface-glow)] text-[var(--text-tertiary)]'
                      }`}
                    >
                      {isCompleted ? '✓' : current}
                    </div>
                    <p
                      className={`mt-2 text-center text-xs font-medium ${
                        isCompleted
                          ? 'text-[var(--status-success-text)]'
                          : isActive
                            ? 'text-[var(--text-link)]'
                            : 'text-[var(--text-tertiary)]'
                      }`}
                    >
                      {phaseMeta[current]}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center">
              {deal?.status === 'DOCUMENTS_PHASE' && (
                <>
                  {deal?.documentsPhase !== 'COMPLETE' && (
                    <button
                      onClick={() => void handleAdvanceDocumentsPhase()}
                      disabled={transitioning}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                        transitioning
                          ? 'cursor-not-allowed bg-[var(--border-default)] text-[var(--text-tertiary)]'
                          : 'bg-[var(--surface-highlight)] text-[var(--text-primary)] hover:bg-[var(--surface-glow-active)]'
                      }`}
                    >
                      {transitioning ? 'Μετάβαση...' : 'Μετάβαση στο επόμενο στάδιο εγγράφων'}
                    </button>
                  )}
                  {deal?.documentsPhase === 'COMPLETE' && (
                    <button
                      onClick={() => void handleStartProcess()}
                      disabled={transitioning}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                        transitioning
                          ? 'cursor-not-allowed bg-[var(--border-default)] text-[var(--text-tertiary)]'
                          : 'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]'
                      }`}
                    >
                      {transitioning ? 'Μετάβαση...' : 'Ενεργοποίηση Skill Tree →'}
                    </button>
                  )}
                </>
              )}
              {awaitingCompletion && (
                <button
                  onClick={() => setCompletionModalOpen(true)}
                  className="rounded-lg bg-[var(--status-success)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Επιβεβαίωση Ολοκλήρωσης ✓
                </button>
              )}
              {!awaitingCompletion && deal?.status === 'SETTLEMENT_PHASE' && !settlementApproved && (
                <div className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-2 text-sm font-medium text-[var(--status-warning-text)]">
                  Περιμένετε upload και έγκριση των αποδεικτικών πληρωμής.
                </div>
              )}
            </div>
          </div>

          <div className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-3">
            <div className="grid grid-cols-2 items-center gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {statusLegend.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="inline-flex items-center justify-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                    <Icon size={16} className={item.iconClass} />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {stages.length === 0 && (
            <div className="m-6 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 text-sm text-[var(--text-secondary)]">
              Δεν υπάρχουν ακόμη στάδια για αυτό το deal. Μεταβείτε στο review εγγράφων και ολοκληρώστε τη μετάβαση σε process phase.
            </div>
          )}
          <div className="border-b border-[var(--border-default)] bg-[var(--surface-glow)]">
            <BranchDependencyGraph
              branches={branchData.branches}
              convergenceNodes={branchData.convergenceNodes}
              onTaskClick={(task) => {
                setSelectedTask(task);
                setIsPanelOpen(true);
              }}
            />
          </div>
          <div className="p-6">
            <TaskTimelineList
              tasks={branchData.allTasks}
              onTaskClick={(task) => {
                setSelectedTask(task);
                setIsPanelOpen(true);
              }}
            />
          </div>

          <div className="mt-6 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Audit Trail</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void handleExportAudit('csv')}
                  disabled={exportingAuditFormat !== null}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--surface-highlight)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)] disabled:opacity-60"
                >
                  <Download size={12} />
                  {exportingAuditFormat === 'csv' ? 'CSV...' : 'CSV'}
                </button>
                <button
                  onClick={() => void handleExportAudit('xlsx')}
                  disabled={exportingAuditFormat !== null}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--surface-highlight)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)] disabled:opacity-60"
                >
                  <Download size={12} />
                  {exportingAuditFormat === 'xlsx' ? 'Excel...' : 'Excel'}
                </button>
                {[
                  { key: 'all', label: 'Όλα' },
                  { key: 'approvals', label: 'Approvals' },
                  { key: 'overdue', label: 'Εκπρόθεσμα' },
                  { key: 'reminders', label: 'Reminders' },
                  { key: 'phases', label: 'Φάσεις' },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => setAuditFilter(chip.key as typeof auditFilter)}
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      auditFilter === chip.key ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-highlight)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {filteredAudit.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs">
                  <p className="font-medium text-[var(--text-primary)]">{entry.message}</p>
                  <p className="text-[var(--text-tertiary)]">{new Date(entry.sentAt).toLocaleString('el-GR')} · {entry.channel}</p>
                </div>
              ))}
              {filteredAudit.length === 0 && (
                <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-4 text-xs text-[var(--text-tertiary)]">
                  Δεν υπάρχουν καταχωρήσεις.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <TaskSlidePanel
        task={selectedTask}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        memberDocuments={selectedMemberDocuments}
        onOpenMemberDocument={(document) => void handleOpenSelectedMemberDocument(document)}
        onApproveMemberDocument={(document) => void reviewSelectedMemberDocument(document, 'APPROVED')}
        onRejectMemberDocument={(document) => void reviewSelectedMemberDocument(document, 'REJECTED')}
        onCompleteStage={() => void completeSelectedStage()}
        reviewing={reviewingMemberDoc || completingStage}
      />

      {completionModalOpen && analytics && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/30" onClick={() => !completingDeal && setCompletionModalOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Analytics Ολοκλήρωσης</h3>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Επιβεβαιώστε ότι η συναλλαγή ολοκληρώθηκε εκτός εφαρμογής.</p>

            <div className="mt-3 inline-flex gap-2">
              <button onClick={() => setAnalyticsTab('timeline')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${analyticsTab === 'timeline' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-highlight)] text-[var(--text-secondary)]'}`}>Χρονοδιάγραμμα</button>
              <button onClick={() => setAnalyticsTab('members')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${analyticsTab === 'members' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-highlight)] text-[var(--text-secondary)]'}`}>Μέλη</button>
              <button onClick={() => setAnalyticsTab('bottlenecks')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${analyticsTab === 'bottlenecks' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-highlight)] text-[var(--text-secondary)]'}`}>Bottlenecks</button>
            </div>

            {analyticsTab === 'timeline' && (
              <div className="mt-4 rounded-lg border border-[var(--border-default)]">
                <table className="min-w-full text-xs">
                  <thead className="bg-[var(--surface-ambient)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-3 py-2 text-left">Στάδιο</th>
                      <th className="px-3 py-2 text-left">Διάρκεια</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analytics.stageDurationsMinutes ?? {}).map(([stage, minutes]) => (
                      <tr key={stage} className="border-t border-[var(--border-subtle)]">
                        <td className="px-3 py-2">{stage}</td>
                        <td className="px-3 py-2">{formatDurationFromMinutes(minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {analyticsTab === 'members' && (
              <div className="mt-4 rounded-lg border border-[var(--border-default)]">
                <table className="min-w-full text-xs">
                  <thead className="bg-[var(--surface-ambient)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-3 py-2 text-left">Μέλος</th>
                      <th className="px-3 py-2 text-left">Μ.Ο. διάρκειας</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analytics.memberAvgMinutes ?? {}).map(([member, avg]) => (
                      <tr key={member} className="border-t border-[var(--border-subtle)]">
                        <td className="px-3 py-2">{member}</td>
                        <td className="px-3 py-2">{formatDurationFromMinutes(avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {analyticsTab === 'bottlenecks' && (
              <div className="mt-4 space-y-2 rounded-lg border border-[var(--border-default)] p-3 text-sm text-[var(--text-secondary)]">
                <p>Πιο αργό στάδιο: <strong>{slowestStageLabel ?? '-'}</strong></p>
                <p>Πιο γρήγορο στάδιο: <strong>{fastestStageLabel ?? '-'}</strong></p>
                <p>Συνολικός χρόνος: <strong>{formatDurationFromMinutes(analytics.totalMinutes ?? totalProcessMinutes)}</strong></p>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setCompletionModalOpen(false)}
                disabled={completingDeal}
                className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:opacity-60"
              >
                Ακύρωση
              </button>
              <button
                onClick={() => void handleCompleteDeal()}
                disabled={completingDeal}
                className="rounded-lg bg-[var(--status-success)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {completingDeal ? 'Ολοκλήρωση...' : 'Επιβεβαίωση Ολοκλήρωσης'}
              </button>
            </div>
          </div>
        </div>
      )}

      {shareMember && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/30" onClick={() => !shareBusy && setShareMember(null)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Αποστολή Link Μέλους</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {shareMember.name} · {mapRoleLabel(shareMember.role)}
            </p>
            <p className="mt-3 break-all rounded-lg bg-[var(--surface-ambient)] px-3 py-2 text-xs text-[var(--text-secondary)]">{shareLink}</p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                onClick={() => void sendMemberLink('email')}
                disabled={shareBusy}
                className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
              >
                Αποστολή Email
              </button>
              <button
                onClick={() => void sendMemberLink('sms')}
                disabled={shareBusy}
                className="rounded-lg bg-[var(--status-success)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                Αποστολή SMS
              </button>
              <button
                onClick={() => void copyMemberLink()}
                disabled={shareBusy}
                className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:opacity-60"
              >
                Αντιγραφή Link
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShareMember(null)}
                disabled={shareBusy}
                className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:opacity-60"
              >
                Κλείσιμο
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
