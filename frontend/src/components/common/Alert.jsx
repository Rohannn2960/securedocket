import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Alert({
  variant = 'info',
  title,
  children,
  className = '',
}) {
  const configs = {
    info: {
      icon: Info,
      container: 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200',
      iconColor: 'text-cyan-400',
    },
    success: {
      icon: CheckCircle2,
      container: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200',
      iconColor: 'text-emerald-400',
    },
    warning: {
      icon: AlertTriangle,
      container: 'bg-amber-950/40 border-amber-500/40 text-amber-200',
      iconColor: 'text-amber-400',
    },
    error: {
      icon: AlertCircle,
      container: 'bg-rose-950/40 border-rose-500/40 text-rose-200',
      iconColor: 'text-rose-400',
    },
  };

  const { icon: Icon, container, iconColor } = configs[variant] || configs.info;

  return (
    <div className={twMerge(clsx('p-4 rounded-xl border flex items-start gap-3 text-sm', container, className))}>
      <Icon className={clsx('w-5 h-5 shrink-0 mt-0.5', iconColor)} />
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-0.5 tracking-wide">{title}</h4>}
        <div className="text-xs leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
}
