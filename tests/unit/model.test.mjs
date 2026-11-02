import test from 'node:test';
import assert from 'node:assert/strict';
const { parseTime, formatTime, formatLoopTime, validLoop, seekPosition } = await import('../../src/model.js').catch(() => ({}));

test('parses seconds and minute timestamps without accepting malformed input', () => {
  for (const [input, want] of [['1:23.4',83.4], ['12.5',12.5], ['0:00',0], [' 2:03.25 ',123.25]]) assert.equal(parseTime(input), want);
  for (const input of ['', '-1', '1:60', '1:2', '1:02:03', 'NaN', 'Infinity', '1e2', '0x10', '.']) assert.equal(parseTime(input), null, input);
});
test('formats rounded time with a carry across minutes', () => {
  assert.equal(formatTime(59.96, true), '1:00.0');
  assert.equal(formatTime(83.4, true), '1:23.4');
  assert.equal(formatTime(83.9), '1:23');
  assert.equal(formatTime(NaN), '0:00');
});
test('requires a finite in-bounds loop of at least one quarter second', () => {
  assert.equal(validLoop(1, 1.25, 6), true);
  for (const [a,b,d] of [[1,1.249,6],[-1,2,6],[2,1,6],[0,7,6],[0,1,Infinity],[NaN,2,6],[0,0,0]]) assert.equal(validLoop(a,b,d), false);
});
test('keeps seeks inside the file and enabled half-open loop', () => {
  assert.equal(seekPosition(-5, 6, null), 0);
  assert.equal(seekPosition(9, 6, null), 6);
  assert.equal(seekPosition(3, 6, {enabled:true,a:1,b:2}), 1);
  assert.equal(seekPosition(0, 6, {enabled:true,a:1,b:2}), 1);
  assert.equal(seekPosition(1.5, 6, {enabled:true,a:1,b:2}), 1.5);
  assert.equal(seekPosition(2, 6, {enabled:true,a:1,b:2}), 1);
  assert.equal(seekPosition(3, 6, {enabled:false,a:1,b:2}), 3);
});


test('accepts exact quarter-second decimal loops but rejects measurably shorter phrases', () => {
  assert.equal(validLoop(0.04, 0.29, 6), true);
  assert.equal(validLoop(0.04, 0.289999, 6), false);
});
test('editable loop timestamps retain millisecond precision without exceeding the file end', () => {
  assert.equal(formatLoopTime(0.26), '0:00.26');
  assert.equal(formatLoopTime(0.51), '0:00.51');
  assert.equal(formatLoopTime(119.9998), '1:59.999');
  assert.equal(formatLoopTime(6), '0:06.0');
});
