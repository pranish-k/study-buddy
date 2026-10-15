import { expect, test, type Page } from '@playwright/test';
import { installSpeech, recognizing, say, spoken } from './support/speech';

const tile = (page: Page) => page.getByTestId('avatar-tile');
const messages = (page: Page) => page.getByTestId('messages');

async function start(page: Page, path = '/') {
  await installSpeech(page);
  await page.goto(path);
  await expect(page.getByTestId('brain-badge')).toHaveText('Mock brain');
  await page.getByTestId('active-toggle').click();
  await expect(page.getByTestId('active-pill')).toHaveText('Active');
  await expect.poll(() => recognizing(page)).toBe(true);
}

test('everything is off until Active Mode starts', async ({ page }) => {
  await installSpeech(page);
  const apiCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/chat')) apiCalls.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByTestId('brain-badge')).toHaveText('Mock brain');
  await expect(page.getByRole('textbox', { name: 'Message to Nova' })).toBeDisabled();
  await expect(page.getByText('Start Active Mode to study together')).toBeVisible();
  expect(await recognizing(page)).toBe(false);
  expect(apiCalls).toEqual([]);
});

test('talking to Nova: speech in, spoken reply with moving mouth, code kept in chat', async ({
  page,
}) => {
  await start(page);
  await say(page, "I'm stuck on recursion");

  await expect(messages(page).locator('.msg.user')).toHaveText("I'm stuck on recursion");
  await expect(tile(page)).toHaveAttribute('data-state', 'speaking');

  // The mouth moves through several shapes while Nova talks.
  const shapes = new Set<string>();
  for (let i = 0; i < 20; i++) {
    shapes.add((await tile(page).getAttribute('data-mouth')) ?? '');
    await page.waitForTimeout(40);
  }
  expect(shapes.size).toBeGreaterThan(2);

  const reply = messages(page).locator('.msg.assistant').last();
  await expect(reply.locator('.code-block')).toContainText('def factorial(n):');
  await expect(reply.getByRole('button', { name: 'Copy code' })).toBeVisible();
  await expect(tile(page)).toHaveAttribute('data-state', 'idle', { timeout: 15_000 });

  const said = (await spoken(page)).join(' ');
  expect(said).toContain('Recursion trips everyone up');
  expect(said).toContain("I've put the code in the chat.");
  expect(said).not.toContain('def factorial');
  // The mic comes back after Nova finishes speaking.
  await expect.poll(() => recognizing(page)).toBe(true);
});

test('a new question mid-reply stops the old answer instead of repeating it', async ({ page }) => {
  await start(page);
  await say(page, "I'm stuck on recursion");
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(0);

  const box = page.getByRole('textbox', { name: 'Message to Nova' });
  await box.fill('hello there');
  await box.press('Enter');

  await expect(messages(page).locator('.msg.assistant').first()).toHaveAttribute(
    'data-status',
    'stopped',
  );
  await expect(messages(page).locator('.msg.assistant').last()).toHaveAttribute(
    'data-status',
    'done',
    { timeout: 10_000 },
  );
  await expect(tile(page)).toHaveAttribute('data-state', 'idle', { timeout: 15_000 });
  const firstSentence = "Recursion trips everyone up at first, so you're in good company.";
  expect((await spoken(page)).filter((s) => s === firstSentence)).toHaveLength(1);
  expect((await spoken(page)).join(' ')).toContain("Hi, I'm Nova!");
});

test('typing and pasting into chat, copying code, text-only mode', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await start(page);
  await page.getByRole('button', { name: 'Speak replies' }).click();
  await expect(page.getByRole('button', { name: 'Text only' })).toBeVisible();

  const box = page.getByRole('textbox', { name: 'Message to Nova' });
  await box.fill(
    'Traceback (most recent call last):\n  File "main.py", line 3\nTypeError: unsupported operand',
  );
  await box.press('Enter');
  await expect(messages(page).locator('.msg.assistant').last()).toContainText(
    'Which line of your own code',
    { timeout: 10_000 },
  );

  await box.fill('can you explain recursion with code?');
  await box.press('Enter');
  const copy = messages(page)
    .locator('.msg.assistant')
    .last()
    .getByRole('button', { name: 'Copy code' });
  await copy.click();
  await expect(messages(page).getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('def factorial');

  // Text-only mode never speaks.
  expect(await spoken(page)).toEqual([]);
  await expect(page.getByTestId('usage')).toContainText('2 replies');
});

test('giant pastes are trimmed with a warning', async ({ page }) => {
  await start(page);
  const box = page.getByRole('textbox', { name: 'Message to Nova' });
  await box.fill('x'.repeat(9000));
  await expect(page.getByText('Only the first 8,000 will be sent')).toBeVisible();
  await box.press('Enter');
  await expect(page.getByText('Your last message was too long')).toBeVisible();
  // The server trims; the trim notice goes away with the next, short message.
  await expect(messages(page).locator('.msg.assistant').last()).toHaveAttribute(
    'data-status',
    'done',
    {
      timeout: 10_000,
    },
  );
  await box.fill('thanks');
  await box.press('Enter');
  await expect(page.getByText('Your last message was too long')).toBeHidden();
});

test('Pomodoro break triggers a check-in, then a back-to-work note', async ({ page }) => {
  await start(page, '/?work=2s&break=2s');
  await expect(page.getByTestId('pomodoro-clock')).toHaveText('00:02');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.locator('.msg.checkin')).toContainText('Break check-in', { timeout: 6_000 });
  await expect(page.locator('.pomodoro')).toHaveAttribute('data-phase', 'break');
  await expect(page.locator('.msg.local')).toContainText("Break's over", { timeout: 6_000 });
  await expect(page.locator('.pomo-count')).toHaveText('1 session done');
});

test('Stop ends everything: no mic, no speech, no requests, no check-ins', async ({ page }) => {
  await installSpeech(page, 400);
  const apiCalls: number[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/')) apiCalls.push(Date.now());
  });
  await page.goto('/?work=2s&break=2s');
  await page.getByTestId('active-toggle').click();
  await expect.poll(() => recognizing(page)).toBe(true);

  await say(page, "I'm stuck on recursion");
  await expect(tile(page)).toHaveAttribute('data-state', 'speaking');
  await page.getByTestId('active-toggle').click();
  const stoppedAt = Date.now();

  await expect(page.getByTestId('active-pill')).toHaveText('Off');
  await expect(tile(page)).toHaveAttribute('data-state', 'idle');
  await expect(messages(page).locator('.msg.assistant').last()).toHaveAttribute(
    'data-status',
    'stopped',
  );
  expect(await recognizing(page)).toBe(false);
  const spokenAtStop = (await spoken(page)).length;

  // Run into a Pomodoro break while off: it must not call the API.
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.locator('.pomodoro')).toHaveAttribute('data-phase', 'break', {
    timeout: 5_000,
  });
  await page.waitForTimeout(1500);

  expect(apiCalls.filter((t) => t > stoppedAt)).toEqual([]);
  expect((await spoken(page)).length).toBe(spokenAtStop);
  expect(await recognizing(page)).toBe(false);
  await expect(page.locator('.msg.checkin')).toHaveCount(0);
});

test('mobile layout fits without horizontal scrolling, even with wide code', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const box = page.getByRole('textbox', { name: 'Message to Nova' });
  await box.fill('recursion example please');
  await box.press('Enter');
  await expect(messages(page).locator('.code-block')).toBeVisible();
  await expect(page.locator('.msg.assistant').last()).toHaveAttribute('data-status', 'done', {
    timeout: 10_000,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByTestId('active-toggle')).toBeInViewport();
});
