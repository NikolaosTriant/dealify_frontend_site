import { useEffect, useState } from 'react';
import { TrendingUp, AlertCircle, Calendar, CheckCircle2, Home, Plus } from 'lucide-react';
import { StatCard } from './StatCard';
import { PipelineFilterBar, PipelineFilter } from './PipelineFilterBar';
import { KanbanColumn } from './KanbanColumn';
import { Deal } from './DealCard';
import {
  ApiBuyerIndication,
  ApiDashboardAnalytics,
  ApiDeal,
  ApiSellerListingAssignment,
  ApiGroup,
  ApiPropertyEngagement,
  ApiProperty,
  createClient,
  createClientGroup,
  getDashboardAnalytics,
  listClients,
  listClientGroups,
  listBuyerIndications,
  listDeals,
  listPropertyEngagement,
  listProperties,
  listSellerListingAssignments,
  updateClient
} from '../api/trustlayerApi';
import { useUiStore } from '../state/uiStore';

type LeadSource = 'Cost Calculator' | 'Public Link' | 'Referral';

interface InterestedViewer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalVisits: number;
  lastSeen: string;
}

interface PropertyLead {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  propertyImage?: string;
  source: LeadSource;
  timestamp: string;
  metrics: {
    views: number;
    saves: number;
    repeatVisitors: number;
    inquiries: number;
  };
  viewers: InterestedViewer[];
}

function mapEngagementToLeads(
  properties: ApiProperty[],
  engagement: ApiPropertyEngagement[]
): PropertyLead[] {
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  return engagement
    .filter((entry) => entry.totalViews > 0 || entry.saves > 0 || entry.inquiries > 0)
    .map((entry, index) => {
      const property = propertyById.get(entry.propertyId);
      const firstVisitor = entry.visitors[0];
      return {
        id: `lead-${entry.propertyId}`,
        propertyId: entry.propertyId,
        propertyTitle: property?.title ?? 'Ακίνητο',
        propertyAddress: property ? `${property.location} • €${Number(property.price).toLocaleString('el-GR')}` : 'Χωρίς στοιχεία',
        propertyImage: property?.photos?.[0],
        source: index % 3 === 0 ? 'Cost Calculator' : index % 3 === 1 ? 'Public Link' : 'Referral',
        timestamp: firstVisitor ? `τελευταία επίσκεψη ${firstVisitor.timeSpent}` : 'χωρίς recent activity',
        metrics: {
          views: entry.totalViews,
          saves: entry.saves,
          repeatVisitors: entry.repeatVisitors,
          inquiries: entry.inquiries,
        },
        viewers: entry.visitors.map((visitor) => ({
          id: `${entry.propertyId}-${visitor.id}`,
          name: visitor.alias,
          email: visitor.email ?? '-',
          phone: visitor.phone ?? '-',
          totalVisits: visitor.visits,
          lastSeen: `συνολικός χρόνος ${visitor.timeSpent}`,
        })),
      };
    })
    .sort((a, b) => b.metrics.views - a.metrics.views);
}

const stages = [
  { id: 'preparation', label: 'Προετοιμασία' },
  { id: 'legal-check', label: 'Νομικός Έλεγχος' },
  { id: 'technical-check', label: 'Τεχνικός Έλεγχος' },
  { id: 'pre-notary', label: 'Προσυμβολαιογραφική' },
  { id: 'signing', label: 'Υπογραφή' },
];

const initialClientGroups: string[] = [];

interface DashboardPageProps {
  onDealClick: (deal: Deal) => void;
}

function mapDealStatusToStage(status: ApiDeal['status']): Deal['stage'] {
  if (status === 'DOCUMENTS_PHASE') return 'preparation';
  if (status === 'PROCESS_PHASE') return 'technical-check';
  if (status === 'SETTLEMENT_PHASE') return 'signing';
  if (status === 'COMPLETED') return 'signing';
  return 'preparation';
}

