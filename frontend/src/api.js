import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000"

/**
 * Search documents using semantic vector search.
 */
export const searchDocs = (query, topK = 10) => {
    return axios.get(`${BASE}/search`, { 
        params: { q: query, top_k: topK } 
    });
};

/**
 * Upload a file and trigger the ingestion pipeline.
 */
export const uploadFile = (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${BASE}/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};

/**
 * Fetch the entire entity knowledge graph.
 */
export const getFullGraph = () => {
    return axios.get(`${BASE}/graph`);
};

/**
 * Fetch database statistics (counts for docs, entities, edges).
 */
export const getStats = () => {
    return axios.get(`${BASE}/stats`);
};

/**
 * Fetch full details for a specific document by ID.
 */
export const getDocDetails = (docId) => {
    return axios.get(`${BASE}/document/${docId}`);
};

/**
 * Helper to resolve file URLs (handles local proxy vs S3).
 */
export const fileUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    // Local development serves files via /files/...
    return `${BASE}${url}`;
};
