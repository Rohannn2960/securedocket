import React from 'react';
import { FileText, ShieldCheck, AlertTriangle, Eye, Lock, HardDrive } from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { truncateHash, formatDate } from '../../utils/formatters';
import { formatBytes } from '../../utils/crypto';

/**
 * Reusable Document Card Component
 * Formatted for evidence files with cryptographic hash, confidence, tamper status, and quick view
 */
export function DocumentCard({
  document,
  onView,
  onInspect,
  showConfidence = true,
  className = '',
}) {
  if (!document) return null;

  const isTampered = document.isTampered;
  const status = document.status || 'valid';
  const confidence = document.ocrConfidence || document.ocrMetadata?.averageConfidence || 85;

  return (
    <div
      onClick={() => onInspect && onInspect(document)}
      className={`p-4 rounded-xl bg-defense-900/70 border border-slate-800 hover:border-cyan-500/40 hover:bg-defense-900 transition-all space-y-3 cursor-pointer ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-defense-950 border border-slate-800 text-cyan-400 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-100 truncate">
              {document.originalName || document.fileName || document.title}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
              <span className="uppercase">{document.documentType || 'DOCUMENT'}</span>
              <span>•</span>
              <span>{formatBytes(document.fileSize || 1024)}</span>
            </div>
          </div>
        </div>

        <Badge
          variant={
            isTampered
              ? 'tampered'
              : status === 'verified'
              ? 'verified'
              : status === 'flagged'
              ? 'tampered'
              : 'pending'
          }
          size="xs"
        >
          {status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>

      {/* SHA-256 Hash Display */}
      <div className="p-2 rounded-lg bg-defense-950/80 border border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
        <span className="text-slate-500">SHA-256:</span>
        <span className="text-emerald-400 font-semibold">
          {truncateHash(document.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 8, 8)}
        </span>
      </div>

      {/* Confidence Indicator */}
      {showConfidence && (
        <ConfidenceIndicator value={confidence} size="sm" />
      )}

      {/* Card Actions */}
      <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>Uploaded: {formatDate(document.createdAt)}</span>
        <div className="flex items-center gap-2">
          {onView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView(document);
              }}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <Eye className="w-3 h-3" /> View
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentCard;
