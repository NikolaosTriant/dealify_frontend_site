import { Deal, DealCard } from './DealCard';

interface KanbanColumnProps {
  title: string;
  deals: Deal[];
  count: number;
  onDealClick: (deal: Deal) => void;
}

export function KanbanColumn({ title, deals, count, onDealClick }: KanbanColumnProps) {
  return (
    <div className="flex min-w-[280px] w-[280px] flex-shrink-0 flex-col">
      {/* Column Header */}
      <div className="rounded-t-lg border border-[var(--border-default)] border-b-0 bg-[var(--surface-glow)] px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <span className="rounded bg-[var(--surface-highlight)] px-2 py-1 text-xs font-medium text-[var(--text-tertiary)]">
            {count}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div className="min-h-[500px] flex-1 space-y-3 overflow-y-auto rounded-b-lg border border-[var(--border-default)] border-t-0 bg-[var(--surface-ambient)] p-3">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal)} />
        ))}
        {deals.length === 0 && (
          <div className="py-8 text-center text-xs text-[var(--text-tertiary)]">
            No deals in this stage
          </div>
        )}
      </div>
    </div>
  );
}
