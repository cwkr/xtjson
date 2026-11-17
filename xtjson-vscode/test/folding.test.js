// Tests for the folding ranges.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { foldingRanges } from '../src/folding.js';

describe('foldingRanges', () => {
  test('objects and arrays fold up to the line before the closing bracket', () => {
    const text = 'listen: {\n  host: "x"\n  ports: [\n    1\n    2\n  ]\n}\nempty: {}';
    assert.deepEqual(foldingRanges(text), [
      { start: 0, end: 5 },
      { start: 2, end: 4 },
    ]);
  });

  test('brackets in strings and comments are ignored', () => {
    const text = 'a: {\n  b: "{["  // ]}\n  c: \'}\'\n  /* } */\n}';
    assert.deepEqual(foldingRanges(text), [{ start: 0, end: 3 }]);
  });

  test('strings across several lines and block comments', () => {
    const text = '/* one\n   two */\nmotd: "\n  Welcome. }\n  Bye. \\"\n  "\nx: 1';
    assert.deepEqual(foldingRanges(text), [
      { start: 0, end: 1, kind: 'comment' },
      { start: 2, end: 4 },
    ]);
  });

  test('runs of line comments, but not comments after a token', () => {
    const text = '# one\n// two\n# three\na: 1 // x\nb: 2 // y\n\n// alone';
    assert.deepEqual(foldingRanges(text), [{ start: 0, end: 2, kind: 'comment' }]);
  });

  test('regions', () => {
    const text = '// #region Limits\na: 1\n#region inner\nb: 2\n#endregion\n// #endregion';
    assert.deepEqual(foldingRanges(text), [
      { start: 0, end: 5, kind: 'region' },
      { start: 2, end: 4, kind: 'region' },
    ]);
  });

  test('CR and CR LF are line breaks', () => {
    assert.deepEqual(foldingRanges('a: [\r\n  1\r\n]'), [{ start: 0, end: 1 }]);
    assert.deepEqual(foldingRanges('a: [\r  1\r]'), [{ start: 0, end: 1 }]);
    assert.deepEqual(foldingRanges('a: "\r\n  x\r\n  "\r\n'), [{ start: 0, end: 1 }]);
    assert.deepEqual(foldingRanges("a: '\r  x\\\r  y\r  '\rb: [\r1\r]"), [{ start: 0, end: 2 }, { start: 4, end: 5 }]);
  });

  test('values of directives fold like other values', () => {
    const text = "%version: '0.6'\n%define: address = {\n  city: 'x'\n  lines: [\n    1\n  ]\n}\n\nhome: address";
    assert.deepEqual(foldingRanges(text), [
      { start: 1, end: 5 },
      { start: 3, end: 4 },
    ]);
  });

  test('brackets in a string across several lines are ignored', () => {
    assert.deepEqual(foldingRanges('a: [\n  "x\n  ]"\n]'), [{ start: 0, end: 2 }]);
  });

  test('U+2028 is not a line break', () => {
    assert.deepEqual(foldingRanges('a: [  1 ]'), []);
  });

  test('unmatched brackets are skipped', () => {
    assert.deepEqual(foldingRanges('a: [\n  {\n  1\n]'), [{ start: 0, end: 2 }]);
    assert.deepEqual(foldingRanges('a: [\n}\n]'), [{ start: 0, end: 1 }]);
  });
});
