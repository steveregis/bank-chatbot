import { syncLanguageAndVoice } from './utils.js';
import { initAvatarSession } from './avatarSession.js';
import { initChat } from './chat.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize the language and TTS voice synchronization.
  syncLanguageAndVoice();

  // Initialize the avatar session (WebRTC and avatar synthesis handling).
  initAvatarSession();

  // Initialize the chat functionality.
  initChat();
}); 