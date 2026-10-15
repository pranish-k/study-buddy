import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPref, savePref } from '../lib/storage';

type WordListener = (word: string) => void;

/**
 * Replies are spoken one sentence at a time, and the next sentence may not have streamed in yet
 * when the current one ends. Holding "speaking" briefly bridges that gap so the mic and avatar don't
 * flicker between sentences.
 */
export const SPEAKING_HOLD_MS = 350;

const PREFERRED_VOICE =
  /natural|premium|enhanced|neural|google us english|samantha|ava|allison|aria|jenny/i;

function pickDefaultVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return (
    english.find((v) => PREFERRED_VOICE.test(v.name) && v.lang === 'en-US') ??
    english.find((v) => PREFERRED_VOICE.test(v.name)) ??
    english.find((v) => v.default) ??
    english[0] ??
    voices[0]
  );
}

/** Speaks queued sentences with the browser voice and reports word timings for lip sync. */
export function useSpeechSynthesis() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState<string | null>(() => loadPref('voice', null));
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState('');
  // Chrome drops utterances that are garbage collected mid-speech, so keep them referenced.
  const pending = useRef(new Set<SpeechSynthesisUtterance>());
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wordListeners = useRef(new Set<WordListener>());

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  const voice = useMemo(
    () => voices.find((v) => v.voiceURI === voiceURI) ?? pickDefaultVoice(voices),
    [voices, voiceURI],
  );

  const setVoiceURI = useCallback((uri: string) => {
    setVoiceURIState(uri);
    savePref('voice', uri);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      const utterance = new SpeechSynthesisUtterance(text);
      try {
        if (voice) utterance.voice = voice;
      } catch {
        // An unusable voice object falls back to the browser default.
      }
      utterance.rate = 1.02;
      utterance.onstart = () => setCaption(text);
      utterance.onboundary = (event) => {
        if (event.name !== 'word') return;
        const rest = text.slice(event.charIndex);
        const word = event.charLength
          ? rest.slice(0, event.charLength)
          : (/^\S+/.exec(rest)?.[0] ?? '');
        wordListeners.current.forEach((listener) => listener(word));
      };
      const finish = () => {
        if (!pending.current.delete(utterance) || pending.current.size > 0) return;
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => {
          if (pending.current.size > 0) return;
          setSpeaking(false);
          setCaption('');
        }, SPEAKING_HOLD_MS);
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      pending.current.add(utterance);
      clearTimeout(holdTimer.current);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [supported, voice],
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    pending.current.clear();
    clearTimeout(holdTimer.current);
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setCaption('');
  }, [supported]);

  const onWord = useCallback((listener: WordListener) => {
    wordListeners.current.add(listener);
    return () => {
      wordListeners.current.delete(listener);
    };
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  return { supported, voices, voice, setVoiceURI, speaking, caption, speak, cancel, onWord };
}

export type SpeechSynthesisApi = ReturnType<typeof useSpeechSynthesis>;
