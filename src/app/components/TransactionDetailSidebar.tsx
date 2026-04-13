import { Calendar, Clock, Home, Mail, MapPin, Phone } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'pending';
  initials: string;
  linkToken?: string;
  phone?: string;
  email?: string;
  completedTasks?: number;
  totalTasks?: number;
  overdueTasks?: number;
}

interface TransactionDetailSidebarProps {
  propertyImage?: string;
  address: string;
  propertyReferenceCode?: string;
  propertyType: string;
  price: string;
  startDate: string;
  daysRemaining: number;
  teamMembers: TeamMember[];
  estimatedCompletionDate: string;
  scheduleHealth: 'on-track' | 'tight' | 'behind';
  onShareLink?: (member: TeamMember) => void;
}

export function TransactionDetailSidebar({
  propertyImage,
  address,
  propertyReferenceCode,
  propertyType,
  price,
  startDate,
  daysRemaining,
  teamMembers,
  estimatedCompletionDate,
  onShareLink,
}: TransactionDetailSidebarProps) {
  const deadlineClass =
    daysRemaining < 7 ? 'text-[var(--status-danger-text)]' : daysRemaining < 14 ? 'text-[var(--status-warning-text)]' : 'text-[var(--text-primary)]';

  return (
    <aside className="flex w-72 flex-col overflow-y-auto border-r border-[var(--border-default)] bg-[var(--surface-glow)]">
      <div className="flex aspect-[4/3] items-center justify-center border-b border-[var(--border-default)] bg-[var(--surface-highlight)]">
        {propertyImage ? <img src={propertyImage} alt="Property" className="h-full w-full object-cover" /> : <Home size={48} className="text-[var(--text-tertiary)]" />}
      </div>

      <div className="border-b border-[var(--border-default)] p-4">
        <div className="mb-3 flex items-start gap-2">
          <MapPin size={16} className="mt-0.5 flex-shrink-0 text-[var(--text-tertiary)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{address}</p>
            {propertyReferenceCode && (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                Ref ID: {propertyReferenceCode}
              </p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">Τύπος</span>
            <span className="text-xs font-medium text-[var(--text-primary)]">{propertyType}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">Τιμή</span>
            <span className="text-xs font-semibold text-[var(--text-primary)]">{price}</span>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--border-default)] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Κρίσιμες Ημερομηνίες</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Calendar size={16} className="mt-0.5 text-[var(--text-tertiary)]" />
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Έναρξη</p>
              <p className="text-base font-semibold text-[var(--text-primary)]">{startDate}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock size={16} className="mt-0.5 text-[var(--text-tertiary)]" />
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Ημέρες έως υπογραφή</p>
              <p className={`text-base font-semibold ${deadlineClass}`}>{daysRemaining} ημέρες</p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--border-default)] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Εκτίμηση Χρόνου</h3>
        <p className="text-sm text-[var(--text-tertiary)]">Αναμενόμενη ολοκλήρωση</p>
        <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">{estimatedCompletionDate}</p>
      </div>

      <div className="p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Μέλη Διαδικασίας</h3>
        <div className="space-y-2">
          {teamMembers.map((member) => (
            <div key={member.id} className="rounded-lg border border-[var(--border-default)] p-2.5">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-darkness)] text-xs font-medium text-white">
                    {member.initials}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${member.status === 'active' ? 'bg-[var(--status-success)]' : 'bg-[var(--status-neutral)]'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[var(--text-primary)]">{member.name}</p>
                  <p className="truncate text-xs text-[var(--text-secondary)]">{member.role}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-[var(--text-tertiary)]">{member.completedTasks ?? 0}/{member.totalTasks ?? 0} tasks</p>
                <div className="flex items-center gap-2">
                  {member.phone && (
                    <a href={`tel:${member.phone}`} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                      <Phone size={14} />
                    </a>
                  )}
                  {member.email && (
                    <a href={`mailto:${member.email}`} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                      <Mail size={14} />
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]">
                <div
                  className="h-full rounded-full bg-[var(--brand-warm)]"
                  style={{ width: `${Math.round((((member.completedTasks ?? 0) / Math.max(member.totalTasks ?? 1, 1)) * 100))}%` }}
                />
              </div>
              <div className="mt-2">
                <button
                  onClick={() => onShareLink?.(member)}
                  className="w-full rounded-md bg-[var(--brand-primary)] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                >
                  Αποστολή Link Ρόλου
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
