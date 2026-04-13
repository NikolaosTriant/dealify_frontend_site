import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Lock, Pencil, Sparkles, Trash2 } from 'lucide-react';
import {
  ApiBillingOverview,
  ApiDeal,
  ApiMemberRole,
  ApiMemberTeam,
  ApiMemberTeamSuggestion,
  ApiProfessionalRole,
  ApiProcessTemplateStage,
  ApiTeamMember,
  ApiProcessTemplate,
  ApiProcessTemplateTeamAssignment,
  getBillingOverview,
  createProfessionalRole,
  createMemberTeam,
  createTeamMember,
  deleteProfessionalRole,
  deleteMemberTeam,
  deleteTeamMember,
  listDeals,
  listMemberTeams,
  listProfessionalRoles,
  listTeamMembers,
  listProcessTemplateTeamAssignments,
  listProcessTemplates,
  saveProcessTemplateTeamAssignments,
  suggestMemberTeams,
  updateProfessionalRole,
  updateTeamMember,
  updateMemberTeam
} from '../api/trustlayerApi';
import { useUiStore } from '../state/uiStore';

type ApiPartyRole = 'BUYER' | 'SELLER';
type DraftTeamMember = {
  role: ApiMemberRole;
  professionalRoleId?: string;
  name: string;
  email: string;
  phone: string;
};

type TemplateSlot = {
  role: ApiMemberRole;
  professionalRoleId?: string;
  professionalRoleName?: string;
  partyRole?: ApiPartyRole;
};

const ROLE_OPTIONS: ApiMemberRole[] = ['LAWYER', 'ENGINEER', 'SURVEYOR', 'NOTARY', 'OTHER'];

function roleLabel(role: ApiMemberRole) {
  if (role === 'LAWYER') return 'Δικηγόρος';
  if (role === 'ENGINEER') return 'Μηχανικός';
  if (role === 'SURVEYOR') return 'Τοπογράφος';
  if (role === 'NOTARY') return 'Συμβολαιογράφος';
  return 'Άλλο';
}

function slotKey(slot: TemplateSlot) {
  return `${slot.role}::${slot.professionalRoleId ?? 'LEGACY'}::${slot.partyRole ?? 'ANY'}`;
}

function slotLabel(slot: TemplateSlot) {
  const base = slot.professionalRoleName || roleLabel(slot.role);
  if (slot.partyRole === 'SELLER') return `${base} Πωλητή`;
  if (slot.partyRole === 'BUYER') return `${base} Αγοραστή`;
  return `${base} · Κοινό`;
}

function memberMatchesSlot(member: ApiTeamMember, slot: TemplateSlot) {
  if (member.role !== slot.role) return false;
  if (slot.professionalRoleId) {
    return member.professionalRoleId === slot.professionalRoleId;
  }
  return true;
}

