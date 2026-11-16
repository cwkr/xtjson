// Tests for the TextMate grammar, tokenized with the libraries VS Code uses.

import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import vsctm from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';

const require = createRequire(import.meta.url);
let grammar;

before(async () => {
  const wasm = readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (s) => new oniguruma.OnigString(s),
    }),
    loadGrammar: async () =>
      vsctm.parseRawGrammar(readFileSync(new URL('../syntaxes/xtjson.tmLanguage.json', import.meta.url), 'utf8'), 'xtjson.tmLanguage.json'),
  });
  grammar = await registry.loadGrammar('source.xtjson');
});

/** Tokenizes a document; returns [text, innermost scope] for every token that is not only spaces. */
function tokens(text) {
  const result = [];
  let state = vsctm.INITIAL;
  for (const line of text.split('\n')) {
    const r = grammar.tokenizeLine(line, state);
    for (const t of r.tokens) {
      const s = line.slice(t.startIndex, t.endIndex);
      if (!/^ *$/.test(s)) result.push([s, t.scopes[t.scopes.length - 1]]);
    }
    state = r.ruleStack;
  }
  return result;
}

/** The innermost scope of the token that is exactly `s`. */
function scopeOf(text, s) {
  const found = tokens(text).find(([t]) => t === s);
  assert.ok(found, `no token ${JSON.stringify(s)} in ${JSON.stringify(tokens(text))}`);
  return found[1];
}

