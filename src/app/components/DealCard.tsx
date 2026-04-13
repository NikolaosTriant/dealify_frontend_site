import { type MouseEvent, useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

export interface Deal {
  id: string;
  propertyAddress: string;
  propertyReferenceCode?: string;
  clientName: string;
  previewImages: string[];
  progress: number;
  assignedAgent: {
    name: string;
    initials: string;
    avatar?: string;
  };
  daysInStage: number;
  overdueTasks: number;
  stage: 'preparation' | 'legal-check' | 'technical-check' | 'pre-notary' | 'signing';
}

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
}

export function DealCard({ deal, onClick }: DealCardProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const previewImages =
    deal.previewImages.length > 0
      ? deal.previewImages
      : ['https://placehold.co/640x360/F5F5F5/4F46E5?text=Property+Preview'];

  useEffect(() => {
    setActiveImageIndex(0);
  }, [deal.id]);

  useEffect(() => {
    if (previewImages.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveImageIndex((current) => (current + 1) % previewImages.length);
    }, 3500);

    return () => {
      window.clearInterval(timer);
    };
  }, [previewImages.length]);

  const showPreviousImage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setActiveImageIndex((current) => (current - 1 + previewImages.length) % previewImages.length);
  };

  const showNextImage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setActiveImageIndex((current) => (current + 1) % previewImages.length);
  };

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 transition-shadow hover:shadow-md"
    >
      <div className="relative mb-3 overflow-hidden rounded-md">
        <img
          src={previewImages[activeImageIndex]}
          alt={`Ακίνητο ${deal.propertyAddress}`}
          className="h-32 w-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = 'https://placehold.co/640x360/F5F5F5/4F46E5?text=Property+Preview';
          }}
        />

        {previewImages.length > 1 && (
          <>
            <button
              onClick={showPreviousImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1 text-white hover:bg-black/60"
              aria-label="Προηγούμενη εικόνα"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={showNextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1 text-white hover:bg-black/60"
              aria-label="Επόμενη εικόνα"
            >
              <ChevronRight size={14} />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1">
              {previewImages.map((_, index) => (
                <span
                  key={`${deal.id}-img-dot-${index}`}
                  className={`h-1.5 w-1.5 rounded-full ${
                    index === activeImageIndex ? 'bg-[var(--surface-glow)]' : 'bg-[var(--surface-glow)]/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Header with Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="mb-1 truncate text-sm font-semibold text-[var(--text-primary)]">
            {deal.propertyAddress}
          </h4>
          {deal.propertyReferenceCode && (
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Ref ID: {deal.propertyReferenceCode}
            </p>
          )}
          <p className="truncate text-xs text-[var(--text-secondary)]">{deal.clientName}</p>
        </div>
        {deal.overdueTasks > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium flex-shrink-0 ml-2"
            style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
          >
            <AlertCircle size={12} />
            <span>{deal.overdueTasks}</span>
          </div>
        )}
      </div>

      {/* Mini Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">Progress</span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">{deal.progress}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--border-default)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${deal.progress}%`,
              backgroundColor: '#1A1612',
            }}
          />
        </div>
      </div>

      {/* Footer with Agent and Days */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
            style={{ backgroundColor: '#1A1612' }}
          >
            {deal.assignedAgent.initials}
          </div>
          <span className="text-xs text-[var(--text-secondary)]">{deal.assignedAgent.name}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
          <Clock size={12} />
          <span>{deal.daysInStage}d</span>
        </div>
      </div>
    </div>
  );
}
