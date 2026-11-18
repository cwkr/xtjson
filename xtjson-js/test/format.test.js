// Unit tests for format.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { format, parse } from '../xtjson.js';

const corpus = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'));

/** Valid texts of the corpus and the specification. */
function validTexts() {
  const texts = [
    ...corpus.ref_valid.map(([text]) => text),
    ...corpus.ref_json_samples,
    ...corpus.a_valid.map(([text]) => text),
    ...corpus.b_valid.map(([text]) => text),
    ...corpus.c_valid.map(([text]) => text),
    ...corpus.d_valid.map(([text]) => text),
  ];
  for (const lang of ['de', 'en']) {
    const path = fileURLToPath(new URL(`../../docs/xtjson-spec-${lang}.md`, import.meta.url));
    if (!existsSync(path)) continue;
    for (const m of readFileSync(path, 'utf8').matchAll(/```xtjson\n([^]*?)```/g)) texts.push(m[1]);
  }
  return texts;
}

describe('format', () => {
  test('lays out objects and arrays like JSON.stringify', () => {
    assert.equal(format('{"a":[1,2],"b":{}}', 2), '{\n  "a": [\n    1,\n    2\n  ],\n  "b": {}\n}');
    assert.equal(format('a:1\nb:[ ]', '\t'), 'a: 1\nb: []');
    assert.equal(format('{ "a" : [ 1 , 2 ] }'), '{"a":[1,2]}');
  });

  test('keeps comments and the notation of names and values', () => {
    const text = "# head\nname:'demo' // note\nsize: 64mb, /* c */ port: 0x1F";
    assert.equal(format(text, 2), "# head\nname: 'demo' // note\nsize: 64mb, /* c */\nport: 0x1F");
  });

  test('keeps one blank line between items', () => {
    assert.equal(format('a: 1\n\n\n\nb: 2', 2), 'a: 1\n\nb: 2');
  });

  test('without indentation, a line break that separates items becomes a comma', () => {
    assert.equal(format('a: 1\nb: [1\n2]'), 'a:1,b:[1,2]');
    assert.equal(format('a: 1 // c\nb: 2'), 'a:1 // c\nb:2');
  });

  test('re-indents strings across several lines that begin with an empty line', () => {
    assert.equal(format('a: {b: "\n      x\n        y\n      "}', 2), 'a: {\n  b: "\n    x\n      y\n    "\n}');
    assert.equal(format("a: ['\n      x\n      ']", 2), "a: [\n  '\n    x\n    '\n]");
    assert.equal(format('a: "x\n      y"', 2), 'a: "x\n      y"');
  });

  test('keeps line continuations and the white space before them', () => {
    assert.equal(format('a: {b: "\n      long \\\n      line\\\n      "}', 2), 'a: {\n  b: "\n    long \\\n    line\\\n    "\n}');
  });

  test('leaves strings with white space after a backslash unchanged', () => {
    const text = 'a: {b: "\n      x\\  \n      "}';
    assert.equal(format(text, 2), 'a: {\n  b: "\n      x\\  \n      "\n}');
  });

  test('a string across several lines is one token', () => {
    assert.equal(format('a: "x\n// no comment\n[1, 2]"', 2), 'a: "x\n// no comment\n[1, 2]"');
    assert.equal(format('a: "x\ny"\nb: 1'), 'a:"x\ny",b:1');
  });

  test('space works as in JSON.stringify', () => {
    assert.equal(format('[1]', 20), '[\n          1\n]');
    assert.equal(format('[1]', ''), '[1]');
    assert.throws(() => format('[1]', 'ab'), TypeError);
    assert.throws(() => format('[1]', true), TypeError);
  });

  test('lays out the directive like a member', () => {
    const text = '%strict:true\n# c\n\nid: 1\nproxy: nil';
    assert.equal(format(text, 2), '%strict: true\n# c\n\nid: 1\nproxy: nil');
    assert.equal(format(text), '%strict:true # c\nid:1,proxy:nil');
    assert.equal(format('%strict:\n  true,[1]', 2), '%strict: true,\n[\n  1\n]');
  });

  test('valid documents keep their value and formatting is stable', () => {
    for (const text of validTexts()) {
      const expected = parse(text);
      for (const space of [2, '\t', 0]) {
        const formatted = format(text, space);
        assert.deepEqual(parse(formatted), expected, `${JSON.stringify(text)} with ${JSON.stringify(space)}`);
        assert.equal(format(formatted, space), formatted, `stable: ${JSON.stringify(text)}`);
      }
    }
  });

  test('invalid documents are formatted without an error', () => {
    for (const text of [...corpus.ref_invalid, ...corpus.a_invalid, ...corpus.b_invalid, ...corpus.c_invalid, ...corpus.d_invalid]) {
      assert.equal(typeof format(text, 2), 'string');
      assert.equal(typeof format(text), 'string');
    }
  });
});
