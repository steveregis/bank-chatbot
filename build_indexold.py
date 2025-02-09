import json
import os
import numpy as np
import faiss
import pickle
from sentence_transformers import SentenceTransformer

# Initialize the embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Function to build the FAISS index
def build_index(input_file, output_dir):
    """
    Reads preprocessed data from a JSON file, encodes it, and builds a FAISS index.

    Args:
        input_file (str): Path to the input JSON file.
        output_dir (str): Directory to save the FAISS index and metadata files.
    """
    # Load documents from the preprocessed JSON file
    with open(input_file, "r", encoding="utf-8") as json_file:
        documents = json.load(json_file)

    # Extract document contents and encode them
    contents = [doc.get("content", "") for doc in documents]
    embeddings = model.encode(contents, convert_to_numpy=True)

    # Ensure output directory exists
    index_dir = os.path.join(output_dir, "document_index")
    os.makedirs(index_dir, exist_ok=True)

    # Create FAISS index
    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    # Save FAISS index
    faiss_index_path = os.path.join(index_dir, "document_index.faiss")
    faiss.write_index(index, faiss_index_path)

    # Save metadata as a pickle file
    metadata_path = os.path.join(index_dir, "document_index.pkl")
    with open(metadata_path, "wb") as pkl_file:
        pickle.dump(documents, pkl_file)

    # Save metadata as JSON for reference
    metadata_json_path = os.path.join(index_dir, "document_index_docs.json")
    with open(metadata_json_path, "w", encoding="utf-8") as doc_file:
        json.dump(documents, doc_file, indent=2, ensure_ascii=False)

    # Debugging Logs
    print(f"Debug: FAISS index saved to: {faiss_index_path}")
    print(f"Debug: Metadata (pickle) saved to: {metadata_path}")
    print(f"Debug: Metadata (JSON) saved to: {metadata_json_path}")

    # Verify file existence
    if not os.path.exists(faiss_index_path):
        print("Error: FAISS index file was not created.")
    if not os.path.exists(metadata_path):
        print("Error: Metadata pickle file was not created.")
    if not os.path.exists(metadata_json_path):
        print("Error: Metadata JSON file was not created.")

# Example usage
if __name__ == "__main__":
    input_json = "processed_data.json"
    output_directory = "faiss_index"
    build_index(input_json, output_directory)
