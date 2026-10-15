// Fakes the Web Speech APIs inside the page so the voice loop can run headless.
// Loaded with `page.addInitScript({ path })`. Plain JS on purpose: TS transpilers can inject
// helpers (like esbuild's __name) that don't exist in the browser.
//
// Test hooks on `window.__speech`:
// - say(text) makes the running recognizer hear `text` (interim, then final).
// - spoken lists every sentence passed to speechSynthesis.speak.
// - recognizing is true while the microphone is listening.
(() => {
  const wordMs = window.__SPEECH_WORD_MS ?? 60;

  const state = {
    spoken: [],
    recognizing: false,
    active: null,
    say(text) {
      const rec = state.active;
      if (!rec) throw new Error('Recognition is not running');
      const result = (isFinal) => {
        const r = Object.assign([{ transcript: text }], { isFinal });
        return { resultIndex: 0, results: [r] };
      };
      rec.onresult?.(result(false));
      setTimeout(() => rec.onresult?.(result(true)), 120);
    },
  };

  class FakeRecognition {
    continuous = false;
    interimResults = false;
    lang = 'en-US';
    onresult = null;
    onerror = null;
    onstart = null;
    onend = null;
    start() {
      state.active = this;
      state.recognizing = true;
      setTimeout(() => this.onstart?.(), 0);
    }
    stop() {
      this.abort();
    }
    abort() {
      if (state.active === this) state.active = null;
      state.recognizing = state.active !== null;
      setTimeout(() => this.onend?.(), 0);
    }
  }

  const queue = [];
  let current = null;
  let timers = [];

  const fire = (u, type, extra = {}) => {
    const event = Object.assign(
      new Event(type),
      { utterance: u, charIndex: 0, charLength: 0, name: '' },
      extra,
    );
    u[`on${type}`]?.call(u, event);
  };

  const playNext = () => {
    current = queue.shift() ?? null;
    if (!current) return;
    const u = current;
    state.spoken.push(u.text);
    fire(u, 'start');
    const words = [...u.text.matchAll(/\S+/g)];
    words.forEach((m, i) => {
      timers.push(
        setTimeout(
          () => fire(u, 'boundary', { name: 'word', charIndex: m.index, charLength: m[0].length }),
          i * wordMs,
        ),
      );
    });
    timers.push(
      setTimeout(
        () => {
          fire(u, 'end');
          playNext();
        },
        words.length * wordMs + 20,
      ),
    );
  };

  const voices = [
    {
      name: 'Test Natural Voice',
      lang: 'en-US',
      voiceURI: 'test-natural',
      default: true,
      localService: true,
    },
    {
      name: 'Test Second Voice',
      lang: 'en-GB',
      voiceURI: 'test-second',
      default: false,
      localService: true,
    },
  ];

  const synth = Object.assign(new EventTarget(), {
    pending: false,
    paused: false,
    getVoices: () => voices,
    speak(u) {
      queue.push(u);
      if (!current) playNext();
    },
    cancel() {
      timers.forEach(clearTimeout);
      timers = [];
      queue.length = 0;
      const u = current;
      current = null;
      if (u) fire(u, 'end');
    },
    pause() {},
    resume() {},
  });
  Object.defineProperty(synth, 'speaking', { get: () => current !== null });

  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  Object.assign(window, {
    SpeechRecognition: FakeRecognition,
    webkitSpeechRecognition: FakeRecognition,
    __speech: state,
  });
})();
