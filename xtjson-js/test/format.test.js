// Unit tests for format.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { format, parse } from '../xtjson.js';

const corpus = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'));
const EXAMPLE_DEFS = {
  namedValues: { nil: null, zero: 0, unbekannt: 'keine Angaben', unknown: 'not specified' },
};

/** Valid texts of the corpus and the specification, with their options. */
function validTexts() {
  const texts = [
    ...corpus.ref_valid.map(([text]) => [text, null]),
    ...corpus.ref_json_samples.map((text) => [text, null]),
    ...corpus.a_valid.map(([text]) => [text, null]),
    ...corpus.b_valid.map(([text]) => [text, null]),
    ...corpus.c_valid.map(([text, label]) => [
      text,
      label === 'D' ? { namedValues: corpus.c_values } : label && { namedValues: label.values },
    ]),
  ];
  for (const lang of ['de', 'en']) {
    const path = fileURLToPath(new URL(`../../docs/xtjson-spec-${lang}.md`, import.meta.url));
    if (!existsSync(path)) continue;
    for (const m of readFileSync(path, 'utf8').matchAll(/```xtjson\n([^]*?)```/g)) texts.push([m[1], EXAMPLE_DEFS]);
  }
  return texts;
}

describe('format', () => {
  test('lays out objects and arrays like stringify', () => {
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

  test('re-indents multi-line strings that begin with an empty line', () => {
    assert.equal(format('a: {b: """\n      x\n        y\n      """}', 2), 'a: {\n  b: """\n    x\n      y\n    """\n}');
    assert.equal(format('a: """x\n      y"""', 2), 'a: """x\n      y"""');
  });

  test('space works as in stringify', () => {
    assert.equal(format('[1]', 20), '[\n          1\n]');
    assert.equal(format('[1]', ''), '[1]');
    assert.throws(() => format('[1]', 'ab'), TypeError);
    assert.throws(() => format('[1]', true), TypeError);
  });

  test('valid documents keep their value and formatting is stable', () => {
    for (const [text, options] of validTexts()) {
      const expected = parse(text, null, options);
      for (const space of [2, '\t', 0]) {
        const formatted = format(text, space);
        assert.deepEqual(parse(formatted, null, options), expected, `${JSON.stringify(text)} with ${JSON.stringify(space)}`);
        assert.equal(format(formatted, space), formatted, `stable: ${JSON.stringify(text)}`);
      }
    }
  });

  test('invalid documents are formatted without an error', () => {
    for (const text of [...corpus.ref_invalid, ...corpus.a_invalid, ...corpus.b_invalid]) {
      assert.equal(typeof format(text, 2), 'string');
      assert.equal(typeof format(text), 'string');
    }
  });
});
