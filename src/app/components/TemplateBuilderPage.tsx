import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Folder,
  Heart,
  Home,
  Plus,
  Save,
  Users,
  X,
} from 'lucide-react';
import {
  ApiDocumentTemplate,
  ApiProfessionalRole,
  ApiProcessTemplate,
  ApiProcessTemplateStage,
  createDocumentTemplate,
  createProcessTemplate,
  deleteDocumentTemplate,
  deleteProcessTemplate,
  listDocumentTemplates,
  listProfessionalRoles,
  listProcessTemplates,
  updateDocumentTemplate,
  updateProcessTemplate,
} from '../api/trustlayerApi';
import { useUiStore } from '../state/uiStore';

type ScenarioId = 'simple' | 'inheritance' | 'irregular' | 'gift' | 'other';
type CategoryId =
  | 'Νομικά Έγγραφα'
  | 'Τεχνικά Έγγραφα'
  | 'Φορολογικά Έγγραφα'
  | 'Δημοτικά / Διοικητικά'
  | 'Στοιχεία Συμβαλλομένων';

interface RoleConfig {
  name: string;
  active: boolean;
}

interface NewTemplateDraft {
  name: string;
  description: string;
  type: string;
  scenario: ScenarioId;
}

interface DocumentRow {
  id: string;
  name: string;
  category: CategoryId;
  role: string;
  partyRole: 'BUYER' | 'SELLER';
  collectionPhase?: boolean;
  estimatedDays: number;
  dependencies: string[];
  checked: boolean;
  isCustom?: boolean;
}

