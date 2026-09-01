import React from 'react';

/**
 * Reusable Confidence Indicator / Meter
 * Portrays AI extraction / semantic matching confidence with accessible color steps
 * @param {number} value - Confidence value (0.0 to 1.0 or 0 to 100)
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} showBar - Whether to show the horizontal progress bar
 * @param {string} label - Optional custom label
 */
export function ConfidenceIndicator({ value = 0, size = 'md', showBar = true, label = null }) {
  const percent = typeof value === 'number' ? (value <= 1 ? Math.round(value * 100) : Math.round(value)) : 0;

  // Grade color
  let colorClass = 'text-emerald-400';
  let barColorClass = 'bg-emerald-500';
  let gradeLabel = 'High Confidence';

  if (percent < 60) {
    colorClass = 'text-rose-400';
    barColorClass = 'bg-rose-500';
    gradeLabel = 'Low (Review Required)';
  } else if (percent < 85) {
    colorClass = 'text-amber-400';
    barColorClass = 'bg-amber-500';
    gradeLabel = 'Moderate Confidence';
  }

  const textSize = size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-sm' : 'text-xs';
  const barHeight = size === 'sm' ? 'h-1' : size === 'lg' ? 'h-2' : 'h-1.5';

  return (
    <div className="space-y-1">
      <div className={`flex items-center justify-between font-mono ${textSize}`}>
        <span className="text-slate-400">{label || gradeLabel}</span>
        <span className={`font-bold ${colorClass}`}>{percent}%</span>
      </div>

      {showBar && (
        <div className={`w-full bg-slate-800 rounded-full overflow-hidden ${barHeight}`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default ConfidenceIndicator;
