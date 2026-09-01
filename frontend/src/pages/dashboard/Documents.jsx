import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Search,
  Filter,
  ShieldCheck,
  Lock,
  ExternalLink,
  Plus,
  RefreshCw,
  Clock,
  Eye,
  FileCheck,
  Tag,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { documentService } from '../../services/documentService';
import { DocumentUploadModal } from '../../components/documents/DocumentUploadModal';
import { DocumentDetailModal } from '../../components/documents/DocumentDetailModal';
import { formatBytes } from '../../utils/crypto';
import { formatDate, truncateHash } from '../../utils/formatters';

const CATEGORY_FILTERS = [
  { value: '', label: 'All Categories' },
  { value: 'FIR', label: 'FIR' },
  { value: 'statement', label: 'Statements' },
  { value: 'chargesheet', label: 'Chargesheets' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'forensic_report', label: 'Forensic Reports' },
];

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'flagged_tampered', label: 'Flagged Tampered' },
  { value: 'rejected', label: 'Rejected' },
];

export function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedCategory) params.documentType = selectedCategory;
      if (selectedStatus) params.status = selectedStatus;

      const res = await documentService.getDocuments(params);
      setDocuments(res.data || []);
    } catch (err) {
      setError(err?.message || 'Failed to fetch document registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleOpenDetail = (doc) => {
    setSelectedDoc(doc);
    setIsDetailModalOpen(true);
  };

  const canUpload = user?.role === 'officer' || user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-cyan-400" />
            Evidentiary Document Vault
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically sealed and SSE-S3 encrypted repository for legal documents
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            onClick={fetchDocuments}
            disabled={loading}
          >
            Refresh
          </Button>

          {canUpload && (
            <Button
              variant="primary"
              size="sm"
              icon={UploadCloud}
              onClick={() => setIsUploadModalOpen(true)}
            >
              Upload Evidence Document
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-defense-900/80 border border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by document title, filename, or SHA-256 hash..."
            className="w-full bg-defense-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </form>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-defense-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {CATEGORY_FILTERS.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-defense-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {STATUS_FILTERS.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="py-20 text-center">
          <Spinner size="lg" />
          <div className="text-xs text-slate-400 mt-2 font-mono">Querying S3 Vault Index...</div>
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-defense-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200">No documents found</h3>
              <p className="text-xs text-slate-400">
                {search || selectedCategory || selectedStatus
                  ? 'No documents match the specified search filters.'
                  : 'No legal evidence documents have been uploaded to your active cases yet.'}
              </p>
            </div>
            {canUpload && (
              <Button
                variant="primary"
                size="sm"
                icon={UploadCloud}
                onClick={() => setIsUploadModalOpen(true)}
              >
                Upload Document Now
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc._id}
              onClick={() => handleOpenDetail(doc)}
              className="p-4 rounded-xl bg-defense-900/60 border border-slate-800/90 hover:border-cyan-500/40 hover:bg-defense-900 transition-all cursor-pointer space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="cyan" size="xs">
                    {doc.documentType?.toUpperCase() || 'EVIDENCE'}
                  </Badge>
                  <Badge
                    variant={
                      doc.status === 'verified'
                        ? 'verified'
                        : doc.status === 'flagged_tampered'
                        ? 'tampered'
                        : 'pending'
                    }
                    size="xs"
                  >
                    {doc.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                  </Badge>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-100 line-clamp-1">{doc.title}</h4>
                  <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                    {doc.fileName}
                  </div>
                </div>

                <div className="text-[11px] text-cyan-400 font-mono">
                  Case: {doc.caseId?.caseNumber || 'CR/2026/XXXX'}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>SHA-256:</span>
                  <span className="text-emerald-400">{truncateHash(doc.sha256Hash, 6, 6)}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>{formatBytes(doc.fileSize)}</span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={() => {
          fetchDocuments();
        }}
      />

      {/* Document Detail Modal */}
      <DocumentDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        document={selectedDoc}
      />
    </div>
  );
}
