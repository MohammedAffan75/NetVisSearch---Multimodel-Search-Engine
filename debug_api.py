import sys
print("DEBUG START", flush=True)
import time
print("Importing config...", flush=True)
from backend import config
print("Importing db...", flush=True)
from backend import db
print("Importing storage...", flush=True)
from backend import storage
print("Importing ocr...", flush=True)
from backend import ocr
print("Importing embedder...", flush=True)
from backend import embedder
print("Importing graph...", flush=True)
from backend import graph
print("Importing search...", flush=True)
from backend import search
print("Importing ingest...", flush=True)
from backend import ingest
print("All imports successful!", flush=True)
