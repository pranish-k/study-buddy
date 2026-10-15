import { useEffect, useRef, useState } from 'react';
import { getRecognitionConstructor } from './speech-recognition-types';

const BLOCKED_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);
const QUIET_ERRORS = new Set(['no-speech', 'aborted']);

/**
 * Listens continuously while `enabled`, reporting live (interim) text and finished phrases.
 * The browser ends continuous sessions on its own every so often, so it restarts itself.
 */
export function useSpeechRecognition({
  enabled,
  onFinal,
}: {
  enabled: boolean;
  onFinal: (text: string) => void;
}) {
  const Recognition = getRecognitionConstructor();
  const supported = Recognition !== undefined;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    if (!enabled || !Recognition) return;
    let stopped = false;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };
    recognition.onresult = (event) => {
      let live = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          if (transcript.trim()) onFinalRef.current(transcript.trim());
        } else {
          live += transcript;
        }
      }
      setInterim(live.trim());
    };
    recognition.onerror = (event) => {
      if (BLOCKED_ERRORS.has(event.error)) {
        stopped = true;
        setError(
          'Microphone access is blocked. Allow it in the browser address bar, or type instead.',
        );
      } else if (!QUIET_ERRORS.has(event.error)) {
        setError(`Speech recognition error: ${event.error}`);
      }
    };
    recognition.onend = () => {
      setListening(false);
      setInterim('');
      if (!stopped) {
        restartTimer = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Already started; nothing to do.
          }
        }, 250);
      }
    };

    try {
      recognition.start();
    } catch {
      // start() only throws if this instance is already running, which a fresh one never is.
    }

    return () => {
      stopped = true;
      clearTimeout(restartTimer);
      recognition.onend = null;
      recognition.onresult = null;
      recognition.abort();
      setListening(false);
      setInterim('');
    };
  }, [enabled, Recognition]);

  return { supported, listening, interim, error };
}
