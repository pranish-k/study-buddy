import Anthropic from '@anthropic-ai/sdk';
import type { Brain, BrainRequest, Usage } from '../types.js';

/** Spoken replies are short, so a small cap keeps any single reply cheap. */
const MAX_OUTPUT_TOKENS = 1024;

export class ClaudeBrain implements Brain {
  readonly name = 'claude';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async reply({ system, messages, signal, onDelta }: BrainRequest): Promise<Usage> {
    const stream = this.client.messages.stream(
      {
        model: this.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Chat replies don't need deep reasoning; low effort keeps latency and cost down.
        output_config: { effort: 'low' },
        system,
        messages,
      },
      { signal },
    );

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onDelta(event.delta.text);
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      onDelta("\n\nI can't help with that one. Let's get back to your studying.");
    }
    return { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens };
  }
}

/** Turns SDK errors into a short message that is safe to show in the UI. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError)
    return 'The API key was rejected. Check ANTHROPIC_API_KEY in .env.';
  if (err instanceof Anthropic.PermissionDeniedError)
    return 'This API key is not allowed to use that model.';
  if (err instanceof Anthropic.RateLimitError)
    return 'Rate limited by the API. Wait a moment and try again.';
  if (err instanceof Anthropic.BadRequestError)
    return `The API rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError)
    return 'Could not reach the Claude API. Check your connection.';
  if (err instanceof Anthropic.APIError) return `Claude API error (${err.status ?? 'unknown'}).`;
  return 'Something went wrong while generating a reply.';
}
