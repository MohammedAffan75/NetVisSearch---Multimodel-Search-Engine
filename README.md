# NetVisSearch 🌐🔍

**Your files. Searched by meaning. Visualized as a network.**

NetVisSearch is a 100% local, privacy-first semantic search engine that understands what your images and documents contain and visualizes their relationships in a stunning 3D force-directed graph.

![NetVisSearch Hero](https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=2070)

## ✨ Key Features

- **Semantic Search**: Search in plain English (e.g., *"blood pressure report from March"* or *"photo near Eiffel Tower"*) and find the right file even if the exact words never appear.
- **Multimodal Understanding**: Uses **Jina-CLIP-v2** to understand both text and visual content in the same embedding space.
- **3D Entity Network**: Every file is automatically connected to others that share people, places, organizations, or dates using **spaCy NER**.
- **Interactive Visualization**: Explore your document ecosystem through a high-performance **Three.js** 3D force-directed network.
- **Local & Private**: All processing happens on your machine. No cloud uploads, no API keys, and zero data leakage.
- **Automated Pipeline**: Drop a file, and the system automatically handles OCR, Embedding, Entity Extraction, and Graph linking.

## 🛠️ Tech Stack

- **Backend**: FastAPI (Python)
- **Vector Database**: DuckDB with VSS extension (HNSW indexing)
- **OCR Engine**: EasyOCR & PyMuPDF (fitz)
- **NLP**: spaCy (Named Entity Recognition)
- **Embeddings**: Jina-CLIP-v2 (512-dimensional multimodal vectors)
- **Frontend**: React + Vite + Tailwind CSS
- **Visualization**: 3D-Force-Graph (Three.js)

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **DuckDB 1.1.3**
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/NetVisSearch.git
cd NetVisSearch
```

### 2. Backend Setup

It is highly recommended to use a virtual environment.

```powershell
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download the spaCy NLP model
python -m spacy download en_core_web_sm
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Running the Project

#### Start the Backend
From the root directory (with venv activated):
```powershell
python -m backend.api
```
The backend will start at `http://127.0.0.1:8000`.

#### Start the Frontend
In a new terminal:
```bash
cd frontend
npm run dev
```
The application will be available at `http://localhost:5173`.

---

## 🐋 Docker Setup (Alternative)

If you have Docker installed, you can start the entire stack with one command:

```bash
docker-compose up --build
```

---

## 📁 Project Structure

```text
NetVisSearch/
├── backend/            # FastAPI Application
│   ├── api.py          # API Endpoints
│   ├── ingest.py       # Ingestion Pipeline (OCR -> Embed -> Graph)
│   ├── search.py       # Semantic Search Logic
│   ├── db.py           # DuckDB Vector Storage
│   └── graph.py        # Entity Extraction & NetworkX Logic
├── frontend/           # React + Vite Application
│   ├── src/            # Components (GraphView, etc.)
│   ├── index.html      # Landing Page
│   └── app.html        # Main Application Dashboard
├── data/               # Local storage for uploads
└── netvis.duckdb       # Local vector database file
```

## 🔒 Privacy

NetVisSearch was built with the belief that your personal data shouldn't be the price for intelligence. 
- No telemetry.
- No external API calls for processing.
- All AI models run locally on your CPU/GPU.
