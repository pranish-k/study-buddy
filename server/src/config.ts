export interface Config {
  apiKey: string | undefined;
  model: string;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.ANTHROPIC_API_KEY?.trim() || undefined;
  return {
    apiKey,
    model: env.CLAUDE_MODEL?.trim() || 'claude-haiku-5-5',
    port: Number(env.PORT) || 8787,
  };
}
