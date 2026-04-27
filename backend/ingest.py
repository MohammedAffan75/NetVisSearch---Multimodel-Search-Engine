import os
import sys
import uuid
import shutil
import json
from pathlib import Path

from backend import config, db, ocr, embedder, graph

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp", ".pdf"}

def ingest_file(source_path: str, file_url: str = "") -> dict:
    """
    End-to-end ingestion pipeline for a single file.
    """
    # a. Validate file
    source_path = os.path.abspath(source_path)
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source file not found: {source_path}")
        
    filename = os.path.basename(source_path)
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported extension: {ext}")

    print(f"[ingest] 1/7 — Processing: {filename}")
    doc_id = str(uuid.uuid4())
    
    # b. Storage Logic
    stored_path = source_path
    if config.STORAGE_BACKEND == 'local':
        dest_path = config.LOCAL_UPLOAD_DIR / filename
        if source_path != str(dest_path.absolute()):
            print(f"[ingest] 2/7 — Copying to local storage...")
            shutil.copy2(source_path, dest_path)
        stored_path = str(dest_path)
    else:
        print(f"[ingest] 2/7 — Using remote storage URL: {file_url}")

    # c. Extract text
    print(f"[ingest] 3/7 — Extracting text (OCR/PDF)...")
    ocr_text, page_count = ocr.extract_text(source_path)

    # d. Generate embedding
    print(f"[ingest] 4/7 — Generating Jina-CLIP-v2 embedding...")
    embedding = embedder.embed_multimodal(source_path, ocr_text)

    # e. Determine doc_type
    doc_type = 'pdf' if ext == '.pdf' else 'image'

    # f. Insert into DB
    print(f"[ingest] 5/7 — Saving document to database...")
    con = db.get_con()
    try:
        con.execute(
            """
            INSERT INTO documents (id, filename, filepath, file_url, ocr_text, doc_type, embedding, page_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [doc_id, filename, stored_path, file_url, ocr_text, doc_type, embedding, page_count]
        )
        
        # g. Extract and store entities
        print(f"[ingest] 6/7 — Extracting entities and updating graph...")
        entities = graph.extract_entities(ocr_text)
        edge_count = graph.store_entities(con, doc_id, entities)
        
        # h. Success
        print(f"[ingest] 7/7 — Done. Created {len(entities)} entities and {edge_count} edges.")
        
        return {
            "doc_id": doc_id,
            "filename": filename,
            "file_url": file_url,
            "ocr_text_length": len(ocr_text),
            "entity_count": len(entities),
            "edge_count": edge_count,
            "page_count": page_count
        }
    finally:
        con.close()

def ingest_directory(dir_path: str) -> list[dict]:
    """
    Process all supported files in a directory.
    """
    results = []
    path = Path(dir_path)
    
    files = []
    for ext in SUPPORTED_EXTENSIONS:
        files.extend(path.glob(f"*{ext}"))
        files.extend(path.glob(f"*{ext.upper()}"))
        
    print(f"[ingest] Found {len(files)} files in {dir_path}")
    
    for f in files:
        try:
            res = ingest_file(str(f))
            results.append(res)
        except Exception as e:
            print(f"[ingest] Error processing {f.name}: {e}")
            continue
            
    return results

if __name__ == "__main__":
    import traceback
    try:
        # Ensure DB is ready
        db.init_db()
        
        # CLI Target
        target = sys.argv[1] if len(sys.argv) > 1 else "data/samples/test.png"
        
        if os.path.isdir(target):
            print(f"Ingesting directory: {target}")
            all_res = ingest_directory(target)
            print(f"Ingested {len(all_res)} files.")
        else:
            print(f"Ingesting file: {target}")
            res = ingest_file(target)
            print("\n--- Ingestion Result ---")
            print(json.dumps(res, indent=2))
    except Exception as e:
        print("\n[ingest] CRITICAL ERROR:")
        traceback.print_exc()
        sys.exit(1)
