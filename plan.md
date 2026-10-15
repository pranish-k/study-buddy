# Study Buddy V1 - Execution Plan

## Context

`project-spec.md` describes an AI study companion: a local web app with a video-call style avatar tile, a chat panel, a Pomodoro timer, browser voice in/out, and a Claude-backed `/api/chat` behind an Active Mode kill switch.
The project folder only holds the spec and `github.md` (remote: `github.com/pranish-k/study-buddy`).
The goal is to build Version 1 end to end and get it running, without real API calls yet.
The server gets a **mock brain** that is used automatically when `ANTHROPIC_API_KEY` is missing, so the whole loop works and can be tested at $0.
Real API testing comes later and only needs a key in `.env`.

Decisions so far:
- Persona: **"Nova"**, an encouraging tutor who is warm and patient and asks guiding questions before giving full answers.
- Avatar: a **semi-realistic human face** drawn in SVG (layered gradients for skin and hair, shaded eyes with irises and lids, brows, nose, lips, neck and shoulders). It blinks, breathes, sways slightly and shows several mouth shapes. Photoreal video is out of scope per the spec. Live2D/VRM is the V2 path to more realism.
- Stack: Vite + React + TypeScript front end, Express + TypeScript server, npm workspaces. Node v25 and npm 11 are installed.
- Git: commit after each finished node and push to `origin main`.
- Model: Claude Haiku 5.5 (`claude-haiku-5-5`), the fast and cheap chat model. I will read the `claude-api` skill before writing the SDK code.

## How the work is run: graph + loop engineering

- **Graph:** the work is a dependency graph (DAG) of nodes. Each node has inputs, outputs, and an **acceptance gate**, which is a set of commands or checks that must pass. A node starts only after the nodes it depends on are green. Nodes that don't depend on each other can be built in any order.
- **Loop:** each node runs this loop: build -> verify against the gate -> if red, diagnose, fix and verify again -> once green, update `plan.md`, commit, push. Nothing is marked done on "should work". It has to pass its gate.
- **State file:** `study-buddy/plan.md` is the living copy of this plan. It holds each node's status (todo / in progress / done / blocked), a progress log, and any problems found. I update it after every node, so a stopped session can pick up exactly where it left off.

```
N0 Bootstrap ──> N1 Server ──────────────┐
      │                                  v
      └────> N2 Web shell ──> N3 Avatar ──> N5 Voice loop ──> N7 E2E + polish ──> N8 Docs/ship
                     │                       ^
                     └──> N4 Chat panel ─────┤
                     └──> N6 Timer+Guardrails┘
```

## Project layout

```
study-buddy/
  plan.md  README.md  .gitignore  .env.example  package.json (workspaces + scripts)
  server/  src/{index.ts, app.ts, routes/chat.ts, brain/{claude.ts, mock.ts, prompt.ts}, guardrails.ts}  tests/
  web/     src/{App.tsx, components/{AvatarTile, ChatPanel, CodeBlock, PomodoroTimer, ActiveModeSwitch, UsageCounter}.tsx,
                hooks/{useSpeechRecognition, useSpeechSynthesis, useChat, usePomodoro}.ts, lib/{api.ts, sse.ts, cost.ts}}
  e2e/     playwright tests + speech API stubs
```

## Nodes

**N0 Bootstrap**
- Copy this plan to `study-buddy/plan.md`. Set up git with README, `.gitignore` (`.env`, `node_modules`, `dist`, test output), and `.env.example`.
- Root `package.json` with workspaces and these scripts: `dev` (server + Vite together), `build`, `test`, `lint`, `typecheck`, `e2e`. Tooling: TypeScript strict, ESLint and Prettier.
- Check `gh auth status`, then push to origin.
- Gate: `npm install`, `npm run typecheck` and `npm run lint` pass, and the first commit is pushed.

**N1 Server (brain)**
- Express on `127.0.0.1:8787`. Keys stay on the server only.
- `GET /api/health` returns `{ brain: "claude" | "mock", model }`.
- `POST /api/chat` takes `{ messages, kind: "chat" | "checkin" }` and streams SSE events: `delta`, `done` (with `usage`), and `error`.
- `brain/claude.ts` uses `@anthropic-ai/sdk` streaming with a capped `max_tokens`. `brain/mock.ts` streams canned tutor-style replies (including one with a code block) so the UI can be fully exercised.
- If the client disconnects, the upstream stream is aborted. This is the server half of the kill switch.
- `guardrails.ts` keeps the last 12 messages and trims any message over ~8k chars. A `trimmed` flag goes back to the client. Requests are validated with zod.
- `prompt.ts` holds Nova's short system prompt (calm, encouraging, concise because replies may be spoken, guiding questions first) plus a short check-in prompt for breaks.
- Gate: vitest covers guardrails, the mock brain, and the SSE route (Anthropic client faked). A `curl` against the running server streams a reply.

