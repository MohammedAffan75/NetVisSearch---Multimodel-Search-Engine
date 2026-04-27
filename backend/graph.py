import uuid
import spacy
import networkx as nx
from backend import config

_nlp = None

def get_nlp():
    """
    Lazy singleton for the spaCy NLP model.
    """
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load(config.SPACY_MODEL)
        except OSError:
            # Fallback for local dev if model isn't downloaded yet
            print(f"[graph] Model {config.SPACY_MODEL} not found. Downloading...")
            spacy.cli.download(config.SPACY_MODEL)
            _nlp = spacy.load(config.SPACY_MODEL)
    return _nlp

# Entities we care about for the knowledge graph
KEEP_LABELS = {"PERSON", "ORG", "GPE", "LOC", "DATE", "PRODUCT", "EVENT"}

def extract_entities(text: str) -> list[dict]:
    """
    Extract relevant named entities from text using spaCy.
    """
    if not text or len(text) < 10:
        return []
    
    nlp = get_nlp()
    # Cap text length to avoid OOM or performance issues
    doc = nlp(text[:100_000])
    
    seen = set()
    entities = []
    
    for ent in doc.ents:
        if ent.label_ in KEEP_LABELS:
            # Deduplicate by (lowercase text, label)
            key = (ent.text.lower().strip(), ent.label_)
            if key not in seen:
                seen.add(key)
                entities.append({
                    "text": ent.text.strip(),
                    "label": ent.label_
                })
                
    return entities

def store_entities(con, doc_id: str, entities: list[dict]):
    """
    Persist entities and create shared-entity edges between documents.
    """
    edge_count = 0
    for ent in entities:
        ent_id = str(uuid.uuid4())
        # 1. Insert the entity record
        con.execute(
            "INSERT INTO entities (id, doc_id, ent_text, ent_label) VALUES (?, ?, ?, ?)",
            [ent_id, doc_id, ent.get("text"), ent.get("label")]
        )
        
        # 2. Find other documents that share this exact entity text
        # (Case-insensitive comparison via lower() is usually better but spec said same ent_text)
        others = con.execute(
            "SELECT DISTINCT doc_id FROM entities WHERE ent_text = ? AND doc_id != ?",
            [ent.get("text"), doc_id]
        ).fetchall()
        
        for (other_doc_id,) in others:
            # 3. Check if an edge already exists in either direction
            exists = con.execute(
                """
                SELECT 1 FROM doc_edges 
                WHERE (source_id = ? AND target_id = ?) 
                   OR (source_id = ? AND target_id = ?)
                """,
                [doc_id, other_doc_id, other_doc_id, doc_id]
            ).fetchone()
            
            if not exists:
                edge_id = str(uuid.uuid4())
                con.execute(
                    """
                    INSERT INTO doc_edges (id, source_id, target_id, shared_entity, weight) 
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    [edge_id, doc_id, other_doc_id, ent.get("text"), 1.0]
                )
                edge_count += 1
                
    return edge_count

def build_networkx_graph(con) -> nx.Graph:
    """
    Build a NetworkX graph from the database state.
    """
    G = nx.Graph()
    
    # Load nodes (Documents)
    docs = con.execute("SELECT id, filename FROM documents").fetchall()
    for doc_id, filename in docs:
        G.add_node(doc_id, label=filename)
        
    # Load edges (Doc Edges)
    edges = con.execute("SELECT source_id, target_id, shared_entity, weight FROM doc_edges").fetchall()
    for src, tgt, ent, w in edges:
        G.add_edge(src, tgt, label=ent, weight=w)
        
    return G

def graph_to_json(G: nx.Graph) -> dict:
    """
    Format graph for 3d-force-graph consumption.
    """
    nodes = []
    for node_id, data in G.nodes(data=True):
        nodes.append({
            "id": node_id,
            "label": data.get("label", node_id)
        })
        
    links = []
    for u, v, data in G.edges(data=True):
        links.append({
            "source": u,
            "target": v,
            "label": data.get("label", ""),
            "weight": data.get("weight", 1.0)
        })
        
    return {"nodes": nodes, "links": links}
