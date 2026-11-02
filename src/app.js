import { parseTime, formatTime, formatLoopTime, validLoop, seekPosition } from './model.js';

const byId = id => document.getElementById(id);
const audio = byId('audio');
const state = { loaded:false, duration:0, rate:1, volume:0.8, loop:{enabled:false,a:0,b:0}, url:null, events:null, generation:0 };
const pitchProperty = ['preservesPitch','webkitPreservesPitch','mozPreservesPitch'].find(key => key in audio);
const loopButtons = [byId('loop-toggle'), byId('quick-loop')];
let playRequest = 0;

function error(message = '') {
  byId('error').textContent = message;
  byId('error').hidden = !message;
}
function loopMessage(message = 'Set points at the playhead or type a timestamp.', invalid = false) {
  byId('loop-message').textContent = message;
  byId('loop-message').classList.toggle('invalid', invalid);
}
function applyAudioSettings() {
  if (pitchProperty) audio[pitchProperty] = true;
  audio.playbackRate = state.rate;
  audio.volume = state.volume;
}
function updateLoopFields() {
  byId('loop-start').value = formatLoopTime(state.loop.a);
  byId('loop-end').value = formatLoopTime(state.loop.b);
}
function paintPosition() {
  const time = state.loaded ? audio.currentTime : 0;
  byId('seek').value = String(time);
  byId('seek').setAttribute('aria-valuetext', `${formatTime(time, true)} of ${formatTime(state.duration, true)}`);
  byId('current-time').textContent = formatTime(time, true);
  byId('timeline').style.setProperty('--position', `${state.duration ? time / state.duration * 100 : 0}%`);
}
function render() {
  document.body.dataset.loaded = String(state.loaded);
  document.body.dataset.playing = String(state.loaded && !audio.paused);
  for (const control of document.querySelectorAll('[data-needs-audio]')) control.disabled = !state.loaded;
  const canLoop = state.loaded && validLoop(state.loop.a, state.loop.b, state.duration);
  for (const button of loopButtons) {
    button.disabled = !canLoop;
    button.setAttribute('aria-pressed', String(state.loop.enabled));
    button.setAttribute('aria-label', `${state.loop.enabled ? 'Disable' : 'Enable'} loop${button.id === 'quick-loop' ? ' shortcut' : ''}`);
  }
  byId('loop-toggle-label').textContent = state.loop.enabled ? 'Loop enabled' : 'Enable loop';
  byId('loop-length').textContent = canLoop ? `${formatTime(state.loop.b - state.loop.a, true)} phrase${state.loop.enabled ? ' · repeating' : ''}` : 'A little repetition goes a long way.';
  byId('timeline').classList.toggle('loop-active', state.loaded && state.loop.enabled);
  byId('timeline').style.setProperty('--a', `${state.duration ? state.loop.a / state.duration * 100 : 0}%`);
  byId('timeline').style.setProperty('--b', `${state.duration ? state.loop.b / state.duration * 100 : 100}%`);
  byId('seek').max = String(state.duration || 1);
  byId('duration').textContent = formatTime(state.duration);
  const playing = state.loaded && !audio.paused;
  byId('play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  byId('play-icon').setAttribute('href', playing ? '#i-pause' : '#i-play');
  byId('playback-status').textContent = !state.loaded ? 'READY WHEN YOU ARE' : playing ? (state.loop.enabled ? 'IN THE LOOP' : 'LISTENING') : 'TAKE IT FROM HERE';
  byId('track-description').textContent = state.loaded ? 'CLICK THE TIMELINE TO SEEK' : 'THE WHOLE SONG, AT YOUR PACE';
  byId('speed').value = String(Math.round(state.rate * 100));
  byId('speed').disabled = !state.loaded || !pitchProperty;
  byId('speed').setAttribute('aria-valuetext', `${Math.round(state.rate * 100)} percent of original speed`);
  byId('speed-value').replaceChildren(document.createTextNode(String(Math.round(state.rate * 100))));
  const unit = document.createElement('span'); unit.textContent = '%'; byId('speed-value').append(unit);
  byId('speed-caption').textContent = state.rate === 1 ? 'Original speed' : state.rate === 0.5 ? 'Half speed. Same pitch.' : 'Slower pace. Same pitch.';
  for (const preset of document.querySelectorAll('[data-speed]')) {
    preset.setAttribute('aria-pressed', String(Number(preset.dataset.speed) === Math.round(state.rate * 100)));
    preset.disabled = !state.loaded || (!pitchProperty && preset.dataset.speed !== '100');
  }
  if (state.loaded && state.duration < 0.25) {
    byId('set-a').disabled = true; byId('set-b').disabled = true;
  }
  for (const [index, label] of [...byId('ruler').children].entries()) label.textContent = state.loaded ? formatTime(state.duration * index / 4) : index === 0 ? '0:00' : '—';
  paintPosition();
}
function releaseFile() {
  state.events?.abort(); state.events = null;
  ++playRequest;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = null;
}
function failFile(message) {
  releaseFile();
  state.loaded = false; state.duration = 0; state.loop = {enabled:false,a:0,b:0};
  byId('file-meta').textContent = 'Try another audio file to keep practicing.';
  error(message); updateLoopFields(); render();
}
function openFile(file) {
  if (!file) return;
  releaseFile();
  const generation = ++state.generation;
  state.loaded = false; state.duration = 0; state.loop = {enabled:false,a:0,b:0};
  byId('file-name').textContent = file.name;
  byId('file-meta').textContent = 'Opening your audio…';
  byId('open-file-label').textContent = 'Change audio';
  error(); loopMessage(); updateLoopFields(); render();
  if (!file.size) { failFile('This file is empty. Choose an MP3, WAV, or another supported audio file.'); return; }
  state.url = URL.createObjectURL(file);
  const url = state.url;
  state.events = new AbortController();
  const { signal } = state.events;
  const current = () => generation === state.generation && state.url === url && audio.currentSrc === url;
  audio.addEventListener('loadedmetadata', () => {
    if (!current()) return;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) { failFile('Couldn’t open this audio. Try a different MP3 or WAV file.'); return; }
    state.duration = audio.duration; state.loaded = true; state.loop = {enabled:false,a:0,b:audio.duration};
    applyAudioSettings(); updateLoopFields();
    const megabytes = file.size / 1024 / 1024;
    byId('file-meta').textContent = `${formatTime(audio.duration)} · ${megabytes < 0.1 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${megabytes.toFixed(1)} MB`} · On your device`;
    if (audio.duration < 0.25) loopMessage('This track is shorter than the 0.25-second minimum loop.');
    render();
  }, {signal});
  audio.addEventListener('error', () => {
    if (generation !== state.generation || state.url !== url) return;
    failFile('Couldn’t open this audio. Your browser may not support its format. Try an MP3 or WAV file.');
  }, {signal});
  audio.src = url; applyAudioSettings(); audio.load();
}
async function play() {
  if (!state.loaded) return;
  const generation = state.generation;
  const request = ++playRequest;
  const position = audio.ended || audio.currentTime >= state.duration ? (state.loop.enabled ? state.loop.a : 0) : seekPosition(audio.currentTime, state.duration, state.loop);
  if (position !== audio.currentTime) audio.currentTime = position;
  applyAudioSettings();
  try { await audio.play(); if (generation === state.generation && request === playRequest) error(); }
  catch (cause) {
    if (generation === state.generation && request === playRequest && cause.name !== 'AbortError') error('Playback couldn’t start. Press Play again, or try a different audio file.');
  }
  render();
}
function togglePlay() {
  if (!state.loaded) return;
  if (audio.paused) void play();
  else { ++playRequest; audio.pause(); render(); }
}
function enforceLoop() {
  if (!state.loaded || !state.loop.enabled || audio.paused || audio.seeking) return;
  const position = seekPosition(audio.currentTime, state.duration, state.loop);
  if (position !== audio.currentTime) audio.currentTime = position;
}
function toggleLoop() {
  if (!state.loaded || !validLoop(state.loop.a, state.loop.b, state.duration)) return;
  state.loop.enabled = !state.loop.enabled;
  if (state.loop.enabled) audio.currentTime = seekPosition(audio.currentTime, state.duration, state.loop);
  loopMessage(state.loop.enabled ? 'Repeating A to B. Adjust either point whenever you like.' : undefined);
  render();
}
function commitPoint(which, value) {
  if (!state.loaded) return;
  const next = {...state.loop, [which]:value};
  if (value === null || !validLoop(next.a, next.b, state.duration)) {
    loopMessage('Use a valid timestamp; A and B must be within the track and at least 0.25 seconds apart.', true);
    updateLoopFields(); return;
  }
  state.loop = next;
  if (next.enabled) audio.currentTime = seekPosition(audio.currentTime, state.duration, next);
  loopMessage(); updateLoopFields(); render();
}
function setPoint(which) { commitPoint(which, audio.currentTime); }
function speed(percent) {
  if (!state.loaded || !pitchProperty) return;
  state.rate = Math.max(25, Math.min(100, percent)) / 100;
  applyAudioSettings(); render();
}

byId('open-file').addEventListener('click', () => byId('file-input').click());
byId('file-input').addEventListener('change', event => { const file = event.target.files[0]; event.target.value = ''; openFile(file); });
const dropZone = byId('drop-zone');
for (const type of ['dragenter','dragover']) dropZone.addEventListener(type, event => { event.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', event => { if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', event => {
  event.preventDefault(); dropZone.classList.remove('dragging');
  if (event.dataTransfer.files.length > 1) { error('Choose one audio file at a time.'); return; }
  openFile(event.dataTransfer.files[0]);
});
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());
byId('play').addEventListener('click', togglePlay);
byId('restart').addEventListener('click', () => { if (state.loaded) { audio.currentTime = state.loop.enabled ? state.loop.a : 0; paintPosition(); } });
byId('seek').addEventListener('input', event => { if (state.loaded) { audio.currentTime = seekPosition(Number(event.target.value), state.duration, state.loop); paintPosition(); } });
byId('speed').addEventListener('input', event => speed(Number(event.target.value)));
for (const preset of document.querySelectorAll('[data-speed]')) preset.addEventListener('click', () => speed(Number(preset.dataset.speed)));
byId('volume').addEventListener('input', event => { state.volume = Number(event.target.value) / 100; audio.volume = state.volume; });
for (const button of loopButtons) button.addEventListener('click', toggleLoop);
byId('clear-loop').addEventListener('click', () => {
  if (!state.loaded) return;
  state.loop = {enabled:false,a:0,b:state.duration}; loopMessage(); updateLoopFields(); render();
});
byId('set-a').addEventListener('click', () => setPoint('a'));
byId('set-b').addEventListener('click', () => setPoint('b'));
for (const [id, point] of [['loop-start','a'],['loop-end','b']]) {
  byId(id).addEventListener('change', event => commitPoint(point, parseTime(event.target.value)));
  byId(id).addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); event.target.blur(); } });
}
for (const event of ['play','pause']) audio.addEventListener(event, render);
audio.addEventListener('timeupdate', () => { enforceLoop(); paintPosition(); });
audio.addEventListener('seeked', paintPosition);
audio.addEventListener('ended', () => {
  if (state.loaded && state.loop.enabled) { audio.currentTime = state.loop.a; void play(); }
  else render();
});
document.addEventListener('keydown', event => {
  if (!state.loaded || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) return;
  if (event.target.closest('input,button,a,select,textarea,[contenteditable="true"],[role="button"]')) return;
  if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
  else if (event.key === '[') { event.preventDefault(); setPoint('a'); }
  else if (event.key === ']') { event.preventDefault(); setPoint('b'); }
  else if (event.key.toLowerCase() === 'l') { event.preventDefault(); toggleLoop(); }
});
// Short phrases need more frequent checks than timeupdate. Browser timer throttling
// still makes background playback best effort rather than sample accurate.
setInterval(() => { enforceLoop(); if (state.loaded && !audio.paused) paintPosition(); }, 25);
window.addEventListener('pagehide', event => { if (event.persisted) audio.pause(); else releaseFile(); });
if (!pitchProperty) {
  byId('pitch-badge').textContent = 'Pitch lock unavailable';
  byId('notice').hidden = false;
  byId('notice').textContent = 'This browser cannot confirm pitch preservation. Slowdown is disabled; use a current Chrome, Edge, Firefox, or Safari browser.';
}
applyAudioSettings(); render();