**N2 Web shell**
- Vite with a `/api` proxy to the server. Layout: a dark video-call stage with the avatar tile and name label on the left, the chat panel on the right, and a top bar with the Active Mode switch, timer and usage counter. It stacks into one column on narrow screens.
- Theme lives in CSS variables.
- Gate: `npm run dev` serves the page, and a Playwright screenshot looks right at desktop and mobile widths.

**N3 Avatar**
- `AvatarTile.tsx` is the semi-realistic SVG human with states `idle | listening | thinking | speaking`.
- Idle: random blinks every 2-6s, breathing, slight head sway and small eye movements.
- Mouth shapes (rest, open, wide, round) are driven by `speechSynthesis` boundary events, with a fallback rhythm while speaking.
- Listening shows a mic glow ring. Thinking shows a subtle look-up and dots.
- Respects `prefers-reduced-motion`.
- Gate: screenshots of each state look right, and a unit test covers the state machine.

**N4 Chat panel**
- Message history with markdown rendering. Code blocks sit in a monospace box with a language label and a **copy** button. Multiline paste works (Enter sends, Shift+Enter adds a newline).
- A **Speak replies / Text only** toggle. Long code answers are never spoken: code blocks are stripped from the spoken text and replaced with "I've put the code in the chat."
- Shows a warning banner when a paste gets trimmed. Streaming text appears as it arrives.
- Sending is disabled while Active Mode is off, with a hint to start it.
- Gate: component tests, plus a manual check in the browser.

