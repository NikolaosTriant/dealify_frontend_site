import { Deal } from '../components/DealCard';
import { DashboardPage } from '../components/DashboardPage';

type Props = {
  onDealClick: (deal: Deal) => void;
};

export function BrokerDashboardPage({ onDealClick }: Props) {
  return <DashboardPage onDealClick={onDealClick} />;
}
