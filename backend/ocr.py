import os
import sys
import io
import tempfile
from pathlib import Path
import fitz  # PyMuPDF
import easyocr
from backend import config

_reader = None

def get_reader() -> easyocr.Reader:
    """
    Lazy singleton for the EasyOCR reader.
    """
    global _reader
    if _reader is None:
        # Initialize with English, CPU mode, and custom model cache dir
        _reader = easyocr.Reader(
            ['en'], 
            gpu=False, 
            model_storage_directory=str(config.HF_CACHE_DIR)
        )
        print("[ocr] EasyOCR ready.")
    return _reader

def ocr_image(image_path: str) -> str:
    """
    Perform OCR on a single image file.
    """
    try:
        reader = get_reader()
        # detail=0 returns only text, paragraph=True groups them
        results = reader.readtext(image_path, detail=0, paragraph=True)
        text = " ".join(results).strip()
        
        filename = os.path.basename(image_path)
        print(f"[ocr] image: {filename} → {len(text)} chars")
        return text
    except Exception as e:
        print(f"[ocr] Warning: OCR failed for {image_path}: {e}")
        return ""

def ocr_pdf(pdf_path: str) -> tuple[str, int]:
    """
    Extract text from a PDF, falling back to OCR for non-searchable pages.
    """
    try:
        # Open the PDF via path
        doc = fitz.open(pdf_path)
        page_texts = []
        page_count = len(doc)
        filename = os.path.basename(pdf_path)

        for n, page in enumerate(doc):
            # Try native text extraction first
            text = page.get_text().strip()
            
            # Heuristic: if text is too short, the page might be an image
            if len(text) > 50:
                page_texts.append(text)
            else:
                # Render page at 200 DPI to PNG bytes
                pix = page.get_pixmap(dpi=200)
                
                # Save to a temporary file for ocr_image to process
                # Using tempfile.gettempdir() for cross-platform compatibility
                temp_dir = tempfile.gettempdir()
                temp_img_path = os.path.join(temp_dir, f"netvis_page_{n}.png")
                pix.save(temp_img_path)
                
                # Run OCR on the rendered page
                ocr_text = ocr_image(temp_img_path)
                page_texts.append(ocr_text)
                
                # Cleanup temp file
                if os.path.exists(temp_img_path):
                    os.remove(temp_img_path)

        full_text = "\n\n".join(page_texts)
        print(f"[ocr] pdf: {filename} → {page_count} pages, {len(full_text)} chars")
        return full_text, page_count
    except Exception as e:
        print(f"[ocr] Warning: PDF extraction failed for {pdf_path}: {e}")
        return "", 0

def extract_text(filepath: str) -> tuple[str, int]:
    """
    Unified entry point for text extraction from documents or images.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {filepath}")
        
    ext = path.suffix.lower()
    
    if ext == ".pdf":
        return ocr_pdf(filepath)
    elif ext in [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]:
        # Images always have page count = 1
        return ocr_image(filepath), 1
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m backend.ocr <path_to_file>")
        sys.exit(1)
        
    target_file = sys.argv[1]
    try:
        extracted_text, pages = extract_text(target_file)
        print(f"\n--- Extraction Result ({pages} pages) ---")
        print(extracted_text[:400] + ("..." if len(extracted_text) > 400 else ""))
    except Exception as e:
        print(f"Error: {e}")
