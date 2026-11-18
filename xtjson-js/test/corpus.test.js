// Shared conformance corpus (CLAUDE.md, "Test against the shared cases").
//
// corpus.json is generated from scripts/xtjson_ref.py and scripts/tests_*.py
// by scripts/export_corpus.py. Do not edit it; run the script again when
// those cases change (`--check` tells whether it is up to date).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parse, parseDocument, ParserError } from '../xtjson.js';

const corpus = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'));

function show(text) {
  return JSON.stringify(text);
}

/**
 * The value with every BigInt converted to a number. This implementation
 * returns integers with the suffix n as BigInt; the corpus gives their
 * value as a number.
 */
function asNumbers(value) {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(asNumbers);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, asNumbers(v)]));
  }
  return value;
}

function assertValid(text, expected) {
  let actual;
  try {
    actual = parse(text);
  } catch (error) {
    assert.fail(`should be valid: ${show(text)} (${error.message})`);
  }
  assert.deepEqual(asNumbers(actual), expected, `value of ${show(text)}`);
}

function assertInvalid(text) {
  assert.throws(() => parse(text), ParserError, `should be invalid: ${show(text)}`);
}

const groups = [
  ['xtjson_ref.py', 'ref'],
  ['tests_zeilenumbruch_strings.py', 'a'],
  ['tests_mehrzeilige_strings.py', 'b'],
  ['tests_definitionen.py', 'c'],
  ['tests_direktiven.py', 'd'],
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
    assert.deepEqual(parse(text), JSON.parse(text), show(text));
  }
});

test('tests_direktiven.py: strict mode of the application, valid texts', () => {
  for (const [text, expected] of corpus.d_strict_valid) {
    let actual;
    try {
      actual = parse(text, { strict: true });
    } catch (error) {
      assert.fail(`should be valid in strict mode: ${show(text)} (${error.message})`);
    }
    assert.deepEqual(actual, expected, show(text));
  }
});

test('tests_direktiven.py: strict mode of the application, invalid texts', () => {
  for (const text of corpus.d_strict_invalid) {
    assert.doesNotThrow(() => parse(text), `should be valid without strict mode: ${show(text)}`);
    assert.throws(() => parse(text, { strict: true }), ParserError, `should be invalid in strict mode: ${show(text)}`);
  }
});

test('strict mode: valid texts give the same value or a strict mode error', () => {
  const all = [
    ...corpus.ref_valid, ...corpus.a_valid, ...corpus.b_valid, ...corpus.c_valid, ...corpus.d_valid,
    ...corpus.ref_json_samples.map((t) => [t, JSON.parse(t)]),
  ];
  let rejected = 0;
  for (const [text, expected] of all) {
    let actual;
    try {
      actual = parse(text, { strict: true });
    } catch (error) {
      assert.match(error.message, /strict mode/, show(text));
      rejected++;
      continue;
    }
    assert.deepEqual(asNumbers(actual), expected, show(text));
  }
  // many texts of the corpus have a string or a number as their root value
  assert.ok(rejected > 0 && rejected < all.length, `rejected ${rejected}`);
});

test('tests_direktiven.py: version statements', () => {
  for (const [text, expected] of corpus.d_versions) {
    assert.deepEqual(Object.fromEntries(parseDocument(text).versions), expected, show(text));
  }
});

test('tests_definitionen.py: the application cannot define named values or suffixes', () => {
  assert.throws(() => parse('nil', { namedValues: { nil: null } }), (error) => {
    return error instanceof TypeError && /defined in the document with %define/.test(error.message);
  });
  assert.throws(() => parse('1', { suffixes: { q: Math.abs } }), TypeError);
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
      const value = parse(body);
      if (blocks[i + 1]?.[0] === 'json') {
        assert.deepEqual(value, JSON.parse(blocks[i + 1][1]), `example ${count}`);
      }
    });
    assert.ok(count > 0);
  });
}
