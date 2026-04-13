import { LoaderCircle, MapPinned, Search } from 'lucide-react';
import { KeyboardEvent, useState } from 'react';
import { ApiGooglePlaceLookupResult, searchGooglePlaces } from '../api/trustlayerApi';

type GooglePlaceLookupPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: ApiGooglePlaceLookupResult) => void;
  onError: (message: string) => void;
  label?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  disabledMessage?: string;
};

export function GooglePlaceLookupPanel({
  value,
  onChange,
  onSelect,
  onError,
  label = 'Google lookup',
  helperText = 'Γράψε διεύθυνση ή κάνε paste full Google Maps URL για να επιλέξεις canonical place.',
  placeholder = 'π.χ. Βούλα Αττικής ή https://www.google.com/maps/...',
  disabled = false,
  disabledMessage,
}: GooglePlaceLookupPanelProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ApiGooglePlaceLookupResult[]>([]);

  const handleSearch = async () => {
    const query = value.trim();
    if (!query) {
      onError('Συμπλήρωσε διεύθυνση ή Google Maps URL για αναζήτηση.');
      return;
    }

    setLoading(true);
    try {
      const nextResults = await searchGooglePlaces(query);
      setResults(nextResults);
    } catch (error) {
      setResults([]);
      onError(error instanceof Error ? error.message : 'Αποτυχία αναζήτησης Google place.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    void handleSearch();
  };

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{helperText}</p>
          {disabled && disabledMessage ? (
            <p className="mt-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-xs font-medium text-[var(--status-warning-text)]">
              {disabledMessage}
            </p>
          ) : null}
        </div>
        <MapPinned size={18} className="mt-0.5 text-[var(--text-tertiary)]" />
      </div>

      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={disabled || loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:opacity-60"
        >
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? 'Αναζήτηση...' : 'Εύρεση'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.map((result) => (
            <button
              key={result.placeId}
              type="button"
              onClick={() => onSelect(result)}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3 text-left transition hover:border-[var(--border-brand)] hover:bg-[var(--surface-highlight)]"
            >
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {result.displayName || result.formattedAddress || result.placeId}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {result.formattedAddress || 'Χωρίς formatted address'}
              </p>
              <p className="mt-2 break-all text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Place ID: {result.placeId}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
