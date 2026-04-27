import os
import tempfile
from pathlib import Path
from backend import config

def save_file(file_bytes: bytes, filename: str) -> tuple[str, str]:
    """
    Save file to the configured storage backend (local or S3).
    Returns (local_path, public_url). 
    local_path is used by the ingestion pipeline (OCR/Embed),
    public_url is used by the frontend for display.
    """
    if config.STORAGE_BACKEND == 'local':
        # Ensure directory exists (handled in config.py but being safe)
        os.makedirs(config.LOCAL_UPLOAD_DIR, exist_ok=True)
        
        local_path = config.LOCAL_UPLOAD_DIR / filename
        with open(local_path, "wb") as f:
            f.write(file_bytes)
            
        # URL served by FastAPI StaticFiles
        public_url = f"/files/{filename}"
        return (str(local_path.absolute()), public_url)
        
    elif config.STORAGE_BACKEND == 's3':
        import boto3
        
        # 1. Upload to S3
        s3 = boto3.client(
            "s3", 
            region_name=config.AWS_REGION
        )
        s3_key = f"uploads/{filename}"
        s3.put_object(
            Bucket=config.S3_BUCKET_NAME,
            Key=s3_key,
            Body=file_bytes
        )
        
        public_url = f"https://{config.S3_BUCKET_NAME}.s3.{config.AWS_REGION}.amazonaws.com/{s3_key}"
        
        # 2. Save to local temp for processing
        # Using tempfile to be cross-platform (Windows/Linux)
        temp_path = os.path.join(tempfile.gettempdir(), filename)
        with open(temp_path, "wb") as f:
            f.write(file_bytes)
            
        return (temp_path, public_url)
    
    else:
        raise ValueError(f"Unknown STORAGE_BACKEND: {config.STORAGE_BACKEND}")

def get_file_url(filename: str) -> str:
    """
    Generate the public URL for a given filename.
    """
    if config.STORAGE_BACKEND == 'local':
        return f"/files/{filename}"
    else:
        return f"https://{config.S3_BUCKET_NAME}.s3.{config.AWS_REGION}.amazonaws.com/uploads/{filename}"
