import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  borderColor?: string;
  topBorderColor?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'var(--text-tertiary)',
  iconBg = 'var(--surface-highlight)',
  borderColor = 'var(--border-default)',
  topBorderColor,
  trend,
}: StatCardProps) {
  return (
    <div
      className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-6"
      style={{ borderColor, borderTopColor: topBorderColor ?? borderColor, borderTopWidth: topBorderColor ? 3 : undefined }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="mb-2 text-sm text-[var(--text-tertiary)]">{title}</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
          {trend && (
            <p
              className={`text-xs mt-2 ${
                trend.isPositive ? 'text-[var(--status-success-text)]' : 'text-[var(--status-danger-text)]'
              }`}
            >
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={24} style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}
