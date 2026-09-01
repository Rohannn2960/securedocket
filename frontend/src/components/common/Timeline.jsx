import React from 'react';
import { GitCommit, MapPin, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from './Badge';

/**
 * Reusable Chronological Timeline Component
 * @param {Array} events - Array of timeline events
 * @param {function} onInspectEvent - Callback when clicking inspect on an event
 * @param {boolean} loading - Loading state
 */
export function Timeline({ events = [], onInspectEvent, loading = false }) {
  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-slate-400 font-mono">
        Loading chronological timeline...
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-slate-400 font-mono">
        No chronological events recorded in timeline.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
      {events.map((evt, idx) => (
        <div key={evt.id || idx} className="relative group">
          {/* Timeline Dot */}
          <div
            className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-defense-950 transition-transform group-hover:scale-125 ${
              evt.isUncertain
                ? 'border-amber-400 shadow-glow-amber'
                : evt.eventType === 'incident_occurred'
                ? 'border-red-400'
                : evt.eventType === 'fir_registered'
                ? 'border-cyan-400'
                : evt.eventType === 'forensic_examination'
                ? 'border-purple-400'
                : 'border-emerald-400'
            }`}
          />

          {/* Event Content Card */}
          <div className="p-4 rounded-xl bg-defense-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    evt.isUncertain
                      ? 'tampered'
                      : evt.eventType === 'incident_occurred'
                      ? 'tampered'
                      : evt.eventType === 'fir_registered'
                      ? 'cyan'
                      : evt.eventType === 'forensic_examination'
                      ? 'verified'
                      : 'default'
                  }
                  size="xs"
                >
                  {(evt.eventType || 'EVENT').replace('_', ' ').toUpperCase()}
                </Badge>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {evt.formattedDate || evt.date || 'Unspecified Date'}
                </span>
                {evt.isUncertain && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Uncertain Date
                  </span>
                )}
              </div>

              {evt.confidence && (
                <span className="text-[10px] font-mono text-slate-400">
                  Confidence: {Math.round(evt.confidence * 100)}%
                </span>
              )}
            </div>

            <h4 className="text-xs font-bold text-slate-100">{evt.title}</h4>
            {evt.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{evt.description}</p>
            )}

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              {evt.location ? (
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <MapPin className="w-3 h-3 text-cyan-400" />
                  {evt.location}
                </span>
              ) : (
                <span />
              )}

              {evt.sourceDocumentId && onInspectEvent && (
                <button
                  onClick={() => onInspectEvent(evt)}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Source Document
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Timeline;
