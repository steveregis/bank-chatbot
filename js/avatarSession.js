export function initAvatarSession() {
  const startBtn = document.getElementById('startSession');
  const stopBtn = document.getElementById('stopSession');
  let avatarSynthesizer;
  let peerConnection;

  startBtn.addEventListener('click', async () => {
    try {
      const region = document.getElementById('region').value;
      const subscriptionKey = document.getElementById('subscriptionKey').value;
      const language = document.getElementById('languageSelect').value;
      const selectedVoice = document.getElementById('ttsVoice').value;

      // Create the Speech SDK configuration.
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(subscriptionKey, region);
      speechConfig.speechSynthesisVoiceName = selectedVoice;
      speechConfig.speechRecognitionLanguage = language;

      // Set up avatar video configurations.
      const videoFormat = new SpeechSDK.AvatarVideoFormat();
      videoFormat.width = 1920;
      videoFormat.height = 1080;
      const avatarConfig = new SpeechSDK.AvatarConfig(
        document.getElementById('avatarCharacter').value,
        document.getElementById('avatarStyle').value,
        videoFormat
      );

      // Create the avatar synthesizer.
      avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechConfig, avatarConfig);

      // Fetch TURN token with improved error handling.
      console.log("Fetching speech token...");
      let turnToken;
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
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to get speech token");
        }
        const data = await response.json();
        if (!data.token) {
          throw new Error("No token received from server");
        }
        turnToken = data.token;
        console.log("Token received, setting up WebRTC with token:", turnToken);
      } catch (tokenError) {
        console.warn("Could not fetch TURN token:", tokenError);
        // Throwing error here will abort the session start instead of silently falling back.
        throw new Error("TURN token fetch error: " + tokenError.message);
      }

      // Set up the peer connection.
      peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          {
            urls: "turn:relay.communication.microsoft.com:3478",
            username: turnToken,
            credential: turnToken
          }
        ]
      });

      // ICE and connection state event handlers.
      peerConnection.addEventListener('icecandidate', event => {
        console.log("ICE candidate:", event.candidate);
      });
      peerConnection.addEventListener('iceconnectionstatechange', () => {
        console.log("ICE connection state changed:", peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === "failed") {
          console.error("ICE Connection failed.");
        }
      });
      peerConnection.addEventListener('connectionstatechange', () => {
        console.log("Peer connection state changed:", peerConnection.connectionState);
        if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "disconnected") {
          console.error("Peer connection failed or disconnected.");
        }
      });

      // **Fix: Explicitly add transceivers for audio and video.**
      peerConnection.addTransceiver('audio', { direction: 'sendrecv', streams: [new MediaStream()] });
      peerConnection.addTransceiver('video', { direction: 'sendrecv', streams: [new MediaStream()] });

      // Set up ontrack handler with additional logging and try/catch.
      peerConnection.ontrack = event => {
        console.log("Ontrack event fired:", event);
        try {
          const remoteVideo = document.getElementById("remoteVideo");

          if (event.track.kind === "video") {
            const videoElement = document.createElement("video");
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.style.width = "100%";
            videoElement.style.height = "100%";

            // Use event.streams[0] if available with valid video tracks, otherwise create a new stream.
            let stream;
            if (event.streams && event.streams[0] && event.streams[0].getVideoTracks().length > 0) {
              stream = event.streams[0];
            } else {
              console.warn("No valid stream in event, creating one manually.");
              stream = new MediaStream();
              stream.addTrack(event.track);
            }
            videoElement.srcObject = stream;

            videoElement.play().then(() => {
              console.log("Video playback started successfully.");
              console.log("Video track count:", videoElement.srcObject.getVideoTracks().length);
            }).catch(error => {
              console.error("Autoplay failed:", error);
              const playButton = document.createElement("button");
              playButton.textContent = "Play Video";
              playButton.onclick = () => {
                videoElement.play().then(() => {
                  videoElement.muted = false;
                  videoElement.volume = 1.0;
                }).catch(err2 => console.error("Retry play error:", err2));
              };
              remoteVideo.appendChild(playButton);
            });
            remoteVideo.innerHTML = "";
            remoteVideo.appendChild(videoElement);
          } else if (event.track.kind === "audio") {
            const audioStream = new MediaStream([event.track]);
            const audioElement = new Audio();
            audioElement.autoplay = true;
            audioElement.srcObject = audioStream;
            audioElement.play().catch(err => console.error("Audio playback error:", err));
          }
        } catch (ontrackError) {
          console.error("Error in ontrack event:", ontrackError);
        }
      };

      // Start the avatar session.
      try {
        await avatarSynthesizer.startAvatarAsync(peerConnection);
      } catch (startError) {
        console.error("Error starting avatar session:", startError);
        throw new Error("Avatar session start failed: " + startError.message);
      }

      document.getElementById('startSession').disabled = true;
      document.getElementById('stopSession').disabled = false;
      console.log("Session started successfully");

      // **Fix: Immediately send an idle SSML message to trigger avatar video generation.**
      try {
        const idleSsml = `
          <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
            <voice name='en-US-JennyNeural'>Hello, I am ready.</voice>
          </speak>`;
        await avatarSynthesizer.speakSsmlAsync(idleSsml);
      } catch (ssmlError) {
        console.error("SSML synthesis error:", ssmlError);
        throw new Error("Avatar SSML synthesis failed: " + ssmlError.message);
      }
      
      // Expose the avatar synthesizer globally for further interactions (e.g., chat).
      window.avatarSynthesizer = avatarSynthesizer;
    } catch (error) {
      console.error("Failed to start session:", error);
      alert("Failed to start session: " + error.message);
    }
  });

  // Stop session logic.
  stopBtn.addEventListener('click', () => {
    try {
      if (avatarSynthesizer) {
        avatarSynthesizer.close();
        avatarSynthesizer = undefined;
      }
      if (peerConnection) {
        peerConnection.close();
        peerConnection = undefined;
      }
      document.getElementById('startSession').disabled = false;
      document.getElementById('stopSession').disabled = true;
      document.getElementById('remoteVideo').innerHTML = '';
      console.log("Session stopped successfully.");
    } catch (stopError) {
      console.error("Error while stopping session:", stopError);
      alert("Error stopping session: " + stopError.message);
    }
  });
} 