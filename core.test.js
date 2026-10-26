// Сверка ключа с бланком Люсина. Запуск: node emin/core.test.js
import assert from 'node:assert/strict';
import { QUESTIONS, SUB, SCALES, score, levelOf } from './core.js';

assert.equal(QUESTIONS.length, 46);
const all = Object.values(SUB).flatMap((s) => [...s.direct, ...s.reverse]).sort((a, b) => a - b);
assert.deepEqual(all, Array.from({ length: 46 }, (_, i) => i + 1), 'каждое утверждение ровно в одной субшкале');

// Списки из бланка для шкал второго уровня.
const sheet = {
  MEI: [[1,3,9,11,13,15,17,20,24,27,29,32,34,36],[2,5,30,38,40,42,44,46]],
  VEI: [[4,7,14,19,21,23,25,26,28,37],[6,8,10,12,16,18,22,31,33,35,39,41,43,45]],
  PE:  [[1,3,7,11,13,14,20,26,27,29,32,34],[8,18,22,31,35,38,41,42,45,46]],
  UE:  [[4,9,15,17,19,21,23,24,25,28,36,37],[2,5,6,10,12,16,30,33,39,40,43,44]],
  OEI: [[1,3,4,7,9,11,13,14,15,17,19,20,21,23,24,25,26,27,28,29,32,34,36,37],
        [2,5,6,8,10,12,16,18,22,30,31,33,35,38,39,40,41,42,43,44,45,46]],
};
const byList = (ans, [d, r]) => d.reduce((t, n) => t + ans[n - 1], 0) + r.reduce((t, n) => t + 3 - ans[n - 1], 0);
for (let i = 0; i < 500; i++) {
  const ans = Array.from({ length: 46 }, () => Math.floor(Math.random() * 4));
  const r = score(ans);
  for (const k of Object.keys(sheet)) assert.equal(r[k].score, byList(ans, sheet[k]), k);
}
const top = score(Array(46).fill(3)), zero = score(Array(46).fill(0));
assert.equal(top.OEI.max, 138);
assert.equal(top.OEI.score + zero.OEI.score, 138);
assert.equal(levelOf('OEI', 71), 0); assert.equal(levelOf('OEI', 72), 1);
assert.equal(levelOf('OEI', 92), 2); assert.equal(levelOf('OEI', 93), 3); assert.equal(levelOf('OEI', 105), 4);
assert.throws(() => score([1, 2]));
console.log('ключ сходится с бланком');

const { norm01, partial, typeOf } = await import('./core.js');
assert.equal(norm01('OEI', 0), 0);
assert.equal(norm01('OEI', 138), 1);
assert.ok(norm01('OEI', 79) === 0.4 && norm01('OEI', 93) === 0.6, 'средний уровень занимает 0.4–0.6');
assert.equal(partial(Array(46).fill(null)).MP, 0.5);
assert.equal(typeOf(score(Array(46).fill(3).map((v, i) => (SUB.MP.reverse.includes(i + 1) || Object.values(SUB).some((s) => s.reverse.includes(i + 1))) ? 0 : 3))), 'conductor');
console.log('нормировка и типы в порядке');
