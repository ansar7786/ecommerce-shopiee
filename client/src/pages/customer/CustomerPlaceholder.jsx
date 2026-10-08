import { Card } from '../../components/ui';

export const CustomerPlaceholder = () => {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-xl font-bold text-ink-900 mb-2">Customer Layout</h2>
        <p className="text-sm text-ink-600">
          This is the Customer Layout placeholder page. TopBar and BottomNav are active with
          mobile-first 390px centered container.
        </p>
      </Card>
    </div>
  );
};
