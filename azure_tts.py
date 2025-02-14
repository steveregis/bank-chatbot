import os
import requests
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

AZURE_API_KEY = os.getenv("AZURE_API_KEY")

AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "https://eastus2.tts.speech.microsoft.com")
TTS_API_URL = f"{AZURE_ENDPOINT}/cognitiveservices/v1"

def synthesize_speech(text: str, language: str = "en-US", voice: str = None) -> bytes:
    """
    Synthesize speech for the given text using Azure Cognitive Services.
    Switch between languages using the `language` parameter:
    - For English: language="en-US" (default voice: en-US-AriaNeural)
    - For Arabic: language="ar-EG" (default voice: ar-EG-SalmaNeural)
    """
    if voice is None:
        voice = "en-US-AriaNeural" if language == "en-US" else "ar-EG-SalmaNeural"

    # Build the SSML payload
    ssml = f"""
    <speak version="1.0" xml:lang="{language}">
      <voice name="{voice}">
        {text}
      </voice>
    </speak>
    """
    
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_API_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
        "User-Agent": "BankChatbot-AzureTTS"
    }
    
    response = requests.post(TTS_API_URL, headers=headers, data=ssml.encode("utf-8"))
    
    if response.status_code == 200:
        return response.content
    else:
        raise Exception(f"Azure TTS API error {response.status_code}: {response.text}")
