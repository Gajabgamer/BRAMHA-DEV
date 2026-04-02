export interface VoiceRecognitionResult {
  text: string;
}

type RecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate =
    (window as typeof window & { webkitSpeechRecognition?: RecognitionConstructor })
      .webkitSpeechRecognition ||
    (window as typeof window & { SpeechRecognition?: RecognitionConstructor })
      .SpeechRecognition;

  return candidate || null;
}

export function supportsVoiceInput() {
  return Boolean(getRecognitionConstructor());
}

export function startVoiceRecognition(): Promise<VoiceRecognitionResult> {
  return new Promise((resolve, reject) => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      reject(new Error("Voice input is not supported in this browser."));
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const result = event.results?.[0]?.[0]?.transcript || "";
      resolve({ text: result.trim() });
    };

    recognition.onerror = (event) => {
      reject(new Error(event.error || "Voice recognition failed."));
    };

    recognition.onend = () => {
      // Handled by result/error callbacks.
    };

    recognition.start();
  });
}

export function speakText(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.96;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
