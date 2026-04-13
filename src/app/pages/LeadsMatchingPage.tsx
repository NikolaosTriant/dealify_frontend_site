import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Download, GripVertical, Plus } from 'lucide-react';
import {
  ApiClient,
  ApiGroup,
  ApiImportError,
  ApiMatchProperty,
  createClient,
  createClientGroup,
  importClientsCsv,
  listClientGroups,
  listClients,
  listPropertyGroups,
  matchProperties,
  sendMatchSuggestions,
  updateClient,
} from '../api/trustlayerApi';
import { useUiStore } from '../state/uiStore';

type LeadValue = 'High' | 'Medium' | 'Low';
type LeadSource = 'Facebook Ads' | 'Spitogatos' | 'XE' | 'Public Link' | 'Referral';

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source?: LeadSource | null;
  value: LeadValue;
  offer?: number | null;
  priority: boolean;
  buyerUsesLoan: boolean;
  associatedPropertyCode?: string | null;
  group: string;
  criteria: {
    location: string;
    budgetMin: number;
    budgetMax: number;
    propertyType: 'διαμέρισμα' | 'μονοκατοικία' | 'επαγγελματικό';
  };
};

type LeadSort = 'default' | 'offer-desc' | 'offer-asc';

type PropertyGroup = {
  id: string;
  name: string;
  location: string;
  budgetMin: number;
  budgetMax: number;
  propertyType: 'διαμέρισμα' | 'μονοκατοικία' | 'επαγγελματικό';
  listings: number;
};

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

function pickLeadSource(tags?: string[]): LeadSource | null {
  const joined = (tags ?? []).join(' ').toLowerCase();
  if (joined.includes('ref') || joined.includes('παραπομπ')) return 'Referral';
  if (joined.includes('public')) return 'Public Link';
  return null;
}

function normalizeLeadSource(client: ApiClient): LeadSource | null {
  const raw = (client.leadSource ?? client.leadMetadata?.source ?? client.leadMetadata?.platform ?? '').toString();
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return pickLeadSource(client.tags);
  if (normalized.includes('meta') || normalized.includes('facebook')) return 'Facebook Ads';
  if (normalized.includes('spitogatos')) return 'Spitogatos';
  if (normalized.includes('xe')) return 'XE';
  return pickLeadSource(client.tags);
}

function pickLeadValue(tags?: string[]): LeadValue {
  const joined = (tags ?? []).join(' ').toLowerCase();
  if (joined.includes('high')) return 'High';
  if (joined.includes('low') || joined.includes('budget')) return 'Low';
  return 'Medium';
}

