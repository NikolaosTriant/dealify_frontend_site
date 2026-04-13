export type PipelineFilter = 'all' | 'my-deals' | 'overdue';

interface PipelineFilterBarProps {
  activeFilter: PipelineFilter;
  onFilterChange: (filter: PipelineFilter) => void;
  onNewTransaction: () => void;
  showNewTransactionButton?: boolean;
}

export function PipelineFilterBar({
  activeFilter,
  onFilterChange,
  onNewTransaction,
  showNewTransactionButton = true,
}: PipelineFilterBarProps) {
  const filters: { id: PipelineFilter; label: string }[] = [
    { id: 'all', label: 'Όλα' },
    { id: 'my-deals', label: 'Οι Συναλλαγές Μου' },
    { id: 'overdue', label: 'Καθυστερήσεις' },
  ];

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Filters */}
      <div className="flex items-center gap-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === filter.id
                ? 'bg-[#1A1612] text-white'
                : 'border border-[var(--border-strong)] bg-[var(--surface-glow)] text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* New Transaction Button */}
      {showNewTransactionButton && (
        <button
          onClick={onNewTransaction}
          className="rounded-lg bg-[var(--brand-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-hover)]"
        >
          + Νέα Συναλλαγή
        </button>
      )}
    </div>
  );
}
