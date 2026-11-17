// Tests for formatText, the adapter between the editor settings and format.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { formatText } from '../src/format.js';

const spaces = (tabSize) => ({ tabSize, insertSpaces: true });

describe('formatText', () => {
  test('uses the indentation of the editor', () => {
    assert.equal(formatText('a: {b: 1}', spaces(2)), 'a: {\n  b: 1\n}');
    assert.equal(formatText('a: {b: 1}', spaces(4)), 'a: {\n    b: 1\n}');
    assert.equal(formatText('a: {b: 1}', { tabSize: 4, insertSpaces: false }), 'a: {\n\tb: 1\n}');
  });

  test('limits the indentation to 10 spaces, as format does', () => {
    assert.equal(formatText('[1]', spaces(12)), `[\n${' '.repeat(10)}1\n]`);
  });

  test('keeps a line break at the end of the document', () => {
    assert.equal(formatText('a:1\n', spaces(2)), 'a: 1\n');
    assert.equal(formatText('a:1\r\n', spaces(2)), 'a: 1\n');
    assert.equal(formatText('a:1', spaces(2)), 'a: 1');
    assert.equal(formatText('\n', spaces(2)), '');
  });

  test('lays out directives like members', () => {
    assert.equal(formatText("%version:'0.6',%define:nil=null\nx:nil\n", spaces(2)), "%version: '0.6',\n%define: nil = null\nx: nil\n");
  });

  test('keeps comments', () => {
    assert.equal(formatText('# head\na:1 // note\n', spaces(2)), '# head\na: 1 // note\n');
  });
});