function parseLeadOffer(client: ApiClient): number | null {
  const rawValue = client.leadMetadata?.offer
    ?? client.leadMetadata?.offer_amount
    ?? client.leadMetadata?.price_offer
    ?? '';
  if (!rawValue) {
    return null;
  }
  const normalized = rawValue.replace(/[^\d,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseAssociatedPropertyCode(client: ApiClient): string | null {
  const meta = client.leadMetadata ?? {};
  return meta.associated_property_reference_code
    ?? meta.property_code
    ?? meta.reference_listing_code
    ?? meta.internal_property_id
    ?? null;
}

function parseAssociatedPropertyLocation(client: ApiClient): string | null {
  const meta = client.leadMetadata ?? {};
  return meta.associated_property_location
    ?? meta.property_location
    ?? meta.listing_location
    ?? meta.location
    ?? null;
}

function parseAssociatedPropertyType(client: ApiClient): string | null {
  const meta = client.leadMetadata ?? {};
  return meta.associated_property_type
    ?? meta.property_type
    ?? meta.listing_type
    ?? meta.type
    ?? null;
}

function parseAssociatedPropertyPrice(client: ApiClient): number | null {
  const meta = client.leadMetadata ?? {};
  const rawValue = meta.associated_property_price
    ?? meta.property_price
    ?? meta.listing_price
    ?? meta.price
    ?? '';
  if (!rawValue) {
    return null;
  }
  const normalized = rawValue.replace(/[^\d,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isPriorityLead(client: ApiClient, offer: number | null): boolean {
  const tags = (client.tags ?? []).map((tag) => tag.trim().toLowerCase());
  if (tags.includes('priority') || tags.includes('prio') || tags.includes('urgent')) {
    return true;
  }
  return offer != null;
}

function usesBuyerLoan(client: ApiClient): boolean {
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

function sellerRejectsLoan(tags?: string[]): boolean {
  return (tags ?? []).some((tag) => {
    const normalized = tag.trim().toLowerCase();
    return normalized.includes('seller_no_loan')
      || normalized.includes('no-loan')
      || normalized.includes('no loan')
      || normalized.includes('χωρις δανει')
      || normalized.includes('οχι δανει')
      || normalized.includes('no mortgage');
  });
}

function propertyPenaltyForLead(property: ApiMatchProperty, lead: Lead | null): number {
  if (!lead) {
    return 0;
  }
  return lead.buyerUsesLoan && sellerRejectsLoan(property.tags) ? 35 : 0;
}

function mapClientToLead(client: ApiClient, clientGroupNameById: Record<string, string>): Lead {
  const tagText = (client.tags ?? []).join(' ').toLowerCase();
  const capturedPropertyType = (parseAssociatedPropertyType(client) ?? '').toLowerCase();
  let propertyType: Lead['criteria']['propertyType'] = 'διαμέρισμα';
  if (capturedPropertyType.includes('μονοκατοικ') || capturedPropertyType.includes('maisonette')) {
    propertyType = 'μονοκατοικία';
  } else if (capturedPropertyType.includes('επαγγελμα')) {
    propertyType = 'επαγγελματικό';
  } else if (capturedPropertyType.includes('διαμερ') || capturedPropertyType.includes('apartment')) {
    propertyType = 'διαμέρισμα';
  } else if (tagText.includes('μονοκατοικ') || tagText.includes('maisonette')) {
    propertyType = 'μονοκατοικία';
  } else if (tagText.includes('επαγγελμα')) {
    propertyType = 'επαγγελματικό';
  }

  const locationTag = (client.tags ?? []).find((tag) => {
    const normalized = tag.toLowerCase();
    return !normalized.includes('high')
      && !normalized.includes('low')
      && !normalized.includes('value')
      && !normalized.includes('budget')
      && !normalized.includes('status:')
      && !normalized.includes('new')
      && !normalized.includes('group');
  });
  const notes = client.notes ?? '';
  const offer = parseLeadOffer(client);
  const associatedPropertyCode = parseAssociatedPropertyCode(client);
  const associatedPropertyLocation = parseAssociatedPropertyLocation(client);
  const associatedPropertyPrice = parseAssociatedPropertyPrice(client);
  const budgetMatch = notes.match(/(\d{2,3})\s*[-–]\s*(\d{2,3})\s*k/i);
  const fallbackBudgetMin = pickLeadValue(client.tags) === 'High' ? 250000 : 140000;
  const fallbackBudgetMax = pickLeadValue(client.tags) === 'High' ? 600000 : 350000;
  const budgetMin = offer != null
    ? offer
    : budgetMatch
      ? Number(budgetMatch[1]) * 1000
      : associatedPropertyPrice != null
        ? Math.round(associatedPropertyPrice * 0.9)
        : fallbackBudgetMin;
  const budgetMax = associatedPropertyPrice != null
    ? Math.max(associatedPropertyPrice, offer ?? 0)
    : budgetMatch
      ? Number(budgetMatch[2]) * 1000
      : fallbackBudgetMax;
  const location = associatedPropertyLocation
    ?? locationTag
    ?? (notes.includes('Γλυφ') ? 'Γλυφάδα' : notes.includes('Βούλα') ? 'Βούλα' : 'Νότια Προάστια');

  const firstGroupId = client.groupIds?.[0] ? String(client.groupIds[0]) : undefined;
  const groupFromMembership = firstGroupId ? clientGroupNameById[firstGroupId] : undefined;
  const fallbackGroup = pickLeadValue(client.tags) === 'High' ? 'High Value' : 'Νέα Εισερχόμενα';

  return {
    id: client.id,
    name: client.name,
    email: client.email ?? `${client.id.slice(0, 6)}@example.com`,
    phone: client.phone ?? '+30 690 000 0000',
    source: normalizeLeadSource(client),
    value: pickLeadValue(client.tags),
    offer,
    priority: isPriorityLead(client, offer),
    buyerUsesLoan: usesBuyerLoan(client),
    associatedPropertyCode,
    group: groupFromMembership ?? fallbackGroup,
    criteria: {
      location,
      budgetMin,
      budgetMax,
      propertyType,
    },
  };
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

function valueTagClasses(value: LeadValue): string {
  if (value === 'High') {
    return 'border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]';
  }
  if (value === 'Medium') {
    return 'border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]';
  }
  return 'border border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]';
}

function calculateMatchScore(lead: Lead, group: PropertyGroup): number {
  let score = 0;

  if (lead.criteria.location === group.location) score += 40;
  if (lead.criteria.propertyType === group.propertyType) score += 30;

  const overlapMin = Math.max(lead.criteria.budgetMin, group.budgetMin);
  const overlapMax = Math.min(lead.criteria.budgetMax, group.budgetMax);
  const hasBudgetOverlap = overlapMax >= overlapMin;

  if (hasBudgetOverlap) {
    const overlapRange = overlapMax - overlapMin;
    const leadRange = lead.criteria.budgetMax - lead.criteria.budgetMin || 1;
    score += Math.min(30, Math.round((overlapRange / leadRange) * 30));
  }

  return Math.max(0, Math.min(100, score));
}

export function LeadsMatchingPage() {
  const { showToast } = useUiStore();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clientsById, setClientsById] = useState<Record<string, ApiClient>>({});
  const [clientGroupsByName, setClientGroupsByName] = useState<Record<string, ApiGroup>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | LeadSource | 'none'>('all');
  const [valueFilter, setValueFilter] = useState<'all' | LeadValue>('all');
  const [sortBy, setSortBy] = useState<LeadSort>('default');
  const [backendReady, setBackendReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<ApiImportError[]>([]);
  const [showImportErrors, setShowImportErrors] = useState(true);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [propertyGroups, setPropertyGroups] = useState<PropertyGroup[]>([]);
  const [liveMatches, setLiveMatches] = useState<ApiMatchProperty[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    listingUrl: '',
    propertyCode: '',
    offer: '',
    buyerLoan: false,
  });
  const fieldClassName = 'w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]';
  const secondaryButtonClassName = 'inline-flex items-center gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--surface-glow)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)] disabled:cursor-not-allowed disabled:opacity-60';
  const primaryButtonClassName = 'inline-flex items-center gap-2 rounded-md bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60';
  const modalCardClassName = 'absolute left-1/2 top-1/2 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)]';

  const mapApiPropertyGroup = (group: ApiGroup): PropertyGroup => {
    const filters = group.filters ?? {};
    const location = typeof filters.location === 'string' ? filters.location : 'Νότια Προάστια';
    const budgetMin = typeof filters.minPrice === 'number' ? filters.minPrice : 180000;
    const budgetMax = typeof filters.maxPrice === 'number' ? filters.maxPrice : 450000;
    const filterType = typeof filters.type === 'string' ? filters.type : '';
    const propertyType: PropertyGroup['propertyType'] =
      filterType === 'μονοκατοικία' || filterType === 'επαγγελματικό'
        ? filterType
        : 'διαμέρισμα';
    return {
      id: group.id,
      name: group.name,
      location,
      budgetMin,
      budgetMax,
      propertyType,
      listings: 8,
    };
  };

  const reloadGroups = () => {
    listPropertyGroups()
      .then((propertyGroupsApi) => {
        if (propertyGroupsApi.length > 0) {
          setPropertyGroups(propertyGroupsApi.map(mapApiPropertyGroup));
        }
      })
      .catch(() => {
        setPropertyGroups([]);
      });
  };

  const reloadClients = (preserveSelection = true) => {
    Promise.all([listClients(), listClientGroups()])
      .then(([clients, clientGroups]) => {
        const groupMap = Object.fromEntries(clientGroups.map((group) => [group.id, group.name]));
        const groupsByName = Object.fromEntries(clientGroups.map((group) => [group.name, group]));
        const mapped = clients.map((client) => mapClientToLead(client, groupMap));
        setLeads(mapped);
        setClientsById(Object.fromEntries(clients.map((client) => [client.id, client])));
        setGroupOptions(clientGroups.map((group) => group.name));
        setClientGroupsByName(groupsByName);
        setBackendReady(true);

        if (mapped.length === 0) {
          setSelectedLeadId(null);
          return;
        }
        if (!preserveSelection) {
          setSelectedLeadId(mapped[0].id);
          return;
        }
        setSelectedLeadId((current) => (current && mapped.some((lead) => lead.id === current) ? current : mapped[0].id));
      })
      .catch(() => setBackendReady(false));
  };

  useEffect(() => {
    reloadClients(false);
    reloadGroups();
  }, []);

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await importClientsCsv(file);
      reloadClients(false);
      showToast(
        `Import done: ${result.importedRows}/${result.totalRows} rows. Failed: ${result.failedRows}.`
      , 'success');
      setImportErrors(result.errors ?? []);
      setShowImportErrors(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV import failed';
      showToast(message, 'error');
      setImportErrors([]);
      setShowImportErrors(false);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;

  const filteredLeads = useMemo(() => {
    const filtered = leads.filter((lead) => {
      const matchesGroup = groupFilter === 'all' || lead.group === groupFilter;
      const matchesSource =
        sourceFilter === 'all'
        || (sourceFilter === 'none' ? !lead.source : lead.source === sourceFilter);
      const matchesValue = valueFilter === 'all' || lead.value === valueFilter;
      return matchesGroup && matchesSource && matchesValue;
    });
    if (sortBy === 'offer-desc') {
      return [...filtered].sort((a, b) => (b.offer ?? -1) - (a.offer ?? -1));
    }
    if (sortBy === 'offer-asc') {
      return [...filtered].sort((a, b) => {
        if (a.offer == null && b.offer == null) return 0;
        if (a.offer == null) return 1;
        if (b.offer == null) return -1;
        return a.offer - b.offer;
      });
    }
    return filtered;
  }, [leads, groupFilter, sourceFilter, valueFilter, sortBy]);

  const rankedPropertyGroups = useMemo(() => {
    if (!selectedLead) {
      return propertyGroups.map((group) => ({ group, score: 0 }));
    }

    return propertyGroups
      .map((group) => ({ group, score: calculateMatchScore(selectedLead, group) }))
      .sort((a, b) => b.score - a.score);
  }, [selectedLead, propertyGroups]);

  useEffect(() => {
    if (!selectedLead) {
      setLiveMatches([]);
      return;
    }
    setLoadingMatches(true);
    matchProperties({
      location: selectedLead.criteria.location,
      minPrice: selectedLead.criteria.budgetMin,
      maxPrice: selectedLead.criteria.budgetMax,
      type: selectedLead.criteria.propertyType,
    })
      .then((matches) => setLiveMatches(
        [...matches].sort((a, b) => propertyPenaltyForLead(a, selectedLead) - propertyPenaltyForLead(b, selectedLead)),
      ))
      .catch(() => setLiveMatches([]))
      .finally(() => setLoadingMatches(false));
  }, [selectedLead]);

  const handleDropToGroup = async (groupName: string) => {
    if (!draggingLeadId) return;
    const targetGroup = clientGroupsByName[groupName];
    const client = clientsById[draggingLeadId];
    if (!targetGroup || !client) {
      showToast('Αποτυχία μεταφοράς lead σε group.', 'error');
      setDraggingLeadId(null);
      return;
    }

    try {
      const tags = new Set(client.tags ?? []);
      tags.add(groupName);
      await updateClient(client.id, {
        name: client.name,
        email: client.email,
        phone: client.phone,
        notes: client.notes,
        tags: Array.from(tags),
        groupIds: [targetGroup.id],
      });
      setLeads((prev) => prev.map((lead) => (lead.id === draggingLeadId ? { ...lead, group: groupName } : lead)));
      showToast(`Ο lead "${client.name}" μεταφέρθηκε στο group "${groupName}".`, 'success');
    } catch {
      showToast('Αποτυχία αποθήκευσης αλλαγής group.', 'error');
    }
    setDraggingLeadId(null);
  };

  const handleSendSuggestions = async () => {
    if (!selectedLead) {
      alert('Επίλεξε lead για αποστολή προτάσεων.');
      return;
    }

    if (!backendReady) {
      alert('Το backend δεν είναι διαθέσιμο. Δοκιμάστε ξανά.');
      return;
    }
    try {
      const dispatched = await sendMatchSuggestions(selectedLead.id, {
        location: selectedLead.criteria.location,
        minPrice: selectedLead.criteria.budgetMin,
        maxPrice: selectedLead.criteria.budgetMax,
        type: selectedLead.criteria.propertyType,
      });
      showToast(`Στάλθηκαν ${dispatched.matchedCount} προτάσεις στο ${dispatched.recipientEmail}.`, 'success');
    } catch {
      showToast('Αποτυχία αποστολής προτάσεων email.', 'error');
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      showToast('Δώσε όνομα νέου group.', 'warning');
      return;
    }
    setCreatingGroup(true);
    try {
      await createClientGroup({ name, filters: {} });
      reloadClients();
      showToast(`Δημιουργήθηκε νέο group: ${name}`, 'success');
      setGroupModalOpen(false);
      setNewGroupName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Group creation failed';
      showToast(message, 'error');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.name.trim()) {
      showToast('Το όνομα πελάτη είναι υποχρεωτικό.', 'warning');
      return;
    }
    if (!newClient.listingUrl.trim()) {
      showToast('Το URL ακινήτου είναι υποχρεωτικό για lead.', 'warning');
      return;
    }
    setCreatingClient(true);
    try {
      await createClient({
        name: newClient.name.trim(),
        email: newClient.email.trim() || undefined,
        phone: newClient.phone.trim() || undefined,
        notes: newClient.notes.trim() || undefined,
        tags: [
          'new-lead',
          ...(newClient.offer.trim() ? ['priority'] : []),
          ...(newClient.buyerLoan ? ['buyer_loan'] : []),
        ],
        leadSource: 'Manual',
        leadMetadata: {
          listing_url: newClient.listingUrl.trim(),
          ...(newClient.propertyCode.trim() ? { property_code: newClient.propertyCode.trim() } : {}),
          ...(newClient.offer.trim() ? { offer: newClient.offer.trim() } : {}),
          ...(newClient.buyerLoan ? { buyer_loan: 'true', offer_case: 'loan' } : {}),
        },
      });
      reloadClients(false);
      setNewClientModalOpen(false);
      setNewClient({ name: '', email: '', phone: '', notes: '', listingUrl: '', propertyCode: '', offer: '', buyerLoan: false });
      showToast(`Δημιουργήθηκε νέος πελάτης: ${newClient.name.trim()}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Client creation failed';
      showToast(message, 'error');
    } finally {
      setCreatingClient(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[var(--surface-ambient)]">
      <header className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-4 text-[var(--text-primary)] dark:bg-[var(--surface-darkness)] dark:text-[var(--text-on-dark)]">
        <h1 className="text-xl font-semibold">Πελάτες & Matching</h1>
        <p className="text-sm text-[var(--text-secondary)] dark:text-[var(--text-on-dark-muted)]">Οργάνωσε leads, offers και matching προτάσεις με βάση το πραγματικό inventory σου.</p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1.1fr_1fr]">
        <section className="min-h-0 overflow-y-auto border-r border-[var(--border-default)] bg-[var(--surface-glow)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Υποψήφιοι Πελάτες</h2>
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleImportChange}
              />
              <button
                className={secondaryButtonClassName}
                onClick={handleImportClick}
                disabled={importing}
              >
                {importing ? 'Importing...' : 'Import CSV/XLSX'}
              </button>
              <button
                className={secondaryButtonClassName}
                onClick={downloadLeadImportTemplate}
                type="button"
              >
                <Download size={14} /> Template
              </button>
              <button
                className={primaryButtonClassName}
                onClick={() => setNewClientModalOpen(true)}
              >
                <Plus size={14} /> Νέος Πελάτης
              </button>
              <button
                className={secondaryButtonClassName}
                onClick={() => setGroupModalOpen(true)}
              >
                + Νέο Group
              </button>
            </div>
          </div>
          {showImportErrors && importErrors.length > 0 && (
            <div className="mb-4 rounded-2xl border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 p-4 text-sm text-[var(--text-primary)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Αποτυχίες εισαγωγής</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Κάποιες γραμμές δεν εισήχθησαν.
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                {importErrors.slice(0, 5).map((error) => (
                  <li key={`${error.rowNumber}-${error.message}`} className="flex gap-2">
                    <span className="rounded-full bg-[var(--surface-ambient)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-primary)]">
                      Row {error.rowNumber}
                    </span>
                    <span>{resolveImportErrorLabel(error)}</span>
                  </li>
                ))}
                {importErrors.length > 5 && (
                  <li className="text-[11px] text-[var(--text-tertiary)]">
                    + {importErrors.length - 5} ακόμη σφάλματα
                  </li>
                )}
              </ul>
            </div>
          )}
          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4">
            <select
              className={fieldClassName}
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
            >
              <option value="all">Όλα τα groups</option>
              {groupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>

            <select
              className={fieldClassName}
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as 'all' | LeadSource | 'none')}
            >
              <option value="all">Όλες οι πηγές</option>
              <option value="none">Χωρίς προέλευση</option>
              <option value="Facebook Ads">Facebook Ads</option>
              <option value="Spitogatos">Spitogatos</option>
              <option value="XE">XE</option>
              <option value="Public Link">Public Link</option>
              <option value="Referral">Referral</option>
            </select>

            <select
              className={fieldClassName}
              value={valueFilter}
              onChange={(event) => setValueFilter(event.target.value as 'all' | LeadValue)}
            >
              <option value="all">Όλα τα Value Tags</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select
              className={fieldClassName}
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as LeadSort)}
            >
              <option value="default">Default sort</option>
              <option value="offer-desc">Offer: υψηλότερο πρώτο</option>
              <option value="offer-asc">Offer: χαμηλότερο πρώτο</option>
            </select>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {groupOptions.map((group) => (
              <button
                key={group}
                className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-ambient)] px-2 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-brand)] hover:bg-[var(--surface-glow)]"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => handleDropToGroup(group)}
              >
                {group}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredLeads.map((lead) => {
              const isSelected = selectedLead?.id === lead.id;

              return (
                <article
                  key={lead.id}
                  draggable
                  onDragStart={() => setDraggingLeadId(lead.id)}
                  onDragEnd={() => setDraggingLeadId(null)}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`cursor-pointer rounded-2xl border p-3 transition ${
                    isSelected
                      ? 'border-[var(--border-brand)] bg-[rgba(232,112,10,0.04)] shadow-[0_10px_24px_rgba(232,112,10,0.08)]'
                      : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-glow)]'
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{lead.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{lead.email}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{lead.phone}</p>
                    </div>
                    <GripVertical className="text-[var(--text-tertiary)]" size={16} />
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {lead.source && (
                      <span className="rounded-full bg-[var(--surface-ambient)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{lead.source}</span>
                    )}
                    {lead.priority && (
                      <span className="rounded-full border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-danger-text)]">
                        Priority
                      </span>
                    )}
                    {lead.buyerUsesLoan && (
                      <span className="rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-warning-text)]">
                        Με δάνειο
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${valueTagClasses(lead.value)}`}>
                      {lead.value}
                    </span>
                    <span className="rounded-full bg-[var(--surface-ambient)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                      Offer {formatCurrencyAmount(lead.offer)}
                    </span>
                    {lead.associatedPropertyCode && (
                      <span className="rounded-full bg-[var(--surface-ambient)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                        Ref {lead.associatedPropertyCode}
                      </span>
                    )}
                    <span className="rounded-full bg-[var(--surface-highlight)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{lead.group}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Live Matching Ακινήτων</h2>
            <p className="text-sm text-[var(--text-tertiary)]">
              {selectedLead
                ? `Matching για ${selectedLead.name}`
                : 'Επίλεξε lead για να εμφανιστούν match scores'}
            </p>
          </div>

          <div className="space-y-3">
            {loadingMatches && (
              <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 text-sm text-[var(--text-tertiary)]">
                Υπολογισμός προτάσεων...
              </article>
            )}
            {!loadingMatches && liveMatches.length === 0 && (
              <article className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-glow)] p-4 text-sm text-[var(--text-tertiary)]">
                Δεν βρέθηκαν ακίνητα με τα τρέχοντα κριτήρια.
              </article>
            )}
            {!loadingMatches && liveMatches.map((property) => (
              <article
                key={property.id}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 transition hover:border-[var(--border-strong)]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{property.title}</h3>
                  {selectedLead?.buyerUsesLoan && sellerRejectsLoan(property.tags) ? (
                    <span className="rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-warning-text)]">
                      Loan mismatch
                    </span>
                  ) : (
                    <span className="rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--status-success-text)]">
                      Match
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {property.location} • €{Number(property.price).toLocaleString('el-GR')} • {property.type}
                </p>
                {selectedLead?.buyerUsesLoan && sellerRejectsLoan(property.tags) && (
                  <p className="mt-2 text-xs font-medium text-[var(--status-warning-text)]">
                    Ο αγοραστής είναι case δανείου, αλλά ο πωλητής έχει δηλώσει ότι δεν δέχεται πώληση με δάνειο. Το listing πέφτει χαμηλότερα σε σχέση με άλλα.
                  </p>
                )}
              </article>
            ))}
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Ομάδες Ακινήτων (CRM)</h3>
            <div className="space-y-2">
              {rankedPropertyGroups.map(({ group, score }) => (
                <article key={group.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-primary)]">{group.name}</span>
                    <span className="text-xs font-semibold text-[var(--text-tertiary)]">{score}% group fit</span>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {group.location} • €{group.budgetMin.toLocaleString('el-GR')} - €
                    {group.budgetMax.toLocaleString('el-GR')} • {group.propertyType}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="sticky bottom-0 border-t border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-secondary)]">
            {selectedLead ? `Επιλεγμένο lead: ${selectedLead.name}` : 'Δεν έχει επιλεγεί lead'}
          </p>
          <button
            className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)]"
            onClick={handleSendSuggestions}
          >
            Αποστολή Προτάσεων
          </button>
        </div>
      </footer>

      {groupModalOpen && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/30" onClick={() => !creatingGroup && setGroupModalOpen(false)} />
          <div className={`${modalCardClassName} max-w-md`}>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Νέο Client Group</h3>
            <input
              autoFocus
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleCreateGroup();
                }
              }}
              placeholder="π.χ. High Value South"
              className={`mt-3 ${fieldClassName}`}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setGroupModalOpen(false)}
                disabled={creatingGroup}
                className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)] disabled:opacity-60"
              >
                Ακύρωση
              </button>
              <button
                onClick={() => void handleCreateGroup()}
                disabled={creatingGroup}
                className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
              >
                {creatingGroup ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}

      {newClientModalOpen && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/30" onClick={() => !creatingClient && setNewClientModalOpen(false)} />
          <div className={modalCardClassName}>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Νέος Πελάτης</h3>
            <div className="mt-3 grid gap-3">
              <input
                value={newClient.name}
                onChange={(event) => setNewClient((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ονοματεπώνυμο"
                className={fieldClassName}
              />
              <input
                value={newClient.email}
                onChange={(event) => setNewClient((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email"
                className={fieldClassName}
              />
              <input
                value={newClient.phone}
                onChange={(event) => setNewClient((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Τηλέφωνο"
                className={fieldClassName}
              />
              <input
                value={newClient.listingUrl}
                onChange={(event) => setNewClient((prev) => ({ ...prev, listingUrl: event.target.value }))}
                placeholder="URL Ακινήτου (υποχρεωτικό για lead)"
                className={fieldClassName}
              />
              <input
                value={newClient.propertyCode}
                onChange={(event) => setNewClient((prev) => ({ ...prev, propertyCode: event.target.value }))}
                placeholder="Κωδικός ακινήτου"
                className={fieldClassName}
              />
              <input
                value={newClient.offer}
                onChange={(event) => setNewClient((prev) => ({ ...prev, offer: event.target.value }))}
                placeholder="Offer"
                className={fieldClassName}
              />
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={newClient.buyerLoan}
                  onChange={(event) => setNewClient((prev) => ({ ...prev, buyerLoan: event.target.checked }))}
                />
                Offer case δανείου
              </label>
              <textarea
                value={newClient.notes}
                onChange={(event) => setNewClient((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Σημειώσεις"
                rows={3}
                className={fieldClassName}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setNewClientModalOpen(false)}
                disabled={creatingClient}
                className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)] disabled:opacity-60"
              >
                Ακύρωση
              </button>
              <button
                onClick={() => void handleCreateClient()}
                disabled={creatingClient}
                className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
              >
                {creatingClient ? 'Αποθήκευση...' : 'Δημιουργία'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
