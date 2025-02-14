export function initChat() {
  document.getElementById('send-btn').addEventListener('click', async () => {
    const userInput = document.getElementById('user-input').value.trim();
    if (!userInput) return;

    addMessage(userInput, 'user');
    document.getElementById('user-input').value = '';

    try {
      const language = document.getElementById('languageSelect').value;
      const selectedVoice = document.getElementById('ttsVoice').value;
      const response = await fetch("http://localhost:8000/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userInput, language: language })
      });

      if (!response.ok) throw new Error("Failed to get response");

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

      // Build SSML for text-to-speech synthesis.
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
                        xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${language}">
                      <voice name="${selectedVoice}">
                        <lang xml:lang="${language}">
                          <mstts:express-as style="chat">
                            ${botResponse}
                          </mstts:express-as>
                        </lang>
                      </voice>
                    </speak>`;
      console.log("Speaking with SSML:", ssml);

      // Use the globally exposed avatarSynthesizer to speak.
      if (window.avatarSynthesizer) {
        await window.avatarSynthesizer.speakSsmlAsync(ssml);
      } else {
        console.warn("Avatar synthesizer not available to speak.");
      }
    } catch (error) {
      console.error("Chat error:", error);
      addMessage("Sorry, I encountered an error. Please try again.", 'bot');
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