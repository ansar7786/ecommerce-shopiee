import { useTranslation } from 'react-i18next';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { Button } from './Button';

export const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  error = null,
  emptyMessage,
  onRetry,
  className = '',
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`w-full bg-white rounded-card border border-ink-300/60 overflow-hidden shadow-xs ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-page border-b border-ink-300/60 text-xs font-bold uppercase tracking-wider text-ink-600">
              {columns.map((col, idx) => (
                <th key={col.key || idx} className={`py-3.5 px-4 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-300/40">
            {loading ? (
              // Loading Skeleton State
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={cIdx} className="py-4 px-4">
                      <Skeleton className="h-5 w-full max-w-[140px] rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              // Error State
              <tr>
                <td colSpan={columns.length} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                    <AlertCircle className="w-8 h-8 text-danger-600 mb-2" />
                    <p className="text-sm font-semibold text-ink-900 mb-1">
                      {error || 'Failed to load table data'}
                    </p>
                    {onRetry && (
                      <Button
                        variant="secondary"
                        size="md"
                        leftIcon={RotateCcw}
                        onClick={onRetry}
                        className="mt-3 text-xs"
                      >
                        {t('common.retry')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="py-12 px-4 text-center text-ink-600">
                  <p className="text-sm font-medium">{emptyMessage || t('common.empty')}</p>
                </td>
              </tr>
            ) : (
              // Normal Data Rows
              data.map((row, rIdx) => (
                <tr key={row._id || row.id || rIdx} className="hover:bg-page/70 transition-colors">
                  {columns.map((col, cIdx) => (
                    <td
                      key={col.key || cIdx}
                      className={`py-3.5 px-4 text-ink-900 align-middle ${col.className || ''}`}
                    >
                      {col.render ? col.render(row, rIdx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