describe('grammar', () => {
  test('comments', () => {
    assert.equal(scopeOf('#!/usr/bin/env xtjson-tool', '!/usr/bin/env xtjson-tool'), 'comment.line.number-sign.xtjson');
    assert.equal(scopeOf('a: 1 // note', ' note'), 'comment.line.double-slash.xtjson');
    assert.equal(scopeOf('/* a\n  b */ x: 1', '  b '), 'comment.block.xtjson');
    assert.equal(scopeOf('/* a\n  b */ x: 1', 'x'), 'support.type.property-name.xtjson');
  });

  test('names', () => {
    assert.equal(scopeOf('$schema: 1', '$schema'), 'support.type.property-name.xtjson');
    assert.equal(scopeOf('{"max-age" : 1}', 'max-age'), 'support.type.property-name.xtjson');
    assert.equal(scopeOf("{'a\\'b': 1}", '\\\''), 'constant.character.escape.xtjson');
    assert.equal(scopeOf('{nil: nil}', 'nil'), 'support.type.property-name.xtjson');
    assert.deepEqual(tokens('{nil: nil}').filter(([t]) => t === 'nil').map(([, s]) => s), [
      'support.type.property-name.xtjson',
      'variable.other.constant.xtjson',
    ]);
  });

  test('named values', () => {
    for (const v of ['true', 'false', 'null']) assert.equal(scopeOf(`a: ${v}`, v), 'constant.language.xtjson');
    assert.equal(scopeOf('a: unknown', 'unknown'), 'variable.other.constant.xtjson');
    assert.equal(scopeOf('a: True', 'True'), 'variable.other.constant.xtjson');
  });

  test('strings and escapes', () => {
    assert.equal(scopeOf('a: "x # y"', 'x # y'), 'string.quoted.double.xtjson');
    assert.equal(scopeOf("a: 'it\\'s'", 'it'), 'string.quoted.single.xtjson');
    for (const e of ['\\n', '\\v', '\\0', '\\x41', '\\u00e4', '\\u{1F600}', '\\u{000041}', '\\/']) {
      assert.equal(scopeOf(`a: "${e}"`, e), 'constant.character.escape.xtjson', e);
    }
    for (const e of ['\\a', '\\X', '\\u{D800}', '\\u{110000}']) {
      assert.equal(scopeOf(`a: "${e}"`, e.slice(0, 2)), 'invalid.illegal.unrecognized-string-escape.xtjson', e);
    }
    assert.equal(scopeOf('a: "\\01"', '\\0'), 'invalid.illegal.unrecognized-string-escape.xtjson');
    assert.equal(scopeOf('a: "x\ty"', 'x\ty'), 'string.quoted.double.xtjson');
    assert.equal(scopeOf('a: "x\vy"', '\v'), 'invalid.illegal.unescaped-control-character.xtjson');
    assert.equal(scopeOf('a: "x\fy"', '\f'), 'invalid.illegal.unescaped-control-character.xtjson');
  });

  test('strings across several lines', () => {
    const text = 'motd: "\n  Welcome. \'x\' \\"\n  // no comment: 1\n  "\nnext: 1';
    assert.equal(scopeOf(text, '  // no comment: 1'), 'string.quoted.double.xtjson');
    assert.equal(scopeOf(text, 'next'), 'support.type.property-name.xtjson');
    assert.equal(scopeOf("a: '\n  x\\ty\n  '", '\\t'), 'constant.character.escape.xtjson');
    assert.equal(scopeOf('a: "open\nb: 1', 'b: 1'), 'string.quoted.double.xtjson');
  });

  test('line continuation', () => {
    assert.equal(scopeOf('a: "long \\\n  line"', '\\'), 'constant.character.escape.line-continuation.xtjson');
    assert.equal(scopeOf('a: "long \\ \n  line"', '\\ '), 'invalid.illegal.unrecognized-string-escape.xtjson');
  });

  test('three quotation marks are marked as invalid', () => {
    assert.equal(scopeOf('a: """x"""', '"""'), 'invalid.illegal.triple-quote.xtjson');
    assert.equal(scopeOf("a: '''\n  x\n  '''", "'''"), 'invalid.illegal.triple-quote.xtjson');
    assert.equal(scopeOf('a: \'say """\'', 'say """'), 'string.quoted.single.xtjson');
  });

  test('numbers and suffixes', () => {
    for (const n of ['0', '-1', '1.5e-3', '10_485_760', '0x1e3', '0XDEAD_BEEF', '0o644', '0b1010_0101']) {
      assert.equal(scopeOf(`a: ${n}`, n), 'constant.numeric.xtjson', n);
    }
    for (const [n, s] of [['64', 'mb'], ['5', 'min'], ['100', 'ms'], ['0x10', 'k'], ['5', 'L'], ['1e3', 'pct']]) {
      assert.equal(scopeOf(`a: ${n}${s}`, n), 'constant.numeric.xtjson', n + s);
      assert.equal(scopeOf(`a: ${n}${s}`, s), 'keyword.other.unit.suffix.xtjson', n + s);
    }
  });

  test('marks nothing as invalid in the valid texts of the corpus and the specification', () => {
    const corpus = JSON.parse(readFileSync(new URL('../../xtjson-js/test/corpus.json', import.meta.url), 'utf8'));
    const texts = [
      ...corpus.ref_valid.map(([text]) => text),
      ...corpus.ref_json_samples,
      ...corpus.a_valid.map(([text]) => text),
      ...corpus.b_valid.map(([text]) => text),
      ...corpus.c_valid.map(([text]) => text),
    ];
    for (const lang of ['de', 'en']) {
      const spec = readFileSync(new URL(`../../docs/xtjson-spec-${lang}.md`, import.meta.url), 'utf8');
      for (const m of spec.matchAll(/```xtjson\n([^]*?)```/g)) texts.push(m[1]);
    }
    for (const text of texts) {
      const lines = text.split(/\r\n?|\n/).join('\n');
      const invalid = tokens(lines).filter(([, scope]) => scope.startsWith('invalid.'));
      assert.deepEqual(invalid, [], JSON.stringify(text));
    }
  });

  test('invalid numbers', () => {
    for (const n of ['0755', '1_', '10_k', '123abc', '5l', '0b102', '.5', '1.', '- 1'.slice(0, 1), '1__0']) {
      assert.equal(scopeOf(`a: ${n}`, n), 'invalid.illegal.number.xtjson', n);
    }
  });
});
