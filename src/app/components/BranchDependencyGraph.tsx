import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Ruler, Scale } from 'lucide-react';
import { BranchNode, BranchTask } from './BranchNode';

interface Branch {
  id: string;
  name: string;
  dotColorClass: string;
  tasks: BranchTask[];
}

interface BranchDependencyGraphProps {
  branches: Branch[];
  convergenceNodes: BranchTask[];
  onTaskClick: (task: BranchTask) => void;
}

interface NodePosition {
  id: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export function BranchDependencyGraph({
  branches,
  convergenceNodes,
  onTaskClick,
}: BranchDependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
  const [isDark, setIsDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const updatePositions = () => {
      const positions: NodePosition[] = [];
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const allNodes = container.querySelectorAll('[data-node-id]');

      allNodes.forEach((node) => {
        const nodeId = node.getAttribute('data-node-id');
        if (!nodeId) return;
        const rect = node.getBoundingClientRect();
        positions.push({
          id: nodeId,
          centerX: rect.left - containerRect.left + rect.width / 2,
          centerY: rect.top - containerRect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        });
      });

      setNodePositions(positions);
    };

    setTimeout(updatePositions, 100);
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [branches, convergenceNodes]);

  const getNodePosition = (id: string) => nodePositions.find((n) => n.id === id);

  const maxBranchDepth = Math.max(...branches.map((branch) => branch.tasks.length));
  const branchRows = Array.from({ length: maxBranchDepth }, (_, idx) => idx);

  const branchMeta = useMemo(
    () => ({
      legal: {
        color: '#16A34A',
        line: isDark ? 'rgba(22,163,74,0.3)' : 'rgba(22,163,74,0.25)',
        headerBg: isDark ? 'rgba(22,163,74,0.12)' : 'rgba(22,163,74,0.08)',
        laneBg: isDark ? 'rgba(22,163,74,0.06)' : 'rgba(22,163,74,0.04)',
        watermark: isDark ? 'rgba(22,163,74,0.04)' : 'rgba(22,163,74,0.03)',
        icon: Scale,
      },
      tech: {
        color: '#2563EB',
        line: isDark ? 'rgba(37,99,235,0.3)' : 'rgba(37,99,235,0.25)',
        headerBg: isDark ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.08)',
        laneBg: isDark ? 'rgba(37,99,235,0.06)' : 'rgba(37,99,235,0.04)',
        watermark: isDark ? 'rgba(37,99,235,0.04)' : 'rgba(37,99,235,0.03)',
        icon: Ruler,
      },
      ops: {
        color: '#D97706',
        line: isDark ? 'rgba(217,119,6,0.3)' : 'rgba(217,119,6,0.25)',
        headerBg: isDark ? 'rgba(217,119,6,0.12)' : 'rgba(217,119,6,0.08)',
        laneBg: isDark ? 'rgba(217,119,6,0.06)' : 'rgba(217,119,6,0.04)',
        watermark: isDark ? 'rgba(217,119,6,0.04)' : 'rgba(217,119,6,0.03)',
        icon: ClipboardList,
      },
    }),
    [isDark]
  );

  const taskBranchMap = useMemo(() => {
    const map = new Map<string, Branch['id']>();
    branches.forEach((branch) => {
      branch.tasks.forEach((task) => map.set(task.id, branch.id));
    });
    return map;
  }, [branches]);

  const taskMap = useMemo(() => {
    const map = new Map<string, BranchTask>();
    branches.forEach((branch) => {
      branch.tasks.forEach((task) => map.set(task.id, task));
    });
    convergenceNodes.forEach((task) => map.set(task.id, task));
    return map;
  }, [branches, convergenceNodes]);

  const lineStyleForStatus = (status?: BranchTask['status']) => {
    if (status === 'completed') {
      return { strokeWidth: 2, strokeDasharray: undefined, opacity: 1 };
    }
    if (status === 'in-progress' || status === 'overdue' || status === 'pending-review') {
      return { strokeWidth: 2, strokeDasharray: '6 4', opacity: 1 };
    }
    return { strokeWidth: 1.5, strokeDasharray: '1.5 4', opacity: 0.6 };
  };

