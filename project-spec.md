# AI Study Companion

## What we are building

A study buddy that sits with you like a person on a Zoom call. It has an animated avatar and a voice, you can talk to it when you get stuck, and it stays quiet while you work. Everything runs as a web app on your own computer. The only paid parts are the API calls that happen while Active Mode is on.

## How it should feel

- You open the app and see the avatar in a video-call style tile.
- You press Start Active Mode and the companion is "in the room" with you.
- While you study, it mostly idles (blinks, small movements) and does not talk unless you speak to it or a check-in fires.
- When you say "I'm stuck on recursion," it listens, thinks, and answers out loud with the avatar's mouth moving in sync.
- A chat panel sits beside the avatar. You can type or paste anything into it (code, error messages, a problem set question, lecture notes) and the companion reads it and answers, out loud or as text.
- A Pomodoro timer runs alongside, and the companion can check in at break time.
- Press Stop and all paid usage stops immediately.

## The four pieces

| Piece | Job | Planned service |
|---|---|---|
| Brain | Understands what you say and replies like a calm study partner | Claude API (a fast, cheap model for chat) |
| Ears | Turns your speech into text | Deepgram (or browser speech recognition for the first test) |
| Voice | Turns the reply into spoken audio | A budget cloud voice such as OpenAI TTS or Cartesia (browser voice for the first test) |
| Avatar | Face that idles and moves its mouth when speaking | Free animated 2D avatar in the browser (SVG first, Live2D later) |

## Architecture

```
Browser (web app on your computer)
  - avatar tile, timer, chat panel, Active Mode switch
  - microphone input and audio playback
        |
        v
Local server (Node.js on your computer)
  - holds your API keys (never exposed to the browser)
  - /api/chat  -> Claude API
  - later: /api/stt and /api/tts for Deepgram and a cloud voice
```

## Scope

### Version 1 (what we build first)
1. Local Node server with a chat endpoint that talks to Claude, with a study-companion system prompt.
2. Web page with an animated avatar (idle blinking, mouth moves while speaking).
3. Active Mode toggle that is the master switch for mic, API calls, and spending.
4. Chat panel for typing and pasting text, with a visible history. Code blocks are shown in a monospace box with a copy button, and a toggle lets the companion either speak its reply or stay text-only (long code answers are better read than spoken).
5. Pomodoro timer (25 minutes work, 5 minutes break) with a break check-in message.
6. Voice in and out using the browser's built-in speech tools, so you can test the whole loop before paying for anything extra.
7. Short conversation history with a cap, so cost stays flat in long sessions. Large pastes are trimmed to a size limit, with a warning, so one giant paste cannot make a single message expensive.

### Version 2 (upgrades once V1 feels good)
1. Swap in Deepgram for more accurate listening.
2. Swap in a nicer cloud voice.
3. Upgrade the avatar to a Live2D or VRM character with lip sync driven by the audio.
4. Let you paste in notes or a syllabus so the companion knows what you are studying.
5. Session summary at the end ("here is what you worked on and what to review").

### Out of scope for now
- Photorealistic video avatars (too expensive for 4 hours a day).
- Running inside actual Zoom or Meet. A browser tab gives the same feel with much less setup.
- Running models locally.

## Cost plan

- Web app open but Active Mode off: $0.
- Budget stack (Claude, Deepgram, cheap voice, free avatar): about $0.30 to $0.80 per active hour.
- At 2 to 4 hours of daily use, expect roughly $15 to $50 a month. Real usage should land near the low end because studying is mostly silence.

How we keep it low:
- Voice activity detection so only your actual speech is sent for transcription.
- The companion only speaks when asked or when a check-in fires.
- Avatar idles locally with no paid video generation.
- Trimmed history and a short system prompt.
- Active Mode off means zero API calls.

## The work, step by step

1. **Setup:** create the project folder, install Node dependencies, add your API key to a `.env` file.
2. **Server:** build the `/api/chat` endpoint and the study-companion personality prompt.
3. **Front end:** build the page layout, the avatar, the chat panel (type and paste), the timer, and the Active Mode switch.
4. **Voice loop:** connect browser speech recognition to the chat endpoint and speak replies back, with mouth movement tied to speech.
5. **Cost guardrails:** history cap, Active Mode kill switch, and a simple on-screen usage counter.
6. **Test:** run a real 30 minute study session and note what feels off.
7. **Upgrade:** pick which V2 items are worth doing based on that test.

## What I need from you

- An Anthropic API key (created in the Anthropic Console) with a small amount of credit, such as $5 to start.
- Your preferred avatar style (friendly cartoon, anime style, simple robot, etc.).
- A name and personality for your companion (strict coach, chill friend, encouraging tutor).
- Your operating system, so the run instructions match your computer.

## Definition of done for Version 1

You can open the app, press Start Active Mode, talk to the avatar about a problem you are stuck on, paste an error message or notes into the chat and get a useful answer, hear a spoken answer while its mouth moves, run a Pomodoro, press Stop, and see that nothing is running or billing afterward.