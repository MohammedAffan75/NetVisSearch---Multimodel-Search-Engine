import torch
import numpy as np
from PIL import Image
from transformers import AutoModel, AutoProcessor
from backend import config
import os

# Lazy model loading singletons
_model = None
_processor = None

def _load():
    """
    Lazy load the Jina-CLIP-v2 model and processor once.
    """
    global _model, _processor
    if _model is None:
        print(f"[embed] Loading {config.EMBEDDING_MODEL}...")
        _processor = AutoProcessor.from_pretrained(
            config.EMBEDDING_MODEL, 
            trust_remote_code=True, 
            cache_dir=str(config.HF_CACHE_DIR)
        )
        _model = AutoModel.from_pretrained(
            config.EMBEDDING_MODEL, 
            trust_remote_code=True, 
            cache_dir=str(config.HF_CACHE_DIR)
        )
        _model.eval()
        print("[embed] Model ready.")
    return _model, _processor

def _normalise(vec: np.ndarray) -> list[float]:
    """
    Apply L2-normalisation to the vector. 
    Slices to config.EMBEDDING_DIM first (supports Matryoshka embeddings).
    """
    # Slice to the configured dimension (e.g., 512)
    vec = vec[:config.EMBEDDING_DIM]
    norm = np.linalg.norm(vec)
    # Epsilon prevents division by zero
    return (vec / (norm + 1e-9)).tolist()

def embed_text(text: str) -> list[float]:
    """
    Generate a normalised embedding for a text string.
    """
    if not text or not text.strip():
        return [0.0] * config.EMBEDDING_DIM
    
    model, processor = _load()
    inputs = processor(
        text=[text], 
        return_tensors="pt", 
        padding=True, 
        truncation=True, 
        max_length=512
    )
    
    with torch.no_grad():
        # Jina-CLIP-v2 requires explicit feature extraction
        outputs = model.get_text_features(
            input_ids=inputs['input_ids'],
            attention_mask=inputs['attention_mask']
        )
    
    return _normalise(outputs[0].cpu().numpy())

def embed_image(image_path: str) -> list[float]:
    """
    Generate a normalised embedding for an image file or PDF first page.
    """
    import fitz  # PyMuPDF
    import io

    model, processor = _load()
    
    ext = os.path.splitext(image_path)[1].lower()
    
    if ext == ".pdf":
        # For PDFs, render the first page as an image
        doc = fitz.open(image_path)
        page = doc[0]
        pix = page.get_pixmap(dpi=150) # Moderate DPI for speed
        img_bytes = pix.tobytes("png")
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        doc.close()
    else:
        # Standard image file
        img = Image.open(image_path).convert("RGB")
        
    inputs = processor(images=[img], return_tensors="pt")
    
    with torch.no_grad():
        outputs = model.get_image_features(
            pixel_values=inputs['pixel_values']
        )
    
    return _normalise(outputs[0].cpu().numpy())

def embed_multimodal(image_path: str, text: str) -> list[float]:
    """
    Generate a combined embedding by averaging image and text embeddings.
    Used for document indexing.
    """
    img_emb = np.array(embed_image(image_path))
    if text and text.strip():
        txt_emb = np.array(embed_text(text))
        # Average the two embeddings
        combined = (img_emb + txt_emb) / 2.0
        return _normalise(combined)
    return img_emb.tolist()

if __name__ == "__main__":
    # 1. Test text embedding
    t1 = "A photo of a dog"
    e1 = embed_text(t1)
    print(f"Text dim: {len(e1)}, First 5: {e1[:5]}")
    
    # 2. Test image embedding
    test_img = "data/samples/test.png"
    if os.path.exists(test_img):
        ei = embed_image(test_img)
        print(f"Image dim: {len(ei)}, First 5: {ei[:5]}")
    else:
        print(f"Skipping image test: {test_img} not found.")
    
    # 3. Cosine similarity test
    t2 = "A picture of a puppy"
    e2 = embed_text(t2)
    # Cosine similarity for normalised vectors is just the dot product
    sim = np.dot(e1, e2)
    print(f"Similarity ('dog' vs 'puppy'): {sim:.4f}")
