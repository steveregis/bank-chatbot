from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import ssl
import os
import datetime
from langchain.chains import ConversationalRetrievalChain, LLMChain
from langchain.chains.conversational_retrieval.prompts import CONDENSE_QUESTION_PROMPT, QA_PROMPT
from langchain.chains.question_answering import load_qa_chain
from langchain.memory import ConversationBufferMemory
from langchain_community.vectorstores import FAISS
from langchain_nvidia_ai_endpoints import ChatNVIDIA

# Ensure SSL is properly configured
if not os.environ.get("PYTHONHTTPSVERIFY", "").strip():
    ssl._create_default_https_context = ssl._create_unverified_context


# Set API key as an environment variable or load from a config file
os.environ["NVIDIA_API_KEY"] = "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"  # Replace with your API key

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize NVIDIA AI endpoint models
llm = ChatNVIDIA(model="meta/llama3-70b-instruct")
retrieval_model = ChatNVIDIA(model="mistralai/mixtral-8x7b-instruct-v0.1", temperature=0.1, max_tokens=1000, top_p=1.0)

# Initialize memory for conversation
memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

# Load FAISS index for document retrieval
print("Debug: Attempting to load FAISS index from: faiss_index/document_index.faiss")
print("Debug: Attempting to load FAISS metadata from: faiss_index/document_index_docs.json")

print(f"Checking FAISS index file: {os.path.exists('faiss_index/document_index/document_index.faiss')}")
print(f"Checking metadata JSON: {os.path.exists('faiss_index/document_index/document_index_docs.json')}")
print(f"Checking metadata pickle: {os.path.exists('faiss_index/document_index/document_index.pkl')}")

# docsearch = FAISS.load_local(
  #   "faiss_index/document_index", 
    # "faiss_index/document_index/document_index_docs.json", 
    # allow_dangerous_deserialization=True
    
# )

# Before calling FAISS.load_local
with open("faiss_index/document_index/document_index_docs.json", "r") as f:
    metadata = json.load(f)
    print(f"Metadata structure: {metadata[:5]}")  # Print first few items to inspect structure


docsearch = FAISS.load_local(
    folder_path="faiss_index/document_index", 
    embeddings=retrieval_model, 
    index_name="document_index",  # Assuming this was your index file name
    allow_dangerous_deserialization=True  # If needed, carefully use this flag
)

# Set up chains for conversational retrieval
question_generator = LLMChain(llm=llm, prompt=CONDENSE_QUESTION_PROMPT)
doc_chain = load_qa_chain(retrieval_model, chain_type="stuff", prompt=QA_PROMPT)

qa_chain = ConversationalRetrievalChain(
    retriever=docsearch.as_retriever(),
    combine_docs_chain=doc_chain,
    memory=memory,
    question_generator=question_generator,
)

# Input model for API requests
class QueryRequest(BaseModel):
    query: str

@app.get("/")
def read_root():
    return {"message": "Welcome to the chatbot API. Use /api/chat for queries."}

@app.post("/api/chat")
async def chat_endpoint(request: QueryRequest):
    query = request.query.lower()
    try:
        # Use the QA chain to handle the query with context
        response = qa_chain.run(query)
    except Exception as e:
        response = f"An error occurred: {e}"
        print(f"Error in chat_endpoint: {e}")

    return {"response": response}

def log_interaction(query, results, response):
    log_entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "query": query,
        "response": response
    }
    with open("interaction_logs.json", "a", encoding="utf-8") as log_file:
        json.dump(log_entry, log_file, indent=2)
        log_file.write("\n")
