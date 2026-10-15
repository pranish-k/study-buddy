import { createApp } from './app.js';
import { ClaudeBrain } from './brain/claude.js';
import { MockBrain } from './brain/mock.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const brain = config.apiKey ? new ClaudeBrain(config.apiKey, config.model) : new MockBrain();

// Bind to loopback only: the server holds the API key and is not meant to be reachable from the network.
createApp(brain).listen(config.port, '127.0.0.1', () => {
  const mode = brain.name === 'claude' ? `Claude (${brain.model})` : 'mock brain (no API key, $0)';
  console.log(`Study Buddy server on http://127.0.0.1:${config.port} using ${mode}`);
});
