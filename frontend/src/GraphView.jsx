import { useEffect, useRef, useState } from 'react'
import ForceGraph3D from '3d-force-graph'
import { getFullGraph } from './api'

const GraphView = ({ searchResults = [], onNodeClick }) => {
  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch full graph data on mount
  useEffect(() => {
    const loadGraph = async () => {
      try {
        const { data } = await getFullGraph()
        setGraphData(data)
      } catch (err) {
        console.error("Failed to load graph", err)
        setError("Could not load entity network graph")
      } finally {
        setLoading(false)
      }
    }
    loadGraph()
  }, [])

  // Identify nodes that should be highlighted (search results)
  const highlightedIds = new Set(searchResults.map(r => r.id))

  // Initialize and Update 3D Graph
  useEffect(() => {
    if (!containerRef.current || graphData.nodes.length === 0) return

    // Destroy previous instance to avoid memory leaks
    if (graphRef.current) {
      if (typeof graphRef.current._destructor === 'function') {
        graphRef.current._destructor()
      } else {
        containerRef.current.innerHTML = ''
      }
    }

    const Graph = ForceGraph3D()(containerRef.current)
      .width(containerRef.current.clientWidth)
      .height(460)
      .backgroundColor('rgba(0,0,0,0)')
      .graphData(graphData)
      .nodeLabel(node => node.label)
      .nodeColor(node => highlightedIds.has(node.id) ? '#1db87e' : '#4a5568')
      .nodeOpacity(0.9)
      .nodeResolution(16)
      .nodeRelSize(6)
      .linkColor(() => '#2d3748')
      .linkWidth(link => (link.weight || 0.5) * 1.5)
      .linkLabel(link => link.label || '')
      .linkOpacity(0.6)
      .onNodeClick(node => {
        onNodeClick?.(node)
        
        // Focus camera on node
        const distance = 80
        const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1)
        Graph.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new pos
          node, // lookAt
          1200  // transition duration
        )
      })

    graphRef.current = Graph

    // Cleanup function
    return () => {
      if (graphRef.current && typeof graphRef.current._destructor === 'function') {
        graphRef.current._destructor()
      }
    }
  }, [graphData, searchResults])

  if (loading) {
    return (
      <div className="h-[460px] flex flex-col items-center justify-center bg-gray-950 rounded-3xl border border-gray-800 text-slate-500">
        <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full mb-4"></div>
        <p className="text-sm font-medium animate-pulse">Initializing 3D Knowledge Network...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[460px] flex items-center justify-center bg-gray-950 rounded-3xl border border-gray-800 text-gray-500 text-sm">
        {error}
      </div>
    )
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="h-[460px] flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
        <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.823a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" /></svg>
        <p className="font-bold">Entity Network Empty</p>
        <p className="text-xs">Upload documents to visualize semantic connections</p>
      </div>
    )
  }

  return (
    <div className="relative group">
      <div 
        className="rounded-3xl border border-gray-800 overflow-hidden shadow-2xl"
        style={{ background: '#0a0f1a' }}
      >
        <div 
          ref={containerRef} 
          className="w-full h-[460px]"
        />
      </div>
      
      {/* Legend / Info Overlay */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-gray-900/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>{graphData.nodes.length} NODES</span>
            <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
            <span>{graphData.links.length} EDGES</span>
            <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
            <span className="flex items-center gap-1.5 text-teal-400">
              <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></span>
              SEARCH RESULTS
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-[9px] text-slate-500 font-bold bg-gray-900/50 px-2 py-1 rounded">
          DRAG TO ROTATE · SCROLL TO ZOOM · CLICK NODE TO FOCUS
        </div>
      </div>
    </div>
  )
}

export default GraphView
