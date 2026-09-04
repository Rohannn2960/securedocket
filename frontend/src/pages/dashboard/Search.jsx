import { useState, useEffect } from 'react';
import { Search as SearchIcon, FileText, Briefcase, File, Tag, AlertCircle, Eye, ExternalLink } from 'lucide-react';
import { searchService } from '../../services/searchService';
import { caseService } from '../../services/caseService';
import { documentService } from '../../services/documentService';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { DocumentDetailModal } from '../../components/documents/DocumentDetailModal';

export function Search() {
  const [query, setQuery] = useState('');
  const [caseIdFilter, setCaseIdFilter] = useState('');
  const [cases, setCases] = useState([]);
  
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isDocDetailOpen, setIsDocDetailOpen] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  
  const { user } = useAuth();

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const res = await caseService.getCases({});
      setCases(Array.isArray(res.data) ? res.data : res.data?.cases || []);
    } catch (err) {
      console.error('Failed to fetch cases for filter', err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await searchService.semanticSearch({ query, caseId: caseIdFilter || undefined });
      const searchResults = res.data?.results || res.results || [];
      setResults(searchResults);
    } catch (err) {
      setError(err?.message || err.response?.data?.message || 'Failed to perform semantic search');
    } finally {
      setIsSearching(false);
    }
  };

  const getRelevanceColor = (score) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-slate-500';
  };

  const handleOpenDoc = async (documentId) => {
    try {
      setLoadingDoc(true);
      const res = await documentService.getDocumentById(documentId);
      setSelectedDoc(res.data?.document || res.data);
      setIsDocDetailOpen(true);
    } catch (err) {
      console.error('Failed to load document details', err);
    } finally {
      setLoadingDoc(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center">
          <SearchIcon className="w-7 h-7 mr-3 text-blue-500" />
          Semantic Document Search
        </h1>
        <p className="text-slate-400 mt-2">
          Find relevant documents based on semantic meaning, not just exact keywords.
          Results are ranked probabilistically by AI.
        </p>
      </header>

      {/* Search Input Box */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700/50 p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-900/50 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Describe what you are looking for... (e.g. 'documents mentioning a blue speeding car')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            
            <div className="w-full md:w-64">
              <select
                className="block w-full pl-3 pr-10 py-3 text-base border-slate-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg bg-slate-900/50 text-slate-200"
                value={caseIdFilter}
                onChange={(e) => setCaseIdFilter(e.target.value)}
              >
                <option value="">All Authorized Cases</option>
                {cases.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.caseNumber} - {c.title}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* Results State */}
      {error && (
        <div className="bg-red-900/20 border-l-4 border-red-500 p-4 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {hasSearched && !isSearching && results.length === 0 && !error && (
        <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700/50">
          <SearchIcon className="mx-auto h-12 w-12 text-slate-500" />
          <h3 className="mt-2 text-sm font-medium text-slate-200">No matching documents found</h3>
          <p className="mt-1 text-sm text-slate-400">
            Try adjusting your natural language query or expanding your case filter.
          </p>
        </div>
      )}

      {/* Results List */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Top Results ({results.length})
          </h3>
          
          <div className="grid gap-4">
            {results.map((result) => (
              <div 
                key={result.documentId} 
                className="bg-slate-800 rounded-xl border border-slate-700/50 p-5 hover:border-slate-600 transition-colors cursor-pointer"
                onClick={() => handleOpenDoc(result.documentId)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <h4 className="text-lg font-medium text-slate-200">
                        {result.title}
                      </h4>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
                        <Tag className="w-3 h-3 mr-1" />
                        {result.documentType}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-sm text-slate-400 space-x-4 mb-3">
                      <span className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-1 text-slate-500" />
                        {result.caseNumber}
                      </span>
                      {result.classification && (
                        <span className="flex items-center">
                          <FileText className="w-4 h-4 mr-1 text-slate-500" />
                          Classified: {result.classification}
                        </span>
                      )}
                    </div>
                    
                    {/* Snippet */}
                    <div className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 italic line-clamp-3">
                      "...{result.snippet}..."
                    </div>
                  </div>
                  
                  {/* Relevance Score */}
                  <div className="ml-6 flex flex-col items-end">
                    <div className="text-sm font-medium text-slate-400 mb-1">Relevance</div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-slate-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getRelevanceColor(result.similarityScore)}`}
                          style={{ width: `${Math.min(100, Math.max(0, result.similarityScore * 100))}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-semibold text-slate-200">
                        {Math.round(result.similarityScore * 100)}%
                      </span>
                    </div>
                    
                    <button 
                      className="mt-4 flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDoc(result.documentId);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" /> View Document
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      <DocumentDetailModal 
        isOpen={isDocDetailOpen}
        onClose={() => {
          setIsDocDetailOpen(false);
          setSelectedDoc(null);
        }}
        document={selectedDoc}
        onUpdated={(updated) => {
          setSelectedDoc(updated);
        }}
      />
    </div>
  );
}
