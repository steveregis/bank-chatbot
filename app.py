import os
import ssl
import json
import datetime
import asyncio  # <-- added for async sleep
import io
import requests

# Import the Azure TTS function

from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ========== LangChain and NVIDIA AI Endpoint (or any other LLM) ==========
#from langchain.vectorstores import FAISS
#from langchain.embeddings import HuggingFaceEmbeddings

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

from langchain.chains import ConversationalRetrievalChain, LLMChain
from langchain.chains.question_answering import load_qa_chain
from langchain.chains.conversational_retrieval.prompts import CONDENSE_QUESTION_PROMPT, QA_PROMPT
from langchain.memory import ConversationBufferMemory
from fastapi.responses import FileResponse, StreamingResponse

from azure_tts import synthesize_speech


# If using ChatNVIDIA, import it here. Otherwise, you can use any LLM you want.
from langchain_nvidia_ai_endpoints import ChatNVIDIA

# ========== SSL Fix if needed (depending on environment) ==========
if not os.environ.get("PYTHONHTTPSVERIFY", "").strip():
    ssl._create_default_https_context = ssl._create_unverified_context

# ========== Set your NVIDIA API Key if using ChatNVIDIA ==========
os.environ["NVIDIA_API_KEY"] = "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"  # example key

# ========== Initialize FastAPI ==========
app = FastAPI()

# Define the allowed origins (adjust if your front end is hosted elsewhere)
origins = [
    "http://localhost:8080",  # if you're serving your index.html on port 8080
    "http://localhost:8000",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8000",
    "http://localhost:3000"
]

# ========== CORS Middleware (optional) ==========
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,   # or restrict to specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

# Mount the static directory (if you have any static files)
app.mount("/static", StaticFiles(directory="."), name="static")

# ========== Define LLM / Embeddings ==========

# LLM for generating final answers (ChatNVIDIA example).
llm = ChatNVIDIA(model="meta/llama3-70b-instruct")

# Embeddings for the retrieval part (HuggingFace Embeddings).
# This must be the *same model* used to build the index, or at least produce compatible embeddings.
retrieval_embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# ========== Load the FAISS VectorStore from disk (LangChain format) ==========
# Path must match what you used in build_index.py
index_path = "faiss_index/document_index"
vectorstore = FAISS.load_local(
    index_path,
    embeddings=retrieval_embeddings,
    allow_dangerous_deserialization=True  # <--- Add this flag
)

# ========== Create Conversational QA Chain ==========
memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

question_generator = LLMChain(llm=llm, prompt=CONDENSE_QUESTION_PROMPT)
doc_chain = load_qa_chain(llm=llm, chain_type="stuff", prompt=QA_PROMPT)

qa_chain = ConversationalRetrievalChain(
    retriever=vectorstore.as_retriever(),
    combine_docs_chain=doc_chain,
    question_generator=question_generator,
    memory=memory,
)

# ========== Define Request Model for POST endpoint ==========
class QueryRequest(BaseModel):
    query: str

# This model represents the data sent to the /synthesize endpoint.
class SynthesisRequest(BaseModel):
    text: str
    language: str = "en-US"  # Default to English; can be changed to "ar-EG" for Arabic

# Add this class to define the request model
class SpeechTokenRequest(BaseModel):
    region: str
    subscription_key: str

# ========== Simple root endpoint ==========
@app.get("/")
def read_root():
    return {"message": "Welcome to the Chatbot API. Send queries to /api/chat or /api/chat-stream."}

@app.get("/chat-ui")
def get_chat_ui():
    return FileResponse("chat-ui.html")

@app.get("/chat-ui-3d")
def get_chat_ui_3d():
    return FileResponse("chat-ui-3d.html")




# ========== Non-streaming Chat endpoint ==========
@app.post("/api/chat")
async def chat_endpoint(request: QueryRequest):
    query = request.query.strip()
    try:
        response = qa_chain.run(query)
    except Exception as e:
        response = f"Error: {e}"
        print(f"Error in /api/chat: {e}")
    log_interaction(query, response)
    return {"response": response}

# ========== Streaming Chat endpoint ==========
@app.post("/api/chat-stream")
async def chat_stream_endpoint(request: QueryRequest):
    query = request.query.strip()

    async def event_generator():
        try:
            full_response = qa_chain.run(query)
        except Exception as e:
            full_response = f"Error: {e}"
            print(f"Error in /api/chat-stream: {e}")
        log_interaction(query, full_response)
        # Simulate streaming by splitting the response into words (or chunks)
        words = full_response.split()
        # Optionally, you can customize chunk size here
        chunk_size = 3  # number of words per chunk
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i+chunk_size])
            # Format as SSE data message
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0.1)  # simulate delay for streaming
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/synthesize", response_description="Synthesized speech audio")
async def synthesize_endpoint(request: SynthesisRequest):
    try:
        # Call the Azure TTS integration to generate audio.
        audio_data = synthesize_speech(request.text, language=request.language)
        # Return the audio data as a streaming response with the correct content type.
        return StreamingResponse(io.BytesIO(audio_data), media_type="audio/wav")
    except Exception as e: # Print the error to your console for debugging
        print("Error in /synthesize:", e)
        raise HTTPException(status_code=500, detail=str(e))
    

def log_interaction(query: str, response: str):
    log_entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "query": query,
        "response": response
    }
    with open("interaction_logs.json", "a", encoding="utf-8") as log_file:
        json.dump(log_entry, log_file, indent=2)
        log_file.write("\n")

@app.post("/api/get-speech-token")
async def get_speech_token(request: SpeechTokenRequest):
    try:
        response = requests.get(
            f"https://{request.region}.api.speech.microsoft.com/cts/speech/token",
            headers={
                "Ocp-Apim-Subscription-Key": request.subscription_key
            }
        )
        response.raise_for_status()
        
        # The token endpoint returns plain text, not JSON
        token = response.text
        
        return {
            "token": token,
            "region": request.region
        }
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")  # Debug logging
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Unexpected error: {e}")  # Debug logging
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

# ========== Run with uvicorn (dev server) ==========
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
