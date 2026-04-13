import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronUp, Clock, Filter, Home, MessageSquareMore, Search, TrendingUp, XCircle } from 'lucide-react';
import {
  ApiDeal,
  ApiDealMember,
  ApiDealStage,
  listDealMembers,
  listDeals,
  listDealStages,
  sendBrokerNudge,
  updateDealStageAssignee,
  updateDealStageDeadline
} from '../api/trustlayerApi';
import { useUiStore } from '../state/uiStore';

type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'overdue' | 'blocked';
type TaskCategory = 'Νομικά Έγγραφα' | 'Τεχνικά Έγγραφα' | 'Φορολογικά' | 'Οργανωτικά';

type TaskRow = {
  id: string;
  dealId: string;
  propertyTitle: string;
  clientName: string;
  title: string;
  category: TaskCategory;
  assigneeName: string;
  assigneeRole: string;
  memberId?: string;
  dueDate?: string;
  status: TaskStatus;
};

function mapRoleLabel(role?: string) {
  if (role === 'LAWYER') return 'Δικηγόρος';
  if (role === 'ENGINEER') return 'Μηχανικός';
  if (role === 'SURVEYOR') return 'Τοπογράφος';
  if (role === 'NOTARY') return 'Συμβολαιογράφος';
  return 'Μέλος';
}

function mapTaskStatus(stage: ApiDealStage): TaskStatus {
  if (stage.status === 'COMPLETED') return 'completed';
  if (stage.status === 'LOCKED') return 'blocked';
  if (stage.deadline && new Date(`${stage.deadline}T00:00:00`).getTime() < Date.now()) return 'overdue';
  return 'in-progress';
}

function mapTaskCategory(stage: ApiDealStage, role?: string): TaskCategory {
  const title = (stage.title ?? '').toLowerCase();
  if (title.includes('φορολογ') || title.includes('ενφια') || title.includes('αφμ')) return 'Φορολογικά';
  if (role === 'LAWYER') return 'Νομικά Έγγραφα';
  if (role === 'ENGINEER' || role === 'SURVEYOR') return 'Τεχνικά Έγγραφα';
  return 'Οργανωτικά';
}

function statusBadge(status: TaskStatus) {
  if (status === 'completed') return 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]';
  if (status === 'overdue') return 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]';
  if (status === 'blocked') return 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]';
  if (status === 'in-progress') return 'bg-[var(--status-info-bg)] text-[var(--status-info-text)]';
  return 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]';
}

function daysLeft(dueDate?: string) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

const categoryOrder: TaskCategory[] = ['Νομικά Έγγραφα', 'Τεχνικά Έγγραφα', 'Φορολογικά', 'Οργανωτικά'];

