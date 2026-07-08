import React, { useState, useEffect } from 'react';
import { getStats, uploadFile, searchDocs, getDocDetails, fileUrl } from './api';
import GraphView from './GraphView';

const App = () => {
  // Application State
  const [stats, setStats] = useState({ doc_count: 0, entity_count: 0, edge_count: 0 });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState([]); // Array of { name, status }
  const [selectedNode, setSelectedNode] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Initial Fetch: Database Stats
  useEffect(() => {
    fetchStats();

    // Close modals on Escape key press
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setViewingDoc(null);
        setSelectedNode(null);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await getStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  /**
   * Handle file uploads via drag-and-drop or click.
   */
  const handleUpload = async (files) => {
    const newUploads = Array.from(files).map(f => ({ name: f.name, status: 'Uploading...' }));
    setUploading(prev => [...prev, ...newUploads]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { data } = await uploadFile(file);
        setUploading(prev => prev.map(u => 
          u.name === file.name ? { ...u, status: `✓ Ingested · ${data.entity_count} entities found` } : u
        ));
        fetchStats(); // Refresh doc/entity counts
      } catch (err) {
        setUploading(prev => prev.map(u => 
          u.name === file.name ? { ...u, status: '❌ Failed' } : u
        ));
      }
    }
  };

  /**
   * Perform semantic vector search.
   */
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const { data } = await searchDocs(query);
      setResults(data.results);
    } catch (err) {
      setError("Cannot connect to backend. Is it running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch and show full document details in a modal.
   */
  const handleViewDoc = async (docId) => {
    setLoading(true);
    try {
      const { data } = await getDocDetails(docId);
      setViewingDoc(data);
    } catch (err) {
      console.error("Failed to load document details", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <a href="/index.html" className="text-slate-400 hover:text-teal-600 transition-colors p-2 hover:bg-slate-50 rounded-xl" title="Back to Landing Page">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </a>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-teal-600 tracking-tighter">NetVisSearch</h1>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">100% local · private</p>
          </div>
        </div>
        
        {/* Desktop Stats Bar */}
        <div className="hidden md:flex gap-3 text-[10px] font-mono">
          <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            DOCS: <span className="text-teal-600 font-black">{stats.doc_count}</span>
          </div>
          <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            ENTITIES: <span className="text-teal-600 font-black">{stats.entity_count}</span>
          </div>
          <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            EDGES: <span className="text-teal-600 font-black">{stats.edge_count}</span>
          </div>
        </div>

        {/* Mobile Stats Toggle Trigger */}
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-slate-600 hover:text-teal-600 hover:bg-slate-100 rounded-xl transition-colors"
          aria-label="Toggle database statistics menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Mobile Drawer (Stats Overlay) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setMenuOpen(false)}
          ></div>
          <div className="relative w-80 max-w-[85vw] bg-white h-full p-6 shadow-2xl flex flex-col gap-6 animate-in slide-in-from-right duration-250">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Database Info</h2>
              <button 
                onClick={() => setMenuOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                aria-label="Close stats menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-bold">TOTAL DOCUMENTS</span>
                <span className="text-teal-600 font-black text-sm">{stats.doc_count}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-bold">EXTRACTED ENTITIES</span>
                <span className="text-teal-600 font-black text-sm">{stats.entity_count}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-bold">NETWORK EDGES</span>
                <span className="text-teal-600 font-black text-sm">{stats.edge_count}</span>
              </div>
            </div>

            <div className="mt-auto border-t border-slate-100 pt-6 space-y-3">
              <a 
                href="/index.html" 
                className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl border border-slate-200 transition-colors text-sm uppercase tracking-tight"
              >
                Back to Landing Page
              </a>
              <a 
                href="https://github.com/MohammedAffan75/NetVisSearch---Multimodel-Search-Engine" 
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors text-sm uppercase tracking-tight"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 md:space-y-10">
        
        {/* ── UPLOAD ZONE ── */}
        <section 
          className="border-2 border-dashed border-slate-300 rounded-3xl p-6 sm:p-12 text-center bg-white hover:border-teal-500 hover:bg-teal-50/30 transition-all cursor-pointer group shadow-sm"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleUpload(e.dataTransfer.files);
          }}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <input 
            id="fileInput" 
            type="file" 
            multiple 
            className="hidden" 
            onChange={(e) => handleUpload(e.target.files)}
          />
          <div className="space-y-3">
            <div className="text-slate-300 group-hover:text-teal-500 transition-colors">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-lg sm:text-xl font-bold text-slate-600">Drop documents or images here</p>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Auto-OCR and CLIP embedding enabled</p>
          </div>

          {/* Active Uploads List */}
          {uploading.length > 0 && (
            <div className="mt-8 text-left space-y-2 max-w-lg mx-auto">
              {uploading.map((u, i) => (
                <div key={i} className="flex justify-between items-center text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="truncate font-mono font-medium text-slate-500 max-w-[65%]">{u.name}</span>
                  <span className={u.status.includes('✓') ? 'text-teal-600 font-black' : 'text-slate-400 italic'}>{u.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── SEARCH BAR ── */}
        <section className="space-y-5">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input 
                type="text" 
                className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-5 py-4 sm:py-5 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none text-base sm:text-lg shadow-sm transition-all"
                placeholder='Try: "patient blood pressure" or "blue document with text"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-black px-6 sm:px-10 py-4 sm:py-0 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-base sm:text-lg uppercase tracking-tight"
            >
              {loading ? 'Searching...' : 'Explore'}
            </button>
          </form>

          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 px-5 py-4 rounded-2xl text-sm font-medium flex items-center gap-3 animate-pulse">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}
        </section>

        {/* ── KNOWLEDGE GRAPH ── */}
        <GraphView 
          searchResults={results} 
          onNodeClick={(node) => setSelectedNode(node)} 
        />

        {/* ── RESULTS GRID ── */}
        <section>
          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {results.map((res) => (
                <div 
                  key={res.id} 
                  onClick={() => handleViewDoc(res.id)}
                  className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-slate-100 hover:border-b-teal-500 cursor-pointer"
                >
                  <div className="h-40 sm:h-48 md:h-52 bg-slate-100 relative overflow-hidden">
                    <img 
                      src={fileUrl(res.file_url)} 
                      alt={res.filename}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                    />
                    <div className="absolute top-4 right-4 bg-teal-600 text-white text-[9px] font-black px-2.5 py-1.5 rounded-full shadow-lg border border-white/20 uppercase tracking-tighter">
                      MATCH: {(res.score * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-5 sm:p-6 space-y-4">
                    <h3 className="font-black text-slate-800 truncate text-base sm:text-lg" title={res.filename}>
                      {res.filename}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium line-clamp-3 leading-relaxed italic">
                      "{res.ocr_preview}..."
                    </p>
                    
                    <div className="flex flex-wrap gap-1.5">
                      {res.entities.slice(0, 4).map((ent, idx) => (
                        <span key={idx} className="bg-teal-50 text-teal-700 text-[9px] font-black px-2.5 py-1 rounded-lg border border-teal-100/50 uppercase">
                          {ent.text}
                        </span>
                      ))}
                    </div>

                    {res.neighbors && res.neighbors.length > 0 && (
                      <div className="pt-4 mt-2 border-t border-slate-50 flex items-center gap-2 text-[9px] text-slate-400 font-black uppercase tracking-tighter">
                        <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.823a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" /></svg>
                        {res.neighbors.length} Cross-links
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {results.length === 0 && !loading && query && (
            <div className="text-center py-32 bg-white rounded-3xl border border-slate-100 shadow-inner">
              <p className="text-slate-300 font-black text-3xl uppercase tracking-tighter">No Semantic Matches</p>
              <p className="text-slate-400 text-sm mt-2 font-medium">Try broadening your search query</p>
            </div>
          )}
        </section>

        {/* ── DOCUMENT PREVIEW MODAL ── */}
        {viewingDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => setViewingDoc(null)}
            ></div>
            <div className="relative bg-white w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200">
              {/* Left: Preview */}
              <div className="h-48 sm:h-64 md:h-auto md:w-1/2 flex-shrink-0 bg-slate-100 border-b md:border-b-0 md:border-r border-slate-100 relative">
                <img 
                  src={fileUrl(viewingDoc.file_url)} 
                  alt={viewingDoc.filename}
                  className="w-full h-full object-contain p-2"
                />
              </div>
              
              {/* Right: Info */}
              <div className="flex-1 p-5 sm:p-8 overflow-y-auto space-y-6 flex flex-col min-h-0">
                <div className="flex justify-between items-start">
                  <div className="max-w-[85%]">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-tight break-all" title={viewingDoc.filename}>
                      {viewingDoc.filename}
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {viewingDoc.doc_type} · {new Date(viewingDoc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => setViewingDoc(null)}
                    className="p-2.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 flex-shrink-0"
                    aria-label="Close document preview"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-black text-teal-600 uppercase tracking-widest">Extracted Entities</h3>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
                    {viewingDoc.entities.map((ent, idx) => (
                      <div key={idx} className="bg-teal-50 text-teal-700 text-[10px] font-bold px-3 py-1.5 rounded-xl border border-teal-100 flex-shrink-0">
                        <span className="opacity-40 mr-1.5">{ent.label}:</span>
                        {ent.text}
                      </div>
                    ))}
                    {viewingDoc.entities.length === 0 && <span className="text-slate-300 italic text-xs">No entities detected</span>}
                  </div>
                </div>

                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Full OCR Text</h3>
                  <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100 font-mono text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[25vh] md:max-h-none flex-1">
                    {viewingDoc.ocr_text || "No text extracted from this document."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SELECTED NODE INFO ── */}
        {selectedNode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm">
            <div className="bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 flex justify-between items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest">Selected Entity</span>
                <span className="text-sm font-bold truncate" title={selectedNode.label}>{selectedNode.label}</span>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="hover:bg-white/10 p-2 rounded-lg transition-colors flex-shrink-0"
                aria-label="Deselect entity"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
