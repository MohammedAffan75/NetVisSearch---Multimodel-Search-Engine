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

  // Initial Fetch: Database Stats
  useEffect(() => {
    fetchStats();
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
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-teal-600 tracking-tighter">NetVisSearch</h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">100% local · private</p>
        </div>
        
        {/* Stats Bar */}
        <div className="flex gap-3 text-[10px] font-mono">
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
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-10">
        
        {/* ── UPLOAD ZONE ── */}
        <section 
          className="border-2 border-dashed border-slate-300 rounded-3xl p-12 text-center bg-white hover:border-teal-500 hover:bg-teal-50/30 transition-all cursor-pointer group shadow-sm"
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
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-xl font-bold text-slate-600">Drop documents or images here</p>
            <p className="text-sm text-slate-400 font-medium">Auto-OCR and CLIP embedding enabled</p>
          </div>

          {/* Active Uploads List */}
          {uploading.length > 0 && (
            <div className="mt-8 text-left space-y-2 max-w-lg mx-auto">
              {uploading.map((u, i) => (
                <div key={i} className="flex justify-between items-center text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="truncate font-mono font-medium text-slate-500">{u.name}</span>
                  <span className={u.status.includes('✓') ? 'text-teal-600 font-black' : 'text-slate-400 italic'}>{u.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── SEARCH BAR ── */}
        <section className="space-y-5">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-5 flex items-center text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input 
                type="text" 
                className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-5 py-5 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none text-lg shadow-sm transition-all"
                placeholder='Try: "patient blood pressure" or "blue document with text"'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-black px-10 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center gap-2 text-lg uppercase tracking-tight"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {results.map((res) => (
                <div 
                  key={res.id} 
                  onClick={() => handleViewDoc(res.id)}
                  className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-slate-100 hover:border-b-teal-500 cursor-pointer"
                >
                  <div className="h-52 bg-slate-100 relative overflow-hidden">
                    <img 
                      src={fileUrl(res.file_url)} 
                      alt={res.filename}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                    />
                    <div className="absolute top-4 right-4 bg-teal-600 text-white text-[9px] font-black px-2.5 py-1.5 rounded-full shadow-lg border border-white/20 uppercase tracking-tighter">
                      MATCH: {(res.score * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <h3 className="font-black text-slate-800 truncate text-lg" title={res.filename}>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => setViewingDoc(null)}
            ></div>
            <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
              {/* Left: Preview */}
              <div className="md:w-1/2 bg-slate-100 border-r border-slate-100">
                <img 
                  src={fileUrl(viewingDoc.file_url)} 
                  alt={viewingDoc.filename}
                  className="w-full h-full object-contain"
                />
              </div>
              
              {/* Right: Info */}
              <div className="md:w-1/2 p-8 overflow-y-auto space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{viewingDoc.filename}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {viewingDoc.doc_type} · {new Date(viewingDoc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => setViewingDoc(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-black text-teal-600 uppercase tracking-widest">Extracted Entities</h3>
                  <div className="flex flex-wrap gap-2">
                    {viewingDoc.entities.map((ent, idx) => (
                      <div key={idx} className="bg-teal-50 text-teal-700 text-[10px] font-bold px-3 py-1.5 rounded-xl border border-teal-100">
                        <span className="opacity-40 mr-1.5">{ent.label}:</span>
                        {ent.text}
                      </div>
                    ))}
                    {viewingDoc.entities.length === 0 && <span className="text-slate-300 italic text-xs">No entities detected</span>}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Full OCR Text</h3>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 font-mono text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {viewingDoc.ocr_text || "No text extracted from this document."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SELECTED NODE INFO ── */}
        {selectedNode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]">
            <div className="bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest">Selected Entity</span>
                <span className="text-sm font-bold truncate max-w-[250px]">{selectedNode.label}</span>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="hover:bg-white/10 p-1.5 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
