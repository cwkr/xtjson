// Shared conformance corpus (CLAUDE.md, "Test against the shared cases").
//
// corpus.json is generated from scripts/xtjson_ref.py and scripts/tests_*.py
// by scripts/export_corpus.py. Do not edit it; run the script again when
// those cases change (`--check` tells whether it is up to date).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import XTJSON, { XTJSONError } from '../xtjson.js';

const corpus = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'));

/** Definitions of scripts/tests_definitionen.py (`D`). */
const D = {
  values: corpus.c_values,
  suffixes: {
    '%': (x) => x / 100,
    '$': (x) => x * 100,
    px: (x) => x,
    y: (x) => x,
    wx: (x) => x,
    '%%': (x) => x / 10000,
    'k%': (x) => x * 10,
    q: () => 'kein Zahlwert',
    r: () => Infinity,
    s: () => true,
    t: () => { throw new Error('division by zero'); },
  },
};

/** Definitions that the examples in the specification assume (EXAMPLE_DEFS). */
const EXAMPLE_DEFS = {
  values: { nil: null, zero: 0, unbekannt: 'keine Angaben', unknown: 'not specified' },
  suffixes: { '%': (x) => x / 100 },
};

function defsFor(label) {
  return label === 'D' ? D : label;
}

function show(text) {
  return JSON.stringify(text);
}

function assertValid(text, expected, defs) {
  let actual;
  try {
    actual = XTJSON.parse(text, null, defs);
  } catch (error) {
    assert.fail(`should be valid: ${show(text)} (${error.message})`);
  }
  assert.deepEqual(actual, expected, `value of ${show(text)}`);
}

function assertInvalid(text, defs) {
  assert.throws(() => XTJSON.parse(text, null, defs), XTJSONError, `should be invalid: ${show(text)}`);
}

const groups = [
  ['xtjson_ref.py', 'ref'],
  ['tests_zeilenumbruch_strings.py', 'a'],
  ['tests_mehrzeilige_strings.py', 'b'],
];

for (const [file, key] of groups) {
  test(`${file}: valid texts`, () => {
    for (const [text, expected] of corpus[`${key}_valid`]) assertValid(text, expected);
  });
  test(`${file}: invalid texts`, () => {
    for (const text of corpus[`${key}_invalid`]) assertInvalid(text);
  });
}

test('xtjson_ref.py: JSON texts give the same value as JSON.parse', () => {
  for (const text of corpus.ref_json_samples) {
    assert.deepEqual(XTJSON.parse(text), JSON.parse(text), show(text));
  }
});

test('xtjson_ref.py: duplicate names are rejected only in I-JSON mode', () => {
  for (const text of ['{a: 1, "a": 2}', "a: 1\n'\\u0061': 2"]) {
    assert.deepEqual(XTJSON.parse(text), { a: 2 });
    assert.throws(() => XTJSON.parse(text, { ijson: true }), /Duplicate name "a"/);
  }
});

test('I-JSON mode: valid texts give the same value or an I-JSON error', () => {
  const all = [...corpus.ref_valid, ...corpus.a_valid, ...corpus.b_valid, ...corpus.ref_json_samples.map((t) => [t, JSON.parse(t)])];
  let rejected = 0;
  for (const [text, expected] of all) {
    let actual;
    try {
      actual = XTJSON.parse(text, { ijson: true });
    } catch (error) {
      assert.match(error.message, /I-JSON mode/, show(text));
      rejected++;
      continue;
    }
    assert.deepEqual(actual, expected, show(text));
  }
  assert.ok(rejected > 0 && rejected < 10, `rejected ${rejected}`);
});

test('tests_definitionen.py: the suffixes of D are reproduced here', () => {
  assert.deepEqual(Object.keys(D.suffixes).sort(), [...corpus.c_suffixes].sort());
});

test('tests_definitionen.py: valid texts', () => {
  for (const [text, label, expected] of corpus.c_valid) assertValid(text, expected, defsFor(label));
});

test('tests_definitionen.py: invalid texts', () => {
  for (const [text, label] of corpus.c_invalid) assertInvalid(text, defsFor(label));
});

test('tests_definitionen.py: invalid definitions are a TypeError, not an XTJSONError', () => {
  const bad = [
    { values: { true: 1 } }, { values: { false: false } }, { values: { null: null } },
    { values: { 'a-b': 1 } }, { values: { '1a': 1 } }, { values: { '': 1 } }, { values: { 'ä': 1 } },
    { values: { x: NaN } }, { values: { x: new (class X {})() } }, { values: { x: new Set([1, 2]) } },
    { suffixes: { k: Math.abs } }, { suffixes: { K: Math.abs } }, { suffixes: { KB: Math.abs } },
    { suffixes: { mB: Math.abs } }, { suffixes: { a: Math.abs } }, { suffixes: { e: Math.abs } },
    { suffixes: { F: Math.abs } }, { suffixes: { abc: Math.abs } }, { suffixes: { ghi: Math.abs } },
    { suffixes: { k1: Math.abs } }, { suffixes: { '': Math.abs } }, { suffixes: { g_: Math.abs } },
    { suffixes: { '%': null } }, { suffixes: { px: 2 } },
    { suffixes: { x: Math.abs } }, { suffixes: { X: Math.abs } }, { suffixes: { o: Math.abs } },
    { suffixes: { O: Math.abs } }, { suffixes: { xy: Math.abs } }, { suffixes: { Ox: Math.abs } },
  ];
  for (const defs of bad) {
    assert.throws(() => XTJSON.parse('1', null, defs), (error) => {
      return error instanceof TypeError && !(error instanceof XTJSONError);
    }, JSON.stringify(Object.keys(defs.values ?? defs.suffixes)));
  }
});

test('tests_definitionen.py: results do not change the definitions', () => {
  const a = XTJSON.parse('liste', null, D);
  a.push(99);
  a[1].a = 3;
  assert.deepEqual(XTJSON.parse('liste', null, D), [1, { a: 2 }]);
});

// Examples of the specification (as in xtjson_ref.py): every block tagged
// xtjson must parse, and a directly following json block must be equal.
for (const lang of ['de', 'en']) {
  const path = fileURLToPath(new URL(`../../docs/xtjson-spec-${lang}.md`, import.meta.url));
  test(`examples of xtjson-spec-${lang}.md`, { skip: !existsSync(path) && 'specification not found' }, () => {
    const md = readFileSync(path, 'utf8');
    const blocks = [...md.matchAll(/```(\w+)\n([^]*?)```/g)].map((m) => [m[1], m[2]]);
    let count = 0;
    blocks.forEach(([tag, body], i) => {
      if (tag !== 'xtjson') return;
      count++;
      const value = XTJSON.parse(body, null, EXAMPLE_DEFS);
      if (blocks[i + 1]?.[0] === 'json') {
        assert.deepEqual(value, JSON.parse(blocks[i + 1][1]), `example ${count}`);
      }
    });
    assert.ok(count > 0);
  });
}
