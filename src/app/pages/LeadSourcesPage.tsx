import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Filter, Search, TrendingUp, Upload } from 'lucide-react';
import { importClientsCsv, listClients, type ApiClient, type ApiImportError } from '../api/trustlayerApi';
import { useUiStore } from '../state/uiStore';

type LeadSort = 'default' | 'offer-desc' | 'offer-asc';

function resolveLeadSource(client: ApiClient) {
  return (
    client.leadSource
    ?? client.leadMetadata?.source
    ?? client.leadMetadata?.platform
    ?? 'Άγνωστο'
  );
}

function resolveMetaField(client: ApiClient, key: string) {
  const meta = client.leadMetadata ?? {};
  return meta[key] ?? '';
}

const importErrorLabels: Record<string, string> = {
  MISSING_NAME: 'Λείπει το όνομα πελάτη',
  INVALID_GROUP_IDS: 'Μη έγκυρα group ids',
  DUPLICATE_LEAD: 'Ήδη υπάρχει αυτό το lead',
  MISSING_LISTING_URL: 'Λείπει το URL ακινήτου',
  INVALID_LISTING_URL: 'Μη έγκυρο URL ακινήτου',
  INVALID_ROW: 'Μη έγκυρη γραμμή',
};

function resolveImportErrorLabel(error: ApiImportError) {
  if (error.code && importErrorLabels[error.code]) {
    return importErrorLabels[error.code];
  }
  return error.message;
}

function resolveListingUrl(client: ApiClient) {
  return (
    client.leadMetadata?.listing_url
    ?? client.leadMetadata?.listing
    ?? client.leadMetadata?.property_url
    ?? ''
  );
}

