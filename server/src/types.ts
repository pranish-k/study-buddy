export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface BrainRequest {
  system: string;
  messages: ChatMessage[];
  signal: AbortSignal;
  onDelta: (text: string) => void;
}

export interface Brain {
  readonly name: 'claude' | 'mock';
  readonly model: string;
  /** Streams the reply through `onDelta` and resolves with token usage once finished. */
  reply(request: BrainRequest): Promise<Usage>;
}
