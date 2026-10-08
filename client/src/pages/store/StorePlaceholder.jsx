import { Card } from '../../components/ui';

export const StorePlaceholder = () => {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-xl font-bold text-ink-900 mb-2">Store Layout</h2>
        <p className="text-sm text-ink-600">
          This is the Store Layout placeholder page. TopBar and BottomNav are active with 56px touch
          target navigation and Telugu-first defaults.
        </p>
      </Card>
    </div>
  );
};
