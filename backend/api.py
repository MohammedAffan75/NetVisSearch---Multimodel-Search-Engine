import os
# Fix for potential OpenMP/MKL hangs on Windows
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

print("[api] Starting NetVisSearch...")

import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from backend import config, db, storage, search, ingest

app = FastAPI(
    title="NetVisSearch API",
    description="Semantic Search and 3D Entity Network Graph for Documents and Images",
    version="1.0.0"
)

# 1. CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Static Files (Local Dev only)
if config.STORAGE_BACKEND == 'local':
    app.mount("/files", StaticFiles(directory=str(config.LOCAL_UPLOAD_DIR)), name="files")

# 3. Initialize Database
db.init_db()
print(f"[api] Database initialized. ENV={config.APP_ENV}")

# 4. Endpoints

@app.get("/health")
@app.get("/stats")
async def health_check():
    """
    Returns API health and database statistics.
    """
    try:
        db_info = db.get_db_info()
        return {
            "status": "ok",
            "env": config.APP_ENV,
            "storage": config.STORAGE_BACKEND,
            **db_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a file, save it to storage, and run the ingestion pipeline.
    """
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in ingest.SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Allowed: {', '.join(ingest.SUPPORTED_EXTENSIONS)}"
        )
    
    try:
        # Read file bytes
        contents = await file.read()
        
        # Save to storage (Local or S3)
        local_path, file_url = storage.save_file(contents, filename)
        
        # Run ingestion pipeline (OCR, Embed, Graph)
        ingest_result = ingest.ingest_file(local_path, file_url=file_url)
        
        return {
            "success": True,
            "file_url": file_url,
            **ingest_result
        }
    except Exception as e:
        print(f"[api] Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
async def semantic_search(
    q: str = Query(..., min_length=1),
    top_k: int = Query(10, ge=1, le=50)
):
    """
    Semantic search with associated entity graph subgraph.
    """
    try:
        results = search.search(q, top_k=top_k)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph")
async def full_graph():
    """
    Returns the entire entity relationship graph for global visualization.
    """
    try:
        return search.get_full_graph()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/document/{doc_id}")
async def get_doc_details(doc_id: str):
    """
    Fetch full details for a specific document.
    """
    doc = search.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

# 5. CLI Execution
if __name__ == "__main__":
    uvicorn.run(
        "backend.api:app", 
        host="127.0.0.1", 
        port=config.APP_PORT, 
        reload=not config.IS_PRODUCTION
    )
