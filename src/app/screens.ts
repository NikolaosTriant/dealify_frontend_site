export type BrokerScreenId =
  | 'broker-dashboard'
  | 'broker-transaction-detail'
  | 'broker-client-portal'
  | 'broker-member-task-view'
  | 'broker-template-builder'
  | 'broker-listings'
  | 'broker-orders'
  | 'broker-leads-matching'
  | 'broker-lead-sources'
  | 'broker-document-review'
  | 'broker-member-teams'
  | 'public-calculator'
  | 'broker-settings';

export const DEFAULT_TRANSACTION_ID = '61111111-0000-0000-0000-000000000002';

type PathResolveResult = {
  screen: BrokerScreenId;
  transactionId?: string;
};

export function resolveScreenFromPath(pathname: string): PathResolveResult {
  const normalized = pathname.toLowerCase();

  const transactionDocumentsMatch = normalized.match(/^\/transaction\/([^/]+)\/documents\/?$/);
  if (transactionDocumentsMatch) {
    return { screen: 'broker-document-review', transactionId: transactionDocumentsMatch[1] };
  }

  const transactionDetailMatch = normalized.match(/^\/transaction\/([^/]+)\/?$/);
  if (transactionDetailMatch) {
    return { screen: 'broker-transaction-detail', transactionId: transactionDetailMatch[1] };
  }

  if (normalized === '/listings') return { screen: 'broker-listings' };
  if (normalized === '/orders') return { screen: 'broker-orders' };
  if (normalized === '/leads') return { screen: 'broker-leads-matching' };
  if (normalized === '/lead-sources') return { screen: 'broker-lead-sources' };
  if (normalized === '/dashboard') return { screen: 'broker-dashboard' };
  if (normalized === '/transaction') {
    return { screen: 'broker-transaction-detail', transactionId: DEFAULT_TRANSACTION_ID };
  }
  if (normalized.startsWith('/client')) return { screen: 'broker-client-portal' };
  if (normalized.startsWith('/seller')) return { screen: 'broker-client-portal' };
  if (normalized === '/calculator') return { screen: 'public-calculator' };
  if (normalized === '/member-tasks') return { screen: 'broker-member-task-view' };
  if (normalized.startsWith('/member/')) return { screen: 'broker-member-task-view' };
  if (normalized === '/templates') return { screen: 'broker-template-builder' };
  if (normalized === '/member-teams') return { screen: 'broker-member-teams' };
  if (normalized === '/settings') return { screen: 'broker-settings' };

  return { screen: 'broker-dashboard' };
}

export function pathForScreen(screen: BrokerScreenId, transactionId = DEFAULT_TRANSACTION_ID): string {
  if (screen === 'broker-dashboard') return '/dashboard';
  if (screen === 'broker-transaction-detail') return `/transaction/${transactionId}`;
  if (screen === 'broker-client-portal') return '/client/preview-client-link';
  if (screen === 'broker-member-task-view') return '/member-tasks';
  if (screen === 'broker-template-builder') return '/templates';
  if (screen === 'broker-listings') return '/listings';
  if (screen === 'broker-orders') return '/orders';
  if (screen === 'broker-leads-matching') return '/leads';
  if (screen === 'broker-lead-sources') return '/lead-sources';
  if (screen === 'broker-member-teams') return '/member-teams';
  if (screen === 'broker-settings') return '/settings';
  if (screen === 'public-calculator') return '/calculator';
  return `/transaction/${transactionId}/documents`;
}

export const BROKER_SCREENS: { id: BrokerScreenId; label: string; short: string }[] = [
  {
    id: 'broker-dashboard',
    label: 'Dashboard Μεσίτη',
    short: 'Κομμάτι 1'
  },
  {
    id: 'broker-transaction-detail',
    label: 'Λεπτομέρεια Συναλλαγής / Skill Tree',
    short: 'Κομμάτι 2'
  },
  {
    id: 'broker-client-portal',
    label: 'Πύλη Πελάτη',
    short: 'Κομμάτι 3'
  },
  {
    id: 'broker-member-task-view',
    label: 'Προβολή Εργασιών Μελών',
    short: 'Κομμάτι 4'
  },
  {
    id: 'broker-template-builder',
    label: 'Διαχείριση Templates',
    short: 'Κομμάτι 5'
  },
  {
    id: 'broker-listings',
    label: 'Ακίνητα',
    short: 'Κομμάτι 6'
  },
  {
    id: 'broker-orders',
    label: 'Εντολές',
    short: 'Κομμάτι 6.1'
  },
  {
    id: 'broker-leads-matching',
    label: 'Πελάτες & Matching',
    short: 'Κομμάτι 7'
  },
  {
    id: 'broker-lead-sources',
    label: 'Πηγές Leads',
    short: 'Κομμάτι 7.1'
  },
  {
    id: 'public-calculator',
    label: 'Υπολογιστής Κόστους',
    short: 'Κομμάτι 8'
  },
  {
    id: 'broker-document-review',
    label: 'Έλεγχος Εγγράφων',
    short: 'Κομμάτι 9'
  },
  {
    id: 'broker-member-teams',
    label: 'Ομάδες & Μέλη',
    short: 'Κομμάτι 10'
  },
  {
    id: 'broker-settings',
    label: 'Settings / Integrations',
    short: 'Κομμάτι 11'
  }
];