function mapDealToCard(deal: ApiDeal, propertyById: Map<string, ApiProperty>): Deal {
  const daysInStage = deal.createdAt
    ? Math.max(
      1,
      Math.ceil((Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    )
    : 1;

  const stage = mapDealStatusToStage(deal.status);
  const progressByStage: Record<Deal['stage'], number> = {
    preparation: 25,
    'legal-check': 45,
    'technical-check': 65,
    'pre-notary': 85,
    signing: 100,
  };

  const property = propertyById.get(deal.propertyId);
  const previewImages = property?.photos?.filter(Boolean) ?? [];

  return {
    id: deal.id,
    propertyAddress: deal.propertyTitle,
    propertyReferenceCode: property?.referenceListingCode,
    clientName: deal.clientName,
    previewImages,
    progress: progressByStage[stage],
    assignedAgent: { name: 'Broker', initials: 'BR' },
    daysInStage,
    overdueTasks: 0,
    stage,
  };
}


export function DashboardPage({ onDealClick }: DashboardPageProps) {
  const { showToast } = useUiStore();
  const [activeFilter, setActiveFilter] = useState<PipelineFilter>('all');
  const [clientGroups, setClientGroups] = useState<string[]>(initialClientGroups);
  const [clientGroupsByName, setClientGroupsByName] = useState<Record<string, ApiGroup>>({});
  const [viewerGroupById, setViewerGroupById] = useState<Record<string, string>>({});
  const [openGroupMenuViewerId, setOpenGroupMenuViewerId] = useState<string | null>(null);
  const [newGroupInputViewerId, setNewGroupInputViewerId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedViewer, setSelectedViewer] = useState<InterestedViewer | null>(null);
  const [viewerListProperty, setViewerListProperty] = useState<PropertyLead | null>(null);
  const [backendDeals, setBackendDeals] = useState<Deal[]>([]);
  const [buyerIndications, setBuyerIndications] = useState<ApiBuyerIndication[]>([]);
  const [sellerAssignments, setSellerAssignments] = useState<ApiSellerListingAssignment[]>([]);
  const [backendLeads, setBackendLeads] = useState<PropertyLead[]>([]);
  const [backendAnalytics, setBackendAnalytics] = useState<ApiDashboardAnalytics | null>(null);

  useEffect(() => {
    Promise.all([
      listDeals(),
      getDashboardAnalytics(),
      listClientGroups(),
      listProperties(),
      listPropertyEngagement(),
      listBuyerIndications(),
      listSellerListingAssignments(),
    ])
      .then(([deals, analytics, groups, properties, engagement, indications, assignments]) => {
        const propertyById = new Map(properties.map((property) => [property.id, property]));
        setBackendDeals(deals.map((deal) => mapDealToCard(deal, propertyById)));
        setBackendLeads(mapEngagementToLeads(properties, engagement));
        setBackendAnalytics(analytics);
        setBuyerIndications(indications);
        setSellerAssignments(assignments);
        if (groups.length > 0) {
          setClientGroups(groups.map((group) => group.name));
        }
        setClientGroupsByName(Object.fromEntries(groups.map((group) => [group.name, group])));
      })
      .catch(() => {
        // Keep default empty state when backend is unavailable.
      });
  }, []);

  useEffect(() => {
    const handleDocumentClick = () => {
      setOpenGroupMenuViewerId(null);
      setNewGroupInputViewerId(null);
      setNewGroupName('');
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const loggedInAgentInitials = 'LB';
  const dealsByAgent = backendDeals;

  const activeDeals = dealsByAgent.filter((deal) => deal.stage !== 'signing').length;
  const overdueTasksCount = dealsByAgent.reduce((sum, deal) => sum + deal.overdueTasks, 0);
  const avgDaysToClose =
    dealsByAgent.length > 0
      ? Math.round(dealsByAgent.reduce((sum, deal) => sum + deal.daysInStage, 0) / dealsByAgent.length) + 21
      : 0;
  const completedThisMonth = dealsByAgent.filter((deal) => deal.stage === 'signing').length;
  const activeDealsValue = backendAnalytics ? Number(backendAnalytics.activeDeals) : activeDeals;
  const completedValue = backendAnalytics ? Number(backendAnalytics.completedDeals) : completedThisMonth;
  const avgDaysValue = backendAnalytics ? Number(backendAnalytics.avgDealDays) : avgDaysToClose;

  const filteredDeals = dealsByAgent.filter((deal) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'my-deals') return deal.assignedAgent.initials === loggedInAgentInitials;
    if (activeFilter === 'overdue') return deal.overdueTasks > 0;
    return true;
  });

  const getDealsByStage = (stageId: string) => filteredDeals.filter((deal) => deal.stage === stageId);

  const normalizeContactValue = (value?: string) => {
    if (!value) return undefined;
    const normalized = value.trim();
    if (!normalized || normalized === '-') return undefined;
    return normalized;
  };

  const assignViewerToGroup = async (viewer: InterestedViewer, groupName: string) => {
    const group = clientGroupsByName[groupName];
    if (!group) {
      showToast(`Η ομάδα "${groupName}" δεν βρέθηκε.`, 'warning');
      return;
    }

    try {
      const email = normalizeContactValue(viewer.email);
      const phone = normalizeContactValue(viewer.phone);
      const currentClients = await listClients();
      const existingClient = currentClients.find((client) => {
        const clientEmail = normalizeContactValue(client.email);
        const clientPhone = normalizeContactValue(client.phone);
        if (email && clientEmail && clientEmail.toLowerCase() === email.toLowerCase()) return true;
        if (phone && clientPhone && clientPhone === phone) return true;
        return client.name.trim().toLowerCase() === viewer.name.trim().toLowerCase();
      });

      if (existingClient) {
        const groupIds = new Set<string>((existingClient.groupIds ?? []).map((id) => String(id)));
        groupIds.add(group.id);
        const tags = new Set<string>(existingClient.tags ?? []);
        tags.add(groupName);
        await updateClient(existingClient.id, {
          name: existingClient.name,
          phone: normalizeContactValue(existingClient.phone),
          email: normalizeContactValue(existingClient.email),
          notes: existingClient.notes ?? 'Lead από listing engagement.',
          tags: Array.from(tags),
          groupIds: Array.from(groupIds),
        });
      } else {
        await createClient({
          name: viewer.name,
          phone,
          email,
          notes: 'Lead από listing engagement.',
          tags: [groupName, 'listing-engagement'],
          groupIds: [group.id],
        });
      }
    } catch {
      showToast('Αποτυχία αποθήκευσης lead στο CRM.', 'error');
      return;
    }

    setViewerGroupById((prev) => ({ ...prev, [viewer.id]: groupName }));
    setOpenGroupMenuViewerId(null);
    setNewGroupInputViewerId(null);
    setNewGroupName('');
    showToast(`Ο/Η "${viewer.name}" προστέθηκε στην ομάδα "${groupName}".`, 'success');
  };

  const createAndAssignGroup = async (viewer: InterestedViewer) => {
    const groupName = newGroupName.trim();
    if (!groupName) return;

    if (!clientGroups.includes(groupName)) {
      try {
        const createdGroup = await createClientGroup({ name: groupName, filters: {} });
        const groups = await listClientGroups();
        const nextGroups = groups.length > 0 ? groups : [createdGroup];
        setClientGroups(nextGroups.map((item) => item.name));
        setClientGroupsByName(Object.fromEntries(nextGroups.map((item) => [item.name, item])));
      } catch {
        setClientGroups((prev) => [...prev, groupName]);
        showToast('Η ομάδα δημιουργήθηκε τοπικά αλλά όχι στο backend.', 'warning');
        return;
      }
    }
    await assignViewerToGroup(viewer, groupName);
  };

  const handleNewTransaction = () => {
    window.history.pushState({}, '', '/orders');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="flex-1 bg-[var(--surface-ambient)]">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="mb-2 text-3xl font-semibold text-[var(--text-primary)]">Dashboard Μεσίτη</h1>
              <p className="text-[var(--text-tertiary)]">Συγκεντρωτική εικόνα για deals, εντολές, leads και pipeline εκτέλεσης.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[var(--border-strong)] bg-[var(--surface-glow)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                Μεσίτης
              </span>
              <button
                onClick={handleNewTransaction}
                className="rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-hover)]"
              >
                + Νέα Συναλλαγή
              </button>
            </div>
          </div>
        </div>
        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Ενεργά Deals"
            value={activeDealsValue}
            icon={TrendingUp}
            iconColor="var(--text-tertiary)"
            iconBg="var(--surface-highlight)"
            borderColor="var(--border-default)"
            trend={{ value: '+12% από τον προηγούμενο μήνα', isPositive: true }}
          />
          <StatCard
            title="Καθυστερημένα Tasks"
            value={overdueTasksCount}
            icon={AlertCircle}
            iconColor="var(--text-tertiary)"
            iconBg="var(--surface-highlight)"
            borderColor="var(--border-default)"
            topBorderColor="var(--status-danger)"
          />
          <StatCard
            title="Μ.Ο. Ημερών έως Κλείσιμο"
            value={avgDaysValue}
            icon={Calendar}
            iconColor="var(--text-tertiary)"
            iconBg="var(--surface-highlight)"
            borderColor="var(--border-default)"
            trend={{ value: '5 ημέρες ταχύτερα', isPositive: true }}
          />
          <StatCard
            title="Ολοκληρώθηκαν Αυτόν τον Μήνα"
            value={completedValue}
            icon={CheckCircle2}
            iconColor="var(--text-tertiary)"
            iconBg="var(--surface-highlight)"
            borderColor="var(--border-default)"
            trend={{ value: '+8% αύξηση', isPositive: true }}
          />
        </div>

        <section className="mb-6 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Εντολές</h2>
              <p className="text-sm text-[var(--text-tertiary)]">
                Οι operational ροές για εντολές υπόδειξης και παραχώρησης εκτελούνται πλέον από τη dedicated σελίδα.
              </p>
            </div>
            <button
              onClick={handleNewTransaction}
              className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white"
            >
              Μετάβαση στις Εντολές
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <article className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Εντολές Υπόδειξης</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {buyerIndications.length} συνολικά • {buyerIndications.filter((item) => item.status === 'BROKER_REVIEW').length} προς έλεγχο
                  </p>
                </div>
                <span className="rounded-full bg-[var(--surface-highlight)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                  {buyerIndications.length}
                </span>
              </div>
            </article>
            <article className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Εντολές Παραχώρησης</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {sellerAssignments.length} συνολικά • {sellerAssignments.filter((item) => item.status === 'BROKER_REVIEW').length} προς έλεγχο
                  </p>
                </div>
                <span className="rounded-full bg-[var(--surface-highlight)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                  {sellerAssignments.length}
                </span>
              </div>
            </article>
          </div>
        </section>

        {backendLeads.length > 0 && (
          <section className="mb-6">
            <header className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Νέα Leads</h2>
                <span className="rounded-full bg-[var(--surface-highlight)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                  {backendLeads.length}
                </span>
              </div>
              <button className="text-sm font-semibold text-[var(--text-secondary)] hover:underline">Προβολή όλων</button>
            </header>

            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-3">
                {backendLeads.map((lead) => (
                  <article
                    key={lead.id}
                    className="relative w-[200px] flex-shrink-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3 shadow-sm"
                  >
                    <div className="mb-2 h-24 w-full overflow-hidden rounded-md bg-[var(--surface-highlight)]">
                      {lead.propertyImage ? (
                        <img
                          src={lead.propertyImage}
                          alt={lead.propertyTitle}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--text-tertiary)]">
                          <Home size={20} />
                        </div>
                      )}
                    </div>

                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{lead.propertyTitle}</p>
                    <p className="truncate text-[11px] text-[var(--text-tertiary)]">{lead.propertyAddress}</p>

                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="rounded bg-[var(--surface-ambient)] px-2 py-1 text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{lead.metrics.views}</span> Προβολές
                      </div>
                      <div className="rounded bg-[var(--surface-ambient)] px-2 py-1 text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{lead.metrics.saves}</span> Αποθηκεύσεις
                      </div>
                      <div className="rounded bg-[var(--surface-ambient)] px-2 py-1 text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{lead.metrics.repeatVisitors}</span> Επαναλήψεις
                      </div>
                      <div className="rounded bg-[var(--surface-ambient)] px-2 py-1 text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{lead.metrics.inquiries}</span> Αιτήματα
                      </div>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {lead.viewers.slice(0, 3).map((viewer) => (
                        <button
                          key={viewer.id}
                          onClick={() => setSelectedViewer(viewer)}
                          className="block w-full truncate text-left text-xs font-medium text-[var(--text-secondary)] hover:underline"
                        >
                          {viewer.name}
                        </button>
                      ))}
                    </div>

                    {lead.viewers.length > 3 && (
                      <button
                        className="mt-3 w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]"
                        onClick={() => setViewerListProperty(lead)}
                      >
                        Δες όλη τη λίστα
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Filter Bar */}
        <PipelineFilterBar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onNewTransaction={handleNewTransaction}
          showNewTransactionButton={false}
        />

        {/* Kanban Pipeline */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {stages.map((stage) => {
              const deals = getDealsByStage(stage.id);
              return (
                <KanbanColumn
                  key={stage.id}
                  title={stage.label}
                  deals={deals}
                  count={deals.length}
                  onDealClick={onDealClick}
                />
              );
            })}
          </div>
        </div>
      </div>


      {selectedViewer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-sm rounded-xl bg-[var(--surface-glow)] p-4 shadow-xl">
            <button
              className="absolute right-3 top-3 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              onClick={() => setSelectedViewer(null)}
            >
              ✕
            </button>
            <div className="mb-2 flex items-start justify-between gap-3 pr-7">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedViewer.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{selectedViewer.lastSeen}</p>
              </div>
              <button
                className="rounded-md border border-[var(--border-default)] bg-[var(--surface-glow)] p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenGroupMenuViewerId((prev) => (prev === selectedViewer.id ? null : selectedViewer.id));
                  setNewGroupInputViewerId(null);
                  setNewGroupName('');
                }}
                aria-label="Assign viewer to group"
              >
                <Plus size={16} />
              </button>
            </div>
            {openGroupMenuViewerId === selectedViewer.id && (
              <div className="mb-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-1 shadow-sm">
                <p className="px-2 py-1 text-[11px] font-semibold text-[var(--text-tertiary)]">Ομάδες πελατών</p>
                {clientGroups.map((group) => (
                  <button
                    key={group}
                    className="w-full rounded-md px-2 py-1.5 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]"
                    onClick={() => assignViewerToGroup(selectedViewer, group)}
                  >
                    {group}
                  </button>
                ))}
                <div className="mt-1 border-t border-[var(--border-subtle)] pt-1">
                  {newGroupInputViewerId === selectedViewer.id ? (
                    <div className="space-y-1 px-1 pb-1">
                      <input
                        className="w-full rounded-md border border-[var(--border-default)] px-2 py-1 text-xs outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                        placeholder="Όνομα νέας ομάδας"
                        value={newGroupName}
                        autoFocus
                        onChange={(event) => setNewGroupName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            createAndAssignGroup(selectedViewer);
                          }
                        }}
                      />
                      <button
                        className="w-full rounded-md bg-[var(--brand-primary)] px-2 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                        onClick={() => createAndAssignGroup(selectedViewer)}
                      >
                        Δημιουργία & Ανάθεση
                      </button>
                    </div>
                  ) : (
                    <button
                      className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]"
                      onClick={() => setNewGroupInputViewerId(selectedViewer.id)}
                    >
                      Νέα Ομάδα...
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1 text-xs text-[var(--text-secondary)]">
              <p>Email: {selectedViewer.email}</p>
              <p>Τηλέφωνο: {selectedViewer.phone}</p>
              <p>Συνολικές επισκέψεις: {selectedViewer.totalVisits}</p>
              {viewerGroupById[selectedViewer.id] && (
                <p className="font-semibold text-[var(--text-primary)]">Ομάδα: {viewerGroupById[selectedViewer.id]}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {viewerListProperty && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--surface-glow)] p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Όλοι οι ενδιαφερόμενοι</p>
                <p className="text-xs text-[var(--text-tertiary)]">{viewerListProperty.propertyAddress}</p>
              </div>
              <button
                className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                onClick={() => setViewerListProperty(null)}
              >
                ✕
              </button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {viewerListProperty.viewers.map((viewer) => (
                <button
                  key={viewer.id}
                  onClick={() => {
                    setSelectedViewer(viewer);
                    setViewerListProperty(null);
                  }}
                  className="w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-left hover:bg-[var(--surface-glow-active)]"
                >
                  <p className="text-sm font-medium text-[var(--text-primary)]">{viewer.name}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {viewer.totalVisits} επισκέψεις • {viewer.lastSeen}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
