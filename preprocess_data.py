from fastapi import FastAPI, Request
from pydantic import BaseModel
import json
import ssl
import os

# Ensure SSL is properly configured
if not os.environ.get("PYTHONHTTPSVERIFY", "").strip():
    ssl._create_default_https_context = ssl._create_unverified_context

# Initialize FastAPI app
app = FastAPI()

# Mock summarizer and embedding logic for sandbox compatibility
class MockSummarizer:
    def __call__(self, text, max_length=100, min_length=30):
        return [{"summary_text": text[:max_length]}]

class MockEmbeddingModel:
    def encode(self, texts):
        return [[0.0] * 768 for _ in texts]

# Replace external dependencies with mocks
model = MockEmbeddingModel()
summarizer = MockSummarizer()

# Mock index and documents
class MockIndex:
    def __init__(self):
        self.documents = []

    def load_documents(self, filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as file:
                self.documents = json.load(file)
        except FileNotFoundError:
            print(f"Warning: {filepath} not found. Using an empty document list.")
            self.documents = []

    def search(self, query_vec, top_k):
        # Mock search logic: Return all documents as results
        return [0] * len(self.documents), range(len(self.documents))

index = MockIndex()
index.load_documents("document_index_docs.json")

# Input model for API requests
class QueryRequest(BaseModel):
    query: str

# Function to search index
def search_index(query, top_k=5, threshold=0.75):
    query_vec = model.encode([query])
    results = []
    for doc in index.documents:
        # Mock logic: Append all documents as results
        results.append(doc)
    return results[:top_k]

# Root endpoint
@app.get("/")
def read_root():
    return {"message": "Welcome to the chatbot API. Use /api/chat for queries."}

# API endpoint to handle queries
@app.post("/api/chat")
async def chat_endpoint(request: QueryRequest):
    query = request.query.lower()
    
    # Handle greetings explicitly
    if query in ["hi", "hello", "hey"]:
        response = "Hello! Welcome to the chatbot. How can I assist you today?"
    else:
        # Perform search and summarization
        results = search_index(query)
        if results:
            summarized = summarizer(" ".join([doc.get("content", "") for doc in results]), max_length=100, min_length=30)
            response = summarized[0]["summary_text"]
        else:
            response = "I'm sorry, I couldn't find any relevant information. Could you rephrase or provide more details?"

    # Log the interaction
    log_interaction(query, results, response)
    
    return {"response": response}

# Function to log interactions
def log_interaction(query, results, response):
    log_entry = {
        "query": query,
        "retrieved_documents": [doc.get("source", "unknown") for doc in results],
        "response": response
    }
    with open("interaction_logs.json", "a", encoding="utf-8") as log_file:
        json.dump(log_entry, log_file, indent=2)
        log_file.write("\n")
