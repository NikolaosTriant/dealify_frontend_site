import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ApiDealStage,
  listDealDocuments,
  listDealMembers,
  listDeals,
  listDealStages,
  listNotificationFeed,
  sendBrokerNudge,
  updateDealStageAssignee,
  updateDealStageDeadline
} from '../api/trustlayerApi';

export type WorkflowPhase = 1 | 2 | 3;
export type WorkspaceRole = 'broker' | 'client' | 'member';
export type WorkflowDocumentStatus = 'pending' | 'approved' | 'rejected';
export type WorkflowTaskStatus = 'pending' | 'in-progress' | 'completed' | 'blocked';
export type WorkflowNotificationType = 'overdue' | 'completed' | 'reminder' | 'document' | 'phase';

export interface WorkflowDocument {
  id: string;
  name: string;
  status: WorkflowDocumentStatus;
}

export interface WorkflowTask {
  id: string;
  dealId?: string;
  memberId?: string;
  name: string;
  member: string;
  status: WorkflowTaskStatus;
  daysOverdue: number;
}

export interface WorkflowNotification {
  id: string;
  type: WorkflowNotificationType;
  message: string;
  timestamp: string;
  read: boolean;
}

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface UiToast {
  message: string;
  variant: ToastVariant;
}

export interface WorkspaceMemberLink {
  id?: string;
  member: string;
  role: string;
  phone: string;
  url: string | null;
}

export type AuditTone = 'green' | 'indigo' | 'amber' | 'red' | 'gray';
export type AuditCategory = 'all' | 'approvals' | 'overdue' | 'reminders' | 'phases';

export interface AuditEntry {
  id: string;
  tone: AuditTone;
  category: AuditCategory;
  timestamp: string;
  actor: string;
  action: string;
}

type UiStoreShape = {
  currentPhase: WorkflowPhase;
  activeRole: WorkspaceRole;
  documents: WorkflowDocument[];
  tasks: WorkflowTask[];
  notifications: WorkflowNotification[];
  auditEntries: AuditEntry[];
  activeMemberName: string;
  linksGenerated: boolean;
  clientLink: string | null;
  memberLinks: WorkspaceMemberLink[];
  utilityPanelOpen: boolean;
  toastMessage: UiToast | null;
  setCurrentPhase: (phase: WorkflowPhase) => void;
  setActiveRole: (role: WorkspaceRole) => void;
  setUtilityPanelOpen: (open: boolean) => void;
  setActiveMemberName: (name: string) => void;
  setDocumentStatus: (id: string, status: WorkflowDocumentStatus) => void;
  approveAllDocuments: () => void;
  engineerOverduePlus5: () => void;
  completeLawyerTasks: () => void;
  sendReminder: (member: string) => void;
  sendSmsReminder: (member: string, phone: string) => void;
  sendWhatsappReminder: (member: string) => void;
  reassignTask: (taskId: string, newMemberId: string) => void;
  extendTaskDeadline: (taskId: string, deadlineIso: string) => void;
  markAllNotificationsRead: () => void;
  jumpToPhase2: () => void;
  completeTransaction: () => void;
  generateAllLinks: () => void;
  refreshClientLink: () => void;
  refreshMemberLink: (member: string) => void;
  resetWorkspace: () => void;
  clearToast: () => void;
  showToast: (message: string, variant?: ToastVariant) => void;
  allDocumentsApproved: boolean;
  allTasksCompleted: boolean;
};

declare global {
  var __davlosUiStoreContext__: ReturnType<typeof createContext<UiStoreShape>> | undefined;
}

const initialDocuments: WorkflowDocument[] = [];
const initialTasks: WorkflowTask[] = [];
const initialNotifications: WorkflowNotification[] = [];
const initialClientLink: string | null = null;
const initialMemberLinks: WorkspaceMemberLink[] = [];
const initialAuditEntries: AuditEntry[] = [];

const noop = () => undefined;