function parseCoverageAreas(input: string) {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function professionalRoleOptionsForLegacy(
  professionalRoles: ApiProfessionalRole[],
  role: ApiMemberRole,
) {
  return professionalRoles.filter((item) => item.legacyMemberRole === role);
}

function extractTemplateSlots(template?: ApiProcessTemplate | null): TemplateSlot[] {
  if (!template) return [];
  const slots = new Map<string, TemplateSlot>();
  template.stages.forEach((stage: ApiProcessTemplateStage) => {
    const slot = {
      role: stage.role,
      professionalRoleId: stage.professionalRoleId,
      professionalRoleName: stage.professionalRoleName,
      partyRole: stage.partyRole,
    };
    slots.set(slotKey(slot), slot);
  });
  return Array.from(slots.values());
}

export function BrokerMemberTeamsPage() {
  const { showToast } = useUiStore();
  const [billingOverview, setBillingOverview] = useState<ApiBillingOverview | null>(null);
  const [deals, setDeals] = useState<ApiDeal[]>([]);
  const [selectedDealId, setSelectedDealId] = useState('');
  const [teams, setTeams] = useState<ApiMemberTeam[]>([]);
  const [teamDirectoryMembers, setTeamDirectoryMembers] = useState<ApiTeamMember[]>([]);
  const [professionalRoles, setProfessionalRoles] = useState<ApiProfessionalRole[]>([]);
  const [processTemplates, setProcessTemplates] = useState<ApiProcessTemplate[]>([]);
  const [selectedProcessTemplateId, setSelectedProcessTemplateId] = useState('');
  const [assignmentRows, setAssignmentRows] = useState<ApiProcessTemplateTeamAssignment[]>([]);
  const [selectedTemplateTeamId, setSelectedTemplateTeamId] = useState('');
  const [roleSelectionPopup, setRoleSelectionPopup] = useState<{
    teamId: string;
    slotCandidates: Record<string, ApiTeamMember[]>;
    selectedMemberBySlot: Record<string, string>;
  } | null>(null);

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCoverage, setNewTeamCoverage] = useState('');
  const [newTeamMembers, setNewTeamMembers] = useState<DraftTeamMember[]>([
    { role: 'LAWYER', professionalRoleId: undefined, name: '', email: '', phone: '' },
  ]);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [newProfessionalRole, setNewProfessionalRole] = useState({
    code: '',
    label: '',
    legacyMemberRole: 'OTHER' as ApiMemberRole,
  });
  const [aiSuggestionLocation, setAiSuggestionLocation] = useState('');
  const [aiSuggestionLoading, setAiSuggestionLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ApiMemberTeamSuggestion[]>([]);

  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);
  const [focusedTeamEditing, setFocusedTeamEditing] = useState(false);
  const [focusedTeamNameDraft, setFocusedTeamNameDraft] = useState('');
  const [focusedTeamCoverageDraft, setFocusedTeamCoverageDraft] = useState('');
  const [focusedAssignRole, setFocusedAssignRole] = useState<ApiMemberRole>('LAWYER');
  const [focusedUnassignedMemberId, setFocusedUnassignedMemberId] = useState('');

  const [form, setForm] = useState({
    teamId: '',
    role: 'LAWYER' as ApiMemberRole,
    professionalRoleId: '',
    name: '',
    email: '',
    phone: '',
  });
  const [registryFilters, setRegistryFilters] = useState({
    search: '',
    role: 'all',
    teamId: 'all',
  });
  const [sectionOpen, setSectionOpen] = useState({
    teams: true,
    templateAssignments: true,
    registry: true,
  });
  const pageSurfaceClass = 'rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-soft)]';
  const nestedSurfaceClass = 'rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4';
  const softCardClass = 'rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-glow)] p-4';
  const inputClass = 'w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]';
  const selectClass = `${inputClass} appearance-none pr-9 cursor-pointer`;
  const ghostButtonClass = 'rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-glow-active)] hover:text-[var(--text-primary)]';
  const primaryButtonClass = 'rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = 'rounded-xl border border-[var(--border-brand)] bg-[rgba(232,112,10,0.08)] px-3 py-2 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-[rgba(232,112,10,0.14)]';
  const successButtonClass = 'rounded-xl bg-[var(--status-success-text)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

  const loadBase = async (options?: { dealId?: string; processTemplateId?: string }) => {
    const [dealRows, teamRows, processRows, directoryMembers, roleRows] = await Promise.all([
      listDeals(),
      listMemberTeams(),
      listProcessTemplates(),
      listTeamMembers(),
      listProfessionalRoles(),
    ]);

    setDeals(dealRows);
    setTeams(teamRows);
    setTeamDirectoryMembers(directoryMembers);
    setProfessionalRoles(roleRows);
    setProcessTemplates(processRows);

    const nextDealId = options?.dealId ?? selectedDealId ?? dealRows[0]?.id ?? '';
    setSelectedDealId(nextDealId);

    const nextProcessTemplateId =
      options?.processTemplateId ?? selectedProcessTemplateId ?? '';
    setSelectedProcessTemplateId(nextProcessTemplateId);

    if (nextProcessTemplateId) {
      const rows = await listProcessTemplateTeamAssignments(nextProcessTemplateId);
      setAssignmentRows(rows);
      const distinctTeamIds = Array.from(new Set(rows.map((row) => row.teamId)));
      setSelectedTemplateTeamId(distinctTeamIds.length === 1 ? distinctTeamIds[0] : '');
    } else {
      setAssignmentRows([]);
      setSelectedTemplateTeamId('');
    }
  };

  const loadBillingSummary = async () => {
    const overview = await getBillingOverview();
    setBillingOverview(overview);
  };

  useEffect(() => {
    Promise.all([loadBase(), loadBillingSummary()]).catch(() => showToast('Αποτυχία φόρτωσης δεδομένων.', 'error'));
  }, []);

  const teamMembersByTeam = useMemo(() => {
    const grouped = new Map<string, ApiTeamMember[]>();
    teamDirectoryMembers.forEach((member) => {
      const key = member.teamId ?? 'unassigned';
      const current = grouped.get(key) ?? [];
      current.push(member);
      grouped.set(key, current);
    });
    return grouped;
  }, [teamDirectoryMembers]);

  const teamRoleTotalsByTeam = useMemo(() => {
    const output = new Map<string, Record<ApiMemberRole, number>>();
    teamDirectoryMembers.forEach((member) => {
      const key = member.teamId;
      const current = output.get(key) ?? { LAWYER: 0, ENGINEER: 0, SURVEYOR: 0, NOTARY: 0, OTHER: 0 };
      current[member.role] += 1;
      output.set(key, current);
    });
    return output;
  }, [teamDirectoryMembers]);

  const focusedTeam = focusedTeamId ? teams.find((team) => team.id === focusedTeamId) ?? null : null;
  const focusedTeamMembers = focusedTeam ? teamMembersByTeam.get(focusedTeam.id) ?? [] : [];
  const unassignedTeamMembers = teamMembersByTeam.get('unassigned') ?? [];
  const unassignedMembersByRole = useMemo(
    () => unassignedTeamMembers.filter((member) => member.role === focusedAssignRole),
    [focusedAssignRole, unassignedTeamMembers],
  );
  const focusedTeamRoleSummary = focusedTeam
    ? teamRoleTotalsByTeam.get(focusedTeam.id) ?? { LAWYER: 0, ENGINEER: 0, SURVEYOR: 0, NOTARY: 0, OTHER: 0 }
    : { LAWYER: 0, ENGINEER: 0, SURVEYOR: 0, NOTARY: 0, OTHER: 0 };

  useEffect(() => {
    if (!focusedTeam) return;
    setFocusedTeamEditing(false);
    setFocusedTeamNameDraft(focusedTeam.name);
    setFocusedTeamCoverageDraft((focusedTeam.coverageAreas ?? []).join(', '));
  }, [focusedTeam?.id]);

  useEffect(() => {
    if (unassignedMembersByRole.length === 0) {
      setFocusedUnassignedMemberId('');
      return;
    }
    setFocusedUnassignedMemberId((current) =>
      unassignedMembersByRole.some((member) => member.id === current)
        ? current
        : unassignedMembersByRole[0].id,
    );
  }, [unassignedMembersByRole]);

  const filteredRegistryMembers = useMemo(() => {
    return teamDirectoryMembers.filter((member) => {
      if (registryFilters.role !== 'all' && member.role !== registryFilters.role) return false;
      if (registryFilters.teamId !== 'all' && (member.teamId ?? '') !== registryFilters.teamId) return false;
      if (registryFilters.search.trim()) {
        const haystack = `${member.name} ${member.email ?? ''} ${member.phone ?? ''}`.toLowerCase();
        if (!haystack.includes(registryFilters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [teamDirectoryMembers, registryFilters]);

  const memberProfessionalRoleOptions = useMemo(
    () => professionalRoleOptionsForLegacy(professionalRoles, form.role),
    [form.role, professionalRoles],
  );

  const selectedProcessTemplate = useMemo(
    () => processTemplates.find((item) => item.id === selectedProcessTemplateId) ?? null,
    [processTemplates, selectedProcessTemplateId],
  );
  const selectedDeal = useMemo(
    () => deals.find((item) => item.id === selectedDealId) ?? null,
    [deals, selectedDealId],
  );
  const templateSlots = useMemo(
    () => extractTemplateSlots(selectedProcessTemplate),
    [selectedProcessTemplate],
  );
  const aiLocked = billingOverview ? !billingOverview.aiEnabled : true;
  const aiUsage = billingOverview?.usage.find((item) => item.metric === 'AI_REQUESTS') ?? null;
  const aiUsageExhausted = aiUsage ? !aiUsage.unlimited && !!aiUsage.limit && aiUsage.limit > 0 && aiUsage.usedCount >= aiUsage.limit : false;

  useEffect(() => {
    if (!selectedDeal?.propertyLocation) {
      return;
    }
    setAiSuggestionLocation((current) => current || selectedDeal.propertyLocation || '');
  }, [selectedDeal?.propertyLocation]);

  const handleLoadAiSuggestions = async () => {
    if (aiLocked) {
      window.location.assign('/settings');
      return;
    }
    setAiSuggestionLoading(true);
    try {
      const suggestions = await suggestMemberTeams({
        location: aiSuggestionLocation.trim() || selectedDeal?.propertyLocation || undefined,
        processTemplateId: selectedProcessTemplateId || undefined,
      });
      setAiSuggestions(suggestions);
      if (suggestions.length === 0) {
        showToast('Δεν βρέθηκαν AI suggestions για τα τωρινά κριτήρια.', 'warning');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία φόρτωσης AI suggestions.', 'error');
    } finally {
      setAiSuggestionLoading(false);
    }
  };

  const assignTeamToTemplate = async (teamId: string, selectedMembers?: Record<string, string>) => {
    if (!selectedProcessTemplateId || !teamId) return;
    const template = selectedProcessTemplate;
    if (!template) return;

    const requiredSlots = extractTemplateSlots(template);
    const membersOfTeam = teamDirectoryMembers.filter((member) => member.teamId === teamId);
    const slotCandidates = requiredSlots.reduce((acc, slot) => {
      acc[slotKey(slot)] = membersOfTeam.filter((member) => memberMatchesSlot(member, slot));
      return acc;
    }, {} as Record<string, ApiTeamMember[]>);

    const missingSlots = requiredSlots.filter((slot) => (slotCandidates[slotKey(slot)] ?? []).length === 0);
    if (missingSlots.length > 0) {
      showToast(`Η ομάδα δεν έχει μέλη για ρόλους: ${missingSlots.map(slotLabel).join(', ')}`, 'warning');
      return;
    }

    if (!selectedMembers) {
      const slotsWithMultiple = requiredSlots.filter((slot) => (slotCandidates[slotKey(slot)] ?? []).length > 1);
      if (slotsWithMultiple.length > 0) {
        const selectedMemberBySlot = requiredSlots.reduce((acc, slot) => {
          acc[slotKey(slot)] = slotCandidates[slotKey(slot)]?.[0]?.id ?? '';
          return acc;
        }, {} as Record<string, string>);
        setRoleSelectionPopup({ teamId, slotCandidates, selectedMemberBySlot });
        return;
      }
    }

    try {
      const payload = requiredSlots.map((slot) => ({
        role: slot.role,
        professionalRoleId: slot.professionalRoleId,
        partyRole: slot.partyRole,
        teamId,
        teamMemberId: selectedMembers
          ? selectedMembers[slotKey(slot)] || undefined
          : slotCandidates[slotKey(slot)]?.[0]?.id,
      }));
      await saveProcessTemplateTeamAssignments(selectedProcessTemplateId, payload);
      const savedRows = await listProcessTemplateTeamAssignments(selectedProcessTemplateId);
      setSelectedTemplateTeamId(teamId);
      setRoleSelectionPopup(null);
      showToast('Η ομάδα ανατέθηκε στο template και οι ρόλοι συμπληρώθηκαν αυτόματα.', 'success');
    } catch {
      showToast('Αποτυχία ανάθεσης ομάδας στο template.', 'error');
    }
  };

  return (
    <div className="space-y-5 px-1 pb-8">
      <header className="overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_38%),linear-gradient(135deg,_rgba(10,24,52,0.99),_rgba(18,39,77,0.98)_48%,_rgba(232,112,10,0.9))] px-6 py-6 text-white shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Operations</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.02em]">Ομάδες & Μέλη</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
              Οργάνωσε συνεργάτες ανά περιοχή και ρόλο, όρισε reusable ομάδες και σύνδεσέ τες με process templates χωρίς να αλλάξει η λειτουργικότητα του backend flow.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">Ομάδες</p>
              <p className="mt-2 text-2xl font-semibold">{teams.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">Μέλη</p>
              <p className="mt-2 text-2xl font-semibold">{teamDirectoryMembers.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">Templates</p>
              <p className="mt-2 text-2xl font-semibold">{processTemplates.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">Deals</p>
              <p className="mt-2 text-2xl font-semibold">{deals.length}</p>
            </div>
          </div>
        </div>
      </header>

      <section className={pageSurfaceClass}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">AI Layer</p>
            <h2 className="mt-1 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
              <Sparkles size={16} className="text-[var(--brand-primary)]" />
              AI suggestions για ομάδες
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Χρησιμοποίησε AI suggestions για να προτείνεις reusable ομάδες με βάση το property location και το selected process template.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
              aiLocked
                ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                : 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
            }`}>
              {aiLocked ? 'AI locked' : 'AI enabled'}
            </span>
            {aiUsage && (
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                aiUsageExhausted
                  ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                  : 'border-[var(--border-default)] bg-[var(--surface-ambient)] text-[var(--text-secondary)]'
              }`}>
                AI requests: {aiUsage.usedCount}/{aiUsage.unlimited ? 'Unlimited' : aiUsage.limit}
              </span>
            )}
          </div>
        </div>

        {aiLocked ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4">
            <div className="flex items-start gap-3">
              <Lock size={18} className="mt-0.5 text-[var(--status-warning-text)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--status-warning-text)]">Το current plan δεν περιλαμβάνει AI features.</div>
                <div className="mt-1 text-sm text-[var(--status-warning-text)]">
                  Τα AI suggestions μπλοκάρονται από το backend και δεν μπορούν να παρακαμφθούν από API calls. Η εμπορική ενεργοποίηση των AI plans έρχεται σε επόμενο rollout.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {aiUsageExhausted && (
              <div className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 text-sm text-[var(--status-danger-text)]">
                Έχει εξαντληθεί το AI monthly quota του current plan. Τα AI suggestions θα μπλοκάρονται μέχρι τον επόμενο κύκλο.
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto]">
              <input
                value={aiSuggestionLocation}
                onChange={(event) => setAiSuggestionLocation(event.target.value)}
                placeholder="Περιοχή ή location για AI suggestions"
                className={inputClass}
              />
              <div className={`${nestedSurfaceClass} flex items-center text-xs text-[var(--text-secondary)]`}>
                {selectedProcessTemplate
                  ? `Template: ${selectedProcessTemplate.name}`
                  : 'Χωρίς selected process template'}
              </div>
              <button
                type="button"
                disabled={aiSuggestionLoading || aiUsageExhausted}
                onClick={() => void handleLoadAiSuggestions()}
                className={primaryButtonClass}
              >
                {aiSuggestionLoading ? 'Φόρτωση...' : 'AI Suggestions'}
              </button>
            </div>
            {aiSuggestions.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-3">
                {aiSuggestions.map((team) => (
                  <div key={team.id} className={softCardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{team.name}</div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">
                          {(team.coverageAreas ?? []).length > 0
                            ? (team.coverageAreas ?? []).join(', ')
                            : 'Χωρίς δηλωμένες περιοχές κάλυψης'}
                        </div>
                      </div>
                      <span className="rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--status-info-text)]">
                        Score {team.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>


      <div className="flex justify-end">
        <button
          onClick={() => setTeamModalOpen(true)}
          className={primaryButtonClass}
        >
          Δημιουργία Νέας Ομάδας
        </button>
      </div>

      <div>
        <section className={pageSurfaceClass}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Directory</p>
              <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">Ομάδες και Μέλη</h2>
            </div>
            <button
              onClick={() => setSectionOpen((prev) => ({ ...prev, teams: !prev.teams }))}
              className="rounded-full border border-[var(--border-default)] bg-[var(--surface-ambient)] p-2 text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-glow-active)] hover:text-[var(--text-primary)]"
              aria-label={sectionOpen.teams ? 'Collapse section' : 'Expand section'}
            >
              {sectionOpen.teams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${sectionOpen.teams ? 'mt-3 max-h-[2400px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {teams.map((team) => {
                const teamMembers = teamMembersByTeam.get(team.id) ?? [];
                const roleSummary = teamRoleTotalsByTeam.get(team.id) ?? { LAWYER: 0, ENGINEER: 0, SURVEYOR: 0, NOTARY: 0, OTHER: 0 };
                return (
                  <article
                    key={team.id}
                    onClick={() => setFocusedTeamId(team.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setFocusedTeamId(team.id);
                      }
                    }}
                    className="cursor-pointer rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--border-brand)] hover:shadow-[var(--shadow-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-warm-muted)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{team.name}</p>
                      <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-ambient)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {teamMembers.length} μέλη
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(team.coverageAreas ?? []).length > 0 ? (
                        (team.coverageAreas ?? []).map((area) => (
                          <span key={`${team.id}-${area}`} className="rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--status-info-text)]">
                            {area}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--text-tertiary)]">Χωρίς περιοχές κάλυψης</span>
                      )}
                    </div>

                    <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                      Μέλη: <strong>{teamMembers.length}</strong> · Δικηγόροι {roleSummary.LAWYER} · Μηχανικοί {roleSummary.ENGINEER} · Τοπογράφοι {roleSummary.SURVEYOR} · Συμβολαιογράφοι {roleSummary.NOTARY}
                    </p>

                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                      {teamMembers.length === 0 ? (
                        <p className="text-xs text-[var(--text-tertiary)]">Δεν υπάρχουν μέλη στην ομάδα.</p>
                      ) : (
                        teamMembers.map((member) => (
                          <p key={member.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                            <strong>{member.name}</strong> · {member.professionalRoleName ?? roleLabel(member.role)}
                          </p>
                        ))
                      )}
                  </div>
                </article>
              );
            })}
            {unassignedTeamMembers.length > 0 && (
              <article className="rounded-[24px] border border-dashed border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Μέλη χωρίς ομάδα</p>
                <p className="mt-2 text-xs text-[var(--text-secondary)]">Σύνολο: <strong>{unassignedTeamMembers.length}</strong></p>
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                  {unassignedTeamMembers.map((member) => (
                    <p key={`unassigned-${member.id}`} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      <strong>{member.name}</strong> · {member.professionalRoleName ?? roleLabel(member.role)}
                    </p>
                  ))}
                </div>
              </article>
            )}
          </div>
          </div>
        </section>
      </div>

      <div className="space-y-5">
        <section className={pageSurfaceClass}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Professional Roles</p>
              <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">Κατάλογος Επαγγελματικών Ρόλων</h2>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              value={newProfessionalRole.label}
              onChange={(event) => setNewProfessionalRole((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="Ονομασία ρόλου"
              className={inputClass}
            />
            <input
              value={newProfessionalRole.code}
              onChange={(event) => setNewProfessionalRole((prev) => ({ ...prev, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') }))}
              placeholder="Κωδικός"
              className={inputClass}
            />
            <select
              value={newProfessionalRole.legacyMemberRole}
              onChange={(event) => setNewProfessionalRole((prev) => ({ ...prev, legacyMemberRole: event.target.value as ApiMemberRole }))}
              className={selectClass}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={`pro-role-${role}`} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
            <button
              onClick={async () => {
                if (!newProfessionalRole.label.trim() || !newProfessionalRole.code.trim()) {
                  showToast('Συμπλήρωσε όνομα και κωδικό ρόλου.', 'warning');
                  return;
                }
                try {
                  await createProfessionalRole({
                    label: newProfessionalRole.label.trim(),
                    code: newProfessionalRole.code.trim(),
                    legacyMemberRole: newProfessionalRole.legacyMemberRole,
                  });
                  setNewProfessionalRole({ code: '', label: '', legacyMemberRole: 'OTHER' });
                  await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                  showToast('Ο επαγγελματικός ρόλος δημιουργήθηκε.', 'success');
                } catch {
                  showToast('Αποτυχία δημιουργίας επαγγελματικού ρόλου.', 'error');
                }
              }}
              className={primaryButtonClass}
            >
              Νέος Ρόλος
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {professionalRoles.map((role) => (
              <div key={role.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-glow)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{role.label}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{role.code} · {role.legacyMemberRole ? roleLabel(role.legacyMemberRole) : 'Χωρίς αντιστοίχιση'}</p>
                  </div>
                  {!role.system && (
                    <button
                      onClick={async () => {
                        try {
                          await deleteProfessionalRole(role.id);
                          await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                          showToast('Ο επαγγελματικός ρόλος διαγράφηκε.', 'success');
                        } catch {
                          showToast('Αποτυχία διαγραφής επαγγελματικού ρόλου.', 'error');
                        }
                      }}
                      className="rounded-full border border-transparent p-2 text-[var(--status-danger-text)] transition hover:border-[var(--status-danger-border)] hover:bg-[var(--status-danger-bg)]"
                      aria-label="Delete professional role"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                  {role.system ? 'System default' : 'Custom broker role'}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className={pageSurfaceClass}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Template Routing</p>
              <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">Αναθέσεις Ομάδων σε Process Template</h2>
            </div>
            <button
              onClick={() => setSectionOpen((prev) => ({ ...prev, templateAssignments: !prev.templateAssignments }))}
              className="rounded-full border border-[var(--border-default)] bg-[var(--surface-ambient)] p-2 text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-glow-active)] hover:text-[var(--text-primary)]"
              aria-label={sectionOpen.templateAssignments ? 'Collapse section' : 'Expand section'}
            >
              {sectionOpen.templateAssignments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${sectionOpen.templateAssignments ? 'mt-3 max-h-[1400px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <select
              value={selectedProcessTemplateId}
              onChange={async (event) => {
                const nextTemplateId = event.target.value;
                setSelectedProcessTemplateId(nextTemplateId);
                if (!nextTemplateId) {
                  setAssignmentRows([]);
                  setSelectedTemplateTeamId('');
                  return;
                }
                const rows = await listProcessTemplateTeamAssignments(nextTemplateId);
                setAssignmentRows(rows);
                const distinctTeamIds = Array.from(new Set(rows.map((row) => row.teamId)));
                setSelectedTemplateTeamId(distinctTeamIds.length === 1 ? distinctTeamIds[0] : '');
              }}
              className={`mt-3 ${selectClass}`}
            >
              <option value="">Επίλεξε template</option>
              {processTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.type})
                </option>
              ))}
            </select>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <select
                value={selectedTemplateTeamId}
                onChange={(event) => setSelectedTemplateTeamId(event.target.value)}
                className={selectClass}
              >
                <option value="">Επίλεξε ομάδα</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void assignTeamToTemplate(selectedTemplateTeamId)}
                disabled={!selectedTemplateTeamId || !selectedProcessTemplateId}
                className={primaryButtonClass}
              >
                Ανάθεση Ομάδας στο Template
              </button>
            </div>

            <div className={`mt-3 ${nestedSurfaceClass}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Τρέχον mapping ρόλων</p>
              <div className="mt-2 space-y-1">
                {templateSlots.length === 0 && (
                  <p className="text-xs text-[var(--text-tertiary)]">Το template δεν έχει στάδια.</p>
                )}
                {templateSlots.length > 0 && assignmentRows.length === 0 && (
                  <p className="text-xs text-[var(--text-tertiary)]">Δεν έχουν οριστεί αναθέσεις.</p>
                )}
                {templateSlots.map((slot) => {
                  const assignment = assignmentRows.find((row) =>
                    row.role === slot.role
                    && (row.partyRole ?? undefined) === slot.partyRole
                    && (row.professionalRoleId ?? undefined) === (slot.professionalRoleId ?? undefined)
                  );
                  if (!assignment) {
                    return (
                      <p key={`assigned-${slotKey(slot)}`} className="text-xs text-[var(--text-secondary)]">
                        <strong>{slotLabel(slot)}:</strong> Δεν έχει οριστεί ομάδα
                      </p>
                    );
                  }
                  const assignedTeamId = assignment.teamId;
                  const candidates = teamDirectoryMembers.filter(
                    (member) => member.teamId === assignedTeamId && memberMatchesSlot(member, slot)
                  );
                  const inferredMemberName =
                    candidates.length === 1 ? candidates[0].name : null;
                  const memberDisplay =
                    assignment?.teamMemberName
                    ?? inferredMemberName
                    ?? (candidates.length > 1 ? 'Θα παρθεί απόφαση' : 'Χωρίς διαθέσιμο μέλος');
                  return (
                    <p key={`assigned-${slotKey(slot)}`} className="text-xs text-[var(--text-secondary)]">
                      <strong>{slotLabel(slot)}:</strong> {memberDisplay}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className={pageSurfaceClass}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Registry</p>
              <h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">Μητρώο Μελών</h2>
            </div>
            <button
              onClick={() => setSectionOpen((prev) => ({ ...prev, registry: !prev.registry }))}
              className="rounded-full border border-[var(--border-default)] bg-[var(--surface-ambient)] p-2 text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-glow-active)] hover:text-[var(--text-primary)]"
              aria-label={sectionOpen.registry ? 'Collapse section' : 'Expand section'}
            >
              {sectionOpen.registry ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${sectionOpen.registry ? 'mt-3 max-h-[2400px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                value={registryFilters.search}
                onChange={(event) => setRegistryFilters((prev) => ({ ...prev, search: event.target.value }))}
                placeholder="Αναζήτηση ονόματος/email/τηλεφώνου"
                className={inputClass}
              />
              <select
                value={registryFilters.role}
                onChange={(event) => setRegistryFilters((prev) => ({ ...prev, role: event.target.value }))}
                className={selectClass}
              >
                <option value="all">Όλοι οι ρόλοι</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={`filter-role-${role}`} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
              <select
                value={registryFilters.teamId}
                onChange={(event) => setRegistryFilters((prev) => ({ ...prev, teamId: event.target.value }))}
                className={selectClass}
              >
                <option value="all">Όλες οι ομάδες</option>
                <option value="">Χωρίς ομάδα</option>
                {teams.map((team) => (
                  <option key={`filter-team-${team.id}`} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Ομάδα</label>
                <select
                  value={form.teamId}
                  onChange={(event) => setForm((prev) => ({ ...prev, teamId: event.target.value }))}
                  className={selectClass}
                >
                  <option value="">Χωρίς ομάδα</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ονοματεπώνυμο"
                className={inputClass}
              />
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    role: event.target.value as ApiMemberRole,
                    professionalRoleId: '',
                  }))}
                className={selectClass}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
              <select
                value={form.professionalRoleId}
                onChange={(event) => setForm((prev) => ({ ...prev, professionalRoleId: event.target.value }))}
                className={selectClass}
              >
                <option value="">Default από κατηγορία</option>
                {memberProfessionalRoleOptions.map((role) => (
                  <option key={`member-prof-role-${role.id}`} value={role.id}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Τηλέφωνο"
                className={inputClass}
              />
              <input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email"
                className={inputClass}
              />
              <button
                onClick={async () => {
                  if (!form.name.trim()) {
                    showToast('Συμπλήρωσε ονοματεπώνυμο μέλους.', 'warning');
                    return;
                  }
                  try {
                    await createTeamMember({
                      teamId: form.teamId || undefined,
                      role: form.role,
                      professionalRoleId: form.professionalRoleId || undefined,
                      name: form.name.trim(),
                      email: form.email.trim() || undefined,
                      phone: form.phone.trim() || undefined,
                    });
                    setForm({ teamId: '', role: 'LAWYER', professionalRoleId: '', name: '', email: '', phone: '' });
                    await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                    showToast('Το μέλος δημιουργήθηκε.', 'success');
                  } catch {
                    showToast('Αποτυχία δημιουργίας μέλους.', 'error');
                  }
                }}
                className={successButtonClass}
              >
                Προσθήκη Μέλους
              </button>
            </div>

            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {filteredRegistryMembers.map((member) => (
                <TeamDirectoryMemberRow
                  key={member.id}
                  member={member}
                  teams={teams}
                  professionalRoles={professionalRoles}
                  onDelete={async () => {
                    try {
                      await deleteTeamMember(member.id);
                      await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                      showToast('Το μέλος διαγράφηκε.', 'success');
                    } catch {
                      showToast('Αποτυχία διαγραφής μέλους.', 'error');
                    }
                  }}
                  onSave={async (payload) => {
                    try {
                      await updateTeamMember(member.id, payload);
                      await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                      showToast('Το μέλος ενημερώθηκε.', 'success');
                    } catch {
                      showToast('Αποτυχία ενημέρωσης μέλους.', 'error');
                    }
                  }}
                />
              ))}
              {filteredRegistryMembers.length === 0 && (
                <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-3 text-xs text-[var(--text-tertiary)]">
                  Δεν βρέθηκαν μέλη με τα τρέχοντα φίλτρα.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {focusedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-primary)] shadow-[var(--shadow-soft)]">
            <header className="flex items-center justify-between border-b border-[var(--border-default)] px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{focusedTeam.name}</h3>
                {!focusedTeamEditing && (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Περιοχές: {(focusedTeam.coverageAreas ?? []).length > 0 ? (focusedTeam.coverageAreas ?? []).join(', ') : 'Δεν ορίστηκαν'}
                  </p>
                )}
              </div>
              <div className="inline-flex items-center gap-2">
                <button
                  onClick={() => {
                    setFocusedTeamEditing(true);
                    setFocusedTeamNameDraft(focusedTeam.name);
                    setFocusedTeamCoverageDraft((focusedTeam.coverageAreas ?? []).join(', '));
                  }}
                  className="rounded-full border border-transparent p-2 text-[var(--text-secondary)] transition hover:border-[var(--border-default)] hover:bg-[var(--surface-ambient)] hover:text-[var(--text-primary)]"
                  aria-label="Edit team"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={async () => {
                    try {
                      await deleteMemberTeam(focusedTeam.id);
                      setFocusedTeamId(null);
                      await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                      showToast('Η ομάδα διαγράφηκε.', 'success');
                    } catch {
                      showToast('Η ομάδα χρησιμοποιείται από μέλη ή templates.', 'warning');
                    }
                  }}
                  className="rounded-full border border-transparent p-2 text-[var(--status-danger-text)] transition hover:border-[var(--status-danger-border)] hover:bg-[var(--status-danger-bg)]"
                  aria-label="Delete team"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => setFocusedTeamId(null)}
                  className={ghostButtonClass}
                >
                  Κλείσιμο
                </button>
              </div>
            </header>

            {focusedTeamEditing && (
              <div className="border-b border-[var(--border-default)] bg-[var(--surface-ambient)] px-6 py-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input
                    value={focusedTeamNameDraft}
                    onChange={(event) => setFocusedTeamNameDraft(event.target.value)}
                    className={inputClass}
                    placeholder="Όνομα ομάδας"
                  />
                  <input
                    value={focusedTeamCoverageDraft}
                    onChange={(event) => setFocusedTeamCoverageDraft(event.target.value)}
                    className={inputClass}
                    placeholder="Περιοχές (comma-separated)"
                  />
                </div>
                <div className="mt-2 inline-flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await updateMemberTeam(focusedTeam.id, {
                          name: focusedTeamNameDraft.trim(),
                          coverageAreas: parseCoverageAreas(focusedTeamCoverageDraft),
                        });
                        setFocusedTeamEditing(false);
                        await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                        showToast('Η ομάδα ενημερώθηκε.', 'success');
                      } catch {
                        showToast('Αποτυχία ενημέρωσης ομάδας.', 'error');
                      }
                    }}
                    className={successButtonClass}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setFocusedTeamEditing(false);
                      setFocusedTeamNameDraft(focusedTeam.name);
                      setFocusedTeamCoverageDraft((focusedTeam.coverageAreas ?? []).join(', '));
                    }}
                    className={ghostButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="grid max-h-[75vh] grid-cols-1 gap-5 overflow-y-auto p-6 lg:grid-cols-3">
              <section className={softCardClass + ' lg:col-span-1'}>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Σύνοψη Ρόλων</p>
                <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                  <p>Δικηγόροι: {focusedTeamRoleSummary.LAWYER}</p>
                  <p>Μηχανικοί: {focusedTeamRoleSummary.ENGINEER}</p>
                  <p>Τοπογράφοι: {focusedTeamRoleSummary.SURVEYOR}</p>
                  <p>Συμβολαιογράφοι: {focusedTeamRoleSummary.NOTARY}</p>
                  <p>Άλλοι: {focusedTeamRoleSummary.OTHER}</p>
                </div>
              </section>

              <section className={softCardClass + ' lg:col-span-2'}>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Μέλη Ομάδας</p>
                <div className="mt-3 space-y-2">
                  {focusedTeamMembers.length === 0 ? (
                    <p className="text-xs text-[var(--text-tertiary)]">Δεν υπάρχουν μέλη στην ομάδα.</p>
                  ) : (
                    focusedTeamMembers.map((member) => (
                      <div key={member.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">{member.name}</p>
                            <p className="text-[var(--text-secondary)]">{member.professionalRoleName ?? roleLabel(member.role)} · {member.phone ?? '-'} · {member.email ?? '-'}</p>
                            <p className="text-[var(--text-tertiary)]">{member.email ?? '-'} · {member.phone ?? '-'}</p>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await deleteTeamMember(member.id);
                                await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                                showToast('Το μέλος αφαιρέθηκε από την ομάδα.', 'success');
                              } catch {
                                showToast('Αποτυχία αφαίρεσης μέλους από την ομάδα.', 'error');
                              }
                            }}
                            className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--status-danger-text)] transition hover:opacity-90"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Προσθήκη μέλους χωρίς ομάδα</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <select
                      value={focusedAssignRole}
                      onChange={(event) => setFocusedAssignRole(event.target.value as ApiMemberRole)}
                      className={selectClass}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={`focused-role-${role}`} value={role}>
                          {roleLabel(role)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={focusedUnassignedMemberId}
                      onChange={(event) => setFocusedUnassignedMemberId(event.target.value)}
                      className={selectClass}
                    >
                      {unassignedMembersByRole.length === 0 ? (
                        <option value="">Δεν υπάρχουν διαθέσιμα μέλη</option>
                      ) : (
                        unassignedMembersByRole.map((member) => (
                          <option key={`focused-unassigned-${member.id}`} value={member.id}>
                            {member.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={async () => {
                        if (!focusedTeam || !focusedUnassignedMemberId) return;
                        const memberToAssign = unassignedTeamMembers.find((member) => member.id === focusedUnassignedMemberId);
                        if (!memberToAssign) {
                          showToast('Δεν βρέθηκε μέλος για ανάθεση.', 'warning');
                          return;
                        }
                        try {
                          await updateTeamMember(memberToAssign.id, {
                            teamId: focusedTeam.id,
                            role: memberToAssign.role,
                            professionalRoleId: memberToAssign.professionalRoleId,
                            name: memberToAssign.name,
                            email: memberToAssign.email,
                            phone: memberToAssign.phone,
                          });
                          await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                          showToast('Το μέλος προστέθηκε στην ομάδα.', 'success');
                        } catch {
                          showToast('Αποτυχία προσθήκης μέλους.', 'error');
                        }
                      }}
                      disabled={!focusedUnassignedMemberId}
                      className={primaryButtonClass}
                    >
                      Add Member
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {roleSelectionPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-primary)] p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Επιλογή μέλους ανά ρόλο</h3>
              <button
                onClick={() => setRoleSelectionPopup(null)}
                className={ghostButtonClass}
              >
                Κλείσιμο
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Βρέθηκαν πολλαπλά μέλη για κάποιους ρόλους. Επίλεξε ποιο μέλος θα χρησιμοποιείται στο template.
            </p>
            <div className="mt-3 space-y-2">
              {templateSlots.filter((slot) => (roleSelectionPopup.slotCandidates[slotKey(slot)] ?? []).length > 1).map((slot) => (
                <div key={`popup-role-${slotKey(slot)}`} className="grid grid-cols-2 items-center gap-2">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">{slotLabel(slot)}</p>
                  <select
                    value={roleSelectionPopup.selectedMemberBySlot[slotKey(slot)] ?? ''}
                    onChange={(event) =>
                      setRoleSelectionPopup((prev) =>
                        prev
                          ? {
                            ...prev,
                            selectedMemberBySlot: {
                              ...prev.selectedMemberBySlot,
                              [slotKey(slot)]: event.target.value,
                            },
                          }
                          : prev
                      )
                    }
                    className={selectClass}
                  >
                    {(roleSelectionPopup.slotCandidates[slotKey(slot)] ?? []).map((member) => (
                      <option key={`candidate-${slotKey(slot)}-${member.id}`} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRoleSelectionPopup(null)}
                className={ghostButtonClass}
              >
                Άκυρο
              </button>
              <button
                onClick={() =>
                  void assignTeamToTemplate(
                    roleSelectionPopup.teamId,
                    roleSelectionPopup.selectedMemberBySlot,
                  )
                }
                className={primaryButtonClass}
              >
                Επιβεβαίωση
              </button>
            </div>
          </div>
        </div>
      )}

      {teamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-primary)] p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Νέα Ομάδα</h3>
              <button
                onClick={() => setTeamModalOpen(false)}
                className={ghostButtonClass}
              >
                Κλείσιμο
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                value={newTeamName}
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder="Όνομα ομάδας"
                className={inputClass}
              />
              <input
                value={newTeamCoverage}
                onChange={(event) => setNewTeamCoverage(event.target.value)}
                placeholder="Περιοχές (π.χ. Γλυφάδα, Βούλα)"
                className={inputClass}
              />
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Αρχικά Μέλη ανά Ρόλο</p>
                <button
                  onClick={() =>
                    setNewTeamMembers((prev) => [...prev, { role: 'LAWYER', professionalRoleId: undefined, name: '', email: '', phone: '' }])
                  }
                  className={secondaryButtonClass}
                >
                  + Προσθήκη μέλους
                </button>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {newTeamMembers.map((member, index) => (
                  <div key={`draft-${index}`} className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-3 md:grid-cols-6">
                    <select
                      value={member.role}
                      onChange={(event) =>
                        setNewTeamMembers((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, role: event.target.value as ApiMemberRole, professionalRoleId: undefined } : item))
                        )
                      }
                      className={selectClass}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={`${index}-${role}`} value={role}>{roleLabel(role)}</option>
                      ))}
                    </select>
                    <select
                      value={member.professionalRoleId ?? ''}
                      onChange={(event) =>
                        setNewTeamMembers((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, professionalRoleId: event.target.value || undefined } : item))
                        )
                      }
                      className={selectClass}
                    >
                      <option value="">Default από κατηγορία</option>
                      {professionalRoleOptionsForLegacy(professionalRoles, member.role).map((role) => (
                        <option key={`${index}-pro-${role.id}`} value={role.id}>{role.label}</option>
                      ))}
                    </select>
                    <input
                      value={member.name}
                      onChange={(event) =>
                        setNewTeamMembers((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, name: event.target.value } : item))
                        )
                      }
                      placeholder="Όνομα"
                      className={inputClass}
                    />
                    <input
                      value={member.email}
                      onChange={(event) =>
                        setNewTeamMembers((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, email: event.target.value } : item))
                        )
                      }
                      placeholder="Email"
                      className={inputClass}
                    />
                    <input
                      value={member.phone}
                      onChange={(event) =>
                        setNewTeamMembers((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, phone: event.target.value } : item))
                        )
                      }
                      placeholder="Τηλέφωνο"
                      className={inputClass}
                    />
                    <button
                      onClick={() =>
                        setNewTeamMembers((prev) => prev.filter((_, idx) => idx !== index))
                      }
                      className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2 py-1 text-xs font-semibold text-[var(--status-danger-text)]"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setTeamModalOpen(false)}
                className={ghostButtonClass}
              >
                Άκυρο
              </button>
              <button
                onClick={async () => {
                  if (!newTeamName.trim()) return;
                  try {
                    const createdTeam = await createMemberTeam({
                      name: newTeamName.trim(),
                      coverageAreas: parseCoverageAreas(newTeamCoverage),
                    });
                    const validMembers = newTeamMembers.filter((member) => member.name.trim());
                    for (const member of validMembers) {
                      await createTeamMember({
                        teamId: createdTeam.id,
                        role: member.role,
                        professionalRoleId: member.professionalRoleId,
                        name: member.name.trim(),
                        email: member.email.trim() || undefined,
                        phone: member.phone.trim() || undefined,
                      });
                    }
                    setNewTeamName('');
                    setNewTeamCoverage('');
                    setNewTeamMembers([{ role: 'LAWYER', professionalRoleId: undefined, name: '', email: '', phone: '' }]);
                    setTeamModalOpen(false);
                    await loadBase({ dealId: selectedDealId, processTemplateId: selectedProcessTemplateId });
                    showToast('Η ομάδα δημιουργήθηκε.', 'success');
                  } catch {
                    showToast('Αποτυχία δημιουργίας ομάδας.', 'error');
                  }
                }}
                className={primaryButtonClass}
              >
                Δημιουργία
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamDirectoryMemberRow({
  member,
  teams,
  professionalRoles,
  onDelete,
  onSave,
}: {
  member: ApiTeamMember;
  teams: ApiMemberTeam[];
  professionalRoles: ApiProfessionalRole[];
  onDelete: () => void;
  onSave: (payload: { teamId?: string; role: ApiMemberRole; professionalRoleId?: string; name: string; email?: string; phone?: string }) => Promise<void>;
}) {
  const inputClass = 'w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]';
  const selectClass = `${inputClass} appearance-none pr-8 cursor-pointer`;
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<ApiMemberRole>(member.role);
  const [professionalRoleId, setProfessionalRoleId] = useState(member.professionalRoleId ?? '');
  const [teamId, setTeamId] = useState(member.teamId ?? '');
  const [email, setEmail] = useState(member.email ?? '');
  const [phone, setPhone] = useState(member.phone ?? '');
  const availableProfessionalRoles = professionalRoleOptionsForLegacy(professionalRoles, role);

  if (!isEditing) {
    return (
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-3 text-xs shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-[var(--text-primary)]">{member.name}</p>
            <p className="text-[var(--text-secondary)]">{member.professionalRoleName ?? roleLabel(member.role)} · {member.phone ?? '-'} · {member.email ?? '-'}</p>
            <p className="text-[var(--text-tertiary)]">{member.teamName ?? 'Χωρίς ομάδα'}</p>
          </div>
          <div className="inline-flex gap-1">
            <button onClick={() => setIsEditing(true)} className="rounded-full border border-transparent p-2 text-[var(--text-secondary)] transition hover:border-[var(--border-default)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]" aria-label="Edit member">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="rounded-full border border-transparent p-2 text-[var(--status-danger-text)] transition hover:border-[var(--status-danger-border)] hover:bg-[var(--status-danger-bg)]" aria-label="Delete member">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-brand)] bg-[rgba(232,112,10,0.08)] px-4 py-3 text-xs shadow-[var(--shadow-soft)]">
      <input value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mb-2`} />
      <div className="grid grid-cols-2 gap-1">
        <select value={role} onChange={(event) => { setRole(event.target.value as ApiMemberRole); setProfessionalRoleId(''); }} className={selectClass}>
          {ROLE_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {roleLabel(item)}
            </option>
          ))}
        </select>
        <select value={professionalRoleId} onChange={(event) => setProfessionalRoleId(event.target.value)} className={selectClass}>
          <option value="">Default από κατηγορία</option>
          {availableProfessionalRoles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <select value={teamId} onChange={(event) => setTeamId(event.target.value)} className={selectClass}>
          <option value="">Χωρίς ομάδα</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1">
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className={inputClass} />
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Τηλέφωνο" className={inputClass} />
      </div>
      <div className="mt-1 inline-flex gap-1">
        <button
          onClick={() => {
            void onSave({
              name: name.trim(),
              role,
              professionalRoleId: professionalRoleId || undefined,
              teamId: teamId || undefined,
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
            });
            setIsEditing(false);
          }}
          className="rounded-xl bg-[var(--status-success-text)] px-3 py-1.5 text-white"
        >
          Save
        </button>
        <button onClick={() => setIsEditing(false)} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] px-3 py-1.5 text-[var(--text-secondary)]">Cancel</button>
      </div>
    </div>
  );
}
