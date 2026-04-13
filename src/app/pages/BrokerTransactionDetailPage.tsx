import { TransactionDetailPage } from '../components/TransactionDetailPage';

type Props = {
  transactionId: string;
  onBack?: () => void;
};

export function BrokerTransactionDetailPage({ transactionId, onBack }: Props) {
  return <TransactionDetailPage transactionId={transactionId} onBack={onBack} />;
}
