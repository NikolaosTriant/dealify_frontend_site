import { X, User, Calendar, MessageSquare } from 'lucide-react';
import { BranchTask } from './BranchNode';
import { ApiMemberDocument } from '../api/trustlayerApi';

interface TaskSlidePanelProps {
  task: BranchTask | null;
  isOpen: boolean;
  onClose: () => void;
  memberDocuments?: ApiMemberDocument[];
  reviewing?: boolean;
  onOpenMemberDocument?: (document: ApiMemberDocument) => void;
  onApproveMemberDocument?: (document: ApiMemberDocument) => void;
  onRejectMemberDocument?: (document: ApiMemberDocument) => void;
  onCompleteStage?: () => void;
}

function memberDocumentStatusLabel(status?: string) {
  if (status === 'UPLOADED') return 'PENDING_REVIEW';
  if (status === 'APPROVED') return 'APPROVED';
  if (status === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

export function TaskSlidePanel({
  task,
  isOpen,
  onClose,
  memberDocuments = [],
  reviewing,
  onOpenMemberDocument,
  onApproveMemberDocument,
  onRejectMemberDocument,
  onCompleteStage,
}: TaskSlidePanelProps) {
  if (!task) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 transition-opacity z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[480px] transform bg-[var(--surface-glow)] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[var(--border-default)] p-6">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">{task.name}</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-[var(--surface-highlight)]"
            >
              <X size={20} className="text-[var(--text-tertiary)]" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Assigned Person */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">
                  Assigned To
                </label>
                <div className="flex items-center gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: '#1A1612' }}
                  >
                    {task.assignee?.split(' ').map((n) => n[0]).join('') || 'N/A'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {task.assignee || 'Unassigned'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">Team Member</p>
                  </div>
                </div>
              </div>

              {/* Member Document Review */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">
                  Απαιτούμενα Έγγραφα Σταδίου
                </label>
                <div className="space-y-2">
                  {memberDocuments.length === 0 && (
                    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3 text-xs text-[var(--text-tertiary)]">
                      Δεν έχουν οριστεί απαιτούμενα έγγραφα για αυτό το στάδιο.
                    </div>
                  )}
                  {memberDocuments.map((memberDocument) => (
                    <div key={memberDocument.id} className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{memberDocument.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">
                        Status: {memberDocumentStatusLabel(memberDocument?.status)}
                      </p>
                      {memberDocument.reviewerComment && (
                        <p className="mt-1 text-xs italic text-[var(--status-danger-text)]">{memberDocument.reviewerComment}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => onOpenMemberDocument?.(memberDocument)}
                          disabled={!memberDocument.fileUrl}
                          className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Προβολή Αρχείου
                        </button>
                        <button
                          onClick={() => onApproveMemberDocument?.(memberDocument)}
                          disabled={memberDocument.status !== 'UPLOADED' || reviewing}
                          className="rounded-md bg-[var(--status-success)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Έγκριση
                        </button>
                        <button
                          onClick={() => onRejectMemberDocument?.(memberDocument)}
                          disabled={memberDocument.status !== 'UPLOADED' || reviewing}
                          className="rounded-md border border-[var(--status-danger-border)] px-2.5 py-1 text-xs font-semibold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Απόρριψη
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">
                  Due Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className="w-full rounded-lg border border-[var(--border-strong)] px-4 py-2.5 pl-10 text-sm text-[var(--text-primary)] focus:border-[var(--border-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                    value={task.dueDate || ''}
                    onChange={(e) => {
                      console.log('Due date changed to:', e.target.value);
                    }}
                  />
                  <Calendar
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">
                  Notes
                </label>
                <textarea
                  className="w-full resize-none rounded-lg border border-[var(--border-strong)] px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                  rows={4}
                  placeholder="Add notes about this task..."
                  defaultValue={task.notes || ''}
                  onChange={(e) => {
                    console.log('Notes updated:', e.target.value);
                  }}
                />
              </div>

              {/* Activity Log */}
              <div>
                <label className="mb-3 block text-sm font-semibold text-[var(--text-secondary)]">
                  Activity Log
                </label>
                <div className="space-y-4">
                  {task.activityLog && task.activityLog.length > 0 ? (
                    task.activityLog.map((entry) => (
                      <div key={entry.id} className="flex gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                            style={{ backgroundColor: '#1A1612' }}
                        >
                          {entry.user.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-[var(--text-primary)]">
                            <span className="font-medium">{entry.user}</span>{' '}
                            <span className="text-[var(--text-secondary)]">{entry.action}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{entry.timestamp}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] py-6 text-center">
                      <MessageSquare size={24} className="mx-auto mb-2 text-[var(--text-tertiary)]" />
                      <p className="text-sm text-[var(--text-tertiary)]">No activity yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 border-t border-[var(--border-default)] p-6">
            <button
              onClick={onCompleteStage}
              disabled={
                task.status === 'completed'
                || task.status === 'blocked'
                || reviewing
                || memberDocuments.length === 0
                || memberDocuments.some((document) => document.status !== 'APPROVED')
              }
              className="w-full rounded-lg bg-[var(--brand-primary)] py-2.5 font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ολοκλήρωση Σταδίου
            </button>
            {memberDocuments.length === 0 || memberDocuments.some((document) => document.status !== 'APPROVED') ? (
              <p className="text-xs text-[var(--text-tertiary)]">
                Για να ολοκληρωθεί το στάδιο, πρέπει πρώτα να έχουν εγκριθεί όλα τα απαιτούμενα έγγραφα.
              </p>
            ) : null}
            <button
              className="w-full rounded-lg bg-[var(--surface-highlight)] py-2.5 font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-glow-hover)]"
              onClick={onClose}
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
