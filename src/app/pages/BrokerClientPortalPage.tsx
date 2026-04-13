import { ClientPortalPage } from '../components/ClientPortalPage';

type Props = {
  onBackToAdmin?: () => void;
  showPreviewBar?: boolean;
};

export function BrokerClientPortalPage({ onBackToAdmin, showPreviewBar = false }: Props) {
  if (!showPreviewBar) {
    return <ClientPortalPage />;
  }

  return (
    <div className="relative">
      <div className="sticky top-0 z-50 flex items-center gap-3 border-b border-[var(--border-dark)] bg-[#1A1612] px-4 py-2 text-sm text-white">
        <span className="rounded bg-[var(--brand-warm)] px-2 py-0.5 text-xs font-semibold text-[#1A1612]">PREVIEW</span>
        <span className="text-[var(--text-on-dark-muted)]">Προβολή ως πελάτης</span>
        <button
          onClick={onBackToAdmin}
          className="ml-auto rounded-lg bg-[var(--surface-glow)]/15 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--surface-glow)]/25"
        >
          Επιστροφή στη διαχείριση
        </button>
      </div>
      <ClientPortalPage />
    </div>
  );
}
