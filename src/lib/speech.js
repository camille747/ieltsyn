export function speakEnglish(text) {
  if (
    typeof window === "undefined"
    || !text
    || !("speechSynthesis" in window)
    || !("SpeechSynthesisUtterance" in window)
  ) return false;

  const utterance = new window.SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  utterance.lang = "en-GB";
  utterance.rate = 0.82;
  utterance.pitch = 1;
  utterance.voice = voices.find((voice) => voice.lang === "en-GB")
    || voices.find((voice) => voice.lang?.startsWith("en"))
    || null;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
