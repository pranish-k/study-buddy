// Dev helper: captures UI screenshots in several states. Usage: npx tsx e2e/support/shoot.ts <outDir>
import { chromium } from '@playwright/test';
import { installSpeech, say } from './speech';

const out = process.argv[2] ?? 'e2e/.screens';
const browser = await chromium.launch();

for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
] as const) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await installSpeech(page, 260);
  await page.goto(process.env.BASE_URL ?? 'http://localhost:5173/');
  await page.getByText('Mock brain').waitFor();
  await page.screenshot({ path: `${out}/${name}-1-off.png`, fullPage: name === 'mobile' });

  await page.getByTestId('active-toggle').click();
  await page.waitForTimeout(300);
  await say(page, "I'm stuck on recursion");
  await page.waitForTimeout(90);
  await page.screenshot({ path: `${out}/${name}-2-listening.png`, fullPage: name === 'mobile' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-3-speaking.png`, fullPage: name === 'mobile' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}/${name}-4-reply.png`, fullPage: name === 'mobile' });
  await page.close();
}
await browser.close();
