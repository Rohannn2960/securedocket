import React, { useState } from 'react';
import { Sparkles, Search, FileText, ArrowRight, ShieldCheck, Database, Sliders } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';

export function SemanticSearch() {
  const [query, setQuery] = useState('find all cases involving unauthorized bank API tokens and money laundering');
  const [searching, setSearching] = useState(false);

  const [results] = useState([
    {
      id: 'res-1',
      title: 'Certified First Information Report (FIR No. 891/26)',
      caseNumber: 'CR/2026/0891-BLR',
      documentType: 'FIR',
      similarityScore: 94.2,
      matchedSnippet: '...the accused systematically generated unauthorized OAuth session tokens to divert wire transfers into mule bank accounts registered under forged KYC documents...',
      acts: ['IT Act Sec 66D', 'IPC 420'],
    },
    {
      id: 'res-2',
      title: 'Witness Statement under Section 161 CrPC - Branch Manager',
      caseNumber: 'CR/2026/0891-BLR',
      documentType: 'statement',
      similarityScore: 89.6,
      matchedSnippet: '...observed anomalous midnight batch requests communicating with offshore IP addresses, bypassing secondary multi-factor authentication triggers...',
      acts: ['CrPC Sec 161'],
    },
  ]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearching(true);
    setTimeout(() => setSearching(false), 600);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          Semantic AI Investigation Search
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Cross-reference witness testimonies, charge sheets, and evidence logs using high-dimensional vector embeddings and cosine similarity.
        </p>
      </div>

      {/* Search Input Bar */}
      <Card className="border-amber-500/20 shadow-glow-cyan">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              icon={Search}
              placeholder="Query in natural legal language (e.g. 'forensic reports matching 9mm bullet striations')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-defense-950 text-sm"
            />
            <Button type="submit" variant="primary" icon={Sparkles} isLoading={searching} className="shrink-0">
              Query Case Vectors
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-1 border-t border-slate-800">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Database className="w-3.5 h-3.5" />
              Vector Model: 768-dim Embedding
            </span>
            <span>•</span>
            <span className="text-emerald-400">Metric: Cosine Similarity</span>
            <span>•</span>
            <span className="text-amber-400">OCR Source: Gemini Vision API Server-Side</span>
          </div>
        </form>
      </Card>

      {/* Semantic Matches Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <span>Relevant Case Matches ({results.length})</span>
          <span>Ranked by Semantic Proximity</span>
        </div>

        {results.map((res) => (
          <div
            key={res.id}
            className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3 hover:border-amber-500/40 transition-all"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="cyan" size="xs">
                  {res.documentType}
                </Badge>
                <span className="text-xs font-mono text-cyan-400 font-bold">{res.caseNumber}</span>
              </div>
              <Badge variant="verified" size="sm">
                {res.similarityScore}% Match Confidence
              </Badge>
            </div>

            <h4 className="text-sm font-semibold text-slate-100">{res.title}</h4>

            {/* Semantic Snippet */}
            <div className="p-3 bg-defense-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300 italic leading-relaxed">
              "{res.matchedSnippet}"
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                {res.acts.map((act, i) => (
                  <span key={i} className="bg-slate-900 px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-800">
                    {act}
                  </span>
                ))}
              </div>
              <Button variant="ghost" size="sm" icon={ArrowRight} className="text-xs text-cyan-400">
                Inspect Document
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