interface ScenarioCard {
  id: ScenarioId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const CATEGORY_ORDER: CategoryId[] = [
  'Νομικά Έγγραφα',
  'Τεχνικά Έγγραφα',
  'Φορολογικά Έγγραφα',
  'Δημοτικά / Διοικητικά',
  'Στοιχεία Συμβαλλομένων',
];

const SCENARIOS: ScenarioCard[] = [
  { id: 'simple', label: 'Απλή Αγοραπωλησία', icon: Home },
  { id: 'inheritance', label: 'Αγοραπωλησία + Κληρονομιά', icon: Users },
  { id: 'irregular', label: 'Αγοραπωλησία + Αυθαίρετα', icon: AlertTriangle },
  { id: 'gift', label: 'Γονική Παροχή / Δωρεά', icon: Heart },
  { id: 'other', label: 'Άλλο', icon: Plus },
];

function createDocId(name: string, idx: number) {
  return `${name.toLowerCase().replace(/[^a-z0-9α-ωάέήίόύώϊϋΐΰ]+/g, '-')}-${idx}`;
}

function normalizeRoleText(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

function buildDocumentDescription(document: DocumentRow, allRows: DocumentRow[]): string {
  const dependencyNames = document.dependencies
    .map((dependencyId) => allRows.find((row) => row.id === dependencyId)?.name)
    .filter((value): value is string => Boolean(value && value.trim().length > 0));

  const base = `${document.category} | ${document.role} | ${document.estimatedDays} days`;
  if (dependencyNames.length === 0) return base;
  return `${base} | deps:${JSON.stringify(dependencyNames)}`;
}

function hasDocumentDependencyPath(
  rows: DocumentRow[],
  startId: string,
  targetId: string,
  visited = new Set<string>(),
): boolean {
  if (startId === targetId) return true;
  if (visited.has(startId)) return false;
  visited.add(startId);

  const row = rows.find((item) => item.id === startId);
  if (!row) return false;

  return row.dependencies.some((dependencyId) =>
    hasDocumentDependencyPath(rows, dependencyId, targetId, visited),
  );
}

function templateTypeForScenario(scenario: ScenarioId) {
  switch (scenario) {
    case 'simple':
      return 'apartment';
    case 'inheritance':
      return 'inheritance';
    case 'irregular':
      return 'irregular';
    case 'gift':
      return 'parental';
    default:
      return 'custom';
  }
}

function ScenarioSelector({
  selected,
  onSelect,
}: {
  selected: ScenarioId;
  onSelect: (scenario: ScenarioId) => void;
}) {
  return (
    <section className="mb-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Τύπος Συναλλαγής</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          const isSelected = selected === scenario.id;
          return (
            <button
              key={scenario.id}
              onClick={() => onSelect(scenario.id)}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center text-sm font-medium transition ${
                isSelected
                  ? 'border-[var(--border-brand)] bg-[rgba(232,112,10,0.06)] text-[var(--brand-primary)] shadow-[0_10px_26px_rgba(232,112,10,0.10)]'
                  : 'border-[var(--border-default)] bg-[var(--surface-glow)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-glow-active)]'
              }`}
            >
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
                isSelected ? 'bg-[rgba(232,112,10,0.12)]' : 'bg-[var(--surface-ambient)]'
              }`}>
                <Icon size={18} />
              </span>
              {scenario.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DependencyEditor({
  row,
  rows,
  disabled,
  onChange,
  onInvalidDependency,
}: {
  row: DocumentRow;
  rows: DocumentRow[];
  disabled: boolean;
  onChange: (deps: string[]) => void;
  onInvalidDependency: (message: string) => void;
}) {
  const options = rows.filter((r) => r.id !== row.id && r.checked);
  const optionsByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    rows: options.filter((option) => option.category === category),
  })).filter((group) => group.rows.length > 0);
  const addDependency = (dependencyId: string) => {
    if (!dependencyId || row.dependencies.includes(dependencyId)) return;
    if (hasDocumentDependencyPath(rows, dependencyId, row.id)) {
      const dependency = rows.find((item) => item.id === dependencyId);
      onInvalidDependency(
        `Δεν μπορείς να ορίσεις το "${dependency?.name ?? 'έγγραφο'}" ως προαπαιτούμενο γιατί δημιουργείται κυκλική εξάρτηση.`,
      );
      return;
    }
    onChange([...row.dependencies, dependencyId]);
  };
  const removeDependency = (dependencyId: string) => {
    onChange(row.dependencies.filter((item) => item !== dependencyId));
  };

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-2">
      <div className="flex flex-wrap gap-2">
        {row.dependencies.length === 0 && (
          <span className="text-xs text-[var(--text-tertiary)]">Δεν έχουν οριστεί εξαρτήσεις.</span>
        )}
        {row.dependencies.map((dependencyId) => {
          const dependency = rows.find((item) => item.id === dependencyId);
          return (
            <span
              key={`${row.id}-${dependencyId}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-info-text)]"
            >
              {dependency?.name || 'Άγνωστο έγγραφο'}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeDependency(dependencyId)}
                  className="text-[var(--status-info-text)]/80 transition hover:text-[var(--status-info-text)]"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          );
        })}
      </div>

      {!disabled && (
        <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-ambient)] p-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Συγκεκριμένα Έγγραφα Προαπαιτούμενα
          </p>
          <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
            {options.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)]">Δεν υπάρχουν διαθέσιμα έγγραφα για εξάρτηση.</p>
            )}
            {optionsByCategory.map((group) => (
              <div key={`${row.id}-${group.category}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-glow)]">
                <div className="border-b border-[var(--border-subtle)] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  {group.category}
                </div>
                <div className="space-y-1 p-1">
                  {group.rows.map((opt) => {
                    const checked = row.dependencies.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--surface-ambient)]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            if (event.target.checked) {
                              addDependency(opt.id);
                              return;
                            }
                            removeDependency(opt.id);
                          }}
                          className="mt-0.5"
                        />
                        <span className="leading-5">{opt.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentCategorySection({
  category,
  rows,
  allRows,
  activeRoles,
  roleOptionsByParty,
  expanded,
  onToggle,
  onUpdateRow,
  onAddRow,
  onInvalidDependency,
}: {
  category: CategoryId;
  rows: DocumentRow[];
  allRows: DocumentRow[];
  activeRoles: string[];
  roleOptionsByParty: Record<DocumentRow['partyRole'], string[]>;
  expanded: boolean;
  onToggle: () => void;
  onUpdateRow: (rowId: string, updates: Partial<DocumentRow>) => void;
  onAddRow: (category: CategoryId) => void;
  onInvalidDependency: (message: string) => void;
}) {
  const selectedCount = rows.filter((r) => r.checked).length;

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)]">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-[var(--surface-glow-active)]">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp size={16} className="text-[var(--text-tertiary)]" /> : <ChevronDown size={16} className="text-[var(--text-tertiary)]" />}
          <Folder size={16} className="text-[var(--text-tertiary)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{category}</span>
        </div>
        <span className="text-xs text-[var(--text-tertiary)]">{selectedCount}/{rows.length} επιλεγμένα</span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)]">
          <div className="grid grid-cols-12 gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-ambient)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
            <div className="col-span-1 text-center">✓</div>
            <div className="col-span-3">Έγγραφο</div>
            <div className="col-span-1 text-center">Πλευρά</div>
            <div className="col-span-2 text-center">Πριν τη διαδικασία</div>
            <div className="col-span-2">Υπεύθυνος Ρόλος</div>
            <div className="col-span-1 text-center">Εκτ. Ημέρες</div>
            <div className="col-span-2">Εξαρτήσεις</div>
          </div>

          {rows.map((row, idx) => (
            <div
              key={row.id}
              className={`grid grid-cols-12 items-start gap-2 px-3 py-2 text-sm min-w-0 ${
                idx % 2 === 0 ? 'bg-[var(--surface-glow)]' : 'bg-[var(--surface-ambient)]'
              } ${
                !row.checked ? 'text-[var(--text-tertiary)] opacity-50' : ''
              }`}
            >
              <div className="col-span-1 flex items-start justify-center pt-1">
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={(e) => onUpdateRow(row.id, { checked: e.target.checked })}
                />
              </div>

              <div className="col-span-3 min-w-0">
                {row.isCustom ? (
                  <input
                    value={row.name}
                    onChange={(e) => onUpdateRow(row.id, { name: e.target.value })}
                    className="w-full min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-2 py-1 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)]"
                    placeholder="Νέο έγγραφο..."
                  />
                ) : (
                  <span className="block min-w-0 truncate text-sm text-[var(--text-primary)]">{row.name}</span>
                )}
              </div>

              <div className="col-span-1 min-w-0 text-center">
                <select
                  value={row.partyRole}
                  disabled={!row.checked}
                  onChange={(e) => {
                    const nextParty = e.target.value as DocumentRow['partyRole'];
                    const options = roleOptionsByParty[nextParty] ?? [];
                    const nextRole = options.includes(row.role) ? row.role : (options[0] ?? row.role);
                    onUpdateRow(row.id, { partyRole: nextParty, role: nextRole });
                  }}
                  className="w-full min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-2 py-1 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                >
                  <option value="BUYER">Αγοραστής</option>
                  <option value="SELLER">Πωλητής</option>
                </select>
              </div>

              <div className="col-span-2 flex items-start justify-center pt-1">
                <div className="flex flex-col items-center gap-1 text-center">
                  <input
                    type="checkbox"
                    checked={row.collectionPhase ?? true}
                    disabled={!row.checked}
                    onChange={(e) => onUpdateRow(row.id, { collectionPhase: e.target.checked })}
                  />
                  <span className="text-[10px] leading-4 text-[var(--text-tertiary)]">
                    {(row.collectionPhase ?? true) ? 'Κρύβεται από τα στάδια' : 'Φαίνεται στα στάδια'}
                  </span>
                </div>
              </div>

              <div className="col-span-2 min-w-0">
                <select
                  value={row.role}
                  disabled={!row.checked}
                  onChange={(e) => onUpdateRow(row.id, { role: e.target.value })}
                  className="w-full min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-2 py-1 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                >
                  {[row.role, ...(roleOptionsByParty[row.partyRole] ?? [])]
                    .filter((value, index, array) => value && array.indexOf(value) === index)
                    .map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                </select>
              </div>

              <div className="col-span-1 flex items-start justify-center">
                <input
                  type="number"
                  min={0}
                  value={row.estimatedDays}
                  disabled={!row.checked}
                  onChange={(e) => onUpdateRow(row.id, { estimatedDays: Number(e.target.value) || 0 })}
                  className="w-16 rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] px-2 py-1 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                />
              </div>

              <div className="col-span-2 min-w-0">
                <DependencyEditor
                  row={row}
                  rows={allRows}
                  disabled={!row.checked}
                  onChange={(deps) => onUpdateRow(row.id, { dependencies: deps })}
                  onInvalidDependency={onInvalidDependency}
                />
              </div>
            </div>
          ))}

          <div className="border-t border-[var(--border-subtle)] px-3 py-2">
            <button
              onClick={() => onAddRow(category)}
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)]"
            >
              <Plus size={14} />
              Άλλο Έγγραφο
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface TemplatePreviewNode {
  id: string;
  label: string;
  subtitle: string;
  dependencies: string[];
  documentBadges?: string[];
  documentBadgesLabel?: string;
  phaseBadge?: string;
  accentClass?: string;
}

interface PreviewNodePosition {
  id: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

function TemplateDependencyPreview({
  title,
  description,
  nodes,
  emptyLabel,
}: {
  title: string;
  description: string;
  nodes: TemplatePreviewNode[];
  emptyLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [positions, setPositions] = useState<PreviewNodePosition[]>([]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const levelById = useMemo(() => {
    const cache = new Map<string, number>();

    const resolveLevel = (nodeId: string, stack = new Set<string>()): number => {
      if (cache.has(nodeId)) return cache.get(nodeId) ?? 0;
      if (stack.has(nodeId)) return 0;
      stack.add(nodeId);
      const node = nodeById.get(nodeId);
      if (!node || node.dependencies.length === 0) {
        cache.set(nodeId, 0);
        stack.delete(nodeId);
        return 0;
      }
      const level = 1 + Math.max(...node.dependencies.map((dependencyId) => resolveLevel(dependencyId, new Set(stack))));
      cache.set(nodeId, level);
      stack.delete(nodeId);
      return level;
    };

    nodes.forEach((node) => resolveLevel(node.id));
    return cache;
  }, [nodeById, nodes]);

  const columns = useMemo(() => {
    const maxLevel = Math.max(0, ...Array.from(levelById.values()));
    return Array.from({ length: maxLevel + 1 }, (_, level) => ({
      level,
      nodes: nodes.filter((node) => (levelById.get(node.id) ?? 0) === level),
    }));
  }, [levelById, nodes]);

  useEffect(() => {
    const updatePositions = () => {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const nextPositions: PreviewNodePosition[] = [];
      container.querySelectorAll<HTMLElement>('[data-preview-node-id]').forEach((element) => {
        const id = element.dataset.previewNodeId;
        if (!id) return;
        const rect = element.getBoundingClientRect();
        nextPositions.push({
          id,
          centerX: rect.left - containerRect.left + rect.width / 2,
          centerY: rect.top - containerRect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        });
      });
      setPositions(nextPositions);
    };

    const timer = window.setTimeout(updatePositions, 60);
    window.addEventListener('resize', updatePositions);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', updatePositions);
    };
  }, [columns]);

  const getPosition = (id: string) => positions.find((position) => position.id === id);

  const connections = nodes.flatMap((node) =>
    node.dependencies.map((dependencyId) => ({ fromId: dependencyId, toId: node.id })),
  );

  return (
    <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <div className="mb-4">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-xs text-[var(--text-secondary)]">{description}</p>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-ambient)] px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
          {emptyLabel}
        </div>
      ) : (
        <div ref={containerRef} className="relative overflow-x-auto pb-2">
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {connections.map((connection) => {
              const from = getPosition(connection.fromId);
              const to = getPosition(connection.toId);
              if (!from || !to) return null;
              const startX = from.centerX + from.width / 2 - 6;
              const startY = from.centerY;
              const endX = to.centerX - to.width / 2 + 6;
              const endY = to.centerY;
              const controlX = (startX + endX) / 2;
              return (
                <path
                  key={`${connection.fromId}-${connection.toId}`}
                  d={`M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke="rgba(232,112,10,0.35)"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />
              );
            })}
          </svg>

          <div
            className="relative grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(220px, 1fr))` }}
          >
            {columns.map((column) => (
              <div key={`preview-column-${column.level}`} className="space-y-3">
                <div className="rounded-full bg-[var(--surface-ambient)] px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  Βήμα {column.level + 1}
                </div>
                {column.nodes.map((node) => (
                  <div
                    key={node.id}
                    data-preview-node-id={node.id}
                    className="rounded-[1.25rem] border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                  >
                    <div className={`mb-3 h-1.5 w-14 rounded-full ${node.accentClass ?? 'bg-[var(--brand-primary)]/70'}`} />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{node.label}</p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">{node.subtitle}</p>
                    {node.phaseBadge ? (
                      <div className="mt-2">
                        <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-glow)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                          {node.phaseBadge}
                        </span>
                      </div>
                    ) : null}
                    <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                      {node.dependencies.length === 0 ? 'Χωρίς εξαρτήσεις' : `${node.dependencies.length} εξαρτήσεις`}
                    </p>
                    {node.documentBadges && node.documentBadges.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                          {node.documentBadgesLabel ?? 'Απαιτούμενα Έγγραφα'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {node.documentBadges.map((documentBadge) => (
                            <span
                              key={`${node.id}-${documentBadge}`}
                              className="inline-flex items-center rounded-full border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--status-warning-text)]"
                            >
                              {documentBadge}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TemplatePhasePreview({
  sections,
  selectedSectionId,
  onSelectSection,
}: {
  sections: Array<{ id: string; title: string; description: string; items: string[]; accentClass: string }>;
  selectedSectionId: string;
  onSelectSection: (sectionId: string) => void;
}) {
  return (
    <section className="mb-5 rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Χαρτογράφηση Συναλλαγής</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Τα έγγραφα και τα στάδια κατανέμονται στις ίδιες φάσεις που βλέπει ο μεσίτης στη συναλλαγή.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectSection('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              selectedSectionId === 'all'
                ? 'bg-[var(--brand-primary)] text-white shadow-[0_8px_24px_rgba(232,112,10,0.28)]'
                : 'border border-[var(--border-default)] bg-[var(--surface-ambient)] text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]'
            }`}
          >
            Όλες οι Φάσεις
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section, index) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelectSection(section.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              selectedSectionId === section.id
                ? 'border-[var(--border-brand)] bg-[var(--surface-raised)] shadow-[0_14px_32px_rgba(15,23,42,0.12)]'
                : 'border-[var(--border-default)] bg-[var(--surface-ambient)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] ${section.accentClass}`}
              >
                {index + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{section.title}</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">{section.description}</p>
              </div>
            </div>

            <div className="mt-4 flex min-h-16 flex-wrap gap-2">
              {section.items.length === 0 ? (
                <span className="text-xs text-[var(--text-tertiary)]">Δεν υπάρχουν σχετικά έγγραφα.</span>
              ) : (
                section.items.map((item) => (
                  <span
                    key={`${section.id}-${item}`}
                    className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-glow)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"
                  >
                    {item}
                  </span>
                ))
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function TemplateBuilderPage() {
  const { showToast } = useUiStore();
  type BuilderMode = 'documents' | 'process';
  type ProcessPartyRole = 'BUYER' | 'SELLER' | null;
  type ProcessRow = {
    id: string;
    title: string;
    role: ApiProcessTemplateStage['role'];
    professionalRoleId?: string;
    professionalRoleName?: string;
    partyRole: ProcessPartyRole;
    deadlineDays: number;
    dependencies: string[];
    requiredDocuments: string[];
  };

  const parseDescription = (description?: string) => {
    if (!description) return null;
    const parts = description.split('|').map((value) => value.trim());
    if (parts.length < 3) return null;
    const [category, role, daysPart, ...rest] = parts;
    const days = Number(daysPart.replace(/\D+/g, ''));
    const dependenciesPart = rest.find((value) => value.startsWith('deps:'));
    let dependencyNames: string[] | null = null;
    if (dependenciesPart) {
      try {
        const parsed = JSON.parse(dependenciesPart.slice(5));
        dependencyNames = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : null;
      } catch {
        dependencyNames = null;
      }
    }
    return {
      category: CATEGORY_ORDER.includes(category as CategoryId) ? (category as CategoryId) : null,
      role: role || null,
      estimatedDays: Number.isFinite(days) ? days : null,
      dependencyNames,
    };
  };

  const toProcessRows = (template: ApiProcessTemplate): ProcessRow[] => {
    return template.stages.map((stage, index) => ({
      id: `stage-${index + 1}`,
      title: stage.title,
      role: stage.role,
      professionalRoleId: stage.professionalRoleId,
      professionalRoleName: stage.professionalRoleName,
      partyRole: stage.partyRole ?? null,
      deadlineDays: stage.deadlineDays ?? 3,
      dependencies: stage.dependencies ?? [],
      requiredDocuments: stage.requiredDocuments ?? [],
    }));
  };

  const roleOptions: ApiProcessTemplateStage['role'][] = ['LAWYER', 'ENGINEER', 'SURVEYOR', 'NOTARY', 'OTHER'];
  const roleLabel: Record<ApiProcessTemplateStage['role'], string> = {
    LAWYER: 'Δικηγόρος',
    ENGINEER: 'Μηχανικός',
    SURVEYOR: 'Τοπογράφος',
    NOTARY: 'Συμβολαιογράφος',
    OTHER: 'Άλλο',
  };

  const partySuffix = (partyRole: ProcessPartyRole | DocumentRow['partyRole']) => {
    if (partyRole === 'SELLER') return 'Πωλητή';
    if (partyRole === 'BUYER') return 'Αγοραστή';
    return '';
  };
  const applyPartySuffix = (label: string, partyRole: ProcessPartyRole | DocumentRow['partyRole']) => {
    const normalized = label.trim().toLowerCase();
    if (!normalized || normalized.includes('πωλητ') || normalized.includes('αγοραστ')) {
      return label;
    }
    if (normalized.includes('άλλ')) {
      return label;
    }
    if (!partyRole) {
      return label;
    }
    return `${label} ${partySuffix(partyRole)}`;
  };

  const processRoleLabel = (
    role: ApiProcessTemplateStage['role'],
    partyRole: ProcessPartyRole,
    professionalRoleName?: string,
  ) => applyPartySuffix(professionalRoleName || roleLabel[role], partyRole);

  const processRoleMatchesDocumentRole = (processRole: ApiProcessTemplateStage['role'], documentRole?: string | null) => {
    const normalized = normalizeRoleText(documentRole);
    if (!normalized) return processRole === 'OTHER';
    if (processRole === 'LAWYER') return normalized.includes('δικηγόρ');
    if (processRole === 'ENGINEER') return normalized.includes('μηχανικ');
    if (processRole === 'SURVEYOR') return normalized.includes('τοπογράφ') || normalized.includes('τοπογραφ');
    if (processRole === 'NOTARY') return normalized.includes('συμβολαιογράφ') || normalized.includes('συμβολαιογραφ');
    return ![
      'δικηγόρ',
      'μηχανικ',
      'τοπογράφ',
      'τοπογραφ',
      'συμβολαιογράφ',
      'συμβολαιογραφ',
    ].some((token) => normalized.includes(token));
  };

  const [mode, setMode] = useState<BuilderMode>('documents');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateType, setTemplateType] = useState('apartment');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('simple');
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<ApiDocumentTemplate[]>([]);
  const [professionalRoles, setProfessionalRoles] = useState<ApiProfessionalRole[]>([]);
  const [processTemplates, setProcessTemplates] = useState<ApiProcessTemplate[]>([]);
  const [selectedDocumentTemplateId, setSelectedDocumentTemplateId] = useState<string>('');
  const [selectedProcessTemplateId, setSelectedProcessTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [showCustomRoleInput, setShowCustomRoleInput] = useState(false);
  const [newTemplateModalOpen, setNewTemplateModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPhaseFilter, setPreviewPhaseFilter] = useState<string>('all');
  const [newTemplateDraft, setNewTemplateDraft] = useState<NewTemplateDraft>({
    name: '',
    description: '',
    type: 'apartment',
    scenario: 'simple',
  });
  const [expandedCategories, setExpandedCategories] = useState<Record<CategoryId, boolean>>({
    'Νομικά Έγγραφα': true,
    'Τεχνικά Έγγραφα': true,
    'Φορολογικά Έγγραφα': true,
    'Δημοτικά / Διοικητικά': true,
    'Στοιχεία Συμβαλλομένων': true,
  });
  const [contentVisible, setContentVisible] = useState(true);

  useEffect(() => {
    setLoadingTemplates(true);
    Promise.all([listDocumentTemplates(), listProcessTemplates(), listProfessionalRoles()])
      .then(([docTemplates, procTemplates, roleRows]) => {
        setDocumentTemplates(docTemplates);
        setProcessTemplates(procTemplates);
        setProfessionalRoles(roleRows);
        const initialDocumentTemplate = findDocumentSeedTemplate('simple', docTemplates) ?? docTemplates[0] ?? null;
        const initialProcessTemplate = findProcessSeedTemplate('simple', procTemplates) ?? procTemplates[0] ?? null;

        if (initialDocumentTemplate) {
          applyBackendDocTemplate(initialDocumentTemplate);
        } else {
          setSelectedDocumentTemplateId('');
          setTemplateName('Νέο Template Εγγράφων');
          setTemplateDescription('');
          setTemplateType('custom');
          setRoles([]);
          setDocuments([]);
          updateExpandedCategories([]);
          showToast('Δεν υπάρχουν templates εγγράφων από το backend ακόμη.', 'warning');
        }

        if (initialProcessTemplate) {
          applyBackendProcessTemplate(initialProcessTemplate);
        } else {
          setSelectedProcessTemplateId('');
          setProcessRows([]);
        }
      })
      .catch(() => {
        setSelectedDocumentTemplateId('');
        setSelectedProcessTemplateId('');
        setRoles([]);
        setDocuments([]);
        setProcessRows([]);
        setTemplateName('Νέο Template');
        setTemplateDescription('');
        setTemplateType('custom');
        updateExpandedCategories([]);
        showToast('Αποτυχία φόρτωσης templates από το backend.', 'error');
      })
      .finally(() => setLoadingTemplates(false));
  }, []);

  useEffect(() => {
    if (previewOpen) {
      setPreviewPhaseFilter('all');
    }
  }, [mode, previewOpen]);

  const activeRoles = useMemo(() => roles.filter((r) => r.active).map((r) => r.name), [roles]);
  const currentDocumentTemplate = documentTemplates.find((template) => template.id === selectedDocumentTemplateId) ?? null;
  const currentProcessTemplate = processTemplates.find((template) => template.id === selectedProcessTemplateId) ?? null;
  const templateLibrary = mode === 'documents' ? documentTemplates : processTemplates;
  const currentTemplate = mode === 'documents' ? currentDocumentTemplate : currentProcessTemplate;

  const roleOptionsByParty = useMemo(() => {
    const processRoleSet = new Set(currentProcessTemplate?.stages.map((stage) => stage.role) ?? []);
    const baseRoles = Array.from(processRoleSet).map((role) => roleLabel[role]);
    const manualRoles = roles.map((role) => role.name);
    const professionalRoleLabels = professionalRoles.map((role) => role.label);
    const processProfessionalRoleLabels = processRows
      .map((row) => row.professionalRoleName)
      .filter((value): value is string => Boolean(value && value.trim()));
    const extraRoles = ['Μεσίτης', 'Λογιστής'];

    const buildOptions = (partyRole: DocumentRow['partyRole']) => {
      const combined = [
        ...manualRoles,
        ...professionalRoleLabels,
        ...processProfessionalRoleLabels,
        ...baseRoles.map((label) => applyPartySuffix(label, partyRole)),
        ...extraRoles.map((label) => applyPartySuffix(label, partyRole)),
      ];
      return Array.from(new Set(combined.filter(Boolean)));
    };

    return {
      BUYER: buildOptions('BUYER'),
      SELLER: buildOptions('SELLER'),
    };
  }, [currentProcessTemplate, processRows, professionalRoles, roles, roleLabel]);

  const docsByCategory = useMemo(() => {
    const map = new Map<CategoryId, DocumentRow[]>();
    CATEGORY_ORDER.forEach((c) => map.set(c, []));
    documents.forEach((doc) => {
      map.get(doc.category)?.push(doc);
    });
    return map;
  }, [documents]);

  const selectedDocuments = documents.filter((d) => d.checked);
  const processRequiredDocumentNames = useMemo(
    () => new Set(processRows.flatMap((row) => row.requiredDocuments)),
    [processRows],
  );
  const isCollectionDocument = (document: DocumentRow) =>
    document.collectionPhase ?? !processRequiredDocumentNames.has(document.name);
  const availableProcessDocumentOptions = useMemo(() => {
    const byRole = new Map<ApiProcessTemplateStage['role'], Array<{ name: string; role: string; category: string; partyRole: DocumentRow['partyRole'] }>>();

    roleOptions.forEach((role) => byRole.set(role, []));

    const matchingTemplates = documentTemplates.filter((template) => template.type === templateType);
    const dedupe = new Set<string>();

    matchingTemplates.forEach((template) => {
      template.documents.forEach((document, index) => {
        if (document.collectionPhase === true) {
          return;
        }
        const parsed = parseDescription(document.description);
        const option = {
          name: document.name,
          role: parsed?.role ?? 'Μέλος',
          category: parsed?.category ?? CATEGORY_ORDER[index % CATEGORY_ORDER.length],
          partyRole: document.partyRole ?? 'BUYER',
        };

        roleOptions.forEach((role) => {
          if (!processRoleMatchesDocumentRole(role, option.role)) {
            return;
          }
          const key = `${role}|${option.name}`;
          if (dedupe.has(key)) {
            return;
          }
          dedupe.add(key);
          byRole.get(role)?.push(option);
        });
      });
    });

    return byRole;
  }, [documentTemplates, templateType]);
  const estimatedDays = selectedDocuments.reduce((sum, d) => sum + d.estimatedDays, 0);
  const processEstimatedDays = processRows.reduce((sum, row) => sum + row.deadlineDays, 0);
  const selectedCategoryCount = CATEGORY_ORDER.filter((category) => (docsByCategory.get(category) ?? []).some((doc) => doc.checked)).length;
  const documentPhaseSections = useMemo(
    () => {
      const sellerItems = selectedDocuments
        .filter((document) => document.partyRole === 'SELLER' && isCollectionDocument(document))
        .map((document) => document.name);
      const buyerItems = selectedDocuments
        .filter((document) => document.partyRole !== 'SELLER' && isCollectionDocument(document))
        .map((document) => document.name);
      const processItems = selectedDocuments
        .filter((document) => !isCollectionDocument(document))
        .map((document) => document.name);

      return [
        {
          id: 'seller-collection',
          title: 'Συλλογή Εγγράφων Πωλητή',
          description: 'Έγγραφα που ανεβάζει ο πωλητής πριν ξεκινήσει η διαδικασία.',
          items: sellerItems,
          accentClass: 'bg-[var(--brand-primary)]',
        },
        {
          id: 'buyer-collection',
          title: 'Συλλογή Εγγράφων Αγοραστή',
          description: 'Έγγραφα που ανεβάζει ο αγοραστής πριν ξεκινήσει η διαδικασία.',
          items: buyerItems,
          accentClass: 'bg-[var(--brand-primary)]',
        },
        {
          id: 'process-documents',
          title: 'Διαδικασία Μελών',
          description: 'Έγγραφα που ζητούνται μέσα στα στάδια της διαδικασίας.',
          items: processItems,
          accentClass: 'bg-[var(--status-info)]',
        },
        {
          id: 'deal-completion',
          title: 'Ολοκλήρωση',
          description: 'Η τελική φάση μετά την έγκριση όλων των προηγούμενων εγγράφων.',
          items: [],
          accentClass: 'bg-[var(--status-success)]',
        },
      ];
    },
    [processRequiredDocumentNames, selectedDocuments],
  );
  const processPhaseSections = useMemo(
    () => [
      {
        id: 'client-collection',
        title: 'Συλλογή Εγγράφων',
        description: 'Η διαδικασία ενεργοποιείται αφού ολοκληρωθεί ο φάκελος του πελάτη.',
        items: ['Ολοκλήρωση ελέγχου φακέλου πελάτη'],
        accentClass: 'bg-[var(--brand-primary)]',
      },
      {
        id: 'process-members',
        title: 'Διαδικασία Μελών',
        description: 'Στάδια που εκτελούν τα μέλη και ξεκλειδώνουν τη συναλλαγή.',
        items: processRows.map((row, index) => row.title || `Στάδιο ${index + 1}`),
        accentClass: 'bg-[var(--status-info)]',
      },
      {
        id: 'deal-completion',
        title: 'Ολοκλήρωση',
        description: 'Τελική επιβεβαίωση του μεσίτη όταν όλα τα στάδια έχουν ολοκληρωθεί.',
        items: ['Επιβεβαίωση Ολοκλήρωσης'],
        accentClass: 'bg-[var(--status-success)]',
      },
    ],
    [processRows],
  );
  const documentPreviewNodes = useMemo<TemplatePreviewNode[]>(
    () =>
      selectedDocuments.map((document) => {
        const dependencyDocuments = document.dependencies
          .map((dependencyId) => selectedDocuments.find((item) => item.id === dependencyId))
          .filter((item): item is typeof selectedDocuments[number] => Boolean(item));

        return {
          id: document.id,
          label: document.name,
          subtitle: `${document.category} · ${document.role} · ${document.estimatedDays}η`,
          dependencies: dependencyDocuments.map((dependency) => dependency.id),
          documentBadges: dependencyDocuments.map((dependency) => `${dependency.name} · ${dependency.category}`),
          documentBadgesLabel: 'Προαπαιτούμενα Έγγραφα',
        phaseBadge: isCollectionDocument(document)
          ? (document.partyRole === 'SELLER' ? 'Συλλογή Εγγράφων Πωλητή' : 'Συλλογή Εγγράφων Αγοραστή')
          : 'Διαδικασία Μελών',
          accentClass: isCollectionDocument(document)
            ? 'bg-[var(--brand-primary)]/80'
            : 'bg-[var(--status-info)]/80',
        };
      }),
    [processRequiredDocumentNames, selectedDocuments],
  );
  const processPreviewNodes = useMemo<TemplatePreviewNode[]>(
    () =>
      processRows.map((row, index) => ({
        id: row.id,
        label: row.title || `Στάδιο ${index + 1}`,
        subtitle: `${processRoleLabel(row.role, row.partyRole, row.professionalRoleName)} · ${row.deadlineDays}η`,
        dependencies: row.dependencies,
        phaseBadge: 'Διαδικασία Μελών',
        accentClass: 'bg-[var(--status-info)]/80',
        documentBadges: row.requiredDocuments.map((documentName) => {
          const documentOption = (availableProcessDocumentOptions.get(row.role) ?? []).find((option) => option.name === documentName);
          return documentOption
            ? `${documentOption.name} · ${documentOption.category}`
            : documentName;
        }),
      })),
    [availableProcessDocumentOptions, processRows, roleLabel],
  );
  const previewNodes = useMemo(() => {
    const baseNodes = mode === 'documents' ? documentPreviewNodes : processPreviewNodes;
    if (previewPhaseFilter === 'all') {
      return baseNodes;
    }

    const filteredIds = new Set(
      baseNodes
        .filter((node) => {
          if (mode === 'documents') {
            if (previewPhaseFilter === 'seller-collection') return node.phaseBadge === 'Συλλογή Εγγράφων Πωλητή';
            if (previewPhaseFilter === 'buyer-collection') return node.phaseBadge === 'Συλλογή Εγγράφων Αγοραστή';
            if (previewPhaseFilter === 'process-documents') return node.phaseBadge === 'Διαδικασία Μελών';
            return false;
          }

          if (previewPhaseFilter === 'process-members') return node.phaseBadge === 'Διαδικασία Μελών';
          return false;
        })
        .map((node) => node.id),
    );

    return baseNodes
      .filter((node) => filteredIds.has(node.id))
      .map((node) => ({
        ...node,
        dependencies: node.dependencies.filter((dependencyId) => filteredIds.has(dependencyId)),
      }));
  }, [documentPreviewNodes, mode, previewPhaseFilter, processPreviewNodes]);
  const scenarioTypeMap: Record<ScenarioId, string> = {
    simple: 'apartment',
    inheritance: 'inheritance',
    irregular: 'irregular',
    gift: 'parental',
    other: 'custom',
  };

  const updateExpandedCategories = (rows: DocumentRow[]) => {
    setExpandedCategories({
      'Νομικά Έγγραφα': rows.some((d) => d.category === 'Νομικά Έγγραφα'),
      'Τεχνικά Έγγραφα': rows.some((d) => d.category === 'Τεχνικά Έγγραφα'),
      'Φορολογικά Έγγραφα': rows.some((d) => d.category === 'Φορολογικά Έγγραφα'),
      'Δημοτικά / Διοικητικά': rows.some((d) => d.category === 'Δημοτικά / Διοικητικά'),
      'Στοιχεία Συμβαλλομένων': rows.some((d) => d.category === 'Στοιχεία Συμβαλλομένων'),
    });
  };

  const findDocumentSeedTemplate = (scenario: ScenarioId, templates: ApiDocumentTemplate[]) => {
    if (scenario === 'other') return null;
    const templateType = templateTypeForScenario(scenario);
    return templates.find((template) => template.systemDefault && template.type === templateType) ?? null;
  };

  const findProcessSeedTemplate = (scenario: ScenarioId, templates: ApiProcessTemplate[]) => {
    if (scenario === 'other') return null;
    const templateType = templateTypeForScenario(scenario);
    return templates.find((template) => template.systemDefault && template.type === templateType) ?? null;
  };

  const openNewTemplateModal = () => {
    const baseScenario = mode === 'documents' ? selectedScenario : 'simple';
    setNewTemplateDraft({
      name: mode === 'documents' ? 'Νέο Template Εγγράφων' : 'Νέο Template Διαδικασίας',
      description: mode === 'documents'
        ? 'Νέο custom template για το γραφείο.'
        : 'Νέο process flow για συναλλαγή ακινήτου.',
      type: scenarioTypeMap[baseScenario],
      scenario: baseScenario,
    });
    setNewTemplateModalOpen(true);
  };

  const startNewTemplate = () => {
    const draftScenario = mode === 'documents' ? newTemplateDraft.scenario : 'simple';
    setTemplateName(newTemplateDraft.name.trim() || (mode === 'documents' ? 'Νέο Template Εγγράφων' : 'Νέο Template Διαδικασίας'));
    setTemplateDescription(newTemplateDraft.description.trim());
    setTemplateType(newTemplateDraft.type.trim() || scenarioTypeMap[draftScenario]);

    if (mode === 'documents') {
      setSelectedScenario(draftScenario);
      setSelectedDocumentTemplateId('');
      const seedTemplate = findDocumentSeedTemplate(draftScenario, documentTemplates);
      if (seedTemplate) {
        applyBackendDocTemplate(seedTemplate);
        setSelectedDocumentTemplateId('');
        setTemplateName(newTemplateDraft.name.trim() || 'Νέο Template Εγγράφων');
        setTemplateDescription(newTemplateDraft.description.trim());
        setTemplateType(newTemplateDraft.type.trim() || scenarioTypeMap[draftScenario]);
      } else {
        setRoles([]);
        setDocuments([]);
        updateExpandedCategories([]);
      }
    } else {
      setSelectedProcessTemplateId('');
      const seedTemplate = findProcessSeedTemplate(draftScenario, processTemplates);
      if (seedTemplate) {
        applyBackendProcessTemplate(seedTemplate);
        setSelectedProcessTemplateId('');
        setTemplateName(newTemplateDraft.name.trim() || 'Νέο Template Διαδικασίας');
        setTemplateDescription(newTemplateDraft.description.trim());
        setTemplateType(newTemplateDraft.type.trim() || scenarioTypeMap[draftScenario]);
      } else {
        setProcessRows([]);
      }
    }

    showToast(mode === 'documents' ? 'Ξεκίνησε νέο template εγγράφων.' : 'Ξεκίνησε νέο template διαδικασίας.', 'info');
    setNewTemplateModalOpen(false);
  };

  const addProcessDependency = (rowId: string, dependencyId: string) => {
    if (!dependencyId) return;
    setProcessRows((prev) => prev.map((stage) => {
      if (stage.id !== rowId) return stage;
      if (stage.dependencies.includes(dependencyId)) return stage;
      return { ...stage, dependencies: [...stage.dependencies, dependencyId] };
    }));
  };

  const removeProcessDependency = (rowId: string, dependencyId: string) => {
    setProcessRows((prev) => prev.map((stage) => (
      stage.id === rowId
        ? { ...stage, dependencies: stage.dependencies.filter((item) => item !== dependencyId) }
        : stage
    )));
  };

  const handleScenarioChange = (scenario: ScenarioId) => {
    setSelectedScenario(scenario);
    setTemplateType(templateTypeForScenario(scenario));
    setContentVisible(false);

    const seedTemplate = findDocumentSeedTemplate(scenario, documentTemplates);
    if (seedTemplate) {
      applyBackendDocTemplate(seedTemplate);
      setSelectedDocumentTemplateId('');
    } else {
      setRoles([]);
      setDocuments([]);
      updateExpandedCategories([]);
    }

    setTimeout(() => setContentVisible(true), 120);
  };

  const setRoleActive = (name: string, active: boolean) => {
    setRoles((prev) => prev.map((role) => (role.name === name ? { ...role, active } : role)));

    if (!active) {
      setDocuments((prev) => {
        const fallbackRole = roles.find((r) => r.name !== name && r.active)?.name ?? 'Μεσίτης';
        return prev.map((doc) => (doc.role === name ? { ...doc, role: fallbackRole } : doc));
      });
    }
  };

  const addCustomRole = () => {
    const value = customRoleInput.trim();
    if (!value) return;
    setRoles((prev) => {
      if (prev.some((r) => r.name.toLowerCase() === value.toLowerCase())) return prev;
      return [...prev, { name: value, active: true }];
    });
    setCustomRoleInput('');
    setShowCustomRoleInput(false);
  };

  const updateRow = (rowId: string, updates: Partial<DocumentRow>) => {
    setDocuments((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...updates } : row)));
  };

  const addRowToCategory = (category: CategoryId) => {
    const nextId = `custom-${Date.now()}`;
    const defaultRole = roleOptionsByParty.BUYER?.[0] ?? activeRoles[0] ?? 'Μεσίτης';
    setDocuments((prev) => [
      ...prev,
      {
        id: nextId,
        category,
        name: '',
        role: defaultRole,
        partyRole: 'BUYER',
        collectionPhase: true,
        estimatedDays: 1,
        dependencies: [],
        checked: true,
        isCustom: true,
      },
    ]);
    setExpandedCategories((prev) => ({ ...prev, [category]: true }));
  };

  const applyBackendDocTemplate = (template: ApiDocumentTemplate) => {
    setSelectedDocumentTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(`Τύπος: ${template.type}`);
    setTemplateType(template.type);
    if (template.type === 'apartment') setSelectedScenario('simple');
    if (template.type === 'inheritance') setSelectedScenario('inheritance');
    if (template.type === 'irregular') setSelectedScenario('irregular');
    if (template.type === 'parental') setSelectedScenario('gift');
    if (!['apartment', 'inheritance', 'irregular', 'parental'].includes(template.type)) setSelectedScenario('other');
    const mappedRows: DocumentRow[] = template.documents.map((document, index) => {
      const parsed = parseDescription(document.description);
      return {
        id: createDocId(document.name, index),
        name: document.name,
        category: parsed?.category ?? CATEGORY_ORDER[index % CATEGORY_ORDER.length],
        role: parsed?.role ?? 'Μεσίτης',
        partyRole: document.partyRole ?? 'BUYER',
        collectionPhase: document.collectionPhase ?? true,
        estimatedDays: parsed?.estimatedDays ?? 3,
        dependencies: [],
        checked: document.required ?? true,
      };
    });
    const idByName = new Map(mappedRows.map((row) => [row.name, row.id]));
    const rowsWithDependencies = mappedRows.map((row, index) => {
      const parsed = parseDescription(template.documents[index].description);
      return {
        ...row,
        dependencies: (parsed?.dependencyNames ?? [])
          .map((dependencyName) => idByName.get(dependencyName))
          .filter((value): value is string => Boolean(value)),
      };
    });
    setDocuments(rowsWithDependencies);
    const mappedRoles = Array.from(new Set(rowsWithDependencies.map((row) => row.role).filter(Boolean)));
    setRoles(
      (mappedRoles.length > 0 ? mappedRoles : ['Μεσίτης']).map((name) => ({
        name,
        active: true,
      })),
    );
    updateExpandedCategories(rowsWithDependencies);
  };

  const applyBackendProcessTemplate = (template: ApiProcessTemplate) => {
    setSelectedProcessTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(`Τύπος: ${template.type}`);
    setTemplateType(template.type);
    if (template.type === 'apartment') setSelectedScenario('simple');
    if (template.type === 'inheritance') setSelectedScenario('inheritance');
    if (template.type === 'irregular') setSelectedScenario('irregular');
    if (template.type === 'parental') setSelectedScenario('gift');
    if (!['apartment', 'inheritance', 'irregular', 'parental'].includes(template.type)) setSelectedScenario('other');
    setProcessRows(toProcessRows(template));
  };

  const createOrUpdateDocumentTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      return;
    }
    const selected = documents.filter((document) => document.checked && document.name.trim().length > 0);
    if (selected.length === 0) {
      return;
    }
    setSavingTemplate(true);
    try {
      const payload = {
        name,
        type: templateType,
        documents: selected.map((document) => ({
          name: document.name.trim(),
          description: buildDocumentDescription(document, documents),
          required: true,
          partyRole: document.partyRole,
          collectionPhase: document.collectionPhase ?? true,
        })),
      };
      const selectedTemplate = documentTemplates.find((template) => template.id === selectedDocumentTemplateId);
      const saved = selectedTemplate && !selectedTemplate.systemDefault
        ? await updateDocumentTemplate(selectedTemplate.id, payload)
        : await createDocumentTemplate(payload);
      const refreshed = await listDocumentTemplates();
      setDocumentTemplates(refreshed);
      applyBackendDocTemplate(saved);
      showToast('Το template εγγράφων αποθηκεύτηκε.', 'success');
    } catch {
      showToast('Αποτυχία αποθήκευσης template εγγράφων.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const createOrUpdateProcessTemplate = async () => {
    const name = templateName.trim();
    if (!name || processRows.length === 0) return;
    setSavingTemplate(true);
    try {
      const payload = {
        name,
        type: templateType,
        stages: processRows.map((row) => ({
          title: row.title.trim(),
          role: row.role,
          professionalRoleId: row.professionalRoleId,
          partyRole: row.partyRole,
          dependencies: row.dependencies,
          deadlineDays: row.deadlineDays,
          requiredDocuments: row.requiredDocuments,
        })),
      };
      const selectedTemplate = processTemplates.find((template) => template.id === selectedProcessTemplateId);
      const saved = selectedTemplate && !selectedTemplate.systemDefault
        ? await updateProcessTemplate(selectedTemplate.id, payload)
        : await createProcessTemplate(payload);
      const refreshed = await listProcessTemplates();
      setProcessTemplates(refreshed);
      applyBackendProcessTemplate(saved);
      showToast('Το template διαδικασίας αποθηκεύτηκε.', 'success');
    } catch {
      showToast('Αποτυχία αποθήκευσης template διαδικασίας.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (mode === 'documents') {
      await createOrUpdateDocumentTemplate();
      return;
    }
    await createOrUpdateProcessTemplate();
  };

  const handleCopyTemplate = async () => {
    try {
      if (mode === 'documents') {
        const selected = documents.filter((document) => document.checked && document.name.trim().length > 0);
        if (selected.length === 0) return;
        const created = await createDocumentTemplate({
          name: `${templateName.trim() || 'Template'} (Copy)`,
          type: templateType,
          documents: selected.map((document) => ({
            name: document.name.trim(),
            description: buildDocumentDescription(document, documents),
            required: true,
            partyRole: document.partyRole,
            collectionPhase: document.collectionPhase ?? true,
          })),
        });
        const refreshed = await listDocumentTemplates();
        setDocumentTemplates(refreshed);
        applyBackendDocTemplate(created);
        showToast('Το αντίγραφο template εγγράφων δημιουργήθηκε.', 'success');
        return;
      }
      if (processRows.length === 0) return;
      const created = await createProcessTemplate({
        name: `${templateName.trim() || 'Template'} (Copy)`,
        type: templateType,
        stages: processRows.map((row) => ({
          title: row.title,
          role: row.role,
          professionalRoleId: row.professionalRoleId,
          partyRole: row.partyRole,
          dependencies: row.dependencies,
          deadlineDays: row.deadlineDays,
          requiredDocuments: row.requiredDocuments,
        })),
      });
      const refreshed = await listProcessTemplates();
      setProcessTemplates(refreshed);
      applyBackendProcessTemplate(created);
      showToast('Το αντίγραφο template διαδικασίας δημιουργήθηκε.', 'success');
    } catch {
      showToast('Αποτυχία αντιγραφής template.', 'error');
    }
  };

  const handleDeleteTemplate = async () => {
    setDeletingTemplate(true);
    try {
      if (mode === 'documents') {
        const selected = documentTemplates.find((template) => template.id === selectedDocumentTemplateId);
        if (!selected || selected.systemDefault) return;
        await deleteDocumentTemplate(selected.id);
        const refreshed = await listDocumentTemplates();
        setDocumentTemplates(refreshed);
        if (refreshed.length > 0) {
          applyBackendDocTemplate(refreshed[0]);
        }
        showToast('Το template εγγράφων διαγράφηκε.', 'success');
        return;
      }
      const selected = processTemplates.find((template) => template.id === selectedProcessTemplateId);
      if (!selected || selected.systemDefault) return;
      await deleteProcessTemplate(selected.id);
      const refreshed = await listProcessTemplates();
      setProcessTemplates(refreshed);
      if (refreshed.length > 0) {
        applyBackendProcessTemplate(refreshed[0]);
      }
      showToast('Το template διαδικασίας διαγράφηκε.', 'success');
    } catch {
      showToast('Αποτυχία διαγραφής template.', 'error');
    } finally {
      setDeletingTemplate(false);
    }
  };

  const isSelectedSystemTemplate = mode === 'documents'
    ? documentTemplates.find((template) => template.id === selectedDocumentTemplateId)?.systemDefault ?? false
    : processTemplates.find((template) => template.id === selectedProcessTemplateId)?.systemDefault ?? false;

  return (
    <div className="min-h-screen bg-[var(--page-bg)]">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-[var(--border-default)] bg-[var(--surface-glow)] p-5">
          <div className="sticky top-5 space-y-5">
            <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Templates</p>
              <h1 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Καλούπια Συναλλαγών</h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Φτιάξε πρότυπα που ο μεσίτης αναγνωρίζει άμεσα και χρησιμοποιεί χωρίς να στήνει κάθε υπόθεση από την αρχή.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setMode('documents')}
                className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                  mode === 'documents'
                    ? 'bg-[var(--brand-primary)] text-white shadow-[0_12px_28px_rgba(232,112,10,0.24)]'
                    : 'border border-[var(--border-default)] bg-[var(--surface-glow)] text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]'
                }`}
              >
                Templates Εγγράφων
              </button>
              <button
                onClick={() => setMode('process')}
                className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                  mode === 'process'
                    ? 'bg-[var(--brand-primary)] text-white shadow-[0_12px_28px_rgba(232,112,10,0.24)]'
                    : 'border border-[var(--border-default)] bg-[var(--surface-glow)] text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]'
                }`}
              >
                Templates Διαδικασίας
              </button>
            </div>

            <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Βιβλιοθήκη</p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {templateLibrary.length} διαθέσιμα {mode === 'documents' ? 'document templates' : 'process templates'}
                  </p>
                </div>
                <button
                  onClick={openNewTemplateModal}
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)]"
                >
                  <Plus size={13} />
                  Νέο
                </button>
              </div>

              <div className="space-y-2">
                {templateLibrary.map((template) => {
                  const selected = mode === 'documents'
                    ? template.id === selectedDocumentTemplateId
                    : template.id === selectedProcessTemplateId;

                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        if (mode === 'documents') {
                          applyBackendDocTemplate(template as ApiDocumentTemplate);
                          return;
                        }
                        const processTemplate = template as ApiProcessTemplate;
                        setTemplateName(processTemplate.name);
                        setTemplateDescription(`Τύπος: ${processTemplate.type}`);
                        applyBackendProcessTemplate(processTemplate);
                      }}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        selected
                          ? 'border-[var(--border-brand)] bg-[rgba(232,112,10,0.06)]'
                          : 'border-[var(--border-default)] bg-[var(--surface-glow)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{template.name}</p>
                          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                            Τύπος: {template.type} · {template.systemDefault ? 'Default' : 'Custom'}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          template.systemDefault
                            ? 'border border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]'
                            : 'border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                        }`}>
                          {template.systemDefault ? 'Default' : 'Custom'}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {templateLibrary.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-ambient)] px-3 py-4 text-sm text-[var(--text-tertiary)]">
                    Δεν υπάρχουν templates ακόμη.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Τρέχουσα Σύνοψη</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--surface-ambient)] p-3">
                  <p className="text-xs text-[var(--text-tertiary)]">{mode === 'documents' ? 'Έγγραφα' : 'Στάδια'}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                    {mode === 'documents' ? selectedDocuments.length : processRows.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-ambient)] p-3">
                  <p className="text-xs text-[var(--text-tertiary)]">{mode === 'documents' ? 'Ρόλοι' : 'Σύνολο Ημερών'}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                    {mode === 'documents' ? activeRoles.length : processEstimatedDays}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="px-6 py-6 pb-28">
          <div className="mx-auto max-w-7xl">
            <section className="mb-6 rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-neutral-text)]">
                      {mode === 'documents' ? 'Document Template' : 'Process Template'}
                    </span>
                    {currentTemplate?.systemDefault && (
                      <span className="rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-info-text)]">
                        System Default
                      </span>
                    )}
                  </div>

                  <input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full bg-transparent text-2xl font-semibold text-[var(--text-primary)] outline-none"
                    placeholder="Όνομα Template..."
                  />
                  <input
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    className="mt-2 w-full bg-transparent text-sm text-[var(--text-secondary)] outline-none"
                    placeholder="Περιγραφή που θα καταλαβαίνει ο μεσίτης με μια ματιά"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
                    <span>Τύπος:</span>
                    <input
                      value={templateType}
                      onChange={(e) => setTemplateType(e.target.value)}
                      className="min-w-[180px] rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-1.5 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                      placeholder="apartment / inheritance / parental"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 xl:min-w-[360px]">
                  <div className="rounded-2xl bg-[var(--surface-ambient)] p-4">
                    <p className="text-xs text-[var(--text-tertiary)]">Αντικείμενα</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                      {mode === 'documents' ? selectedDocuments.length : processRows.length}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      {mode === 'documents' ? 'έγγραφα προς συλλογή' : 'στάδια διαδικασίας'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-ambient)] p-4">
                    <p className="text-xs text-[var(--text-tertiary)]">Εκτίμηση</p>
                    <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                      ~{mode === 'documents' ? estimatedDays : processEstimatedDays} ημ.
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      {mode === 'documents' ? `${selectedCategoryCount} κατηγορίες` : 'συνολικό planned window'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <ScenarioSelector selected={selectedScenario} onSelect={handleScenarioChange} />

            <div className={`transition-opacity duration-300 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>
              {mode === 'documents' ? (
                <>
                  <section className="mb-6 rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5">
                    {loadingTemplates && <p className="mb-2 text-xs text-[var(--text-tertiary)]">Φόρτωση templates από backend...</p>}
                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Εμπλεκόμενοι Ρόλοι</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Κράτησε ενεργούς μόνο τους ρόλους που πρέπει να φαίνονται στο template του μεσίτη.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {roles.map((role) => (
                        <button
                          key={role.name}
                          onClick={() => setRoleActive(role.name, !role.active)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                            role.active
                              ? 'border-[var(--border-strong)] bg-[var(--surface-glow)] text-[var(--text-primary)]'
                              : 'border-[var(--border-default)] bg-[var(--surface-ambient)] text-[var(--text-tertiary)] line-through'
                          }`}
                        >
                          {role.name}
                          {role.active && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setRoleActive(role.name, false);
                              }}
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--surface-ambient)] text-[var(--text-tertiary)]"
                            >
                              <X size={11} />
                            </span>
                          )}
                        </button>
                      ))}

                      {!showCustomRoleInput ? (
                        <button
                          onClick={() => setShowCustomRoleInput(true)}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)]"
                        >
                          <Plus size={14} />
                          Άλλος Ρόλος
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <input
                            autoFocus
                            value={customRoleInput}
                            onChange={(e) => setCustomRoleInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addCustomRole();
                            }}
                            className="rounded-full border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)]"
                            placeholder="Νέος ρόλος"
                          />
                          <button onClick={addCustomRole} className="rounded-xl bg-[var(--brand-primary)] px-2.5 py-1.5 text-xs font-semibold text-white">
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  </section>

                  <section>
                    {CATEGORY_ORDER.map((category) => {
                      const rows = docsByCategory.get(category) ?? [];
                      return (
                        <DocumentCategorySection
                          key={category}
                          category={category}
                          rows={rows}
                          allRows={documents}
                          activeRoles={activeRoles.length > 0 ? activeRoles : ['Μεσίτης']}
                          roleOptionsByParty={roleOptionsByParty}
                          expanded={expandedCategories[category]}
                          onToggle={() => setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }))}
                          onUpdateRow={updateRow}
                          onAddRow={addRowToCategory}
                          onInvalidDependency={(message) => showToast(message, 'warning')}
                        />
                      );
                    })}
                  </section>
                </>
              ) : (
                <section className="space-y-4">
                  <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Flow Σταδίων</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Δήλωσε ρόλο, duration και dependencies ώστε ο μεσίτης να βλέπει άμεσα πώς εκτελείται η διαδικασία.
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setProcessRows((prev) => [
                            ...prev,
                            {
                              id: `stage-${Date.now()}`,
                              title: '',
                              role: 'OTHER',
                              professionalRoleId: undefined,
                              professionalRoleName: undefined,
                              partyRole: null,
                              deadlineDays: 3,
                              dependencies: [],
                              requiredDocuments: [],
                            },
                          ])
                        }
                        className="inline-flex items-center gap-1 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)]"
                      >
                        <Plus size={14} />
                        Προσθήκη Σταδίου
                      </button>
                    </div>

                    <div className="space-y-3">
                      {processRows.map((row, index) => (
                        <div key={row.id} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                      <p className="text-sm font-semibold text-[var(--text-primary)]">Στάδιο {index + 1}</p>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Ρόλος: {processRoleLabel(row.role, row.partyRole, row.professionalRoleName)} · {row.deadlineDays} ημέρες
                              </p>
                                    </div>
                            <button
                              onClick={() => setProcessRows((prev) => prev.filter((stage) => stage.id !== row.id))}
                              className="rounded-xl border border-[var(--status-danger-border)] px-3 py-1.5 text-xs font-semibold text-[var(--status-danger-text)] transition hover:bg-[var(--status-danger-bg)]"
                            >
                              Διαγραφή
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                            <input
                              value={row.title}
                              onChange={(event) => {
                                const value = event.target.value;
                                setProcessRows((prev) => prev.map((stage) => stage.id === row.id ? { ...stage, title: value } : stage));
                              }}
                              className="xl:col-span-5 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)]"
                              placeholder="Τίτλος σταδίου"
                            />
                            <select
                              value={row.role}
                              onChange={(event) => {
                                const value = event.target.value as ApiProcessTemplateStage['role'];
                                setProcessRows((prev) => prev.map((stage) => stage.id === row.id ? {
                                  ...stage,
                                  role: value,
                                  professionalRoleId: undefined,
                                  professionalRoleName: undefined,
                                } : stage));
                              }}
                              className="xl:col-span-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                            >
                              {roleOptions.map((role) => (
                                <option key={role} value={role}>{roleLabel[role]}</option>
                              ))}
                            </select>
                            <select
                              value={row.professionalRoleId ?? ''}
                              onChange={(event) => {
                                const roleId = event.target.value || undefined;
                                const selectedRole = professionalRoles.find((item) => item.id === roleId);
                                setProcessRows((prev) => prev.map((stage) => stage.id === row.id ? {
                                  ...stage,
                                  professionalRoleId: roleId,
                                  professionalRoleName: selectedRole?.label,
                                } : stage));
                              }}
                              className="xl:col-span-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                            >
                              <option value="">Default από κατηγορία</option>
                              {professionalRoles
                                .filter((item) => item.legacyMemberRole === row.role)
                                .map((item) => (
                                  <option key={`${row.id}-${item.id}`} value={item.id}>{item.label}</option>
                                ))}
                            </select>
                            <select
                              value={row.partyRole ?? 'ANY'}
                              onChange={(event) => {
                                const rawValue = event.target.value as 'ANY' | DocumentRow['partyRole'];
                                const value = rawValue === 'ANY' ? null : rawValue;
                                setProcessRows((prev) => prev.map((stage) => stage.id === row.id ? { ...stage, partyRole: value } : stage));
                              }}
                              className="xl:col-span-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                            >
                              <option value="ANY">Κοινό για όλους</option>
                              <option value="BUYER">Αγοραστής</option>
                              <option value="SELLER">Πωλητής</option>
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={row.deadlineDays}
                              onChange={(event) => {
                                const value = Number(event.target.value) || 1;
                                setProcessRows((prev) => prev.map((stage) => stage.id === row.id ? { ...stage, deadlineDays: value } : stage));
                              }}
                              className="xl:col-span-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] px-3 py-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                              placeholder="Ημέρες"
                            />
                            <div className="xl:col-span-2 rounded-2xl bg-[var(--surface-glow)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
                              Deadline
                              <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">+{row.deadlineDays} ημ.</div>
                            </div>
                            <div className="xl:col-span-12">
                              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Dependencies</label>
                              <div className="mt-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-3">
                                <div className="flex flex-wrap gap-2">
                                  {row.dependencies.length === 0 && (
                                    <span className="text-xs text-[var(--text-tertiary)]">Δεν έχουν οριστεί εξαρτήσεις.</span>
                                  )}
                                  {row.dependencies.map((dependencyId) => {
                                    const dependencyStage = processRows.find((stage) => stage.id === dependencyId);
                                    return (
                                      <span
                                        key={`${row.id}-${dependencyId}`}
                                        className="inline-flex items-center gap-2 rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-info-text)]"
                                      >
                                        {dependencyStage?.title || 'Άγνωστο στάδιο'}
                                        <button
                                          type="button"
                                          onClick={() => removeProcessDependency(row.id, dependencyId)}
                                          className="text-[var(--status-info-text)]/80 transition hover:text-[var(--status-info-text)]"
                                        >
                                          <X size={12} />
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>

                                <div className="mt-3 flex items-center gap-2">
                                  <select
                                    value=""
                                    onChange={(event) => {
                                      addProcessDependency(row.id, event.target.value);
                                      event.currentTarget.value = '';
                                    }}
                                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                                  >
                                    <option value="">Προσθήκη εξάρτησης…</option>
                                    {processRows
                                      .filter((stage) => stage.id !== row.id && !row.dependencies.includes(stage.id))
                                      .map((stage, dependencyIndex) => (
                                        <option key={stage.id} value={stage.id}>
                                          {stage.title || `Στάδιο ${dependencyIndex + 1}`}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div className="xl:col-span-12">
                              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                                Απαιτούμενα Έγγραφα
                              </label>
                              <div className="mt-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-3">
                                <div className="flex flex-wrap gap-2">
                                  {row.requiredDocuments.length === 0 && (
                                    <span className="text-xs text-[var(--text-tertiary)]">
                                      Δεν έχουν οριστεί απαιτούμενα έγγραφα.
                                    </span>
                                  )}
                                  {row.requiredDocuments.map((documentName) => (
                                    <span
                                      key={`${row.id}-${documentName}`}
                                      className="inline-flex items-center gap-2 rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-info-text)]"
                                    >
                                      {documentName}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setProcessRows((prev) => prev.map((stage) => (
                                            stage.id === row.id
                                              ? { ...stage, requiredDocuments: stage.requiredDocuments.filter((item) => item !== documentName) }
                                              : stage
                                          )));
                                        }}
                                        className="text-[var(--status-info-text)]/80 transition hover:text-[var(--status-info-text)]"
                                      >
                                        <X size={12} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <select
                                    value=""
                                    onChange={(event) => {
                                      const selectedDocument = event.target.value;
                                      if (!selectedDocument) return;
                                      setProcessRows((prev) => prev.map((stage) => (
                                        stage.id === row.id && !stage.requiredDocuments.includes(selectedDocument)
                                          ? { ...stage, requiredDocuments: [...stage.requiredDocuments, selectedDocument] }
                                          : stage
                                      )));
                                      event.currentTarget.value = '';
                                    }}
                                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                                  >
                                    <option value="">Επιλογή εγγράφου από τον ρόλο…</option>
                                    {(availableProcessDocumentOptions.get(row.role) ?? [])
                                      .filter((option) => {
                                        if (row.partyRole != null && option.partyRole !== row.partyRole) {
                                          return false;
                                        }
                                        if (row.professionalRoleName) {
                                          return normalizeRoleText(option.role) === normalizeRoleText(row.professionalRoleName)
                                            && !row.requiredDocuments.includes(option.name);
                                        }
                                        return !row.requiredDocuments.includes(option.name);
                                      })
                                      .map((option) => (
                                        <option key={`${row.id}-${option.name}`} value={option.name}>
                                          {option.name} · {option.role} · {option.category}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                                  Η λίστα προέρχεται από τα templates εγγράφων του ίδιου τύπου και φιλτράρεται με βάση ρόλο. Αν επιλέξεις ειδική πλευρά, φιλτράρεται και σε αγοραστή/πωλητή.
                                </p>
                                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                                  Αν δεν βλέπεις ένα έγγραφο εδώ, έλεγξε στο tab εγγράφων ότι δεν είναι σημειωμένο ως `Πριν τη διαδικασία`.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {mode === 'documents'
              ? `${selectedDocuments.length} έγγραφα · ${activeRoles.length} ρόλοι · ~${estimatedDays} ημέρες εκτίμηση`
              : `${processRows.length} στάδια διαδικασίας · ~${processEstimatedDays} ημέρες εκτίμηση`}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleCopyTemplate()}
              className="inline-flex items-center gap-1 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)]"
            >
              <Copy size={14} />
              Αντιγραφή
            </button>
            <button
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)]"
            >
              <Eye size={14} />
              Preview
            </button>
            <button
              onClick={() => void handleDeleteTemplate()}
              disabled={isSelectedSystemTemplate || deletingTemplate}
              className="inline-flex items-center gap-1 rounded-2xl border border-[var(--status-danger-border)] bg-[var(--surface-glow)] px-3 py-2 text-sm text-[var(--status-danger-text)] transition hover:bg-[var(--status-danger-bg)] disabled:opacity-50"
            >
              Διαγραφή
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="inline-flex items-center gap-1 rounded-2xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
            >
              <Save size={14} />
              {savingTemplate ? 'Αποθήκευση...' : 'Αποθήκευση Template'}
            </button>
          </div>
        </div>
      </div>

      {newTemplateModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Νέο Template</p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                {mode === 'documents' ? 'Νέο Template Εγγράφων' : 'Νέο Template Διαδικασίας'}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Δήλωσε τα βασικά στοιχεία ώστε ο μεσίτης να ξεκινά με σωστή βάση.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Όνομα</span>
                <input
                  value={newTemplateDraft.name}
                  onChange={(event) => setNewTemplateDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)]"
                  placeholder="π.χ. Κληρονομιά + Πώληση Νοτίων Προαστίων"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Περιγραφή</span>
                <input
                  value={newTemplateDraft.description}
                  onChange={(event) => setNewTemplateDraft((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)]"
                  placeholder="Σύντομη περιγραφή για το γραφείο"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Τύπος</span>
                  <input
                    value={newTemplateDraft.type}
                    onChange={(event) => setNewTemplateDraft((prev) => ({ ...prev, type: event.target.value }))}
                    className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-brand)]"
                    placeholder="apartment / inheritance / parental"
                  />
                </label>

                {mode === 'documents' && (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Scenario</span>
                    <select
                      value={newTemplateDraft.scenario}
                      onChange={(event) => {
                        const scenario = event.target.value as ScenarioId;
                        setNewTemplateDraft((prev) => ({
                          ...prev,
                          scenario,
                          type: scenarioTypeMap[scenario],
                        }));
                      }}
                      className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] px-3 py-2 text-sm text-[var(--text-secondary)] outline-none focus:border-[var(--border-brand)]"
                    >
                      {SCENARIOS.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setNewTemplateModalOpen(false)}
                className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)]"
              >
                Ακύρωση
              </button>
              <button
                onClick={startNewTemplate}
                className="rounded-2xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-hover)]"
              >
                Δημιουργία Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--surface-glow)] shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] px-5 py-4">
              <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Preview</p>
        <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
          {mode === 'documents' ? 'Preview Εξαρτήσεων Εγγράφων' : 'Preview Flow Σταδίων'}
        </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {mode === 'documents'
                    ? 'Δείχνει τη σειρά των εγγράφων, τη χαρτογράφησή τους στις φάσεις της συναλλαγής και ποια προαπαιτούμενα χρειάζεται κάθε έγγραφο.'
                    : 'Δείχνει τη ροή των σταδίων, τη χαρτογράφησή τους στις φάσεις της συναλλαγής και ποια έγγραφα απαιτούνται σε κάθε στάδιο.'}
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-ambient)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-glow-active)]"
              >
                Κλείσιμο
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <TemplatePhasePreview
                sections={mode === 'documents' ? documentPhaseSections : processPhaseSections}
                selectedSectionId={previewPhaseFilter}
                onSelectSection={setPreviewPhaseFilter}
              />
              <TemplateDependencyPreview
                title={mode === 'documents' ? 'Γράφημα Εγγράφων' : 'Γράφημα Σταδίων'}
                description={
                  mode === 'documents'
                    ? 'Τα έγγραφα τοποθετούνται σε βήματα με βάση τις εξαρτήσεις τους, αλλά και στη σωστή φάση της συναλλαγής.'
                    : 'Τα στάδια τοποθετούνται σε βήματα με βάση τα prerequisites του process template και στη σωστή φάση της συναλλαγής.'
                }
                nodes={previewNodes}
                emptyLabel={
                  previewPhaseFilter === 'all'
                    ? mode === 'documents'
                      ? 'Δεν υπάρχουν αρκετά έγγραφα για preview.'
                      : 'Δεν υπάρχουν ακόμη στάδια για preview.'
                    : 'Δεν υπάρχουν στοιχεία σε αυτή τη φάση.'
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
