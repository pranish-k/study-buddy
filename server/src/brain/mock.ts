import type { Brain, BrainRequest, Usage } from '../types.js';
import { CHECKIN_PROMPT } from './prompt.js';

const REPLIES = {
  checkin:
    "Nice work, that's a full focus block done! Stand up, stretch, grab some water, and give your eyes a rest for five minutes.",
  recursion: `Recursion trips everyone up at first, so you're in good company. Here's the key question: what is the smallest version of the problem you can answer instantly? That's your base case. Here's the classic example:

\`\`\`python
def factorial(n):
    if n <= 1:  # base case
        return 1
    return n * factorial(n - 1)  # smaller problem
\`\`\`

Each call shrinks the problem until it hits the base case. What problem are you working on?`,
  error:
    "Let's read this error together. The last line usually names the problem, and the line just above it shows where it happened. Which line of your own code does the traceback point to?",
  greeting:
    "Hi, I'm Nova! I'll be right here while you study. Tell me what you're working on, or just get started and call me when you're stuck.",
  fallback:
    "Good question. Before I give you the answer, what do you think the first step is? Tell me your guess and we'll build from there.",
} as const;

export function pickMockReply(lastUser: string): string {
  const text = lastUser.toLowerCase();
  if (lastUser === CHECKIN_PROMPT) return REPLIES.checkin;
  if (text.includes('recurs')) return REPLIES.recursion;
  if (/error|exception|traceback|undefined|failed/.test(text)) return REPLIES.error;
  if (/^(hi|hey|hello)\b/.test(text)) return REPLIES.greeting;
  return REPLIES.fallback;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** A free stand-in for Claude so the full app can be used and tested without an API key. */
export class MockBrain implements Brain {
  readonly name = 'mock';
  readonly model = 'mock';

  constructor(private readonly delayMs = 30) {}

  async reply({ messages, signal, onDelta }: BrainRequest): Promise<Usage> {
    const lastUser = messages.findLast((m) => m.role === 'user')?.content ?? '';
    const reply = pickMockReply(lastUser);
    // Stream word by word (keeping whitespace) so the UI behaves like a real stream.
    for (const chunk of reply.match(/\S+\s*/g) ?? []) {
      if (this.delayMs > 0) await sleep(this.delayMs, signal);
      else if (signal.aborted) throw signal.reason;
      onDelta(chunk);
    }
    return { inputTokens: 0, outputTokens: 0 };
  }
}
