import sys
import json
from backend import config, db, embedder, graph

def search(query: str, top_k: int = config.DEFAULT_TOP_K) -> dict:
    """
    Perform semantic vector search and return enriched results plus a subgraph.
    """
    # Step 1 — Validate
    if not query or not query.strip():
        return {"results": [], "graph": {"nodes": [], "links": []}}

    # Step 2 — Embed the query
    query_emb = embedder.embed_text(query)
    print(f"[search] query='{query}' top_k={top_k}")

    con = db.get_con()
    try:
        # Step 3 — ANN search with DuckDB VSS
        # array_cosine_similarity returns 1.0 for identical vectors, -1.0 for opposites.
        rows = con.execute(f"""
            SELECT id, filename, filepath, file_url, ocr_text, doc_type,
                   array_cosine_similarity(embedding, ?::FLOAT[{config.EMBEDDING_DIM}]) AS score
            FROM documents
            WHERE embedding IS NOT NULL
            ORDER BY score DESC
            LIMIT ?
        """, [query_emb, top_k]).fetchall()

        results = []
        result_ids = set()
        
        # Step 4 — Enrich each result
        for row in rows:
            doc_id, filename, filepath, file_url, ocr_text, doc_type, score = row
            result_ids.add(doc_id)
            
            # a. Fetch entities
            entities = con.execute(
                "SELECT ent_text, ent_label FROM entities WHERE doc_id = ?",
                [doc_id]
            ).fetchall()
            
            # b. Fetch neighbor doc IDs
            neighbors = con.execute("""
                SELECT DISTINCT
                    CASE WHEN source_id = ? THEN target_id ELSE source_id END AS neighbor_id,
                    shared_entity
                FROM doc_edges
                WHERE source_id = ? OR target_id = ?
            """, [doc_id, doc_id, doc_id]).fetchall()
            
            # c. Build result dict
            score_val = round(float(score), 4)
            if score_val > 0.1:
                results.append({
                    "id": doc_id,
                    "filename": filename,
                    "filepath": filepath,
                    "file_url": file_url,
                    "ocr_preview": (ocr_text or "")[:300],
                    "doc_type": doc_type,
                    "score": score_val,
                    "entities": [{"text": e[0], "label": e[1]} for e in entities],
                    "neighbors": [{"id": n[0], "via": n[1]} for n in neighbors]
                })
            else:
                # Remove from result_ids if score is too low
                result_ids.remove(doc_id)

        # Step 5 — Build subgraph
        # Collect all result IDs + their immediate neighbor IDs
        all_ids = set(result_ids)
        for res in results:
            for n in res["neighbors"]:
                all_ids.add(n["id"])
        
        # Build full graph from DB
        full_G = graph.build_networkx_graph(con)
        # Extract subgraph for the nodes identified
        sub_G = full_G.subgraph(all_ids)
        graph_data = graph.graph_to_json(sub_G)

        return {
            "results": results,
            "graph": graph_data
        }
    finally:
        con.close()

def get_full_graph() -> dict:
    """
    Fetch the entire knowledge graph for the full visualisation view.
    """
    con = db.get_con()
    try:
        G = graph.build_networkx_graph(con)
        return graph.graph_to_json(G)
    finally:
        con.close()

def get_document(doc_id: str) -> dict | None:
    """
    Fetch a single document and its entities.
    """
    con = db.get_con()
    try:
        row = con.execute("""
            SELECT id, filename, filepath, file_url, ocr_text, doc_type, created_at, page_count
            FROM documents WHERE id = ?
        """, [doc_id]).fetchone()
        
        if not row:
            return None
            
        doc = {
            "id": row[0],
            "filename": row[1],
            "filepath": row[2],
            "file_url": row[3],
            "ocr_text": row[4],
            "doc_type": row[5],
            "created_at": str(row[6]),
            "page_count": row[7]
        }
        
        entities = con.execute(
            "SELECT ent_text, ent_label FROM entities WHERE doc_id = ?",
            [doc_id]
        ).fetchall()
        
        doc["entities"] = [{"text": e[0], "label": e[1]} for e in entities]
        return doc
    finally:
        con.close()

if __name__ == "__main__":
    # CLI search test
    query_str = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "blood pressure"
    
    output = search(query_str)
    print(f"\n--- Search Results for '{query_str}' ---")
    for res in output["results"]:
        print(f"[{res['score']}] {res['filename']} ({len(res['entities'])} entities)")
        if res["entities"]:
            print(f"    Entities: {', '.join([e['text'] for e in res['entities'][:5]])}")
    
    print(f"\nSubgraph: {len(output['graph']['nodes'])} nodes, {len(output['graph']['links'])} links.")
