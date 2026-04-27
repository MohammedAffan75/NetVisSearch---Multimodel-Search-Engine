import duckdb
from backend import config

def get_con() -> duckdb.DuckDBPyConnection:
    """
    Connect to DuckDB and load the VSS extension.
    """
    # Use string 'true' for persistence config
    config_dict = {'hnsw_enable_experimental_persistence': 'true'}
    con = duckdb.connect(config.DUCKDB_PATH, config=config_dict)
    try:
        print("[db] Loading VSS extension...")
        con.execute("LOAD vss;")
    except Exception as e:
        print(f"[db] VSS error: {e}. Attempting install...")
        con.execute("INSTALL vss;")
        con.execute("LOAD vss;")
    print("[db] VSS extension loaded.")
    return con

def init_db():
    """
    Initialize the database schema if it doesn't exist.
    """
    print(f"[db] Initializing at {config.DUCKDB_PATH}...")
    con = get_con()
    
    try:
        print("[db] Creating documents table...")
        con.execute(f"""
            CREATE TABLE IF NOT EXISTS documents (
                id           VARCHAR PRIMARY KEY,
                filename     VARCHAR NOT NULL,
                filepath     VARCHAR NOT NULL,
                file_url     VARCHAR DEFAULT '',
                ocr_text     TEXT DEFAULT '',
                doc_type     VARCHAR DEFAULT 'image',
                embedding    FLOAT[{config.EMBEDDING_DIM}],
                page_count   INTEGER DEFAULT 1,
                created_at   TIMESTAMP DEFAULT now()
            );
        """)
        
        print("[db] Creating entities table...")
        con.execute("""
            CREATE TABLE IF NOT EXISTS entities (
                id           VARCHAR PRIMARY KEY,
                doc_id       VARCHAR NOT NULL,
                ent_text     VARCHAR NOT NULL,
                ent_label    VARCHAR NOT NULL
            );
        """)
        
        print("[db] Creating edges table...")
        con.execute("""
            CREATE TABLE IF NOT EXISTS doc_edges (
                id           VARCHAR PRIMARY KEY,
                source_id    VARCHAR NOT NULL,
                target_id    VARCHAR NOT NULL,
                shared_entity VARCHAR NOT NULL,
                weight       FLOAT DEFAULT 1.0,
                created_at   TIMESTAMP DEFAULT now()
            );
        """)
        
        # print("[db] Creating HNSW index (this may take a moment)...")
        # con.execute("CREATE INDEX IF NOT EXISTS hnsw_emb ON documents USING HNSW (embedding) WITH (metric = 'cosine');")
        
        print(f"[db] Success! Database initialized at {config.DUCKDB_PATH}")
    except Exception as e:
        print(f"[db] CRITICAL ERROR during init: {e}")
        raise e
    finally:
        con.close()

def drop_all():
    """
    Drop all tables and indexes.
    """
    con = get_con()
    con.execute("DROP INDEX IF EXISTS hnsw_emb;")
    con.execute("DROP TABLE IF EXISTS doc_edges;")
    con.execute("DROP TABLE IF EXISTS entities;")
    con.execute("DROP TABLE IF EXISTS documents;")
    print("[db] All tables dropped.")
    con.close()

def get_db_info() -> dict:
    """
    Return metadata and counts from the database.
    """
    con = get_con()
    try:
        doc_count = con.execute("SELECT count(*) FROM documents").fetchone()[0]
        entity_count = con.execute("SELECT count(*) FROM entities").fetchone()[0]
        edge_count = con.execute("SELECT count(*) FROM doc_edges").fetchone()[0]
    except Exception:
        doc_count = entity_count = edge_count = 0
    finally:
        con.close()
        
    return {
        "backend": "duckdb",
        "path": config.DUCKDB_PATH,
        "doc_count": doc_count,
        "entity_count": entity_count,
        "edge_count": edge_count
    }

if __name__ == "__main__":
    init_db()
    import json
    print(json.dumps(get_db_info(), indent=2))
