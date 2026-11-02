import { test, expect } from '@playwright/test';
function wav(seconds = 6, frequency = 440) {
  const rate = 44100, count = Math.floor(rate * seconds), data = Buffer.alloc(44 + count * 2);
  data.write('RIFF'); data.writeUInt32LE(36 + count * 2, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(count * 2, 40);
  for (let n = 0; n < count; n++) data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * n / rate) * 12000), 44 + n * 2);
  return data;
}
async function load(page, seconds = 6, name = 'Practice A440.wav') {
  await page.locator('#file-input').setInputFiles({name,mimeType:'audio/wav',buffer:wav(seconds)});
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
}
async function loop(page, a, b) {
  await page.getByLabel('Loop start').fill(a);
  await page.getByLabel('Loop start').press('Tab');
  await page.getByLabel('Loop end').fill(b);
  await page.getByLabel('Loop end').press('Tab');
  await page.getByRole('button',{name:'Enable loop',exact:true}).click();
}
test.beforeEach(async ({page,browserName}) => {
  test.skip(browserName === 'webkit' && process.platform === 'win32', 'Windows WebKit rejects standalone PCM WAV with MEDIA_ERR_SRC_NOT_SUPPORTED; run audio tests on macOS/Linux.');
  await page.goto('/');
});

test('empty state disables transport and a local WAV plays at half speed with pitch preservation', async ({page}) => {
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeDisabled();
  await page.screenshot({path:'test-results/desktop-empty.png',fullPage:true});
  await load(page);
  await expect(page.locator('#file-name')).toHaveText('Practice A440.wav');
  await expect(page.locator('#duration')).toHaveText('0:06');
  await page.getByRole('button',{name:'50%',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThan(0.1);
  const state = await page.locator('audio').evaluate(a => ({rate:a.playbackRate,pitch:a.preservesPitch ?? a.webkitPreservesPitch,paused:a.paused}));
  expect(state).toEqual({rate:0.5,pitch:true,paused:false});
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect.poll(() => page.locator('audio').evaluate(a => a.paused)).toBe(true);
});

test('A/B loop repeatedly wraps and seeking outside its bounds returns to A', async ({page}) => {
  await load(page);
  await loop(page, '0:01.0', '0:01.4');
  await page.locator('#seek').focus(); await page.keyboard.press('End');
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeCloseTo(1,1);
  await page.evaluate(() => {
    window.wraps = 0;
    document.querySelector('audio').addEventListener('seeking', () => { window.wraps++; });
  });
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(() => page.evaluate(() => window.wraps),{timeout:5000}).toBeGreaterThanOrEqual(3);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const t = await page.locator('audio').evaluate(a => a.currentTime);
  expect(t).toBeGreaterThanOrEqual(1); expect(t).toBeLessThan(1.6);
  await page.getByRole('button',{name:'Clear loop',exact:true}).click();
  await expect(page.getByRole('button',{name:'Enable loop',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(page.getByLabel('Loop start')).toHaveValue('0:00.0');
});

test('invalid loop edits show feedback and preserve the previous valid boundary', async ({page}) => {
  await load(page);
  await loop(page, '1', '2');
  await page.getByLabel('Loop end').fill('0:01.1'); await page.getByLabel('Loop end').press('Tab');
  await expect(page.locator('#loop-message')).toContainText('0.25');
  await expect(page.getByLabel('Loop end')).toHaveValue('0:02.0');
  await expect(page.getByRole('button',{name:'Disable loop',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('replacing a playing file pauses and resets its loop and position, preserving speed', async ({page}) => {
  await load(page);
  await loop(page, '1','2');
  await page.getByRole('button',{name:'75%',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await load(page, 3, 'Next.wav');
  await expect(page.locator('#duration')).toHaveText('0:03');
  await expect(page.getByLabel('Loop start')).toHaveValue('0:00.0');
  await expect(page.getByRole('button',{name:'Enable loop',exact:true})).toHaveAttribute('aria-pressed','false');
  const state = await page.locator('audio').evaluate(a => ({time:a.currentTime,paused:a.paused,rate:a.playbackRate}));
  expect(state).toEqual({time:0,paused:true,rate:0.75});
});

test('invalid and empty files show actionable errors and another file can still load', async ({page}) => {
  for (const buffer of [Buffer.from('not audio'),Buffer.alloc(0)]) {
    await page.locator('#file-input').setInputFiles({name:'Broken.wav',mimeType:'audio/wav',buffer});
    await expect(page.locator('#error')).toContainText(/empty|couldn.t open/i);
    await expect(page.getByRole('button',{name:'Play',exact:true})).toBeDisabled();
  }
  await load(page);
  await expect(page.locator('#error')).toBeHidden();
});

test('short audio plays while looping is unavailable', async ({page}) => {
  await load(page, 0.15);
  await expect(page.getByRole('button',{name:'Enable loop',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(() => page.locator('audio').evaluate(a => a.ended)).toBe(true);
});

test('Space and loop shortcuts work outside controls without hijacking timestamp edits', async ({page}) => {
  await load(page);
  await page.locator('h1').click(); await page.keyboard.press('Space');
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  await page.keyboard.press('Space');
  await page.keyboard.press('l');
  await expect(page.getByRole('button',{name:'Disable loop',exact:true})).toBeVisible();
  await page.getByLabel('Loop start').focus(); await page.keyboard.press('l');
  await expect(page.getByRole('button',{name:'Disable loop',exact:true})).toBeVisible();
});

test('loop at the end of the file continues playing', async ({page}) => {
  await load(page, 1);
  await loop(page,'0.5','1');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.evaluate(() => { window.wraps = 0; document.querySelector('audio').addEventListener('seeking', () => window.wraps++); });
  await expect.poll(() => page.evaluate(() => window.wraps),{timeout:4000}).toBeGreaterThanOrEqual(2);
  expect(await page.locator('audio').evaluate(a => a.paused)).toBe(false);
});

test('mobile controls fit without horizontal overflow', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await load(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeInViewport();
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});

test('rendered half-speed audio keeps a 440 Hz tone near its original pitch', async ({page,browserName}) => {
  test.skip(browserName !== 'chromium','Media element captureStream is unavailable in WebKit.');
  await load(page, 6);
  await page.getByRole('button',{name:'50%',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  const frequency = await page.evaluate(async () => {
    const media = document.querySelector('audio');
    const context = new AudioContext(); await context.resume();
    const source = context.createMediaStreamSource(media.captureStream());
    const analyser = context.createAnalyser(); analyser.fftSize = 8192; source.connect(analyser);
    await new Promise(resolve => setTimeout(resolve,600));
    const bins = new Float32Array(analyser.frequencyBinCount); analyser.getFloatFrequencyData(bins);
    let peak = 1;
    for (let n = 2; n < bins.length; n++) if (bins[n] > bins[peak]) peak = n;
    const hz = peak * context.sampleRate / analyser.fftSize;
    source.disconnect(); await context.close(); return hz;
  });
  expect(frequency).toBeGreaterThan(425); expect(frequency).toBeLessThan(455);
});


test('MP3 loading, fine speed adjustment, volume and restart work', async ({page}) => {
  await page.locator('#file-input').setInputFiles('tests/fixtures/tone.mp3');
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  await expect(page.locator('#file-name')).toHaveText('tone.mp3');
  await page.getByLabel('Playback speed',{exact:true}).focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  expect(await page.locator('audio').evaluate(a => a.playbackRate)).toBe(0.26);
  await page.getByLabel('Volume',{exact:true}).focus(); await page.keyboard.press('Home');
  expect(await page.locator('audio').evaluate(a => a.volume)).toBe(0);
  await page.getByRole('button',{name:'100%',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThan(0.2);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Restart',exact:true}).click();
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBe(0);
});

test('set A and B use the paused playhead position', async ({page}) => {
  await load(page);
  await page.locator('#seek').focus(); await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.getByRole('button',{name:'Set A',exact:true}).click();
  const a = await page.locator('audio').evaluate(a => a.currentTime);
  await page.locator('#seek').focus(); await page.keyboard.press('End');
  await page.getByRole('button',{name:'Set B',exact:true}).click();
  await expect(page.getByLabel('Loop end')).toHaveValue('0:06.0');
  await page.getByRole('button',{name:'Enable loop',exact:true}).click();
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeCloseTo(a,1);
});

test('dropping a local file loads it without outgoing network requests', async ({page}) => {
  const external = [];
  page.on('request', request => { if (!/^(http:\/\/127\.0\.0\.1:5174|blob:)/.test(request.url())) external.push(request.url()); });
  await page.evaluate(bytes => {
    const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)],'Dropped.wav',{type:'audio/wav'}));
    document.querySelector('#drop-zone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  }, [...wav(1)]);
  await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
  await expect(page.locator('#file-name')).toHaveText('Dropped.wav');
  await page.getByRole('button',{name:'50%',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThan(0.1);
  expect(external).toEqual([]);
});

test('missing browser pitch preservation disables slowdown with an explanation', async ({page}) => {
  await page.addInitScript(() => { for (const key of ['preservesPitch','webkitPreservesPitch','mozPreservesPitch']) delete HTMLMediaElement.prototype[key]; });
  await page.reload();
  await load(page);
  await expect(page.locator('#notice')).toBeVisible();
  await expect(page.getByRole('button',{name:'50%',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'100%',exact:true})).toBeEnabled();
});

test('fractional quarter-second loops remain valid and editable', async ({page}) => {
  await load(page);
  for (const [a,b,wantA,wantB] of [['0.04','0.29','0:00.04','0:00.29'],['0.26','0.51','0:00.26','0:00.51']]) {
    await loop(page,a,b);
    await expect(page.getByLabel('Loop start')).toHaveValue(wantA);
    await expect(page.getByLabel('Loop end')).toHaveValue(wantB);
    await expect(page.locator('#loop-message')).not.toContainText('valid timestamp');
    await page.getByLabel('Loop start').fill(a + '0'); await page.getByLabel('Loop start').press('Tab');
    await expect(page.getByLabel('Loop start')).toHaveValue(wantA);
    await page.getByRole('button',{name:'Clear loop',exact:true}).click();
  }
});
