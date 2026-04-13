import { Calendar, User, CheckCircle2, Clock, AlertCircle, Eye, Lock } from 'lucide-react';
import { BranchTask, NodeStatus } from './BranchNode';

interface TaskTimelineListProps {
  tasks: BranchTask[];
  onTaskClick: (task: BranchTask) => void;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'var(--status-warning-text)',
    bg: 'var(--status-warning-bg)',
  },
  'in-progress': {
    icon: Clock,
    color: 'var(--status-info-text)',
    bg: 'var(--status-info-bg)',
  },
  completed: {
    icon: CheckCircle2,
    color: 'var(--status-success-text)',
    bg: 'var(--status-success-bg)',
  },
  overdue: {
    icon: AlertCircle,
    color: 'var(--status-danger-text)',
    bg: 'var(--status-danger-bg)',
  },
  blocked: {
    icon: Lock,
    color: 'var(--status-neutral-text)',
    bg: 'var(--status-neutral-bg)',
  },
  'pending-review': {
    icon: Eye,
    color: 'var(--status-warning-text)',
    bg: 'var(--status-warning-bg)',
  },
};

function getRelativeDate(dueDate: string): string {
  // Mock implementation - in real app, calculate based on notary date
  const dates = [
    '15 days before notary',
    '12 days before notary',
    '10 days before notary',
    '8 days before notary',
    '5 days before notary',
    '3 days before notary',
    '1 day before notary',
    'Day of notary',
    'Day 1 after deal',
  ];
  return dates[Math.floor(Math.random() * dates.length)];
}

export function TaskTimelineList({ tasks, onTaskClick }: TaskTimelineListProps) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)]">
      <div className="border-b border-[var(--border-default)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Task Timeline</h3>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Tasks organized by timeline relative to notary date
        </p>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {tasks.map((task) => {
          const config = statusConfig[task.status];
          const Icon = config.icon;

          return (
            <button
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-glow-active)]"
            >
              {/* Status Icon */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: config.bg }}
              >
                <Icon size={16} style={{ color: config.color }} />
              </div>

              {/* Task Info */}
              <div className="flex-1 min-w-0">
                <h4 className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {task.name}
                </h4>
                <div className="flex items-center gap-3 mt-1">
                  {task.assignee && (
                    <div className="flex items-center gap-1">
                      <User size={12} className="text-[var(--text-tertiary)]" />
                      <span className="text-xs text-[var(--text-tertiary)]">{task.assignee}</span>
                    </div>
                  )}
                  {(task.dueDate || task.completedAt) && (
                    <div className="flex items-center gap-1">
                      <Calendar size={12} className="text-[var(--text-tertiary)]" />
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {task.completedAt
                          ? `Ολοκληρώθηκε: ${new Date(task.completedAt).toLocaleString('el-GR')}`
                          : getRelativeDate(task.dueDate ?? '')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badge */}
              <div
                className="px-2 py-1 rounded text-xs font-medium flex-shrink-0"
                style={{ backgroundColor: config.bg, color: config.color }}
              >
                {task.status === 'in-progress'
                  ? 'In Progress'
                  : task.status === 'pending-review'
                    ? 'Pending Review'
                    : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
