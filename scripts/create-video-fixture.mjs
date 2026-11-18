import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
    const context = canvas.getContext('2d');
    context.fillStyle = '#174e3e'; context.fillRect(0, 0, 160, 90);
    context.fillStyle = 'white'; context.font = '16px sans-serif'; context.fillText('Learning test', 24, 48);
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const parts = [];
    const complete = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.ondataavailable = event => parts.push(event.data);
    recorder.start();
    let frame = 0;
    const timer = setInterval(() => { context.fillStyle = frame++ % 2 ? '#174e3e' : '#355a4a'; context.fillRect(0, 0, 160, 90); context.fillStyle = 'white'; context.fillText('Learning test', 24, 48); }, 100);
    await new Promise(resolve => setTimeout(resolve, 1500));
    clearInterval(timer); recorder.stop(); await complete; stream.getTracks().forEach(track => track.stop());
    const bytes = new Uint8Array(await new Blob(parts, { type: 'video/webm' }).arrayBuffer());
    return btoa(String.fromCharCode(...bytes));
  });
  mkdirSync('web/e2e/fixtures', { recursive: true });
  writeFileSync('web/e2e/fixtures/lesson.webm', Buffer.from(base64, 'base64'));
  console.log('Created playable, first-party test video fixture.');
} finally { await browser.close(); }
