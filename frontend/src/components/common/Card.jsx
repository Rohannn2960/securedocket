import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({
  children,
  title,
  subtitle,
  badge,
  action,
  className = '',
  headerClassName = '',
  footer,
  ...props
}) {
  return (
    <div
      className={twMerge(
        'glass-panel rounded-xl overflow-hidden border border-slate-800/80 shadow-lg',
        className
      )}
      {...props}
    >
      {(title || badge || action) && (
        <div
          className={twMerge(
            'px-5 py-4 border-b border-slate-800/80 flex items-center justify-between gap-4',
            headerClassName
          )}
        >
          <div>
            {title && <h3 className="font-semibold text-slate-100 text-sm tracking-wide">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {badge}
            {action}
          </div>
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="px-5 py-3 bg-defense-950/60 border-t border-slate-800/60 text-xs text-slate-400">
          {footer}
        </div>
      )}
    </div>
  );
}
