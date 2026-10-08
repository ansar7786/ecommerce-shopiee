import { Card } from '../../components/ui';

export const AdminPlaceholder = () => {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-xl font-bold text-ink-900 mb-2">Admin Layout</h2>
        <p className="text-sm text-ink-600">
          This is the Admin Layout placeholder page. Left desktop sidebar and top mobile drawer are
          active for administrative console management.
        </p>
      </Card>
    </div>
  );
};
