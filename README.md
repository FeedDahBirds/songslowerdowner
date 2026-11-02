# Slowroom — Song Slower Downer

A small browser app for learning music by ear. Open or drop a local audio file, reduce playback to 25–100% without changing its pitch, and repeat an A/B phrase.

## GitHub Pages

The public site is published at https://feeddahbirds.github.io/songslowerdowner/.

Pushing to `main` runs `.github/workflows/deploy-pages.yml`: install development dependencies, check JavaScript, run unit tests, build, and deploy only `dist/` to GitHub Pages. The site uses relative asset paths so it works under the repository's `/songslowerdowner/` address. No audio files are uploaded to GitHub when someone uses the player.

Pages must use **GitHub Actions** as its publishing source. Deployments also support manual runs from the repository's Actions tab. No deployment secrets are required; the workflow uses GitHub's temporary token with Pages permissions limited to the deploy job.

## Run

Node.js 22 or later is recommended. No dependencies are needed to run the app:

```sh
npm run dev
```

Open http://127.0.0.1:5173 in Chrome or Edge. Keep the terminal running. Change the port with `npm run dev -- --port 5175`.

## Use

1. Open an MP3, WAV, or another audio format supported by your browser.
2. Choose a speed preset or drag the speed slider in 1% steps.
3. Seek to the start of a phrase and press **Set A**, then seek to the end and press **Set B**. You can also enter seconds (`12.5`) or a timestamp (`1:23.4`). Editable bounds show up to millisecond precision.
4. Enable the loop. Restart returns to A while looping, or to the start of the song otherwise.

Shortcuts when focus is outside a control: **Space** play/pause, **[** set A, **]** set B, **L** toggle loop. The loop must be at least 0.25 seconds long. Clear resets its boundaries to the full track.

Audio is opened with a local blob URL. There are no uploads, accounts, analytics, external fonts, or audio processing servers. Reloading the page clears the chosen file and loop.

## Verification and build

```sh
npm install
npx playwright install chromium webkit
npm test
npm run check
npm run test:browser
npm run build
```

The build copies a standalone static app to `dist/`, suitable for any static HTTP host. It needs no backend. The generated 440 Hz MP3 fixture is included; FFmpeg is not required to run tests. Browser tests generate WAV fixtures in memory.

Automated media tests cover Chromium playback, MP3/WAV, pitch preservation, loops, seek behavior, keyboard controls, replacement and error recovery. A spectral capture check verifies the rendered 440 Hz tone stays near 440 Hz at half speed. Desktop and narrow-screen layouts are also checked.

The installed Playwright WebKit runtime on Windows fails to decode even a standalone valid PCM WAV (`MEDIA_ERR_SRC_NOT_SUPPORTED`), so media tests explicitly skip that environment; UI and invalid-file tests still run there. This does not establish Safari playback compatibility. Run the media suite on macOS/Linux to verify that browser separately.

The browser supplies time stretching. Sound quality depends on the recording, browser, and slowdown amount. Loops use frequent position checks and may have small gaps or overshoot, particularly in background tabs. Export, recording, pitch transposition, persistent libraries, and sample-accurate looping are outside this version.


Final verification for this version: **6 unit tests passed, 19 browser tests passed, 15 Windows WebKit audio cases explicitly skipped**. Syntax checks and static build passed. Independent review's two loop precision findings were fixed with failing-then-passing regression tests. No outstanding code findings remain from that review.