const defaultUiStoreValue: UiStoreShape = {
  currentPhase: 1,
  activeRole: 'broker',
  documents: initialDocuments,
  tasks: initialTasks,
  notifications: initialNotifications,
  auditEntries: initialAuditEntries,
  activeMemberName: 'Μέλος',
  linksGenerated: false,
  clientLink: initialClientLink,
  memberLinks: initialMemberLinks,
  utilityPanelOpen: false,
  toastMessage: null,
  setCurrentPhase: noop,
  setActiveRole: noop,
  setUtilityPanelOpen: noop,
  setActiveMemberName: noop,
  setDocumentStatus: noop,
  approveAllDocuments: noop,
  engineerOverduePlus5: noop,
  completeLawyerTasks: noop,
  sendReminder: noop,
  sendSmsReminder: noop,
  sendWhatsappReminder: noop,
  reassignTask: noop,
  extendTaskDeadline: noop,
  markAllNotificationsRead: noop,
  jumpToPhase2: noop,
  completeTransaction: noop,
  generateAllLinks: noop,
  refreshClientLink: noop,
  refreshMemberLink: noop,
  resetWorkspace: noop,
  clearToast: noop,
  showToast: noop,
  allDocumentsApproved: true,
  allTasksCompleted: true,
};

const UiStoreContext =
  globalThis.__davlosUiStoreContext__
  ?? (globalThis.__davlosUiStoreContext__ = createContext<UiStoreShape>(defaultUiStoreValue));

function mapStageStatus(stage: ApiDealStage): WorkflowTaskStatus {
  if (stage.status === 'COMPLETED') return 'completed';
  if (stage.status === 'LOCKED') return 'blocked';
  if (stage.deadline && new Date(`${stage.deadline}T00:00:00`).getTime() < Date.now()) return 'pending';
  return 'in-progress';
}

