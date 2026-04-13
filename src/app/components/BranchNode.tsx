import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Clock, Eye, Lock, MoreHorizontal, User } from 'lucide-react';
import { useUiStore } from '../state/uiStore';

export type NodeStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'overdue'
  | 'blocked'
  | 'pending-review';

export interface BranchTask {
  id: string;
  name: string;
  status: NodeStatus;
  assignee?: string;
  dueDate?: string;
  completedAt?: string;
  notes?: string;
  documents?: string[];
  activityLog?: ActivityLogEntry[];
}

export interface ActivityLogEntry {
  id: string;
  user: string;
  action: string;
  timestamp: string;
}

interface BranchNodeProps {
  task: BranchTask;
  onClick: () => void;
}

const statusConfig = {
  pending: {
    containerClass: 'bg-[var(--surface-glow)] border-[var(--border-default)] text-[var(--text-primary)]',
    iconClass: 'text-[var(--text-tertiary)]',
    icon: Circle,
  },
  'in-progress': {
    containerClass: 'bg-[var(--status-info-bg)] border-[var(--status-info-border)] text-[var(--text-primary)]',
    iconClass: 'text-[var(--status-info-text)]',
    icon: Clock,
  },
  completed: {
    containerClass: 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--text-primary)]',
    iconClass: 'text-[var(--status-success-text)]',
    icon: CheckCircle2,
  },
  overdue: {
    containerClass: 'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] text-[var(--text-primary)]',
    iconClass: 'text-[var(--status-danger-text)]',
    icon: AlertTriangle,
  },
  blocked: {
    containerClass: 'bg-[var(--surface-highlight)] border-[var(--border-strong)] border-dashed text-[var(--text-primary)]',
    iconClass: 'text-[var(--text-tertiary)]',
    icon: Lock,
  },
  'pending-review': {
    containerClass: 'bg-[var(--status-warning-bg)] border-[var(--status-warning-border)] text-[var(--text-primary)]',
    iconClass: 'text-[var(--status-warning-text)]',
    icon: Eye,
  },
};

const greekStatusLabel: Record<NodeStatus, string> = {
  pending: 'Εκκρεμεί',
  'in-progress': 'Σε εξέλιξη',
  completed: 'Ολοκληρωμένο',
  overdue: 'Εκπρόθεσμο',
  blocked: 'Κλειδωμένο',
  'pending-review': 'Αναμονή ελέγχου',
};

function getDueDateLabel(task: BranchTask): { text: string; className: string } {
  if (task.status === 'completed') {
    if (task.completedAt) {
      return {
        text: `Ολοκληρώθηκε: ${new Date(task.completedAt).toLocaleString('el-GR')}`,
        className: 'text-[var(--status-success-text)]',
      };
    }
    return { text: greekStatusLabel[task.status], className: 'text-[var(--status-success-text)]' };
  }

  if (!task.dueDate) {
    return { text: greekStatusLabel[task.status], className: 'text-[var(--text-secondary)]' };
  }

  const now = new Date();
  const dueDate = new Date(task.dueDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / msPerDay);

  if (task.status === 'overdue' || diffDays < 0) {
    const overdueDays = Math.max(Math.abs(diffDays), 1);
    return {
      text: `${overdueDays} ημέρες καθυστέρηση`,
      className: 'text-[var(--status-danger-text)]',
    };
  }

  return { text: `${Math.max(diffDays, 0)} ημέρες απομένουν`, className: 'text-[var(--text-secondary)]' };
}

export function BranchNode({ task, onClick }: BranchNodeProps) {
  const {
    memberLinks,
    sendReminder,
    sendSmsReminder,
    sendWhatsappReminder,
    reassignTask,
    extendTaskDeadline,
    showToast,
  } = useUiStore();
  const config = statusConfig[task.status];
  const StatusIcon = config.icon;
  const dueDateLabel = getDueDateLabel(task);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(memberLinks[0]?.id ?? '');
  const [newDate, setNewDate] = useState('');
  const memberPhone =
    memberLinks.find((m) => m.member === task.assignee)?.phone ?? memberLinks[0]?.phone ?? '';

  return (
    <>
      <button
        onClick={onClick}
        className={`group relative w-full max-w-[320px] min-h-[100px] cursor-pointer rounded-lg border p-4 text-left shadow-sm transition-all hover:shadow-md ${config.containerClass}`}
      >
        {task.status === 'overdue' && (
          <div className="absolute right-2 top-2 z-20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--surface-glow)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] py-1 text-xs shadow-lg">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sendReminder(task.assignee || 'Μέλος');
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--surface-glow-active)]"
                >
                  📩 Στείλε Υπενθύμιση
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sendSmsReminder(task.assignee || 'Μέλος', memberPhone);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--surface-glow-active)]"
                >
                  📱 Στείλε SMS
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sendWhatsappReminder(task.assignee || 'Μέλος');
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--surface-glow-active)]"
                >
                  💬 Στείλε WhatsApp
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setReassignOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--surface-glow-active)]"
                >
                  🔄 Αλλαγή Υπευθύνου
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    setExtendOpen(true);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--surface-glow-active)]"
                >
                  📅 Παράταση Προθεσμίας
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <StatusIcon size={20} className={config.iconClass} />
          <h4 className="text-sm font-medium leading-tight text-[var(--text-primary)]">{task.name}</h4>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <User size={14} className="text-[var(--text-tertiary)]" />
          <p className="truncate text-xs text-[var(--text-tertiary)]">{task.assignee || 'Μη ορισμένο μέλος'}</p>
        </div>
        <p className={`text-xs font-semibold mt-2 ${dueDateLabel.className}`}>{dueDateLabel.text}</p>
      </button>

      {reassignOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] shadow-lg">
            <div className="border-b border-[var(--border-default)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">Αλλαγή Υπευθύνου</div>
            <div className="px-4 py-3">
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="w-full rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm"
              >
                {memberLinks.map((m) => (
                  <option key={m.id ?? m.member} value={m.id ?? ''}>
                    {m.member}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-4 py-3">
              <button onClick={() => setReassignOpen(false)} className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm">Ακύρωση</button>
              <button
                onClick={() => {
                  reassignTask(task.id, selectedMember);
                  setReassignOpen(false);
                }}
                className="rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-sm text-white"
              >
                Επιβεβαίωση
              </button>
            </div>
          </div>
        </div>
      )}

      {extendOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] shadow-lg">
            <div className="border-b border-[var(--border-default)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">Παράταση Προθεσμίας</div>
            <div className="px-4 py-3">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-4 py-3">
              <button onClick={() => setExtendOpen(false)} className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm">Ακύρωση</button>
              <button
                onClick={() => {
                  extendTaskDeadline(task.id, newDate);
                  if (newDate) showToast(`📅 Νέα προθεσμία: ${newDate}`);
                  setExtendOpen(false);
                }}
                className="rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-sm text-white"
              >
                Επιβεβαίωση
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
