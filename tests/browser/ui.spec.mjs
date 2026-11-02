import { test, expect } from '@playwright/test';
test('the empty player is accessible on desktop and narrow screens', async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Find every note.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open audio',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeDisabled();
  await page.setViewportSize({width:320,height:700});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('malformed audio produces a recoverable error', async ({page}) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({name:'broken.wav',mimeType:'audio/wav',buffer:Buffer.from('broken')});
  await expect(page.locator('#error')).toContainText('Try an MP3 or WAV');
  await expect(page.getByRole('button',{name:'Change audio',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeDisabled();
});