function mapOverdueDays(stage: ApiDealStage): number {
  if (!stage.deadline) return 0;
  const diffMs = Date.now() - new Date(`${stage.deadline}T00:00:00`).getTime();
  if (diffMs <= 0) return 0;
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function UiStoreProvider({ children }: { children: ReactNode }) {
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>(1);
  const [activeRole, setActiveRole] = useState<WorkspaceRole>('broker');
  const [documents, setDocuments] = useState<WorkflowDocument[]>(initialDocuments);
  const [tasks, setTasks] = useState<WorkflowTask[]>(initialTasks);
  const [notifications, setNotifications] = useState<WorkflowNotification[]>(initialNotifications);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>(initialAuditEntries);
  const [activeMemberName, setActiveMemberName] = useState('Μέλος');
  const [linksGenerated, setLinksGenerated] = useState(false);
  const [clientLink, setClientLink] = useState<string | null>(initialClientLink);
  const [memberLinks, setMemberLinks] = useState<WorkspaceMemberLink[]>(initialMemberLinks);
  const [utilityPanelOpen, setUtilityPanelOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<UiToast | null>(null);

  const allDocumentsApproved = documents.every((doc) => doc.status === 'approved');
  const allTasksCompleted = tasks.every((task) => task.status === 'completed');

  const pushToast = (message: string, variant: ToastVariant = 'info') => {
    setToastMessage({ message, variant });
  };

  const pushNotification = (type: WorkflowNotificationType, message: string) => {
    setNotifications((prev) => [
      {
        id: `n-${Date.now()}`,
        type,
        message,
        timestamp: 'μόλις τώρα',
        read: false,
      },
      ...prev,
    ]);
  };

  const pushAudit = (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
    const ts = new Date().toLocaleString('el-GR', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    setAuditEntries((prev) => [{ ...entry, id: `a-${Date.now()}`, timestamp: ts }, ...prev]);
  };

  const loadBackendSnapshot = useCallback(async () => {
    try {
      const deals = await listDeals();
      if (deals.length === 0) {
        return;
      }

      const deal = deals[0];
      const [dealDocuments, dealMembers, dealStages, feed] = await Promise.all([
        listDealDocuments(deal.id),
        listDealMembers(deal.id),
        listDealStages(deal.id),
        listNotificationFeed(),
      ]);

      setCurrentPhase(
        deal.status === 'PROCESS_PHASE' || deal.status === 'SETTLEMENT_PHASE' || deal.status === 'COMPLETED' ? 2 : 1
      );
      setDocuments(
        dealDocuments.map((document) => ({
          id: document.id,
          name: document.name,
          status:
            document.status === 'APPROVED'
              ? 'approved'
              : document.status === 'REJECTED'
                ? 'rejected'
                : 'pending',
        }))
      );

      const memberById = new Map(dealMembers.map((member) => [member.id, member]));
      setTasks(
        dealStages.map((stage) => ({
          id: stage.id,
          dealId: deal.id,
          memberId: stage.memberId,
          name: stage.title,
          member: stage.memberId ? (memberById.get(stage.memberId)?.name ?? 'Μέλος') : 'Μέλος',
          status: mapStageStatus(stage),
          daysOverdue: mapOverdueDays(stage),
        }))
      );

      setNotifications(
        feed.map((item) => ({
          id: item.id,
          type:
            item.type === 'status_change'
              ? 'phase'
              : item.type === 'reminder'
                ? 'reminder'
                : item.type === 'nudge'
                  ? 'reminder'
                  : 'document',
          message: item.message,
          timestamp: new Date(item.sentAt).toLocaleString('el-GR'),
          read: Boolean(item.readAt),
        }))
      );

      const buyerToken = deal.buyerLinkToken ?? deal.clientLinkToken;
      setClientLink(`/client/${buyerToken}`);
      const mappedLinks: WorkspaceMemberLink[] = dealMembers.map((member) => ({
        id: member.id,
        member: member.name,
        role: member.role,
        phone: member.phone ?? '',
        url: `/member/${member.linkToken}`,
      }));
      setMemberLinks(mappedLinks);
      setLinksGenerated(mappedLinks.length > 0);
      setActiveMemberName(mappedLinks[0]?.member ?? 'Μέλος');
    } catch {
      // Keep local-only interactions enabled even if backend snapshot fails.
    }
  }, []);

  useEffect(() => {
    loadBackendSnapshot();
  }, [loadBackendSnapshot]);

  const setDocumentStatus = (id: string, status: WorkflowDocumentStatus) => {
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? { ...doc, status } : doc)));
    if (status === 'approved') {
      pushNotification('document', `📄 Εγκρίθηκε το έγγραφο: ${id}`);
      pushAudit({ tone: 'green', category: 'approvals', actor: 'Μεσίτης', action: `Ενέκρινε το έγγραφο «${id}»` });
    }
    if (status === 'rejected') {
      pushAudit({ tone: 'red', category: 'approvals', actor: 'Μεσίτης', action: `Απόρριψη εγγράφου «${id}»` });
    }
  };

  const approveAllDocuments = () => {
    setDocuments((prev) => prev.map((doc) => ({ ...doc, status: 'approved' })));
    pushNotification('document', '📄 Όλα τα έγγραφα εγκρίθηκαν από τον μεσίτη');
    pushAudit({ tone: 'green', category: 'approvals', actor: 'Μεσίτης', action: 'Έγκριση όλων των εγγράφων' });
    pushToast('✓ Όλα τα έγγραφα εγκρίθηκαν');
  };

  const engineerOverduePlus5 = () => {
    setTasks((prev) =>
      prev.map((task) =>
        task.member.includes('Πέτρος')
          ? {
              ...task,
              status: task.status === 'completed' ? 'completed' : 'in-progress',
              daysOverdue: 5,
            }
          : task
      )
    );
    pushNotification('overdue', '⚠ Ο Πέτρος Ιωάννου (Μηχανικός) καθυστερεί 5 ημέρες στην ΗΤΚ');
    pushAudit({ tone: 'red', category: 'overdue', actor: 'Σύστημα', action: 'Εκπρόθεσμο: ΗΤΚ (+5 ημέρες)' });
    pushToast('⚠ Ο μηχανικός είναι πλέον εκπρόθεσμος');
  };

  const completeLawyerTasks = () => {
    setTasks((prev) =>
      prev.map((task) =>
        task.member.includes('Αλεξάνδρα')
          ? {
              ...task,
              status: 'completed',
              daysOverdue: 0,
            }
          : task
      )
    );
    pushNotification('completed', '✓ Η Αλεξάνδρα Νικολάου ολοκλήρωσε τον Έλεγχο Τίτλων');
    pushAudit({ tone: 'green', category: 'approvals', actor: 'Αλεξάνδρα Νικολάου', action: 'Ολοκλήρωση: Έλεγχος Τίτλων' });
    pushToast('✓ Εργασίες δικηγόρου ολοκληρώθηκαν');
  };

  const sendReminder = (member: string) => {
    const task = tasks.find((item) => item.member === member && item.dealId && item.memberId);
    if (!task?.dealId || !task.memberId) {
      pushToast(`Δεν βρέθηκε ενεργό task για ${member}`);
      return;
    }
    sendBrokerNudge({
      dealId: task.dealId,
      memberId: task.memberId,
      message: `Υπενθύμιση για το στάδιο: ${task.name}`,
    })
      .then(() => {
        pushNotification('reminder', `📩 Υπενθύμιση στάλθηκε στον ${member}`);
        pushAudit({ tone: 'amber', category: 'reminders', actor: 'Σύστημα', action: `Υπενθύμιση στάλθηκε στον ${member}` });
        pushToast(`📩 Υπενθύμιση στάλθηκε στον ${member}`);
      })
      .catch(() => {
        pushToast(`Αποτυχία αποστολής υπενθύμισης στον ${member}`);
      });
  };

  const sendSmsReminder = (member: string, phone: string) => {
    const task = tasks.find((item) => item.member === member && item.dealId && item.memberId);
    if (!task?.dealId || !task.memberId) {
      pushToast(`Δεν βρέθηκε ενεργό task για ${member}`);
      return;
    }
    sendBrokerNudge({
      dealId: task.dealId,
      memberId: task.memberId,
      message: `SMS υπενθύμιση για το στάδιο: ${task.name}`,
      channel: 'sms',
    })
      .then(() => {
        pushNotification('reminder', `📱 SMS στάλθηκε στο ${member}`);
        pushAudit({ tone: 'amber', category: 'reminders', actor: 'Σύστημα', action: `SMS στάλθηκε στον ${member}` });
        pushToast(`📱 SMS στάλθηκε στο ${phone}`);
      })
      .catch(() => {
        pushToast(`Αποτυχία αποστολής SMS σε ${member}`);
      });
  };

  const sendWhatsappReminder = (member: string) => {
    const task = tasks.find((item) => item.member === member && item.dealId && item.memberId);
    if (!task?.dealId || !task.memberId) {
      pushToast(`Δεν βρέθηκε ενεργό task για ${member}`);
      return;
    }
    sendBrokerNudge({
      dealId: task.dealId,
      memberId: task.memberId,
      message: `WhatsApp υπενθύμιση για το στάδιο: ${task.name}`,
      channel: 'whatsapp',
    })
      .then(() => {
        pushNotification('reminder', `💬 WhatsApp μήνυμα στάλθηκε στον ${member}`);
        pushAudit({ tone: 'amber', category: 'reminders', actor: 'Σύστημα', action: `WhatsApp στάλθηκε στον ${member}` });
        pushToast('💬 WhatsApp μήνυμα στάλθηκε');
      })
      .catch(() => {
        pushToast(`Αποτυχία αποστολής WhatsApp σε ${member}`);
      });
  };

  const reassignTask = (taskId: string, newMemberId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task?.dealId) {
      pushToast('Δεν βρέθηκε task για ανάθεση');
      return;
    }
    const member = memberLinks.find((link) => link.id === newMemberId);
    if (!member) {
      pushToast('Δεν βρέθηκε μέλος');
      return;
    }
    updateDealStageAssignee(task.dealId, taskId, { memberId: newMemberId })
      .then(() => {
        setTasks((prev) =>
          prev.map((item) =>
            item.id === taskId
              ? { ...item, member: member.member, memberId: newMemberId }
              : item
          )
        );
        pushNotification('reminder', `🔄 Ανατέθηκε στον ${member.member}`);
        pushAudit({ tone: 'indigo', category: 'all', actor: 'Μεσίτης', action: `Αλλαγή υπευθύνου σε ${member.member}` });
        pushToast(`🔄 Ανατέθηκε στον ${member.member}`);
      })
      .catch(() => {
        pushToast('Αποτυχία αλλαγής υπευθύνου');
      });
  };

  const extendTaskDeadline = (taskId: string, deadlineIso: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task?.dealId || !deadlineIso) {
      pushToast('Μη έγκυρη ημερομηνία');
      return;
    }
    updateDealStageDeadline(task.dealId, taskId, { deadline: deadlineIso })
      .then(() => {
        const isFutureDate = new Date(deadlineIso).getTime() > Date.now();
        setTasks((prev) =>
          prev.map((item) =>
            item.id === taskId
              ? {
                  ...item,
                  daysOverdue: isFutureDate ? 0 : item.daysOverdue,
                  status: isFutureDate ? 'in-progress' : item.status,
                }
              : item
          )
        );
        pushAudit({ tone: 'indigo', category: 'all', actor: 'Μεσίτης', action: `Παράταση προθεσμίας για ${taskId}` });
      })
      .catch(() => {
        pushToast('Αποτυχία ενημέρωσης προθεσμίας');
      });
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const jumpToPhase2 = () => {
    setCurrentPhase(2);
    pushNotification('phase', '→ Η συναλλαγή πέρασε στη Φάση 2');
    pushAudit({ tone: 'indigo', category: 'phases', actor: 'Μεσίτης', action: 'Ενεργοποίηση Skill Tree (Φάση 2)' });
    pushToast('→ Μετάβαση σε Φάση 2');
  };

  const completeTransaction = () => {
    setCurrentPhase(3);
    setTasks((prev) => prev.map((task) => ({ ...task, status: 'completed', daysOverdue: 0 })));
    pushNotification('phase', '🏁 Η συναλλαγή ολοκληρώθηκε');
    pushAudit({ tone: 'green', category: 'phases', actor: 'Μεσίτης', action: 'Ολοκλήρωση συναλλαγής' });
    pushToast('🏁 Η συναλλαγή ολοκληρώθηκε');
  };

  const generateAllLinks = () => {
    setLinksGenerated(true);
    setClientLink(`trustlayer.app/c/${Math.random().toString(36).slice(2, 8)}`);
    setMemberLinks((prev) =>
      prev.map((m) => ({ ...m, url: `trustlayer.app/m/${Math.random().toString(36).slice(2, 8)}` }))
    );
    pushToast('✓ Links δημιουργήθηκαν για 6 παραλήπτες');
  };

  const refreshClientLink = () => {
    setClientLink(`trustlayer.app/c/${Math.random().toString(36).slice(2, 8)}`);
    pushToast('🔄 Νέο link δημιουργήθηκε');
  };

  const refreshMemberLink = (member: string) => {
    setMemberLinks((prev) =>
      prev.map((m) =>
        m.member === member ? { ...m, url: `trustlayer.app/m/${Math.random().toString(36).slice(2, 8)}` } : m
      )
    );
    pushToast('🔄 Νέο link δημιουργήθηκε');
  };

  const resetWorkspace = () => {
    setCurrentPhase(1);
    setActiveRole('broker');
    setDocuments([]);
    setTasks([]);
    setNotifications([]);
    setAuditEntries(initialAuditEntries);
    setActiveMemberName('Μέλος');
    setLinksGenerated(false);
    setClientLink(null);
    setMemberLinks([]);
    setUtilityPanelOpen(false);
    loadBackendSnapshot();
    pushToast('↺ Επαναφόρτωση δεδομένων');
  };

  const clearToast = () => setToastMessage(null);

  const value = useMemo(
    () => ({
      currentPhase,
      activeRole,
      documents,
      tasks,
      notifications,
      auditEntries,
      activeMemberName,
      linksGenerated,
      clientLink,
      memberLinks,
      utilityPanelOpen,
      toastMessage,
      setCurrentPhase,
      setActiveRole,
      setUtilityPanelOpen,
      setActiveMemberName,
      setDocumentStatus,
      approveAllDocuments,
      engineerOverduePlus5,
      completeLawyerTasks,
      sendReminder,
      sendSmsReminder,
      sendWhatsappReminder,
      reassignTask,
      extendTaskDeadline,
      markAllNotificationsRead,
      jumpToPhase2,
      completeTransaction,
      generateAllLinks,
      refreshClientLink,
      refreshMemberLink,
      resetWorkspace,
      clearToast,
      showToast: pushToast,
      allDocumentsApproved,
      allTasksCompleted,
    }),
    [
      currentPhase,
      activeRole,
      documents,
      tasks,
      notifications,
      auditEntries,
      activeMemberName,
      linksGenerated,
      clientLink,
      memberLinks,
      utilityPanelOpen,
      toastMessage,
      allDocumentsApproved,
      allTasksCompleted,
    ]
  );

  return <UiStoreContext.Provider value={value}>{children}</UiStoreContext.Provider>;
}

export function useUiStore() {
  return useContext(UiStoreContext);
}