function resolveOffer(client: ApiClient) {
  const raw = client.leadMetadata?.offer
    ?? client.leadMetadata?.offer_amount
    ?? client.leadMetadata?.price_offer
    ?? '';
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isPriorityLead(client: ApiClient) {
  const tags = (client.tags ?? []).map((tag) => tag.trim().toLowerCase());
  return tags.includes('priority') || tags.includes('prio') || tags.includes('urgent') || resolveOffer(client) != null;
}

function usesBuyerLoan(client: ApiClient) {
  const meta = client.leadMetadata ?? {};
  const raw = [
    meta.buyer_loan,
    meta.offer_case,
    meta.offer_case_loan,
    meta.finance_case,
    meta.financing,
  ]
    .find((value) => value != null && value !== '')
    ?.toString()
    .trim()
    .toLowerCase();
  if (raw) {
    if (['true', 'yes', 'loan', 'mortgage', 'στεγαστικο', 'δανειο', 'με δανειο'].includes(raw)) {
      return true;
    }
    if (['false', 'no', 'cash', 'χωρις δανειο'].includes(raw)) {
      return false;
    }
  }
  const tags = (client.tags ?? []).map((tag) => tag.trim().toLowerCase());
  return tags.some((tag) => tag.includes('loan') || tag.includes('mortgage') || tag.includes('δανει'));
}

function formatCurrencyAmount(value: number | null | undefined) {
  if (value == null) {
    return '—';
  }
  return `€${value.toLocaleString('el-GR')}`;
}

function downloadLeadImportTemplate() {
  const templateRows = [
    ['name', 'email', 'phone', 'lead_source', 'listing_url', 'property_code', 'offer', 'buyer_loan', 'campaign', 'adset', 'form', 'notes'],
    ['Μαρία Κωνσταντίνου', 'maria@example.com', '6912345678', 'Spitogatos', 'https://example.com/listing/123', 'SPT-1001', '285000', 'true', 'South Campaign', 'Luxury Buyers', 'Lead Form A', 'Βούλα 3ος, σοβαρό ενδιαφέρον'],
  ];
  const csv = templateRows.map((row) => row.map((value) => `"${value}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'lead-import-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function isLead(client: ApiClient) {
  return Boolean(resolveListingUrl(client));
}

export function LeadSourcesPage() {
  const { showToast } = useUiStore();
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<LeadSort>('default');
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<ApiImportError[]>([]);
  const [showImportErrors, setShowImportErrors] = useState(true);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLoading(true);
    listClients()
      .then((data) => setClients(data))
      .catch(() => showToast('Αποτυχία φόρτωσης πελατών.', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const leadClients = useMemo(() => clients.filter(isLead), [clients]);

  const sourceStats = useMemo(() => {
    const map = new Map<string, ApiClient[]>();
    leadClients.forEach((client) => {
      const source = resolveLeadSource(client);
      const list = map.get(source) ?? [];
      list.push(client);
      map.set(source, list);
    });
    return Array.from(map.entries()).map(([source, items]) => ({
      source,
      count: items.length,
      items,
    })).sort((a, b) => b.count - a.count);
  }, [leadClients]);

  const topSource = sourceStats[0]?.source ?? '—';
  const totalLeads = leadClients.length;
  const uniqueSources = sourceStats.length;

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = leadClients.filter((client) => {
      const source = resolveLeadSource(client);
      if (sourceFilter !== 'all' && source !== sourceFilter) return false;
      if (!normalized) return true;
      return [
        client.name,
        client.email,
        client.phone,
        source,
        resolveMetaField(client, 'offer'),
        resolveMetaField(client, 'buyer_loan'),
        resolveMetaField(client, 'campaign'),
        resolveMetaField(client, 'adset'),
        resolveMetaField(client, 'form'),
        resolveListingUrl(client),
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized));
    });
    if (sortBy === 'offer-desc') {
      return [...filtered].sort((a, b) => (resolveOffer(b) ?? -1) - (resolveOffer(a) ?? -1));
    }
    if (sortBy === 'offer-asc') {
      return [...filtered].sort((a, b) => {
        const offerA = resolveOffer(a);
        const offerB = resolveOffer(b);
        if (offerA == null && offerB == null) return 0;
        if (offerA == null) return 1;
        if (offerB == null) return -1;
        return offerA - offerB;
      });
    }
    return filtered;
  }, [leadClients, query, sourceFilter, sortBy]);

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importClientsCsv(file, { leadOnly: true });
      showToast(
        `Import done: ${result.importedRows}/${result.totalRows}. Failed: ${result.failedRows}.`,
        result.failedRows > 0 ? 'warning' : 'success',
      );
      setImportErrors(result.errors ?? []);
      setShowImportErrors(true);
      const refreshed = await listClients();
      setClients(refreshed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      showToast(message, 'error');
      setImportErrors([]);
      setShowImportErrors(false);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] px-8 pb-12 pt-8">
      <div className="mb-8 rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">CRM</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">Πηγές Leads</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Παρακολούθησε από πού έρχονται οι επαφές σου και ποια κανάλια αποδίδουν καλύτερα.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              <TrendingUp size={16} />
              Top source: <span className="font-semibold text-[var(--text-primary)]">{topSource}</span>
            </div>
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-glow-active)] disabled:opacity-60"
            >
              <Upload size={16} />
              {importing ? 'Importing…' : 'Import Leads (CSV/XLSX)'}
            </button>
            <button
              onClick={downloadLeadImportTemplate}
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-glow-active)]"
            >
              <Download size={16} />
              Template
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Συνολικά Leads</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{totalLeads}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Διαφορετικές Πηγές</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{uniqueSources}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Ενεργή Φίλτρα</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {sourceFilter === 'all' ? 'Όλες οι πηγές' : sourceFilter}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {query ? `Query: ${query}` : 'Χωρίς αναζήτηση'}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Filter size={16} /> Φίλτρα
          </div>
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Πηγή
            </label>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-secondary)] outline-none"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option value="all">Όλες</option>
              {sourceStats.map((source) => (
                <option key={source.source} value={source.source}>
                  {source.source} ({source.count})
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Αναζήτηση
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2">
              <Search size={16} className="text-[var(--text-tertiary)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Όνομα, email, campaign..."
                className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
              Ταξινόμηση
            </label>
            <select
              className="mt-2 w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-secondary)] outline-none"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as LeadSort)}
            >
              <option value="default">Default sort</option>
              <option value="offer-desc">Offer: υψηλότερο πρώτο</option>
              <option value="offer-asc">Offer: χαμηλότερο πρώτο</option>
            </select>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Σύνοψη Πηγών</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Τα πιο ενεργά κανάλια ανά αριθμό leads.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {sourceStats.map((source) => (
              <div
                key={source.source}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4"
              >
                <p className="text-sm font-semibold text-[var(--text-primary)]">{source.source}</p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">{source.count} leads</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showImportErrors && importErrors.length > 0 && (
        <div className="mb-6 rounded-3xl border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 p-5 text-sm text-[var(--text-primary)] shadow-[0_12px_30px_rgba(248,113,113,0.12)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Αποτυχίες εισαγωγής</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Δες γιατί κάποιες γραμμές δεν εισήχθησαν.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-[var(--text-tertiary)]">{importErrors.length} σφάλματα</div>
              <button
                type="button"
                onClick={() => setShowImportErrors(false)}
                className="rounded-full border border-[var(--border-default)] bg-[var(--surface-ambient)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
            {importErrors.slice(0, 6).map((error) => (
              <li key={`${error.rowNumber}-${error.message}`} className="flex gap-2">
                <span className="rounded-full bg-[var(--surface-ambient)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-primary)]">
                  Row {error.rowNumber}
                </span>
                <span>{resolveImportErrorLabel(error)}</span>
              </li>
            ))}
            {importErrors.length > 6 && (
              <li className="text-[11px] text-[var(--text-tertiary)]">
                + {importErrors.length - 6} ακόμη σφάλματα
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Leads Από Πηγές</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Εμφανίζει τους πελάτες με τα διαθέσιμα metadata της πηγής.
            </p>
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {loading ? 'Φόρτωση...' : `${filteredClients.length} results`}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] text-left text-xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                <th className="pb-3">Πελάτης</th>
                <th className="pb-3">Πηγή</th>
                <th className="pb-3">Campaign</th>
                <th className="pb-3">Adset</th>
                <th className="pb-3">Form</th>
                <th className="pb-3">Listing</th>
                <th className="pb-3">Offer</th>
                <th className="pb-3">Loan</th>
                <th className="pb-3">Priority</th>
                <th className="pb-3">Μήνυμα</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id} className="border-b border-[var(--border-default)] text-[var(--text-secondary)]">
                  <td className="py-3">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{client.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{client.email ?? client.phone ?? '—'}</div>
                  </td>
                  <td className="py-3 text-sm font-medium text-[var(--text-primary)]">
                    {resolveLeadSource(client)}
                  </td>
                  <td className="py-3 text-xs">{resolveMetaField(client, 'campaign') || '—'}</td>
                  <td className="py-3 text-xs">{resolveMetaField(client, 'adset') || '—'}</td>
                  <td className="py-3 text-xs">{resolveMetaField(client, 'form') || '—'}</td>
                  <td className="py-3 text-xs">
                    {resolveListingUrl(client) ? (
                      <a
                        href={resolveListingUrl(client)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[var(--text-link)] transition hover:text-[var(--text-link-hover)]"
                      >
                        Προβολή
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 text-xs font-semibold text-[var(--text-primary)]">{formatCurrencyAmount(resolveOffer(client))}</td>
                  <td className="py-3 text-xs">
                    {usesBuyerLoan(client) ? (
                      <span className="rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-warning-text)]">
                        Με δάνειο
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 text-xs">
                    {isPriorityLead(client) ? (
                      <span className="rounded-full border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-danger-text)]">
                        Priority
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 text-xs">{resolveMetaField(client, 'message') || '—'}</td>
                </tr>
              ))}
              {!loading && filteredClients.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-sm text-[var(--text-tertiary)]">
                    Δεν υπάρχουν leads για αυτά τα φίλτρα.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
