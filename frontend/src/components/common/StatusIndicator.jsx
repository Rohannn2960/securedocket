import React from 'react';
import { clsx } from 'clsx';

export function StatusIndicator({ status = 'online', label, className = '' }) {
  const colors = {
    online: 'bg-emerald-500',
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    tampered: 'bg-rose-600',
    offline: 'bg-slate-500',
    processing: 'bg-cyan-500',
  };

  const ringColors = {
    online: 'bg-emerald-400',
    healthy: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    tampered: 'bg-rose-500',
    processing: 'bg-cyan-400',
  };

  const dotColor = colors[status] || colors.online;
  const pingColor = ringColors[status] || ringColors.online;

  return (
    <div className={clsx('inline-flex items-center gap-2', className)}>
      <span className="relative flex h-2.5 w-2.5">
        <span className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', pingColor)}></span>
        <span className={clsx('relative inline-flex rounded-full h-2.5 w-2.5', dotColor)}></span>
      </span>
      {label && <span className="text-xs font-mono font-medium text-slate-300">{label}</span>}
    </div>
  );
}
