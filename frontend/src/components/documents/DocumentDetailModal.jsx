import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Clock,
  User,
  Calendar,
  Lock,
  ExternalLink,
  Download,
  Copy,
  Check,
  AlertTriangle,
  History,
  Layers,
  Eye,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Alert } from '../common/Alert';
import { Spinner } from '../common/Spinner';
import { documentService } from '../../services/documentService';
import { formatBytes } from '../../utils/crypto';
import { formatDate, truncateHash } from '../../utils/formatters';

export function DocumentDetailModal({ isOpen, onClose, document }) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [generatingUrl, setGeneratingUrl] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [viewUrlData, setViewUrlData] = useState(null);
  const [error, setError] = useState(null);

  if (!document) return null;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(document.sha256Hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleSecureView = async () => {
    setGeneratingUrl(true);
    setError(null);
    try {
      const res = await documentService.getDocumentViewUrl(document._id);
      setViewUrlData(res.data);
      // Safely open in new window
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err?.message || 'Failed to generate presigned view URL');
    } finally {
      setGeneratingUrl(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await documentService.getDocumentDownloadUrl(document._id);
      const url = res.data?.downloadUrl || res.data?.url;
      if (url) {
        const link = window.document.createElement('a');
        link.href = url;
        link.setAttribute('download', document.fileName || 'evidence-file');
        window.document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      setError(err?.message || 'Failed to generate presigned download URL');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Evidentiary Document Dossier"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Top Header Card */}
        <div className="p-4 rounded-xl bg-defense-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="cyan" size="xs">
                  {document.documentType?.toUpperCase() || 'EVIDENCE'}
                </Badge>
                <Badge variant={document.isTampered ? 'tampered' : 'verified'} size="xs">
                  {document.status?.replace('_', ' ').toUpperCase() || 'PENDING REVIEW'}
                </Badge>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-1">{document.title}</h3>
              <div className="text-xs text-slate-400 font-mono">{document.fileName}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              onClick={handleDownload}
              isLoading={downloading}
              className="text-xs shrink-0"
              title="Download original evidence file"
            >
              Download
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={ExternalLink}
              onClick={handleSecureView}
              isLoading={generatingUrl}
              className="text-xs shrink-0"
            >
              5m Secure View
            </Button>
          </div>
        </div>

        {viewUrlData && (
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between text-xs font-mono text-cyan-300">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Temporary Presigned Vault Stream Active</span>
            </div>
            <a
              href={viewUrlData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-cyan-400 hover:text-cyan-200"
            >
              Re-open Tab
            </a>
          </div>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-defense-900/60 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-500 font-mono uppercase block">Associated Case</span>
            <div className="font-bold text-slate-200">
              {document.caseId?.caseNumber || 'CR/2026/XXXX'}
            </div>
            <div className="text-slate-400 text-[11px] truncate">
              {document.caseId?.title || 'Case Title'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-defense-900/60 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-500 font-mono uppercase block">File Details</span>
            <div className="font-bold text-slate-200">
              {formatBytes(document.fileSize)} • {document.mimeType}
            </div>
            <div className="text-slate-400 text-[11px]">
              Uploaded: {formatDate(document.createdAt)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-defense-900/60 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-500 font-mono uppercase block">Uploaded By</span>
            <div className="font-bold text-slate-200">
              {document.uploadedBy?.name || 'Investigating Officer'}
            </div>
            <div className="text-slate-400 text-[11px] font-mono">
              Badge: {document.uploadedBy?.badgeNumber || 'CCB-9842'} ({document.uploadedBy?.role})
            </div>
          </div>

          <div className="p-3 rounded-xl bg-defense-900/60 border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-500 font-mono uppercase block">Storage Encryption</span>
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> SSE-S3 (AES-256)
            </div>
            <div className="text-slate-400 text-[11px] font-mono truncate">
              Key: {document.s3Key}
            </div>
          </div>
        </div>

        {/* Cryptographic SHA-256 Hash */}
        <div className="p-3.5 rounded-xl bg-defense-950 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              Cryptographic SHA-256 Seal
            </span>
            <button
              onClick={handleCopyHash}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
            >
              {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedHash ? 'Copied' : 'Copy Hash'}
            </button>
          </div>
          <div className="text-xs font-mono text-emerald-400 break-all select-all">
            {document.sha256Hash}
          </div>
        </div>

        {/* Version History Infrastructure */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Version Audit History (v{document.version || 1})</span>
          </div>

          <div className="p-3 rounded-xl bg-defense-900/40 border border-slate-800/80 space-y-2">
            {document.versions && document.versions.length > 0 ? (
              document.versions.map((ver, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/50 last:border-0"
                >
                  <div className="flex items-center gap-2 font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 text-[10px] font-bold border border-cyan-800/40">
                      v{ver.version}
                    </span>
                    <span className="text-slate-300">{ver.changeNotes || 'Initial secure upload'}</span>
                  </div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    {formatDate(ver.uploadedAt || document.createdAt)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400">Initial version v1 locked.</div>
            )}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close Dossier
          </Button>
        </div>
      </div>
    </Modal>
  );
}
