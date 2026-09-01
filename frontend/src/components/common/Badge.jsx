import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  icon: Icon,
  ...props
}) {
  const base = 'inline-flex items-center font-medium rounded-md tracking-wider uppercase font-mono';

  const variants = {
    default: 'bg-slate-800 text-slate-300 border border-slate-700',
    verified: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-glow-emerald',
    tampered: 'bg-rose-950/80 text-rose-300 border border-rose-500/50 shadow-glow-rose animate-pulse',
    pending: 'bg-amber-950/80 text-amber-300 border border-amber-500/40',
    cyan: 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan',
    indigo: 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/40',
  };

  const sizes = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1 text-sm gap-2',
  };

  return (
    <span className={twMerge(clsx(base, variants[variant], sizes[size], className))} {...props}>
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </span>
  );
}
