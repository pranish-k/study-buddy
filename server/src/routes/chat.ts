import { Router, type Response } from 'express';
import { z } from 'zod';
import { describeError } from '../brain/claude.js';
import { CHECKIN_PROMPT, SYSTEM_PROMPT } from '../brain/prompt.js';
import { prepareMessages } from '../guardrails.js';
import type { Brain } from '../types.js';

const ChatRequest = z.object({
  kind: z.enum(['chat', 'checkin']).default('chat'),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1) }))
    .max(200),
});

function send(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function chatRouter(brain: Brain): Router {
  const router = Router();

  router.post('/chat', async (req, res) => {
    const parsed = ChatRequest.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid chat request', issues: parsed.error.issues });
      return;
    }
    const { kind } = parsed.data;
    const history =
      kind === 'checkin'
        ? [...parsed.data.messages, { role: 'user' as const, content: CHECKIN_PROMPT }]
        : parsed.data.messages;
    const { messages, trimmed } = prepareMessages(history);
    if (messages.length === 0 || messages.at(-1)?.role !== 'user') {
      res.status(400).json({ error: 'The conversation must end with a user message.' });
      return;
    }

    // If the browser goes away (Stop pressed, tab closed), stop paying for the upstream stream.
    const upstream = new AbortController();
    res.on('close', () => upstream.abort());

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    send(res, 'meta', { brain: brain.name, model: brain.model, trimmed });

    try {
      const usage = await brain.reply({
        system: SYSTEM_PROMPT,
        messages,
        signal: upstream.signal,
        onDelta: (text) => send(res, 'delta', { text }),
      });
      send(res, 'done', { usage });
    } catch (err) {
      if (upstream.signal.aborted) return;
      console.error('[chat] reply failed:', err);
      send(res, 'error', { message: describeError(err) });
    } finally {
      res.end();
    }
  });

  return router;
}