**N5 Voice loop**
- `useSpeechRecognition` uses `webkitSpeechRecognition` in continuous mode. It runs only while Active is on, is paused while Nova speaks (so it doesn't hear its own voice), and sends final transcripts to chat.
- `useSpeechSynthesis` speaks replies sentence by sentence as the stream arrives and drives the avatar's mouth. Users can pick a voice.
- If the browser lacks the APIs (e.g. Firefox), show a "text only" notice.
- Gate: Playwright with stubbed speech APIs runs the full flow: speak "I'm stuck on recursion", get a reply, the avatar enters `speaking`, then returns to `idle`.

**N6 Timer + guardrails**
- `usePomodoro`: 25/5 cycles with start/pause/reset. The display stays accurate even when the tab is in the background, because it tracks a timestamp rather than counting ticks.
- At break time, if Active Mode is on, a `checkin` request goes out and Nova speaks a short check-in.
- Active Mode is the master switch. Turning it **off** stops recognition, cancels speech, aborts every in-flight fetch, and suppresses check-ins.
- `UsageCounter` shows tokens in/out per session and an estimated cost (a price table in `lib/cost.ts`). In mock mode it shows "$0 (mock)".
- Gate: unit tests with fake timers, plus an E2E check that **no `/api` requests happen after Stop**.

**N7 E2E + polish**
- The full "definition of done" Playwright script runs against mock mode. Then a pixel-level review of screenshots: spacing, alignment, contrast, focus states, both themes if supported.
- Fix every lint, type and flaky-test problem found, whether or not it's related.
- Gate: `npm run lint && npm run typecheck && npm test && npm run e2e` all pass three times in a row (checks for flakiness).

**N8 Docs and ship**
- README covers setup, how to add the key, mock vs real mode, the cost notes, and a macOS run guide.
- Final `plan.md` update with V2 next steps.
- Commit and push.

## Verification (end to end)

1. `npm install && npm run dev`, then open `http://localhost:5173`.
2. With no key, the health badge shows "Mock brain". Press Start Active Mode, type or paste an error, get a streamed reply with a copyable code block, and hear it spoken while the mouth moves (in Chrome).
3. Say "I'm stuck on recursion" through the mic and get a spoken answer.
4. Run the Pomodoro (a dev-only short duration flag helps here) and see the break check-in.
5. Press Stop. The Network tab shows no further `/api` calls, the mic indicator turns off, and speech stops.
6. Later: put `ANTHROPIC_API_KEY` in `.env`, restart, and the badge shows "Claude (claude-haiku-5-5)". This is the API testing phase you want to do separately.

## Risks / notes
- Browser speech recognition works best in Chrome and Edge (it sends audio to Google, which is free). Safari support is partial.
- SVG realism has a ceiling. If the result looks uncanny, I'll aim for a polished illustrated-realistic style rather than forcing photorealism.
- A push needs `gh` / git credentials. If auth fails, I'll mark that node blocked in `plan.md` and keep committing locally.

## Status board

| Node | Status | Gate result |
|---|---|---|
| N0 Bootstrap | done | install, lint, typecheck green |
| N1 Server | done | 17/17 vitest (3x stable), curl streams SSE from mock brain |
| N2 Web shell | done | Desktop and 390px screenshots reviewed |
| N3 Avatar | done | State machine unit tests, mouth-shape E2E check |
| N4 Chat panel | done | Component tests, copy-to-clipboard E2E |
| N5 Voice loop | done | E2E with stubbed speech APIs |
| N6 Timer + guardrails | done | Fake-timer tests, "no /api after Stop" E2E |
| N7 E2E + polish | done | `npm run check` green 3 runs in a row |
| N8 Docs and ship | done | README, production build smoke-tested |

## Progress log

- 2026-10-15: Plan approved. gh auth OK, remote repo exists and is empty. Starting N0.
- N0: npm workspaces (server, web), ESLint 10 flat config, Prettier, Playwright. Issue: typescript-eslint does not support TypeScript 7 yet, so TS is pinned to 6.0.x. Target bumped to ES2023 for `findLast`.
- N1: Express 5 server with `/api/health` and SSE `/api/chat`. Brain interface with `ClaudeBrain` (claude-haiku-5-5, effort low, max 1024 output tokens) and a free `MockBrain` used when no key is set. Guardrails cap history at 12 messages and trim messages over 8000 chars. Client disconnect aborts the upstream stream (tested).
- N2 to N6: built together because they share App wiring; each node still has its own gate. Pure logic sits in `web/src/lib` (speech text, lip sync, avatar state, durations, cost) with unit tests. Hooks: `useChat`, `useSpeechSynthesis`, `useSpeechRecognition`, `useLipSync`, `useReplySpeaker`, `usePomodoro`.
- E2E needs fake speech APIs in headless Chromium. Issue: tsx injects an esbuild `__name` helper into functions passed to `addInitScript`, which crashes in the browser. Fix: the stub is a plain JS init script (`e2e/support/speech-stub.js`).
- Bugs found by screenshot review and fixed: (1) an exception from the speech layer marked a good reply as failed, so reply listeners are now isolated; (2) on mobile a long code line forced 96px of horizontal scroll, fixed with `minmax(0, 1fr)`, and the E2E test now checks after a code reply (verified red without the fix); (3) the hair drawing, stray background lines, and "1 replies" grammar.
- Added a fake-fetch test for `ClaudeBrain` so the real API path (request shape, stream parsing, refusal note, error messages) is verified at $0.
- Final gate: 21 server + 29 web unit tests, 7 Playwright E2E tests, lint and typecheck, green 3 runs in a row. `npm start` serves the built app from one port.

## Code review pass (2026-10-15)

A high-effort review plus a manual pass found 11 real bugs, all fixed, each with a test confirmed to fail on the old code:

| Bug | Fix |
|---|---|
| A new question while a reply streamed made Nova re-speak the old reply | Sending supersedes (aborts) the in-flight reply; check-ins are skipped mid-reply |
| `send` could overwrite queued state updates and lose a reply | `useChat` keeps one source of truth (ref) and routes every change through `commit` |
| Client trim plus suffix exceeded the server limit, so the trim banner kept coming back | Server is the only trimmer and publishes `maxMessageChars` on `/api/health`; `trimmed` reports only on the newest message |
| Merging same-role turns before trimming could cut off the newest question | Server trims each turn, then merges (also fixes check-in after an unanswered question) |
| "3." / "1." / "e.g." chunk boundaries skipped half a sentence in speech | While streaming, the last segment is always held back |
| The mic restarted between streamed sentences and could hear Nova | Mic stays off for the whole spoken reply; "speaking" holds 350 ms across sentence gaps |
| Hard recognition errors restarted every 250 ms indefinitely, and errors stayed on screen | Hard errors stop restarts; errors clear when the mic turns off |
| Health check never retried ("Server offline" stuck) | Retries every 2 s until the server answers |
| E2E could start before the API server was up | Playwright waits on `/api/health` through the Vite proxy |
| E2E could reuse a dev server holding a real API key | E2E runs on its own ports (5174 / 8790), never reuses, and forces an empty key (verified that it wins over `.env`) |
| Duplicated trim logic in client and server | Client trim removed |

Gate after the fixes: 22 server + 41 web unit tests, 8 E2E tests, lint and typecheck, green 3 runs in a row.

## Not yet verified (needs you)

- A live Claude API call with a real key (deliberately deferred to the API testing phase).
- Real microphone and real browser voices. E2E uses stubbed speech APIs, so try a real session in Chrome.
- The 30 minute real study session from the spec (step 6).

## V2 next steps

1. Deepgram streaming speech-to-text behind `/api/stt` for better accuracy and Firefox/Safari support.
2. A cloud voice (OpenAI TTS or Cartesia) behind `/api/tts`, with amplitude-driven lip sync.
3. Live2D or VRM avatar for a more realistic face.
4. Paste notes or a syllabus as session context (use prompt caching to keep it cheap).
5. End-of-session summary of what was covered and what to review.
