export function parseTime(text) {
  const value = String(text).trim();
  if (!/^(?:\d+(?:\.\d+)?|\d+:[0-5]\d(?:\.\d+)?)$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  const seconds = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  return Number.isFinite(seconds) ? seconds : null;
}

export function formatTime(seconds, precise = false) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const ticks = precise ? Math.round(safe * 10) : Math.floor(safe);
  const scale = precise ? 10 : 1;
  const minutes = Math.floor(ticks / (60 * scale));
  const rest = (ticks % (60 * scale)) / scale;
  return `${minutes}:${(precise ? rest.toFixed(1) : String(rest)).padStart(precise ? 4 : 2, '0')}`;
}

export function validLoop(a, b, duration) {
  return [a, b, duration].every(Number.isFinite) && a >= 0 && b <= duration && b - a >= 0.25 - 1e-9;
}

export function seekPosition(target, duration, loop) {
  const safe = Math.max(0, Math.min(Number.isFinite(target) ? target : 0, duration));
  if (loop?.enabled && validLoop(loop.a, loop.b, duration) && (safe < loop.a || safe >= loop.b)) return loop.a;
  return safe;
}


// Editable bounds keep milliseconds. Flooring avoids displaying a file-end value
// beyond the actual duration; the tiny epsilon only absorbs binary round-off.
export function formatLoopTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const milliseconds = Math.floor(safe * 1000 + 1e-7);
  const whole = Math.floor(milliseconds / 1000);
  const fraction = String(milliseconds % 1000).padStart(3, '0').replace(/0+$/, '') || '0';
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${fraction}`;
}
