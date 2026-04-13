import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Eye, Heart, Repeat, Search } from 'lucide-react';
import {
  ApiBillingOverview,
  ApiGroup,
  ApiPropertyBlacklistEntry,
  ApiPropertyBlacklistIdentityType,
  ApiProperty,
  ApiPropertyEngagement,
  createPropertyBlacklistEntry,
  createPropertyGroup,
  deletePropertyBlacklistEntry,
  downloadPropertyAuditExport,
  getBillingOverview,
  listPropertyBlacklist,
  listProperties,
  listPropertyEngagement,
  listPropertyGroups,
  updateProperty
} from '../api/trustlayerApi';
import { GooglePlaceLookupPanel } from '../components/GooglePlaceLookupPanel';
import { useUiStore } from '../state/uiStore';

type PropertyType = 'διαμέρισμα' | 'μονοκατοικία' | 'οικόπεδο' | 'επαγγελματικό';
type ListingStatus = 'active' | 'sold' | 'paused';

type Listing = {
  id: string;
  address: string;
  type: PropertyType;
  price: number;
  status: ListingStatus;
  totalViews: number;
  saves: number;
  repeatVisitors: number;
  photo: string;
  viewsOverTime: number[];
  groupTags: string[];
};

type Visitor = {
  id: string;
  alias: string;
  visits: number;
  timeSpent: string;
  alsoViewed: string[];
};

function mapPropertyType(type: string): PropertyType {
  const normalized = type.toLowerCase();
  if (normalized.includes('apartment') || normalized.includes('διαμέρισμα')) return 'διαμέρισμα';
  if (normalized.includes('maisonette') || normalized.includes('μονοκατοικία')) return 'μονοκατοικία';
  if (normalized.includes('office') || normalized.includes('επαγγελμα')) return 'επαγγελματικό';
  return 'οικόπεδο';
}

function mapListingStatus(tags?: string[]): ListingStatus {
  const normalized = (tags ?? []).join(' ').toLowerCase();
  if (
    normalized.includes('sold')
    || normalized.includes('πωλη')
    || normalized.includes('closed')
  ) {
    return 'sold';
  }
  if (
    normalized.includes('paused')
    || normalized.includes('on-hold')
    || normalized.includes('hold')
    || normalized.includes('παυση')
    || normalized.includes('παγω')
  ) {
    return 'paused';
  }
  return 'active';
}

function extractMetricFromTags(tags: string[] | undefined, keys: string[]): number | null {
  if (!tags || tags.length === 0) return null;
  for (const rawTag of tags) {
    const tag = rawTag.toLowerCase().trim();
    for (const key of keys) {
      if (!tag.startsWith(`${key}:`)) continue;
      const numeric = Number(tag.split(':')[1]);
      if (Number.isFinite(numeric) && numeric >= 0) {
        return numeric;
      }
    }
  }
  return null;
}

function fallbackViewsTrend(totalViews: number): number[] {
  if (totalViews <= 0) return [0, 0, 0, 0, 0, 0, 0, 0];
  const weights = [0.06, 0.08, 0.1, 0.11, 0.13, 0.15, 0.17, 0.2];
  const values = weights.map((weight) => Math.max(0, Math.round(totalViews * weight)));
  const diff = totalViews - values.reduce((sum, value) => sum + value, 0);
  values[values.length - 1] += diff;
  return values;
}

function extractGroupTags(tags?: string[]): string[] {
  if (!tags) return [];
  return tags
    .filter((tag) => tag.toLowerCase().startsWith('group:'))
    .map((tag) => tag.substring('group:'.length).trim())
    .filter((group) => group.length > 0);
}

