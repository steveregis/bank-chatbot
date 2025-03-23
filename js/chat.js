export function initChat() {
  let lastLanguage = document.getElementById('languageSelect').value;

  // Add language change handler
  document.getElementById('languageSelect').addEventListener('change', async (event) => {
    const newLanguage = event.target.value;
    console.log(`Language changed from ${lastLanguage} to ${newLanguage}`);
    
    // Update voice selection based on language
    updateVoiceForLanguage(newLanguage);
    lastLanguage = newLanguage;
  });

  // Function to update voice based on language
  function updateVoiceForLanguage(language) {
    const voiceSelect = document.getElementById('ttsVoice');
    const options = voiceSelect.getElementsByTagName('option');
    
    // Find the first voice option for the selected language
    for (let option of options) {
      if (option.parentElement.label === language) {
        voiceSelect.value = option.value;
        console.log(`Updated voice to ${option.value} for language ${language}`);
        return;
      }
    }
  }

  document.getElementById('send-btn').addEventListener('click', async () => {
    const userInput = document.getElementById('user-input').value.trim();
    if (!userInput) return;

    try {
      const language = document.getElementById('languageSelect').value;
      const selectedVoice = document.getElementById('ttsVoice').value;
      
      console.log("Processing message with:", {
        language,
        selectedVoice,
        userInput
      });

      addMessage(userInput, 'user');
      document.getElementById('user-input').value = '';

      const response = await fetch("http://localhost:8000/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: userInput, 
          language: language,
          require_translation: language !== 'en-US'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const cleanChunk = chunk.replace(/data:\s*/g, "").trim();
        if (cleanChunk) {
          botResponse += cleanChunk + " ";
          addMessage(botResponse, 'bot', true);
        }
      }

      console.log("Preparing to speak response:", {
        botResponse,
        language,
        selectedVoice
      });

      if (!window.avatarSynthesizer) {
        throw new Error("Avatar synthesizer not initialized. Please start the session first.");
      }

      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
                        xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${language}">
                      <voice name="${selectedVoice}">
                        <prosody rate="0.9" volume="+20%">
                          ${botResponse}
                        </prosody>
                      </voice>
                    </speak>`;

      console.log("Using SSML:", ssml);

      try {
        await window.avatarSynthesizer.speakSsmlAsync(ssml);
        console.log("Speech synthesis completed successfully");
      } catch (speechError) {
        console.error("Speech synthesis error:", speechError);
        if (window.reinitializeAvatarSession) {
          console.log("Attempting to reinitialize session...");
          await window.reinitializeAvatarSession();
          await window.avatarSynthesizer.speakSsmlAsync(ssml);
        } else {
          throw speechError;
        }
      }

    } catch (error) {
      console.error("Chat error:", error);
      addMessage(`Error: ${error.message}. Please try restarting the session.`, 'bot');
    }
  });

  // Helper function to add messages to chat history.
  function addMessage(text, sender, update = false) {
    const chatHistory = document.getElementById('chat-history');
    if (update) {
      const lastMessage = chatHistory.lastElementChild;
      if (lastMessage && lastMessage.classList.contains('bot-message')) {
        lastMessage.textContent = text;
        return;
      }
    }
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender + '-message');
    messageDiv.textContent = text;
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
} 