export function syncLanguageAndVoice() {
  const languageSelect = document.getElementById('languageSelect');
  const ttsVoiceSelect = document.getElementById('ttsVoice');
  languageSelect.addEventListener('change', function () {
    const language = this.value;
    const groups = ttsVoiceSelect.getElementsByTagName('optgroup');

    // Hide all groups
    Array.from(groups).forEach(group => group.style.display = 'none');

    // Show only the matching group and select its first option.
    const matchingGroup = Array.from(groups).find(group => group.label === language);
    if (matchingGroup) {
      matchingGroup.style.display = 'block';
      ttsVoiceSelect.value = matchingGroup.children[0].value;
    }
  });

  // Trigger the change event on page load.
  languageSelect.dispatchEvent(new Event('change'));
}