import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

/**
 * Slide-out Drawer Component
 * For inspecting details without leaving the current view context
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-xl',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-defense-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className={`w-screen ${width} bg-defense-950 border-l border-slate-800 shadow-2xl flex flex-col`}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-start justify-between bg-defense-900/60">
            <div>
              <h3 className="text-base font-bold text-slate-100">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200"
            />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="p-4 border-t border-slate-800 bg-defense-900/60 flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Drawer;
