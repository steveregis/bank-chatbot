# Bank Chatbot

## Overview
Bank Chatbot is an intelligent conversational assistant designed specifically for banking applications. It leverages advanced natural language processing and vector-based search techniques—using tools such as FAISS and Chroma—to quickly retrieve and present relevant banking information. The solution integrates data preprocessing, web scraping, and document indexing to create a robust knowledge base, all accessible via an engaging chat interface.

## Features
### Conversational Interface:
Engage users with an intuitive chat interface. Multiple UI options are provided, including a standard web chat and a 3D chat experience.

### Document Indexing and Retrieval:
Build and search indexes using FAISS and Chroma to deliver fast and accurate responses from a large corpus of banking documents.

### Data Preprocessing:
Process raw and scraped data to enhance the quality and performance of the indexing process.

### Web Scraping:
Automatically collect relevant banking information from the web to keep the knowledge base current.

### Interaction Logging:
Maintain logs of all interactions to support analysis and continual improvement of the chatbot.

## Docker Support:
Containerize the application with Docker for easier deployment and scalability.

## Installation
### Prerequisites
Python 3.8+
(Check requirements.txt for the list of Python package dependencies)
Git
Uvicorn
For serving the application as an ASGI server (often installed via pip or included in the requirements).
Docker (optional, for containerized deployment)
### Setup Instructions

#### Clone the Repository:

``` bash

git clone https://github.com/steveregis/bank-chatbot.git
```
```cd bank-chatbot
```
#### Set Up a Virtual Environment:

``` bash

python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### Install Dependencies:

``` bash
pip install -r requirements.txt
```

#### Configure Environment Variables:

Create a .env file (if not already present) and configure it with your required environment variables. Use the existing .env file as a template if available.

#### Build the Document Index:

Run the index building script to preprocess data and create a searchable document index:

``` bash

python build_index.py
```
Note: There is also an older version of the index builder (build_indexold.py) available if needed.

#### Running the Application
Using Python
You can start the application by running:

``` bash

python app.py
```

This method will start the chatbot server on the port specified in config.json.

Using Uvicorn
If you prefer to run the application with Uvicorn (which is ideal for asynchronous frameworks such as FastAPI), execute the following command:

```bash

uvicorn app:app --reload
```
In this command, app:app refers to the Python file (app.py) and the ASGI application instance (app) within that file. Adjust accordingly if your setup differs.

## Usage
### Chat Interfaces:

Open chat-ui.html for the standard chat experience.
Open chat-ui-3d.html or chat-ui-3dNEW.html for an enhanced 3D chat interface.
Simply open these HTML files in your browser to start interacting with the chatbot.

## Web Scraping:

To update or expand your data set, run:

``` bash
python web_scraper.py
```
Utility Scripts:

Use printallurls.py to list all URLs extracted during the web scraping process, if needed.

### Directory Structure
chroma_db/:
Contains data related to the Chroma vector database.

faiss_index/:
Stores FAISS index files for similarity searches.

raw_data/ & scraped_data/:
Directories for storing original and scraped data.

processed_data.json:
Preprocessed data ready for indexing.

interaction_logs.json:
Logs of user interactions for analysis.

### Source Files:

app.py: Main application script.
appold.py: Previous version of the main application.
build_index.py & build_indexold.py: Scripts for building the document index.
preprocess_data.py: Data preprocessing script.
web_scraper.py: Script for scraping banking-related data.
printallurls.py: Utility to print URLs from data.
### UI Files:

chat-ui.html: Standard chat interface.
chat-ui-3d.html & chat-ui-3dNEW.html: 3D chat interface variations.
### Configuration:

config.json: Application configuration settings.
.env: Environment variable definitions.
Configuration
config.json
Contains settings such as port numbers, API keys, and other configuration parameters.

.env
Securely stores sensitive environment variables. Ensure that you update this file with your own configuration details.

## Contributing
Contributions are welcome! If you have suggestions, improvements, or bug fixes, please fork the repository and submit a pull request. Make sure to follow standard coding practices and include tests where applicable.

## License

### Acknowledgements
FAISS for enabling efficient similarity searches.
Chroma for vector database indexing.
Uvicorn for serving the ASGI application.
