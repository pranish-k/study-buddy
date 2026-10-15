import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../hooks/useChat';
import { MOUTH_PARAMS } from '../lib/lipsync';
import { mouthPaths } from '../lib/mouth-paths';
import { ChatPanel } from './ChatPanel';

function renderChat(overrides: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  const onSend = vi.fn();
  render(
    <ChatPanel
      messages={[]}
      active
      thinking={false}
      speakReplies
      speechSupported
      onToggleSpeak={() => {}}
      onSend={onSend}
      trimNotice={false}
      onDismissTrimNotice={() => {}}
      maxChars={8000}
      {...overrides}
    />,
  );
  return { onSend, box: screen.getByRole('textbox', { name: 'Message to Nova' }) };
}

describe('ChatPanel', () => {
  it('sends on Enter and keeps Shift+Enter as a newline', async () => {
    const { onSend, box } = renderChat();
    await userEvent.type(box, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(onSend).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledWith('line one\nline two');
    expect(box).toHaveValue('');
  });

  it('warns before sending a paste over the server limit', async () => {
    const { box } = renderChat({ maxChars: 10 });
    await userEvent.type(box, 'x'.repeat(11));
    expect(screen.getByRole('status')).toHaveTextContent('Only the first 10 will be sent');
  });

  it('is disabled while Active Mode is off', () => {
    const { box } = renderChat({ active: false });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute('placeholder', 'Start Active Mode to chat with Nova');
  });

  it('renders code in a copyable block with its language', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'assistant', content: 'Try:\n\n```js\nconst a = 1;\n```', status: 'done' },
    ];
    renderChat({ messages });
    expect(screen.getByText('js')).toBeInTheDocument();
    expect(screen.getByText('const a = 1;')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('shows errors and stopped replies', () => {
    renderChat({
      messages: [
        { id: '1', role: 'assistant', content: '', status: 'error', error: 'API key rejected' },
        { id: '2', role: 'assistant', content: 'partial', status: 'stopped' },
      ],
    });
    expect(screen.getByRole('alert')).toHaveTextContent('API key rejected');
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });
});

describe('mouthPaths', () => {
  it('produces valid path data for every mouth shape', () => {
    for (const params of Object.values(MOUTH_PARAMS)) {
      const paths = mouthPaths(params);
      for (const d of Object.values(paths)) expect(d).toMatch(/^M [-\d. ]+(?:[QCZ][-\d. ]*)+$/);
    }
  });
});
