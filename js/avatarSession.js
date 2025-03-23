let currentSession = {
  avatarSynthesizer: null,
  peerConnection: null,
  isInitializing: false
};

export function initAvatarSession() {
  const startBtn = document.getElementById('startSession');
  const stopBtn = document.getElementById('stopSession');

  async function initializeSession() {
    if (currentSession.isInitializing) {
      console.log("Session initialization already in progress");
      return;
    }

    try {
      currentSession.isInitializing = true;
      const region = document.getElementById('region').value;
      const subscriptionKey = document.getElementById('subscriptionKey').value;
      const language = document.getElementById('languageSelect').value;
      const selectedVoice = document.getElementById('ttsVoice').value;

      console.log("Starting session initialization...");

      // Clean up any existing session first.
      await stopSession(false);

      // Get a token for TURN server from your API.
      const tokenResponse = await fetch("http://localhost:8000/api/get-speech-token", {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: region,
          subscription_key: subscriptionKey
        })
      });
      if (!tokenResponse.ok) {
        throw new Error("Failed to get speech token");
      }
      const tokenData = await tokenResponse.json();

      // Build the Speech SDK configuration.
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
      speechConfig.speechSynthesisVoiceName = selectedVoice;
      speechConfig.speechRecognitionLanguage = language;

      // Build the avatar configuration.
      const videoFormat = new SpeechSDK.AvatarVideoFormat();
      videoFormat.width = 1920;
      videoFormat.height = 1080;
      const avatarConfig = new SpeechSDK.AvatarConfig(
        document.getElementById('avatarCharacter').value,
        document.getElementById('avatarStyle').value,
        videoFormat
      );
      // Enable avatar animations.
      avatarConfig.enableLipSync = true;
      avatarConfig.enableGesture = true;
      avatarConfig.enableBlink = true;

      // Create a new synthesizer.
      currentSession.avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);

      // Set up the peer connection with both STUN and TURN servers.
      currentSession.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:relay.communication.microsoft.com:3478",
            username: tokenData.token,
            credential: tokenData.token
          }
        ]
      });
      currentSession.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
      currentSession.peerConnection.addTransceiver('video', { direction: 'sendrecv' });

      // Set up event handlers for tracks.
      currentSession.peerConnection.ontrack = (event) => {
        console.log("Track received:", event.track.kind);
        if (event.track.kind === 'video') {
          const remoteVideo = document.getElementById('remoteVideo');
          const videoElement = document.createElement('video');
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.srcObject = new MediaStream([event.track]);
          remoteVideo.innerHTML = '';
          remoteVideo.appendChild(videoElement);
        } else if (event.track.kind === 'audio') {
          const audioStream = new MediaStream([event.track]);
          const audioElement = new Audio();
          audioElement.autoplay = true;
          audioElement.srcObject = audioStream;
          audioElement.play().catch(err => console.error("Audio play error:", err));
        }
      };

      currentSession.peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", currentSession.peerConnection.iceConnectionState);
      };
      currentSession.peerConnection.onconnectionstatechange = () => {
        console.log("Connection State:", currentSession.peerConnection.connectionState);
      };

      // Start the avatar session on the peer connection.
      await currentSession.avatarSynthesizer.startAvatarAsync(currentSession.peerConnection);
      window.avatarSynthesizer = currentSession.avatarSynthesizer;

      // Wait until the peer connection becomes "connected"
      let attempts = 0;
      while (attempts < 10 && currentSession.peerConnection.connectionState !== 'connected') {
        console.log("Waiting for ICE connection, current state:", currentSession.peerConnection.connectionState);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      if (currentSession.peerConnection.connectionState !== 'connected') {
        throw new Error("ICE connection failed to establish after waiting");
      }

      // Update UI.
      startBtn.disabled = true;
      stopBtn.disabled = false;
      console.log("Session initialized successfully");

    } catch (error) {
      console.error("Failed to initialize session:", error);
      startBtn.disabled = false;
      stopBtn.disabled = true;
      throw error;
    } finally {
      currentSession.isInitializing = false;
    }
  }

  async function stopSession(updateUI = true) {
    try {
      if (currentSession.avatarSynthesizer) {
        await currentSession.avatarSynthesizer.close();
        currentSession.avatarSynthesizer = null;
        window.avatarSynthesizer = null;
      }
      if (currentSession.peerConnection) {
        currentSession.peerConnection.close();
        currentSession.peerConnection = null;
      }
      if (updateUI) {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        document.getElementById('remoteVideo').innerHTML = '';
      }
      console.log("Session stopped successfully");
    } catch (error) {
      console.error("Error stopping session:", error);
      throw error;
    }
  }

  // --------- updateVoiceOnly: Update voice settings without a full session reload ---------
  async function updateVoiceOnly() {
    const language = document.getElementById('languageSelect').value;
    const selectedVoice = document.getElementById('ttsVoice').value;
    const region = document.getElementById('region').value;
    const subscriptionKey = document.getElementById('subscriptionKey').value;
    console.log("Updating voice without full reload:", { language, selectedVoice });

    // For languages that cause connection instability, perform a full reinitialization.
    if (language === "ar-SA" || language === "hi-IN") {
      console.warn(`Language ${language} requires full session reload. Reinitializing session...`);
      await stopSession(true);
      // Increase wait time to allow proper connection teardown.
      await new Promise(resolve => setTimeout(resolve, 1000));
      await initializeSession();
      // Wait additional time for ICE connection to stabilize.
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!currentSession.peerConnection || currentSession.peerConnection.connectionState !== 'connected') {
          throw new Error("Full reinitialization failed: ICE connection not established.");
      }
      return;
    }

    // Build new Speech SDK configuration.
    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
    speechConfig.speechSynthesisVoiceName = selectedVoice;
    speechConfig.speechRecognitionLanguage = language;

    // Build new avatar configuration.
    const videoFormat = new SpeechSDK.AvatarVideoFormat();
    videoFormat.width = 1920;
    videoFormat.height = 1080;
    const avatarConfig = new SpeechSDK.AvatarConfig(
      document.getElementById('avatarCharacter').value,
      document.getElementById('avatarStyle').value,
      videoFormat
    );
    avatarConfig.enableLipSync = true;
    avatarConfig.enableGesture = true;
    avatarConfig.enableBlink = true;

    // Close the current synthesizer while keeping the peer connection intact.
    await currentSession.avatarSynthesizer.close();

    // Create a new synthesizer with the updated configuration.
    currentSession.avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);
    await currentSession.avatarSynthesizer.startAvatarAsync(currentSession.peerConnection);

    // Wait briefly for the connection to stabilize.
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!currentSession.peerConnection || currentSession.peerConnection.connectionState !== 'connected') {
      console.error("Peer connection not stable after voice update, reinitializing full session");
      await stopSession(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      await initializeSession();
      return;
    }

    window.avatarSynthesizer = currentSession.avatarSynthesizer;
    console.log("Voice configuration updated successfully");
  }

  // Event listeners.
  startBtn.addEventListener('click', initializeSession);
  stopBtn.addEventListener('click', () => stopSession(true));
  // For best stability upon language change, perform a full session reinitialization.
  document.getElementById('languageSelect').addEventListener('change', async () => {
    if (!currentSession.isInitializing) {
      try {
        console.log("Language changed, fully reinitializing session...");
        await stopSession(true);
        // Wait briefly to ensure connection teardown.
        await new Promise(resolve => setTimeout(resolve, 1000));
        await initializeSession();
      } catch (error) {
        console.error("Full reinitialization after language change failed:", error);
        alert("Failed to switch language. Please try again.");
      }
    }
  });

  // Expose full reinitialization globally.
  window.reinitializeAvatarSession = initializeSession;
}

