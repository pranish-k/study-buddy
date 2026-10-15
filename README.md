# Study Buddy

An AI study companion that sits with you like a person on a video call.
Nova, an encouraging tutor, idles in a video tile while you work, listens when you talk, answers out loud with lip-synced speech, reads anything you paste into the chat, and checks in when your Pomodoro break starts.

Everything runs locally in your browser and a small Node server on your computer.
The only paid part is the Claude API, and only while Active Mode is on.

## Quick start (macOS)

1. Install Node.js 22 or newer (`brew install node`).
2. Install dependencies:

   ```sh
   npm install
   ```

3. Start the app:

   ```sh
   npm run dev
   ```

4. Open http://localhost:5173 in **Chrome** (or Edge) and allow the microphone when asked.
5. Press **Start Active Mode** and say "I'm stuck on recursion", or type in the chat.

Without an API key, the server runs a free **mock brain** with canned tutor replies, so the whole app (voice, avatar, chat, timer) works at $0.
The badge in the top bar says which brain is active.

## Using the real Claude brain

1. Create an API key in the [Anthropic Console](https://console.anthropic.com) and add a few dollars of credit.
2. Copy the example env file and paste your key:

   ```sh
   cp .env.example .env
   # then edit .env: ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Restart `npm run dev`.
   The badge now reads `Claude · claude-haiku-5-5`.

The key stays on the local server and is never sent to the browser.
To try another model, set `CLAUDE_MODEL` in `.env`.

## How it works

```
Browser (React + Vite, port 5173)
  avatar tile, Pomodoro, chat panel, Active Mode switch
  browser speech recognition (ears) and speech synthesis (voice)
        |
        v  /api/chat (Server-Sent Events)
Local server (Express, 127.0.0.1:8787)
  holds the API key, trims history and pastes, streams Claude's reply
```

- **Brain:** Claude Haiku 5.5 with low effort and a 1024-token reply cap, prompted as Nova.
- **Ears:** the browser's built-in speech recognition (Chrome and Edge).
  The mic pauses while Nova speaks, so it does not hear itself.
- **Voice:** the browser's built-in voices, spoken sentence by sentence as the reply streams in.
  Code is never read aloud; Nova says "I've put the code in the chat" instead.
- **Avatar:** a hand-built SVG face that blinks, breathes, moves its eyes, and shapes its mouth from the voice's word timings.

## Cost guardrails

- Active Mode off means zero API calls, no microphone and no speech.
  Pressing Stop aborts any reply mid-stream, and the server cancels the upstream request too.
- Only the last 12 messages are sent, so a long session costs the same per message as a short one.
- A single message is capped at 8,000 characters; a bigger paste is trimmed with a warning.
- Nova only speaks when asked or when a break check-in fires (only in Active Mode).
- The top bar shows replies, tokens, and estimated cost for the session.

With Haiku 5.5 at $0.10 / $0.50 per million input / output tokens, a typical reply costs a small fraction of a cent.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Server and web app with hot reload |
| `npm start` | Production build served from one port (http://127.0.0.1:8787) |
| `npm test` | Server and web unit tests |
| `npm run e2e` | Playwright end-to-end tests (always uses the mock brain) |
| `npm run check` | Lint, typecheck, unit tests, and E2E tests |
| `npm run screens -- <dir>` | Screenshots of key states (needs `npm run dev` running) |

For a quick Pomodoro test, open http://localhost:5173/?work=10s&break=5s.

## Browser support

Voice in and out works best in Chrome and Edge.
Chrome's speech recognition sends audio to Google's servers for transcription, at no cost to you.
In browsers without speech recognition (such as Firefox), Nova shows a notice and you can still chat by typing.

See `project-spec.md` for the product spec and `plan.md` for the build plan and progress log.