function mapPropertyToListing(property: ApiProperty, engagement?: ApiPropertyEngagement): Listing {
  const fallbackViews = extractMetricFromTags(property.tags, ['views', 'view']);
  const fallbackSaves = extractMetricFromTags(property.tags, ['saves', 'save']);
  const fallbackRepeatVisitors = extractMetricFromTags(property.tags, ['repeat', 'recurring', 'returning']);
  const hasRealEngagement =
    (engagement?.totalViews ?? 0) > 0
    || (engagement?.saves ?? 0) > 0
    || (engagement?.repeatVisitors ?? 0) > 0
    || (engagement?.inquiries ?? 0) > 0
    || (engagement?.visitors?.length ?? 0) > 0;

  const totalViews = hasRealEngagement ? (engagement?.totalViews ?? 0) : (fallbackViews ?? 0);
  const saves = hasRealEngagement ? (engagement?.saves ?? 0) : (fallbackSaves ?? 0);
  const repeatVisitors = hasRealEngagement
    ? (engagement?.repeatVisitors ?? 0)
    : (fallbackRepeatVisitors ?? 0);
  const viewsOverTime = hasRealEngagement
    ? (engagement?.viewsOverTime ?? [0, 0, 0, 0, 0, 0, 0, 0])
    : fallbackViewsTrend(totalViews);

  return {
    id: property.id,
    address: `${property.title} — ${property.location}`,
    type: mapPropertyType(property.type),
    price: property.price,
    status: mapListingStatus(property.tags),
    totalViews,
    saves,
    repeatVisitors,
    photo:
      property.photos?.[0]
      ?? `https://placehold.co/520x320/e9eefb/4F46E5?text=${encodeURIComponent(property.location)}`,
    viewsOverTime,
    groupTags: extractGroupTags(property.tags),
  };
}