// Helper function to set up peer connection
async function setupPeerConnection(region, subscriptionKey) {
      try {
        const response = await fetch("http://localhost:8000/api/get-speech-token", {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            region: region,
            subscription_key: subscriptionKey
          })
        });
    
        if (!response.ok) {
      throw new Error("Failed to get speech token");
    }
    
    const data = await response.json();
    const turnToken = data.token;
    
    const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:relay.communication.microsoft.com:3478",
            username: turnToken,
            credential: turnToken
          }
        ]
      });

    // Set up event handlers
    peerConnection.ontrack = handleTrackEvent;
    peerConnection.onicecandidate = (event) => console.log("ICE candidate:", event.candidate);
    peerConnection.oniceconnectionstatechange = () => console.log("ICE state:", peerConnection.iceConnectionState);
    
    return peerConnection;
  } catch (error) {
    console.error("Failed to setup peer connection:", error);
    throw error;
  }
}

function handleTrackEvent(event) {
  console.log("Track event received:", event);
        try {
          const remoteVideo = document.getElementById("remoteVideo");
          if (event.track.kind === "video") {
            const videoElement = document.createElement("video");
            videoElement.autoplay = true;
            videoElement.playsInline = true;
      videoElement.srcObject = new MediaStream([event.track]);
      remoteVideo.innerHTML = '';
            remoteVideo.appendChild(videoElement);
    }
  } catch (error) {
    console.error("Error handling track event:", error);
  }
}

// Modify the speak function to handle different languages
function speak(text, language) {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set language-specific voices
    switch(language) {
        case 'ar':
            utterance.lang = 'ar-SA';  // Arabic
            break;
        case 'hi':
            utterance.lang = 'hi-IN';  // Hindi
            break;
        case 'ml':
            utterance.lang = 'ml-IN';  // Malayalam
            break;
        default:
            utterance.lang = 'en-US';  // English
    }
    
    // Get available voices
    const voices = speechSynthesis.getVoices();
    
    // Try to find a voice for the selected language
    const voice = voices.find(v => v.lang.startsWith(utterance.lang));
    if (voice) {
        utterance.voice = voice;
    }
    
    speechSynthesis.speak(utterance);
}

// Update the playResponse function
function playResponse(response) {
    const language = document.getElementById('languageSelect').value;
    speak(response, language);
} 