export function ProfessionalTaskDashboard({ focusMemberName }: { focusMemberName?: string }) {
  const { showToast } = useUiStore();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [membersByDeal, setMembersByDeal] = useState<Record<string, ApiDealMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [dealFilter, setDealFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'overdue'>('all');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedDueDate, setEditedDueDate] = useState('');
  const [editedMemberId, setEditedMemberId] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [nudgeTask, setNudgeTask] = useState<TaskRow | null>(null);
  const [nudgeChannel, setNudgeChannel] = useState<'email' | 'sms'>('email');
  const filterSelectClassName = 'w-full appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 pr-8 text-sm text-[var(--text-secondary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)] cursor-pointer';
  const inlineSelectClassName = 'appearance-none rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-1.5 pr-8 text-xs text-[var(--text-secondary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)] cursor-pointer';

  const reload = async () => {
    setLoading(true);
    try {
      const deals = await listDeals();
      const rows = await Promise.all(
        deals.map(async (deal) => {
          const [members, stages] = await Promise.all([
            listDealMembers(deal.id),
            listDealStages(deal.id),
          ]);
          setMembersByDeal((prev) => ({ ...prev, [deal.id]: members }));
          return buildRowsForDeal(deal, members, stages);
        })
      );
      setTasks(rows.flat());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (focusMemberName && task.assigneeName !== focusMemberName) return false;
      if (search && !`${task.title} ${task.propertyTitle} ${task.clientName}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (dealFilter !== 'all' && task.dealId !== dealFilter) return false;
      const diff = daysLeft(task.dueDate);
      if (dateFilter === 'today' && diff !== 0) return false;
      if (dateFilter === 'week' && !(diff !== null && diff >= 0 && diff <= 7)) return false;
      if (dateFilter === 'overdue' && task.status !== 'overdue') return false;
      return true;
    });
  }, [tasks, focusMemberName, search, statusFilter, dealFilter, dateFilter]);

  const groupedByDeal = useMemo(() => {
    const map = new Map<string, { dealId: string; propertyTitle: string; clientName: string; tasks: TaskRow[] }>();
    filtered.forEach((task) => {
      if (!map.has(task.dealId)) {
        map.set(task.dealId, {
          dealId: task.dealId,
          propertyTitle: task.propertyTitle,
          clientName: task.clientName,
          tasks: [],
        });
      }
      map.get(task.dealId)?.tasks.push(task);
    });
    return Array.from(map.values());
  }, [filtered]);

  const dealOptions = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((task) => {
      if (!map.has(task.dealId)) map.set(task.dealId, task.propertyTitle);
    });
    return Array.from(map.entries());
  }, [tasks]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSendNudge = async () => {
    if (!nudgeTask?.memberId) return;
    try {
      await sendBrokerNudge({
        dealId: nudgeTask.dealId,
        memberId: nudgeTask.memberId,
        message: `Υπενθύμιση για το task "${nudgeTask.title}"`,
        channel: nudgeChannel,
      });
      showToast(`Στάλθηκε υπενθύμιση μέσω ${nudgeChannel === 'sms' ? 'SMS' : 'Email'}.`, 'success');
      setNudgeTask(null);
      setNudgeChannel('email');
    } catch {
      showToast('Αποτυχία αποστολής υπενθύμισης.', 'error');
    }
  };

  const saveTaskEdits = async (task: TaskRow) => {
    try {
      if (editedMemberId && editedMemberId !== task.memberId) {
        await updateDealStageAssignee(task.dealId, task.id, { memberId: editedMemberId });
      }
      if (editedDueDate && editedDueDate !== task.dueDate) {
        await updateDealStageDeadline(task.dealId, task.id, { deadline: editedDueDate });
      }
      await reload();
      showToast('Η εργασία ενημερώθηκε.', 'success');
      setEditingTaskId(null);
    } catch {
      showToast('Αποτυχία ενημέρωσης εργασίας.', 'error');
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[var(--page-bg)]">
      <header className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-4 text-[var(--text-primary)] dark:bg-[var(--surface-darkness)] dark:text-[var(--text-on-dark)]">
        <h1 className="text-lg font-semibold">Προβολή Εργασιών Μελών</h1>
        <p className="text-xs text-[var(--text-secondary)] dark:text-[var(--text-on-dark-muted)]">Backend-driven tasks grouped by deal and category</p>
      </header>

      <div className="p-6">
        <div className="mb-4">
          <WeekAnalyticsCard tasks={tasks} />
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-3 md:grid-cols-5">
          <label className="col-span-2 flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2">
            <Search size={14} className="text-[var(--text-tertiary)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
              placeholder="Αναζήτηση task, ακινήτου ή πελάτη"
            />
          </label>
          <label className="flex items-center gap-2">
            <Filter size={14} className="text-[var(--text-tertiary)]" />
            <div className="relative w-full">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as TaskStatus | 'all')}
                className={filterSelectClassName}
              >
                <option value="all">Όλα τα status</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="blocked">Blocked</option>
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            </div>
          </label>
          <label>
            <div className="relative">
              <select
                value={dealFilter}
                onChange={(event) => setDealFilter(event.target.value)}
                className={filterSelectClassName}
              >
                <option value="all">Όλα τα deals</option>
                {dealOptions.map(([id, title]) => (
                  <option key={id} value={id}>{title}</option>
                ))}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            </div>
          </label>
          <label>
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value as 'all' | 'today' | 'week' | 'overdue')}
                className={filterSelectClassName}
              >
                <option value="all">Όλες οι ημερομηνίες</option>
                <option value="today">Λήγει σήμερα</option>
                <option value="week">Εντός εβδομάδας</option>
                <option value="overdue">Καθυστερημένα</option>
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            </div>
          </label>
        </div>

        <div className="space-y-4">
          {loading && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 text-sm text-[var(--text-secondary)]">Φόρτωση...</div>
          )}

          {!loading && groupedByDeal.map((dealGroup) => {
            const total = dealGroup.tasks.length;
            const completed = dealGroup.tasks.filter((task) => task.status === 'completed').length;
            const overdue = dealGroup.tasks.filter((task) => task.status === 'overdue').length;
            const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

            return (
              <article key={dealGroup.dealId} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]">
                      <Home size={14} className="text-[var(--text-tertiary)]" />
                      {dealGroup.propertyTitle}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">{dealGroup.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-tertiary)]">{completed}/{total} tasks</p>
                    {overdue > 0 && <p className="text-xs font-semibold text-[var(--status-danger-text)]">{overdue} overdue</p>}
                  </div>
                </div>

                <div className="mb-4 h-1.5 rounded-full bg-[var(--border-default)]">
                  <div className="h-1.5 rounded-full bg-[var(--brand-primary)]" style={{ width: `${progress}%` }} />
                </div>

                <div className="space-y-3">
                  {categoryOrder.map((category) => {
                    const categoryTasks = dealGroup.tasks.filter((task) => task.category === category);
                    if (categoryTasks.length === 0) return null;
                    const groupKey = `${dealGroup.dealId}:${category}`;
                    const open = openGroups[groupKey] ?? categoryTasks.some((task) => task.status === 'overdue');
                    const overdueCountInCategory = categoryTasks.filter((task) => task.status === 'overdue').length;
                    return (
                      <div key={groupKey} className={`rounded-lg border ${overdueCountInCategory > 0 ? 'border-[var(--status-danger-border)]' : 'border-[var(--border-default)]'}`}>
                        <button
                          onClick={() => toggleGroup(groupKey)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left"
                        >
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{category}</p>
                            <p className="text-xs text-[var(--text-tertiary)]">{categoryTasks.length} εργασίες</p>
                          </div>
                          <div className="inline-flex items-center gap-2">
                            {overdueCountInCategory > 0 && (
                              <span className="rounded-full bg-[var(--status-danger-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-danger-text)]">{overdueCountInCategory} overdue</span>
                            )}
                            {open ? <ChevronUp size={16} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={16} className="text-[var(--text-tertiary)]" />}
                          </div>
                        </button>

                        {open && (
                          <div className="space-y-2 border-t border-[var(--border-subtle)] px-3 py-2">
                            {categoryTasks.map((task) => (
                              <div key={task.id} className="rounded-md border border-[var(--border-default)] p-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-[var(--text-primary)]">{task.title}</p>
                                    <p className="text-xs text-[var(--text-tertiary)]">{task.assigneeName} · {task.assigneeRole}</p>
                                  </div>
                                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusBadge(task.status)}`}>{task.status}</span>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                                  {editingTaskId === task.id ? (
                                    <>
                                      <div className="relative">
                                        <select
                                          value={editedMemberId}
                                          onChange={(event) => setEditedMemberId(event.target.value)}
                                          className={inlineSelectClassName}
                                        >
                                          <option value="">Χωρίς αλλαγή υπευθύνου</option>
                                          {(membersByDeal[task.dealId] ?? []).map((member) => (
                                            <option key={member.id} value={member.id}>{member.name}</option>
                                          ))}
                                        </select>
                                        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                                      </div>
                                      <input
                                        type="date"
                                        value={editedDueDate}
                                        onChange={(event) => setEditedDueDate(event.target.value)}
                                        className="rounded border border-[var(--border-strong)] px-2 py-1"
                                      />
                                    </>
                                  ) : (
                                    <span className="inline-flex items-center gap-1">
                                      <Calendar size={12} />
                                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString('el-GR') : 'Χωρίς deadline'}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-3 inline-flex gap-2">
                                  {editingTaskId === task.id ? (
                                    <>
                                      <button
                                        onClick={() => void saveTaskEdits(task)}
                                        className="rounded-md bg-[var(--brand-primary)] px-2 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditingTaskId(null)}
                                        className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingTaskId(task.id);
                                          setEditedDueDate(task.dueDate ?? '');
                                          setEditedMemberId(task.memberId ?? '');
                                        }}
                                        className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          setNudgeTask(task);
                                          setNudgeChannel('email');
                                        }}
                                        disabled={!task.memberId}
                                        className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-primary)] px-2 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                                      >
                                        <MessageSquareMore size={12} />
                                        Nudge
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}

          {!loading && groupedByDeal.length === 0 && (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 text-center text-sm text-[var(--text-tertiary)]">
              Δεν βρέθηκαν εργασίες.
            </div>
          )}
        </div>
      </div>
      {nudgeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Επιλογή τρόπου υπενθύμισης</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Task: <span className="font-medium">{nudgeTask.title}</span>
            </p>

            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={nudgeChannel === 'email'}
                  onChange={() => setNudgeChannel('email')}
                />
                Email
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={nudgeChannel === 'sms'}
                  onChange={() => setNudgeChannel('sms')}
                />
                SMS
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setNudgeTask(null)}
                className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Άκυρο
              </button>
              <button
                onClick={() => void handleSendNudge()}
                className="rounded-md bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                Επιβεβαίωση αποστολής
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeekAnalyticsCard({ tasks }: { tasks: TaskRow[] }) {
  const deals = new Set(tasks.map((task) => task.dealId)).size;
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const dueToday = tasks.filter((task) => task.status !== 'completed' && daysLeft(task.dueDate) === 0).length;
  const dueThisWeek = tasks.filter((task) => {
    if (task.status === 'completed') return false;
    const diff = daysLeft(task.dueDate);
    return diff !== null && diff > 0 && diff <= 7;
  }).length;
  const overdue = tasks.filter((task) => task.status === 'overdue').length;
  const blocked = tasks.filter((task) => task.status === 'blocked').length;

  const rangeStart = new Date();
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + 6);
  const rangeLabel = `${rangeStart.toLocaleDateString('el-GR', { day: '2-digit', month: 'short' })} - ${rangeEnd.toLocaleDateString('el-GR', { day: '2-digit', month: 'short' })}`;

  const stats = [
    { label: 'Deals', count: deals, fg: 'text-[var(--text-secondary)]', bg: 'bg-[var(--surface-highlight)]', icon: <Home size={16} /> },
    { label: 'Ολοκληρωμένα', count: completedTasks, fg: 'text-[var(--status-success-text)]', bg: 'bg-[var(--status-success-bg)]', icon: <CheckCircle2 size={16} /> },
    { label: 'Καθυστερημένα', count: overdue, fg: 'text-[var(--status-danger-text)]', bg: 'bg-[var(--status-danger-bg)]', icon: <AlertTriangle size={16} /> },
    { label: 'Λήγουν Σήμερα', count: dueToday, fg: 'text-[var(--status-warning-text)]', bg: 'bg-[var(--status-warning-bg)]', icon: <Clock size={16} /> },
    { label: 'Εντός Εβδομάδας', count: dueThisWeek, fg: 'text-[var(--status-info-text)]', bg: 'bg-[var(--status-info-bg)]', icon: <Calendar size={16} /> },
    { label: 'Μπλοκαρισμένα', count: blocked, fg: 'text-[var(--status-neutral-text)]', bg: 'bg-[var(--status-neutral-bg)]', icon: <XCircle size={16} /> },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)]">
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <TrendingUp size={16} className="text-[var(--brand-primary)]" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Analytics Εργασιών</h2>
        <span className="ml-auto text-xs text-[var(--text-tertiary)]">{rangeLabel}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-lg p-3 ${stat.bg}`}>
            <div className={`flex items-center justify-between ${stat.fg}`}>
              {stat.icon}
              <span className="text-2xl font-bold leading-none">{stat.count}</span>
            </div>
            <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildRowsForDeal(deal: ApiDeal, members: ApiDealMember[], stages: ApiDealStage[]): TaskRow[] {
  const memberById = new Map(members.map((member) => [member.id, member]));
  return stages.map((stage) => {
    const member = stage.memberId ? memberById.get(stage.memberId) : undefined;
    return {
      id: stage.id,
      dealId: deal.id,
      propertyTitle: deal.propertyTitle,
      clientName: deal.clientName,
      title: stage.title,
      category: mapTaskCategory(stage, member?.role),
      assigneeName: member?.name ?? stage.memberName ?? 'Μη ορισμένο μέλος',
      assigneeRole: mapRoleLabel(member?.role),
      dueDate: stage.deadline,
      status: mapTaskStatus(stage),
      memberId: stage.memberId,
    };
  });
}