function miniChartPath(values: number[]): string {
  if (values.length === 0) return '';

  const max = Math.max(...values);
  const min = Math.min(...values);
  const width = 580;
  const height = 220;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const normalized = max === min ? 0.5 : (value - min) / (max - min);
      const y = height - normalized * (height - 20) - 10;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

const priceRanges = [
  { id: 'all', label: 'Όλες οι τιμές' },
  { id: '0-300000', label: '0 - 300Κ' },
  { id: '300001-500000', label: '300Κ - 500Κ' },
  { id: '500001+', label: '500Κ+' }
] as const;

export function MyListingsPage() {
  const { showToast } = useUiStore();
  const [backendListings, setBackendListings] = useState<Listing[]>([]);
  const [propertiesById, setPropertiesById] = useState<Record<string, ApiProperty>>({});
  const [backendVisitorsByListing, setBackendVisitorsByListing] = useState<Record<string, Visitor[]>>({});
  const [loadingBackend, setLoadingBackend] = useState(true);
  const [propertyGroups, setPropertyGroups] = useState<ApiGroup[]>([]);
  const [propertyBlacklist, setPropertyBlacklist] = useState<ApiPropertyBlacklistEntry[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | PropertyType>('all');
  const [priceFilter, setPriceFilter] = useState<(typeof priceRanges)[number]['id']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ListingStatus>('all');
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [groupToAssign, setGroupToAssign] = useState('');
  const [assigningGroup, setAssigningGroup] = useState(false);
  const [kaek, setKaek] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [placeLookupQuery, setPlaceLookupQuery] = useState('');
  const [referenceListingCode, setReferenceListingCode] = useState('');
  const [listingCodesDraft, setListingCodesDraft] = useState<string[]>([]);
  const [newListingCode, setNewListingCode] = useState('');
  const [savingIdentifiers, setSavingIdentifiers] = useState(false);
  const [blacklistIdentityType, setBlacklistIdentityType] = useState<ApiPropertyBlacklistIdentityType>('INTERNAL_CODE');
  const [blacklistIdentityValue, setBlacklistIdentityValue] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [savingBlacklistEntry, setSavingBlacklistEntry] = useState(false);
  const [removingBlacklistEntryId, setRemovingBlacklistEntryId] = useState<string | null>(null);
  const [exportingAuditFormat, setExportingAuditFormat] = useState<'csv' | 'xlsx' | null>(null);
  const [billingOverview, setBillingOverview] = useState<ApiBillingOverview | null>(null);
  const selectClassName = 'w-full appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 pr-9 text-sm text-[var(--text-secondary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)] cursor-pointer';
  const integrationsLookupLocked = billingOverview ? !billingOverview.integrationsEnabled : false;

  const reloadProperties = () => {
    Promise.all([listProperties(), listPropertyEngagement(), listPropertyBlacklist(), getBillingOverview()])
      .then(([properties, engagement, blacklist, overview]) => {
        const engagementByPropertyId = new Map(engagement.map((item) => [item.propertyId, item]));
        const mapped = properties.map((property) => mapPropertyToListing(property, engagementByPropertyId.get(property.id)));
        setPropertiesById(Object.fromEntries(properties.map((property) => [property.id, property])));
        setPropertyBlacklist(blacklist);
        setBillingOverview(overview);
        if (mapped.length > 0) {
          setBackendListings(mapped);
          setSelectedListingId((current) =>
            current && mapped.some((listing) => listing.id === current) ? current : mapped[0].id
          );
        }

        const visitorsByListing = engagement.reduce<Record<string, Visitor[]>>((acc, item) => {
          acc[item.propertyId] = item.visitors.map((visitor) => ({
            id: visitor.id,
            alias: visitor.alias,
            visits: visitor.visits,
            timeSpent: visitor.timeSpent,
            alsoViewed: visitor.alsoViewed,
          }));
          return acc;
        }, {});
        setBackendVisitorsByListing(visitorsByListing);
      })
      .finally(() => setLoadingBackend(false));
  };

  useEffect(() => {
    reloadProperties();
    listPropertyGroups()
      .then((groups) => setPropertyGroups(groups))
      .catch(() => setPropertyGroups([]));
  }, []);

  const handleCreatePropertyGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      showToast('Δώσε όνομα ομάδας.', 'warning');
      return;
    }
    setCreatingGroup(true);
    try {
      await createPropertyGroup({ name, filters: {} });
      const groups = await listPropertyGroups();
      setPropertyGroups(groups);
      showToast(`Δημιουργήθηκε ομάδα ακινήτων: ${name}`, 'success');
      setGroupModalOpen(false);
      setNewGroupName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Property group creation failed';
      showToast(message, 'error');
    } finally {
      setCreatingGroup(false);
    }
  };

  const filteredListings = useMemo(() => {
    return backendListings.filter((listing) => {
      const matchesSearch = listing.address.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || listing.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || listing.status === statusFilter;
      const matchesPrice =
        priceFilter === 'all' ||
        (priceFilter === '0-300000' && listing.price <= 300000) ||
        (priceFilter === '300001-500000' && listing.price > 300000 && listing.price <= 500000) ||
        (priceFilter === '500001+' && listing.price > 500000);

      return matchesSearch && matchesType && matchesStatus && matchesPrice;
    });
  }, [backendListings, search, typeFilter, priceFilter, statusFilter]);

  const selectedListing =
    filteredListings.find((listing) => listing.id === selectedListingId) ?? filteredListings[0] ?? null;

  const selectedVisitors = selectedListing ? backendVisitorsByListing[selectedListing.id] ?? [] : [];
  const selectedProperty = selectedListing ? propertiesById[selectedListing.id] : undefined;
  const selectedViewsSeriesTotal = selectedListing
    ? selectedListing.viewsOverTime.reduce((sum, value) => sum + value, 0)
    : 0;

  useEffect(() => {
    setKaek(selectedProperty?.kaek ?? '');
    setGooglePlaceId(selectedProperty?.googlePlaceId ?? '');
    setLatitude(selectedProperty?.latitude != null ? String(selectedProperty.latitude) : '');
    setLongitude(selectedProperty?.longitude != null ? String(selectedProperty.longitude) : '');
    setGoogleMapsUrl(selectedProperty?.googleMapsUrl ?? '');
    setPlaceLookupQuery(selectedProperty?.googleMapsUrl ?? selectedProperty?.location ?? '');
    setReferenceListingCode(selectedProperty?.referenceListingCode ?? '');
    setListingCodesDraft(selectedProperty?.listingCodes ?? []);
    setNewListingCode('');
  }, [selectedProperty?.id, selectedProperty?.kaek, selectedProperty?.googlePlaceId, selectedProperty?.latitude, selectedProperty?.longitude, selectedProperty?.googleMapsUrl, selectedProperty?.referenceListingCode, selectedProperty?.listingCodes]);

  const handleAssignPropertyToGroup = async () => {
    if (!selectedProperty) return;
    const groupName = groupToAssign.trim();
    if (!groupName) {
      showToast('Επέλεξε ομάδα ακινήτων.', 'warning');
      return;
    }

    setAssigningGroup(true);
    try {
      const tags = new Set(selectedProperty.tags ?? []);
      tags.add(`group:${groupName}`);
      await updateProperty(selectedProperty.id, {
        title: selectedProperty.title,
        location: selectedProperty.location,
        price: Number(selectedProperty.price),
        type: selectedProperty.type,
        listingUrl: selectedProperty.listingUrl,
        kaek: selectedProperty.kaek,
        googlePlaceId: selectedProperty.googlePlaceId,
        latitude: selectedProperty.latitude,
        longitude: selectedProperty.longitude,
        googleMapsUrl: selectedProperty.googleMapsUrl,
        referenceListingCode: selectedProperty.referenceListingCode,
        listingCodes: selectedProperty.listingCodes,
        description: selectedProperty.description,
        photos: selectedProperty.photos,
        tags: Array.from(tags),
        sellerClientId: selectedProperty.sellerClientId,
      });
      await reloadProperties();
      showToast(`Το ακίνητο προστέθηκε στην ομάδα "${groupName}".`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία προσθήκης ακινήτου σε ομάδα.';
      showToast(message, 'error');
    } finally {
      setAssigningGroup(false);
    }
  };

  const handleSaveIdentifiers = async () => {
    if (!selectedProperty) return;
    if (!kaek.trim() && !googlePlaceId.trim() && listingCodesDraft.length === 0) {
      showToast('Χρειάζεται τουλάχιστον ένα στοιχείο ταυτοποίησης: KAEK, Google Place ID ή internal ID, ακόμα και παλιός active κωδικός.', 'warning');
      return;
    }
    setSavingIdentifiers(true);
    try {
      await updateProperty(selectedProperty.id, {
        title: selectedProperty.title,
        location: selectedProperty.location,
        price: Number(selectedProperty.price),
        type: selectedProperty.type,
        listingUrl: selectedProperty.listingUrl,
        kaek: kaek.trim() || undefined,
        googlePlaceId: googlePlaceId.trim() || undefined,
        latitude: latitude.trim() ? Number(latitude) : undefined,
        longitude: longitude.trim() ? Number(longitude) : undefined,
        googleMapsUrl: googleMapsUrl.trim() || undefined,
        referenceListingCode: referenceListingCode.trim() || undefined,
        listingCodes: listingCodesDraft,
        description: selectedProperty.description,
        photos: selectedProperty.photos,
        tags: selectedProperty.tags,
        sellerClientId: selectedProperty.sellerClientId,
      });
      await reloadProperties();
      showToast('Οι κωδικοί listing ενημερώθηκαν.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία ενημέρωσης των κωδικών listing.';
      showToast(message, 'error');
    } finally {
      setSavingIdentifiers(false);
    }
  };

  const handleAddListingCode = () => {
    const code = newListingCode.trim();
    if (!code) {
      showToast('Συμπληρώστε έναν κωδικό listing.', 'warning');
      return;
    }
    if (listingCodesDraft.some((entry) => entry.toLowerCase() === code.toLowerCase())) {
      showToast('Ο κωδικός υπάρχει ήδη στη λίστα.', 'warning');
      return;
    }
    setListingCodesDraft((prev) => [...prev, code]);
    setReferenceListingCode((prev) => prev || code);
    setNewListingCode('');
  };

  const handleRemoveListingCode = (code: string) => {
    const nextCodes = listingCodesDraft.filter((entry) => entry !== code);
    setListingCodesDraft(nextCodes);
    if (referenceListingCode === code) {
      setReferenceListingCode(nextCodes[0] ?? '');
    }
  };

  const handleCreateBlacklistEntry = async (
    identityType = blacklistIdentityType,
    identityValue = blacklistIdentityValue,
    reason = blacklistReason,
  ) => {
    const normalizedValue = identityValue.trim();
    if (!normalizedValue) {
      showToast('Συμπληρώστε identity value για blacklist.', 'warning');
      return;
    }
    setSavingBlacklistEntry(true);
    try {
      await createPropertyBlacklistEntry({
        identityType,
        identityValue: normalizedValue,
        reason: reason.trim() || undefined,
      });
      await reloadProperties();
      setBlacklistIdentityValue('');
      setBlacklistReason('');
      showToast('Η blacklist εγγραφή αποθηκεύτηκε.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία αποθήκευσης blacklist εγγραφής.';
      showToast(message, 'error');
    } finally {
      setSavingBlacklistEntry(false);
    }
  };

  const handleDeleteBlacklistEntry = async (id: string) => {
    setRemovingBlacklistEntryId(id);
    try {
      await deletePropertyBlacklistEntry(id);
      await reloadProperties();
      showToast('Η blacklist εγγραφή αφαιρέθηκε.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία αφαίρεσης blacklist εγγραφής.';
      showToast(message, 'error');
    } finally {
      setRemovingBlacklistEntryId(null);
    }
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportListingAudit = async (format: 'csv' | 'xlsx') => {
    if (!selectedProperty) return;
    setExportingAuditFormat(format);
    try {
      const blob = await downloadPropertyAuditExport(selectedProperty.id, format);
      const safeRef = selectedProperty.referenceListingCode?.trim() || selectedProperty.id;
      triggerBlobDownload(blob, `listing-audit-${safeRef}.${format}`);
      showToast(`Το listing audit εξήχθη σε ${format.toUpperCase()}.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Αποτυχία εξαγωγής listing audit.';
      showToast(message, 'error');
    } finally {
      setExportingAuditFormat(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[var(--surface-ambient)]">
      <header className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-4 text-[var(--text-primary)] dark:bg-[var(--surface-darkness)] dark:text-[var(--text-on-dark)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Ακίνητα & Συμπεριφορά Ενδιαφερόμενων</h1>
            <p className="text-sm text-[var(--text-secondary)] dark:text-[var(--text-on-dark-muted)]">
              {loadingBackend ? 'Σύνδεση με backend...' : 'Live εικόνα για ενδιαφέρον, groups και identity controls των ακινήτων σου.'}
            </p>
          </div>
          <div>
            <button
              onClick={() => {
                window.history.pushState({}, '', '/orders');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-highlight)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)] disabled:opacity-60 dark:border-white/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
            >
              Μετάβαση στις Εντολές
            </button>
            <button
              onClick={() => setGroupModalOpen(true)}
              className="ml-2 rounded-md border border-[var(--border-strong)] bg-[var(--surface-highlight)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)] dark:border-white/10 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
            >
              + Νέα Ομάδα
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--text-secondary)] dark:text-[var(--text-on-dark-muted)]">
          Η δημιουργία νέου ακινήτου γίνεται πλέον μέσω εντολής παραχώρησης από τον ιδιοκτήτη και όχι μέσω import αρχείου.
        </p>
      </header>

      {propertyGroups.length > 0 && (
        <div className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-2">
          <div className="flex flex-wrap gap-2">
            {propertyGroups.map((group) => (
              <span
                key={group.id}
                className="rounded-full bg-[var(--surface-highlight)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]"
              >
                {group.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
            <input
              className="w-full rounded-lg border border-[var(--border-default)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
              placeholder="Αναζήτηση διεύθυνσης"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="relative">
            <select
              className={selectClassName}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'all' | PropertyType)}
            >
              <option value="all">Όλοι οι τύποι</option>
              <option value="διαμέρισμα">Διαμέρισμα</option>
              <option value="μονοκατοικία">Μονοκατοικία</option>
              <option value="οικόπεδο">Οικόπεδο</option>
              <option value="επαγγελματικό">Επαγγελματικό</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          </label>

          <label className="relative">
            <select
              className={selectClassName}
              value={priceFilter}
              onChange={(event) =>
                setPriceFilter(event.target.value as (typeof priceRanges)[number]['id'])
              }
            >
              {priceRanges.map((range) => (
                <option key={range.id} value={range.id}>
                  {range.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          </label>

          <label className="relative">
            <select
              className={selectClassName}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | ListingStatus)}
            >
              <option value="all">Όλα τα status</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="paused">Paused</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          </label>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[360px_1fr]">
        <aside className="overflow-y-auto border-r border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
          <div className="space-y-3">
            {filteredListings.map((listing) => {
              const isSelected = listing.id === selectedListing?.id;
              const highActivity = listing.repeatVisitors >= 25;

              return (
                <button
                  key={listing.id}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? 'border-[var(--border-brand)] bg-[rgba(232,112,10,0.05)] shadow-sm'
                      : 'border-[var(--border-default)] bg-[var(--surface-glow)] hover:border-[var(--border-brand)]/40'
                  }`}
                  onClick={() => setSelectedListingId(listing.id)}
                >
                  <img
                    src={listing.photo}
                    alt={listing.address}
                    className="mb-3 h-28 w-full rounded-lg object-cover"
                  />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{listing.address}</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {listing.type} • €{listing.price.toLocaleString('el-GR')}
                  </p>
                  {propertiesById[listing.id]?.referenceListingCode && (
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                      Ref ID: {propertiesById[listing.id]?.referenceListingCode}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-[var(--surface-ambient)] p-2 text-[var(--text-secondary)]">
                      <p className="font-semibold text-[var(--text-primary)]">{listing.totalViews}</p>
                      <p>Προβολές</p>
                    </div>
                    <div className="rounded-md bg-[var(--surface-ambient)] p-2 text-[var(--text-secondary)]">
                      <p className="font-semibold text-[var(--text-primary)]">{listing.saves}</p>
                      <p>Αποθηκεύσεις</p>
                    </div>
                    <div className="rounded-md bg-[var(--surface-ambient)] p-2 text-[var(--text-secondary)]">
                      <p className="font-semibold text-[var(--text-primary)]">{listing.repeatVisitors}</p>
                      <p>Επαναλήψεις</p>
                    </div>
                  </div>

                  {highActivity && (
                    <span className="mt-3 inline-flex rounded-full border border-[#FCD34D] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-semibold text-[#D97706]">
                      High Value Interest
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-6">
          {!selectedListing ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-glow)] p-12 text-center text-[var(--text-tertiary)]">
              Δεν βρέθηκαν listings με τα τρέχοντα φίλτρα.
            </div>
          ) : (
            <div className="space-y-5">
              <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Προβολές Ανά Ημέρα</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">{selectedListing.address}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-3 py-1 text-xs font-semibold text-[#16A34A]">
                    <Eye size={13} /> {selectedViewsSeriesTotal} προβολές / 8ημ
                  </span>
                </div>

                <svg viewBox="0 0 580 220" className="h-56 w-full rounded-lg bg-[var(--surface-ambient)] p-2">
                  <path
                    d={miniChartPath(selectedListing.viewsOverTime)}
                    fill="none"
                    stroke="var(--brand-primary)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </article>

              <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Property Blacklist</h3>
                    <p className="text-sm text-[var(--text-tertiary)]">Ξεχωριστό ban layer για identities που δεν πρέπει να ξαναμπουν στο σύστημα, ακόμα κι αν δεν υπάρχει πλέον property record.</p>
                  </div>
                  <span className="rounded-full bg-[var(--surface-highlight)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {propertyBlacklist.length} entries
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Identity type</span>
                    <select
                      value={blacklistIdentityType}
                      onChange={(event) => setBlacklistIdentityType(event.target.value as ApiPropertyBlacklistIdentityType)}
                      className={selectClassName}
                    >
                      <option value="INTERNAL_CODE">Internal code</option>
                      <option value="KAEK">KAEK</option>
                      <option value="GOOGLE_PLACE_ID">Google Place ID</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Identity value</span>
                    <input
                      value={blacklistIdentityValue}
                      onChange={(event) => setBlacklistIdentityValue(event.target.value)}
                      placeholder="π.χ. BAN-100 ή ChIJ..."
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Reason</span>
                    <input
                      value={blacklistReason}
                      onChange={(event) => setBlacklistReason(event.target.value)}
                      placeholder="π.χ. off-market, duplicate source, banned parcel"
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreateBlacklistEntry()}
                    disabled={savingBlacklistEntry}
                    className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                  >
                    {savingBlacklistEntry ? 'Αποθήκευση...' : 'Προσθήκη στο Blacklist'}
                  </button>
                  {kaek && (
                    <button
                      type="button"
                      onClick={() => void handleCreateBlacklistEntry('KAEK', kaek, blacklistReason)}
                      disabled={savingBlacklistEntry}
                      className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:opacity-60"
                    >
                      Ban selected KAEK
                    </button>
                  )}
                  {googlePlaceId && (
                    <button
                      type="button"
                      onClick={() => void handleCreateBlacklistEntry('GOOGLE_PLACE_ID', googlePlaceId, blacklistReason)}
                      disabled={savingBlacklistEntry}
                      className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:opacity-60"
                    >
                      Ban selected Place ID
                    </button>
                  )}
                  {listingCodesDraft.map((code) => (
                    <button
                      key={`ban-${code}`}
                      type="button"
                      onClick={() => void handleCreateBlacklistEntry('INTERNAL_CODE', code, blacklistReason)}
                      disabled={savingBlacklistEntry}
                      className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:opacity-60"
                    >
                      Ban {code}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {propertyBlacklist.length === 0 && (
                    <p className="text-sm text-[var(--text-tertiary)]">Δεν υπάρχουν blacklist entries.</p>
                  )}
                  {propertyBlacklist.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{entry.identityValue}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{entry.identityType}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{entry.reason || 'Χωρίς reason'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBlacklistEntry(entry.id)}
                        disabled={removingBlacklistEntryId === entry.id}
                        className="rounded-lg border border-[var(--status-danger-border)] px-3 py-2 text-sm font-semibold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] disabled:opacity-60"
                      >
                        {removingBlacklistEntryId === entry.id ? 'Αφαίρεση...' : 'Remove ban'}
                      </button>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Πρόσφατοι Επισκέπτες</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleExportListingAudit('csv')}
                      disabled={!selectedProperty || exportingAuditFormat !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-highlight)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)] disabled:opacity-60"
                    >
                      <Download size={12} />
                      {exportingAuditFormat === 'csv' ? 'CSV...' : 'CSV'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleExportListingAudit('xlsx')}
                      disabled={!selectedProperty || exportingAuditFormat !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-highlight)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)] disabled:opacity-60"
                    >
                      <Download size={12} />
                      {exportingAuditFormat === 'xlsx' ? 'Excel...' : 'Excel'}
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {selectedVisitors.map((visitor) => (
                    <div key={visitor.id} className="rounded-xl border border-[var(--border-default)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{visitor.alias}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {visitor.visits} επισκέψεις • {visitor.timeSpent} μέσος χρόνος
                          </p>
                        </div>
                        <button
                          className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-glow)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]"
                          onClick={() =>
                            alert(`${visitor.alias} προστέθηκε στα Leads από το ${selectedListing.address}`)
                          }
                        >
                          Προσθήκη στα Leads
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Είδε επίσης: <span className="font-medium">{visitor.alsoViewed.join(', ')}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Ομάδες Ακινήτου</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedListing.groupTags.length === 0 && (
                    <span className="text-sm text-[var(--text-tertiary)]">Δεν έχει προστεθεί σε ομάδα.</span>
                  )}
                  {selectedListing.groupTags.map((group) => (
                    <span
                      key={`${selectedListing.id}-${group}`}
                      className="rounded-full bg-[var(--surface-highlight)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                    >
                      {group}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <label className="relative w-full">
                    <select
                      value={groupToAssign}
                      onChange={(event) => setGroupToAssign(event.target.value)}
                      className={selectClassName}
                    >
                      <option value="">Επιλογή ομάδας</option>
                      {propertyGroups.map((group) => (
                        <option key={group.id} value={group.name}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                  </label>
                  <button
                    onClick={() => void handleAssignPropertyToGroup()}
                    disabled={assigningGroup || !selectedProperty}
                    className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                  >
                    {assigningGroup ? 'Προσθήκη...' : 'Προσθήκη στην Ομάδα'}
                  </button>
                </div>
              </article>

              <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Ταυτοποίηση Ακινήτου</h3>
                    <p className="text-sm text-[var(--text-tertiary)]">Για αποφυγή διπλοτύπου το οικόπεδο πρέπει να έχει τουλάχιστον ένα από: KAEK, Google Place ID ή internal property ID, ακόμη και παλιό active code.</p>
                  </div>
                  {(selectedProperty?.kaek || selectedProperty?.googlePlaceId || (selectedProperty?.listingCodes?.length ?? 0) > 0) && (
                    <span className="rounded-full bg-[var(--surface-highlight)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      identity set
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <GooglePlaceLookupPanel
                      value={placeLookupQuery}
                      onChange={setPlaceLookupQuery}
                      onError={(message) => showToast(message, 'error')}
                      onSelect={(place) => {
                        setGooglePlaceId(place.placeId ?? '');
                        setGoogleMapsUrl(place.googleMapsUrl ?? '');
                        setLatitude(place.latitude != null ? String(place.latitude) : '');
                        setLongitude(place.longitude != null ? String(place.longitude) : '');
                        setPlaceLookupQuery(place.formattedAddress ?? place.displayName ?? place.googleMapsUrl ?? '');
                        showToast('Το Google place επιλέχθηκε και συμπλήρωσε τα identity πεδία.', 'success');
                      }}
                      label="Google place search"
                      disabled={integrationsLookupLocked}
                      disabledMessage="Το Google Places lookup ανήκει στο Integrations plan και παραμένει Coming soon στο initial launch."
                    />
                  </div>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">KAEK</span>
                    <input
                      value={kaek}
                      onChange={(event) => setKaek(event.target.value)}
                      placeholder="π.χ. 050123456789/0/0"
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Google Place ID</span>
                    <input
                      value={googlePlaceId}
                      onChange={(event) => setGooglePlaceId(event.target.value)}
                      placeholder="π.χ. ChIJ..."
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Google Maps URL</span>
                    <input
                      value={googleMapsUrl}
                      onChange={(event) => setGoogleMapsUrl(event.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Latitude</span>
                    <input
                      value={latitude}
                      onChange={(event) => setLatitude(event.target.value)}
                      placeholder="π.χ. 37.8623456"
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Longitude</span>
                    <input
                      value={longitude}
                      onChange={(event) => setLongitude(event.target.value)}
                      placeholder="π.χ. 23.7567890"
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Active internal property ID</span>
                    <select
                      value={referenceListingCode}
                      onChange={(event) => setReferenceListingCode(event.target.value)}
                      className={selectClassName}
                    >
                      <option value="">Επιλέξτε active κωδικό</option>
                      {listingCodesDraft.map((code) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Νέος internal κωδικός</span>
                    <div className="flex gap-2">
                      <input
                        value={newListingCode}
                        onChange={(event) => setNewListingCode(event.target.value)}
                        placeholder="π.χ. RMX-48291"
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                      />
                      <button
                        type="button"
                        onClick={handleAddListingCode}
                        className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                      >
                        Προσθήκη
                      </button>
                    </div>
                  </label>
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                  <div className="mb-3 grid gap-2 md:grid-cols-3">
                    <div className="rounded-lg bg-[var(--surface-glow)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">KAEK</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{kaek || '-'}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-glow)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">Google Place ID</p>
                      <p className="mt-1 break-all text-sm font-semibold text-[var(--text-primary)]">{googlePlaceId || '-'}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-glow)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">Google Maps</p>
                      <p className="mt-1 break-all text-sm font-semibold text-[var(--text-primary)]">{googleMapsUrl || '-'}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-glow)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">Coordinates</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{latitude && longitude ? `${latitude}, ${longitude}` : '-'}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--surface-glow)] p-3">
                      <p className="text-xs text-[var(--text-tertiary)]">Active internal ID</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{referenceListingCode || '-'}</p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">Όλοι οι κωδικοί του ακινήτου</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {listingCodesDraft.length === 0 && (
                      <span className="text-sm text-[var(--text-tertiary)]">Δεν έχουν οριστεί ακόμα κωδικοί listing.</span>
                    )}
                    {listingCodesDraft.map((code) => (
                      <span
                        key={code}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          code === referenceListingCode
                            ? 'bg-[var(--surface-highlight)] text-[var(--text-primary)]'
                            : 'bg-[var(--surface-glow-active)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {code}
                        {code === referenceListingCode && <span className="uppercase tracking-[0.18em] text-[10px]">active</span>}
                        <button
                          type="button"
                          onClick={() => handleRemoveListingCode(code)}
                          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => void handleSaveIdentifiers()}
                    disabled={savingIdentifiers || !selectedProperty}
                    className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                  >
                    {savingIdentifiers ? 'Αποθήκευση...' : 'Αποθήκευση κωδικών'}
                  </button>
                </div>
              </article>

              <article className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                  <p className="text-xs text-[var(--text-tertiary)]">Σύνολο προβολών</p>
                  <p className="mt-1 flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
                    <Eye size={18} className="text-[var(--text-secondary)]" />
                    {selectedListing.totalViews}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                  <p className="text-xs text-[var(--text-tertiary)]">Αποθηκεύσεις</p>
                  <p className="mt-1 flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
                    <Heart size={18} className="text-[var(--text-secondary)]" />
                    {selectedListing.saves}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                  <p className="text-xs text-[var(--text-tertiary)]">Επαναλαμβανόμενοι επισκέπτες</p>
                  <p className="mt-1 flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
                    <Repeat size={18} className="text-[#991B1B]" />
                    {selectedListing.repeatVisitors}
                  </p>
                </div>
              </article>
            </div>
          )}
        </section>
      </div>

      {groupModalOpen && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              if (creatingGroup) return;
              setGroupModalOpen(false);
            }}
          />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Νέα Ομάδα Ακινήτων</h3>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Δώσε ένα όνομα για τη νέα ομάδα.</p>
            <input
              autoFocus
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleCreatePropertyGroup();
                }
              }}
              placeholder="π.χ. Νότια Προάστια 250-400K"
              className="mt-4 w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setGroupModalOpen(false)}
                disabled={creatingGroup}
                className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:opacity-60"
              >
                Ακύρωση
              </button>
              <button
                onClick={() => void handleCreatePropertyGroup()}
                disabled={creatingGroup}
                className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
              >
                {creatingGroup ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