  const drawConnection = (fromId: string, toId: string) => {
    const from = getNodePosition(fromId);
    const to = getNodePosition(toId);
    if (!from || !to) return null;

    const fromTask = taskMap.get(fromId);
    const branchId = taskBranchMap.get(fromId);
    const branchInfo = branchId ? branchMeta[branchId as keyof typeof branchMeta] : null;
    const stroke = branchInfo?.line ?? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)');
    const { strokeWidth, strokeDasharray, opacity } = lineStyleForStatus(fromTask?.status);

    const startX = from.centerX;
    const startY = from.centerY + from.height / 2;
    const endX = to.centerX;
    const endY = to.centerY - to.height / 2;
    const controlY = (startY + endY) / 2;

    return (
      <path
        key={`${fromId}-${toId}`}
        d={`M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        opacity={opacity}
        fill="none"
        markerEnd={`url(#arrow-${branchId ?? 'neutral'})`}
      />
    );
  };

  return (
    <div ref={containerRef} className="relative min-h-[600px] w-full py-8">
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3">
        {branches.map((branch, idx) => {
          const info = branchMeta[branch.id as keyof typeof branchMeta];
          const Icon = info.icon;
          return (
            <div
              key={`lane-${branch.id}`}
              className={`relative h-full ${idx < 2 ? 'border-r border-dashed' : ''}`}
              style={{
                background: info.laneBg,
                padding: '0 12px',
                borderRightColor: idx < 2 ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') : undefined,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon size={120} style={{ color: info.watermark }} />
              </div>
            </div>
          );
        })}
      </div>

      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 0 }}>
        <defs>
          {Object.entries(branchMeta).map(([key, meta]) => (
            <marker
              key={key}
              id={`arrow-${key}`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill={meta.line} />
            </marker>
          ))}
          <marker
            id="arrow-neutral"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}
            />
          </marker>
        </defs>

        {branches.map((branch) =>
          branch.tasks.slice(0, -1).map((task, index) =>
            drawConnection(task.id, branch.tasks[index + 1].id)
          )
        )}

        {convergenceNodes.length > 0 &&
          branches.map((branch) => {
            const lastTask = branch.tasks[branch.tasks.length - 1];
            if (!lastTask) return null;
            return drawConnection(lastTask.id, convergenceNodes[0].id);
          })}

        {convergenceNodes.slice(0, -1).map((node, index) =>
          drawConnection(node.id, convergenceNodes[index + 1].id)
        )}
      </svg>

      <div className="relative w-full" style={{ zIndex: 1 }}>
        <div className="mb-8 grid w-full grid-cols-3 gap-8 px-6">
          {branches.map((branch) => {
            const info = branchMeta[branch.id as keyof typeof branchMeta];
            const Icon = info.icon;
            return (
              <div
                key={branch.id}
                className="flex items-center justify-center gap-2 rounded-full border px-3 py-2"
                style={{
                  background: info.headerBg,
                  borderColor: info.line,
                  color: info.color,
                }}
              >
                <Icon size={16} />
                <span className="text-sm font-medium">{branch.name}</span>
              </div>
            );
          })}
        </div>

        <div className="space-y-24 px-6">
          {branchRows.map((rowIndex) => (
            <div key={`row-${rowIndex}`} className="grid w-full grid-cols-3 items-start gap-8">
              {branches.map((branch) => {
                const task = branch.tasks[rowIndex];
                return (
                  <div key={`${branch.id}-row-${rowIndex}`} className="flex w-full justify-center">
                    {task ? (
                      <div data-node-id={task.id} className="w-full">
                        <BranchNode task={task} onClick={() => onTaskClick(task)} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-24 space-y-24 px-6">
          {convergenceNodes.map((node) => (
            <div key={node.id} className="grid w-full grid-cols-3 items-start gap-8">
              <div />
              <div data-node-id={node.id} className="flex w-full justify-center">
                <BranchNode task={node} onClick={() => onTaskClick(node)} />
              </div>
              <div />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
