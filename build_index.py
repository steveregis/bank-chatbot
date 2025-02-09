import json
import os

from langchain.docstore.document import Document
#from langchain.embeddings import HuggingFaceEmbeddings
#from langchain.vectorstores import FAISS

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

def build_index(input_file: str, output_dir: str):
    """
    Reads JSON documents from `input_file`, creates a LangChain FAISS index,
    and saves it to `output_dir/document_index/`.
    """

    # 1. Load the data from a JSON file. Must be a list of dicts.
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 2. Convert each dict into a LangChain Document.
    #    We assume "content" holds the main text. Everything else goes into metadata.
    docs = []
    for record in data:
        text = record.get("content", "")
        metadata = {k: v for k, v in record.items() if k != "content"}
        # Create a LangChain Document object
        docs.append(Document(page_content=text, metadata=metadata))

    # 3. Create an embeddings object for converting text -> vector.
    #    (You can pick any supported model: "all-MiniLM-L6-v2" is popular and small.)
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # 4. Create the FAISS vector store from these docs.
    vectorstore = FAISS.from_documents(docs, embedding=embeddings)

    # 5. Save the FAISS store locally in LangChain's format:
    #    This will create files: document_index.faiss, document_index.pkl, etc.
    index_path = os.path.join(output_dir, "document_index")
    vectorstore.save_local(index_path)

    print(f"FAISS index built and saved to: {index_path}")

if __name__ == "__main__":
    # Example usage:
    input_json = "processed_data.json"  # <-- your preprocessed JSON
    output_directory = "faiss_index"
    
    build_index(input_json, output_directory)
    print("Done building LangChain FAISS index.")
