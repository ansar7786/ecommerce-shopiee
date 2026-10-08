import { Check, Circle } from 'lucide-react';

export const Timeline = ({ steps = [], className = '' }) => {
  return (
    <div className={`relative flex flex-col gap-6 py-2 ${className}`}>
      {steps.map((step, index) => {
        const isDone = step.status === 'done';
        const isCurrent = step.status === 'current';
        const isPending = step.status === 'pending';
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id || index} className="relative flex items-start gap-4">
            {/* Vertical connector line */}
            {!isLast && (
              <span
                className={`absolute left-4 top-8 -bottom-6 w-0.5 -translate-x-1/2 transition-colors ${
                  isDone ? 'bg-primary-600' : 'bg-ink-300/60'
                }`}
                aria-hidden="true"
              />
            )}

            {/* Step indicator node */}
            <div className="relative z-10 flex-shrink-0 flex items-center justify-center">
              {isDone && (
                <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-sm">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}
              {isCurrent && (
                <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center shadow ring-4 ring-primary-50">
                  <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                </div>
              )}
              {isPending && (
                <div className="w-8 h-8 rounded-full bg-white border-2 border-ink-300 text-ink-300 flex items-center justify-center">
                  <Circle className="w-3 h-3 fill-current text-ink-300/40" />
                </div>
              )}
            </div>

            {/* Step text content */}
            <div className="flex-1 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <h4
                  className={`text-sm font-semibold ${isPending ? 'text-ink-600' : 'text-ink-900'}`}
                >
                  {step.label}
                </h4>
                {step.time && (
                  <span className="text-xs text-ink-600 whitespace-nowrap">{step.time}</span>
                )}
              </div>
              {step.description && (
                <p className="text-xs text-ink-600 mt-0.5 leading-relaxed">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
