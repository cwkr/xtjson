// Unit tests for the API and behaviour of parse and Parser beyond the shared corpus.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import * as xtjson from '../xtjson.js';
import { parse, parseDocument, Parser, Options, ParserError } from '../xtjson.js';

/** Asserts a ParserError and returns it. */
function error(text, options) {
  try {
    parse(text, null, options);
  } catch (e) {
    assert.ok(e instanceof ParserError, `expected ParserError, got ${e}`);
    return e;
  }
  assert.fail(`should be invalid: ${JSON.stringify(text)}`);
}

describe('API', () => {
  test('named exports only, no default export', () => {
    assert.deepEqual(Object.keys(xtjson).sort(), ['Generator', 'Options', 'Parser', 'ParserError', 'format', 'parse', 'parseDocument', 'stringify']);
    assert.equal('default' in xtjson, false);
  });

  test('Parser keeps its options and hides its state', () => {
    const parser = new Parser({ strict: true });
    assert.deepEqual(parser.parse('%define: nil = null\na: nil'), { a: null });
    assert.deepEqual(parser.parse('[1, 2]'), [1, 2]);
    assert.throws(() => parser.parse('{a: 1, a: 2}'), /Duplicate name/);
    assert.deepEqual(Object.keys(parser), []);
    assert.deepEqual(Object.getOwnPropertyNames(Parser.prototype).sort(), ['constructor', 'parse', 'parseDocument']);
  });

  test('Parser can be reused after an error and called from a reviver', () => {
    const parser = new Parser();
    assert.throws(() => parser.parse('[1 2]'), ParserError);
    assert.deepEqual(parser.parse('a: 1'), { a: 1 });
    const value = parser.parse('a: "b: 2"\nc: 3', (key, v) => (key === 'a' ? parser.parse(v) : v));
    assert.deepEqual(value, { a: { b: 2 }, c: 3 });
    assert.throws(() => parser.parse('1', {}), /the reviver must be a function/);
  });

  test('text is converted to a string, like JSON.parse', () => {
    assert.equal(parse(42), 42);
    assert.equal(parse({ toString: () => 'a: 1' }).a, 1);
  });

  test('ParserError is a SyntaxError', () => {
    const e = error('[1 2]');
    assert.ok(e instanceof SyntaxError);
    assert.equal(e.name, 'ParserError');
  });

  test('parsed objects are plain objects', () => {
    const v = parse('a: {b: [1]}');
    assert.equal(Object.getPrototypeOf(v), Object.prototype);
    assert.ok(Array.isArray(v.a.b));
  });

  test('"__proto__" is an ordinary name', () => {
    const v = parse('{"__proto__": {"x": 1}, __proto__: {"y": 2}}');
    assert.equal(Object.getPrototypeOf(v), Object.prototype);
    assert.deepEqual(Object.keys(v), ['__proto__']);
    assert.deepEqual(v.__proto__, { y: 2 }); // own property, last member applies
    assert.equal(v.y, undefined);
  });

  test('duplicate names: the last member applies (7.2)', () => {
    assert.deepEqual(parse('a: 1\nb: 2\na: 3'), { a: 3, b: 2 });
  });
});

describe('reviver', () => {
  test('is called like in JSON.parse', () => {
    const calls = [];
    const v = parse('a: [1, 2]\nb: {c: 3}', function (key, value) {
      calls.push([key, this === undefined ? undefined : Array.isArray(this) ? 'array' : 'object']);
      return typeof value === 'number' ? value * 10 : value;
    });
    assert.deepEqual(v, { a: [10, 20], b: { c: 30 } });
    assert.deepEqual(calls.map((c) => c[0]), ['0', '1', 'a', 'c', 'b', '']);
    assert.deepEqual(calls[0], ['0', 'array']);
  });

  test('gives the same result as JSON.parse for JSON texts', () => {
    const text = '{"a":[1,{"b":2}],"c":"x","d":null}';
    const reviver = (key, value) => (key === 'b' ? undefined : value);
    assert.deepEqual(parse(text, reviver), JSON.parse(text, reviver));
  });

  test('undefined removes members and leaves holes in arrays', () => {
    const v = parse('[1, 2, 3]', (k, x) => (x === 2 ? undefined : x));
    assert.equal(v.length, 3);
    assert.ok(!(1 in v));
  });

  test('null and undefined mean no reviver', () => {
    assert.deepEqual(parse('[1]', null), [1]);
    assert.deepEqual(parse('[1]', undefined), [1]);
  });

  test('other primitive values as second argument are a TypeError', () => {
    for (const arg of ['not a function', 1, true, 1n, Symbol('s')]) {
      assert.throws(() => parse('[1]', arg), (e) => e instanceof TypeError && !(e instanceof ParserError));
    }
  });
});

describe('call forms', () => {
  const init = { strict: true };
  const defs = new Options(init);
  const text = '%define: nil = null\n[nil, 50pct, 1]';
  const expected = [null, 0.5, 1];
  const double = (k, v) => (typeof v === 'number' ? v * 2 : v);

  test('options as second argument: instance or plain object', () => {
    assert.deepEqual(parse(text, defs), expected);
    assert.deepEqual(parse(text, init), expected);
    assert.deepEqual(parse('[1, 1k]', {}), [1, 1000]);
  });

  test('options as third argument after a reviver or null', () => {
    assert.deepEqual(parse(text, null, defs), expected);
    assert.deepEqual(parse(text, undefined, init), expected);
    assert.deepEqual(parse(text, double, defs), [null, 1, 2]);
  });

  test('options given twice are a TypeError', () => {
    assert.throws(() => parse(text, defs, defs), /given twice/);
    assert.throws(() => parse(text, init, {}), /given twice/);
    assert.deepEqual(parse(text, defs, null), expected);
    assert.deepEqual(parse(text, defs, undefined), expected);
  });

  test('invalid arguments are a TypeError', () => {
    assert.throws(() => parse(text, { namedValues: { nil: null } }), TypeError);
    assert.throws(() => parse(text, []), /unexpected argument of type object/);
    assert.throws(() => parse(text, null, 'x'), /unexpected argument of type string/);
    assert.throws(() => parse(text, defs, () => 1), /the reviver is in the wrong position/);
  });
});

describe('directives and named values', () => {
  test('named values are defined in the document with %define', () => {
    const text = '%define: nil = null\n%define: zero = 0, %define: half = 50pct\n[nil, zero, half, true]';
    assert.deepEqual(parse(text), [null, 0, 0.5, true]);
    assert.match(error('nil').message, /Undefined named value 'nil'.*define 'nil' with %define before it is used/);
    assert.equal(parse('10k'), 10000);
  });

  test('a definition applies only to the document that contains it', () => {
    const parser = new Parser();
    assert.deepEqual(parser.parse('%define: a = 1\n[a]'), [1]);
    assert.throws(() => parser.parse('[a]'), /Undefined named value 'a'/);
    assert.deepEqual(parser.parse('%define: a = 2\n[a]'), [2]);
  });

  test('objects and arrays are copied to every position (6.4)', () => {
    const v = parse('%define: address = {city: "x", lines: [1, 2]}\nhome: address\nwork: address');
    assert.deepEqual(v.home, { city: 'x', lines: [1, 2] });
    assert.notEqual(v.home, v.work);
    assert.notEqual(v.home.lines, v.work.lines);
    v.home.lines.push(3);
    assert.deepEqual(v.work.lines, [1, 2]);
    const p = parse('%define: o = {"__proto__": {"x": 1}}\n[o, o]');
    assert.deepEqual(Object.keys(p[1]), ['__proto__']);
    assert.equal(Object.getPrototypeOf(p[1]), Object.prototype);
  });

  test('a reviver sees the copies', () => {
    const v = parse('%define: a = [1]\nx: a\ny: a', (key, value) => (typeof value === 'number' ? value + 1 : value));
    assert.deepEqual(v, { x: [2], y: [2] });
  });

  test('parseDocument returns the version statements', () => {
    const { value, versions } = parseDocument("%version: '0.6'\n%version: schema = 20260401\n%define: a = 1\n[a]");
    assert.deepEqual(value, [1]);
    assert.ok(versions instanceof Map);
    assert.deepEqual([...versions], [['xtjson', '0.6'], ['schema', 20260401]]);
    assert.deepEqual([...parseDocument('{}').versions], []);
    assert.deepEqual([...parseDocument('%version: xtjson = 1.5\n{}').versions], [['xtjson', 1.5]]);
    assert.deepEqual(parseDocument('[1]', (k, v) => (v === 1 ? 2 : v)).value, [2]);
    assert.deepEqual(new Parser({ strict: true }).parseDocument('%version: 1\n[1]').value, [1]);
  });

  test('a version can be a number with a suffix or a named value', () => {
    const text = "%version: windows = 2k\n%define: v = '1.4.0'\n%version: app = v\n%version: 10n\nversion: v";
    const { value, versions } = parseDocument(text);
    assert.deepEqual(value, { version: '1.4.0' });
    assert.deepEqual([...versions], [['windows', 2000], ['app', '1.4.0'], ['xtjson', 10n]]);
  });

  test('error messages for directives', () => {
    const cases = [
      ['% define: a = 1\n[a]', /The name of a directive must follow '%' directly/, [1, 2]],
      ['%Define: a = 1\n[a]', /Unknown directive '%Define'; did you mean '%define'\? Directives are case-sensitive/, [1, 1]],
      ['%import: x = "a"\n{}', /Unknown directive '%import'\. The directives are %define, %version and %strict/, [1, 1]],
      ['%STRICT: true\n{}', /Unknown directive '%STRICT'; did you mean '%strict'\?/, [1, 1]],
      ['%define a = 1\n[a]', /expected ':' after '%define'/, [1, 9]],
      ['%define: "x"\n{}', /%define needs an identifier and '=' before the value/, [1, 10]],
      ['%define: null = 1\n1', /The named value 'null' is predefined and cannot be redefined/, [1, 10]],
      ['%define: a = 1\n%define: a = 2\n[a]', /The named value 'a' is already defined at line 1, column 10; a named value can be defined only once/, [2, 10]],
      ['%define: a = [a]\n1', /Undefined named value 'a'/, [1, 15]],
      ['%define: a = 1 [a]', /Expected a comma or a line break after the directive, found '\['/, [1, 16]],
      ['%define: a = 1 /*\n*/ [a]', /a line break inside a block comment does not separate items/, [2, 4]],
      ['%define: a = 1\n', /The document contains only directives/, [2, 1]],
      ['a: 1\n%define: b = 2', /A directive is permitted only at the top level, before the content of the document/, [2, 1]],
      ['[%define: b = 2]', /A directive is permitted only at the top level/, [1, 2]],
      ['1\n%version: 1', /A directive is permitted only at the top level/, [2, 1]],
      ['%version: 1\n%version: xtjson = 2\n{}', /The version of the specification is already stated \(%version: v and %version: xtjson = v are the same\)/, [2, 11]],
      ["%version: s = 1\n%version: s = '1'\n{}", /The version 's' is already stated; each version may be stated only once/, [2, 11]],
      ['%version: nil\n{}', /Undefined named value 'nil'/, [1, 11]],
      ['%version: [1]\n{}', /The value of %version must be a string or a number, or a named value whose value is a string or a number/, [1, 11]],
      ['%define: t = true\n%version: t\n{}', /The value of %version must be a string or a number/, [2, 11]],
      ['%strict: s = true\n{}', /%strict has no identifier; write '%strict: true' or '%strict: false'/, [1, 10]],
      ['%strict: true\n%strict: true\n{}', /%strict is already stated at line 1, column 1; %strict may occur only once/, [2, 1]],
      ['%strict: 1\n{}', /The value of %strict must be true or false, or a named value whose value is true or false/, [1, 10]],
      ['%define: on = "true"\n%strict: on\n{}', /The value of %strict must be true or false/, [2, 10]],
    ];
    for (const [text, pattern, [line, column]] of cases) {
      const e = error(text);
      assert.match(e.message, pattern, text);
      assert.deepEqual([e.line, e.column], [line, column], text);
    }
  });
});

describe('options', () => {
  test('Options is immutable', () => {
    const init = { strict: true };
    const options = new Options(init);
    init.strict = false;
    assert.equal(options.strict, true);
    assert.ok(Object.isFrozen(options));
  });

  test('an Options instance can be used as init', () => {
    const copy = new Options(new Options({ strict: true, maxExpansion: 7 }));
    assert.equal(copy.strict, true);
    assert.equal(copy.maxExpansion, 7);
  });

  test('the application cannot define named values or suffixes', () => {
    assert.throws(() => new Options({ namedValues: { nil: null } }),
      /Unknown XTJSON option "namedValues"; named values are defined in the document with %define, not by the application/);
    assert.throws(() => new Options({ suffixes: { q: Math.abs } }), /Unknown XTJSON option "suffixes"\./);
    assert.equal('namedValues' in new Options(), false);
  });

  test('unknown options are a TypeError', () => {
    assert.throws(() => parse('1', { strcit: true }),
      /Unknown XTJSON option "strcit"\. The options are "maxDepth", "maxExpansion", "strict", "writeNumberSuffixes" and "writeSingleQuotes"/);
    assert.throws(() => parse('1', { ijson: true }), /Unknown XTJSON option "ijson"; the I-JSON mode is strict mode, option "strict"/);
    assert.deepEqual(parse('1', { strict: undefined, maxDepth: undefined, maxExpansion: undefined }), 1);
  });

  test('invalid options throw TypeError', () => {
    const cases = [
      [{ maxExpansion: 0 }, /"maxExpansion" must be a positive integer/],
      [{ maxExpansion: 1.5 }, /"maxExpansion" must be a positive integer/],
      [{ maxExpansion: '10' }, /"maxExpansion" must be a positive integer/],
      [{ maxExpansion: Infinity }, /"maxExpansion" must be a positive integer/],
      ['abc', /must be an object/],
    ];
    for (const [options, pattern] of cases) {
      assert.throws(() => new Options(options), (e) => e instanceof TypeError && pattern.test(e.message));
      assert.throws(() => parse('1', null, options), TypeError);
    }
  });
});

describe('strict mode', () => {
  const strict = new Options({ strict: true });

  test('is off by default and can be read back', () => {
    assert.equal(new Options().strict, false);
    assert.equal(strict.strict, true);
    assert.equal(new Options(strict).strict, true);
    assert.deepEqual(parse('{"a": 1, "a": 2}'), { a: 2 });
  });

  test('"strict" must be a boolean', () => {
    for (const value of [1, 'true', null, {}]) {
      if (value === null) continue; // null means "not given"
      assert.throws(() => new Options({ strict: value }), /"strict" must be true or false/);
    }
  });

  test('duplicate names are an error, independent of their notation', () => {
    const e = error('{\n  a: 1\n  "\\u0061": 2\n}', strict);
    assert.match(e.message, /Duplicate name "a"; names must be unique in strict mode \(first occurrence at line 2, column 3\)/);
    assert.deepEqual([e.line, e.column], [3, 3]);
    assert.match(error("a: 1\nb: 2\n'a': 3", strict).message, /first occurrence at line 1, column 1/);
    assert.match(error('[{x: 1}, {y: {z: 1, z: 2}}]', strict).message, /Duplicate name "z"/);
    assert.match(error('{"__proto__": 1, __proto__: 2}', strict).message, /Duplicate name "__proto__"/);
  });

  test('the same name in different objects is permitted', () => {
    assert.deepEqual(parse('a: {a: {a: 1}}\nb: [{a: 1}, {a: 2}]', strict),
      { a: { a: { a: 1 } }, b: [{ a: 1 }, { a: 2 }] });
  });

  test('unpaired surrogates in strings and names are an error', () => {
    for (const text of [String.raw`"\uDEAD"`, String.raw`"\uD83D"`, String.raw`["\uDE00\uD83D"]`,
      String.raw`{"\uD800": 1}`, "'x\t\\uDC00'", String.raw`a: "\uD83Dx"`]) {
      assert.match(error(text, strict).message, /unpaired surrogate U\+D[89A-F][0-9A-F]{2}, which is not permitted in strict mode/, text);
    }
    assert.deepEqual(parse(String.raw`["😀\u{1F600}"]`, strict), ['\u{1F600}\u{1F600}']);
  });

  test('noncharacters in strings and names are an error', () => {
    const nonchars = ['\\uFDD0', '\\uFDEF', '\\uFFFE', '\\uFFFF', '\\u{1FFFE}', '\\u{10FFFF}', '\\uD83F\\uDFFF'];
    for (const escape of nonchars) {
      assert.match(error(`"x${escape}"`, strict).message, /the noncharacter U\+[0-9A-F]+, which is not permitted/, escape);
      assert.match(error(`{"${escape}": 1}`, strict).message, /noncharacter/, escape);
    }
    // written directly, not as an escape sequence
    assert.match(error('"' + String.fromCharCode(0xffff) + '"', strict).message, /noncharacter U\+FFFF/);
    // the neighbours are permitted
    assert.equal(parse(String.raw`["﷏ﷰ�\u{1FFFD}\u{10000}"]`, strict)[0].length, 7);
  });

  test('values of directives are always checked, even if they are not used (6.5)', () => {
    for (const options of [strict, undefined]) {
      assert.deepEqual(parse('%define: good = "b"\n[good]', options), ['b']);
      const e = error('%define: bad = "ok\\uFFFF"\n[1]', options);
      assert.match(e.message, /The string contains the noncharacter U\+FFFF, which is not permitted in the value of a directive/);
      assert.deepEqual([e.line, e.column], [1, 16]);
      assert.match(error('%define: lone = "\\uD800"\n[lone]', options).message, /unpaired surrogate U\+D800, which is not permitted in the value of a directive/);
      assert.match(error('%version: "\\uD800"\n{}', options).message, /unpaired surrogate U\+D800/);
      const d = error('%define: d = {a: 1, "\\u0061": 2}\n{}', options);
      assert.match(d.message, /Duplicate name "a"; names must be unique in the value of a directive \(first occurrence at line 1, column 15\)/);
      assert.deepEqual([d.line, d.column], [1, 21]);
    }
    // in the content, outside strict mode, the same values are fine
    assert.deepEqual(parse('["\\uD800", {a: 1, a: 2}]'), ['\uD800', { a: 2 }]);
  });

  test('large numbers are not rejected (only a SHOULD in section 12)', () => {
    assert.deepEqual(parse('[0xFFFF_FFFF_FFFF_F800]', strict), [2 ** 64 - 2048]);
  });

  test('the root value must be an object or an array', () => {
    for (const text of ['1', '"x"', 'null', 'true', '10n', '%define: a = 1\na', '  \n\n  "x" // k']) {
      const e = error(text, strict);
      assert.match(e.message, /In strict mode the root value must be an object or an array/, text);
    }
    assert.deepEqual([error('\n  "x"', strict).line, error('\n  "x"', strict).column], [2, 3]);
    assert.deepEqual(parse('a: 1', strict), { a: 1 });
    assert.deepEqual(parse('%define: a = [1]\na', strict), [1]);
  });

  test('%strict: true requests strict mode for the document', () => {
    assert.deepEqual(parse('%strict: true\n{a: 1}'), { a: 1 });
    assert.deepEqual(parse('%define: yes = true, %strict: yes\n[1]'), [1]);
    assert.match(error('%strict: true\n{a: 1, a: 2}').message, /Duplicate name "a"; names must be unique in strict mode/);
    assert.match(error('%strict: true\n1').message, /root value must be an object or an array/);
    assert.match(error('%strict: true\n["\\uFFFF"]').message, /noncharacter U\+FFFF/);
    // %strict: false and no %strict leave strict mode off
    assert.deepEqual(parse('%strict: false\n{a: 1, a: 2}'), { a: 2 });
    assert.equal(parse('%define: no = false\n%strict: no\n1'), 1);
  });

  test('%strict applies to the content, not to the directives', () => {
    // a violation in a directive is reported where it occurs, before %strict is read
    const e = error('%define: d = {a: 1, a: 2}\n%strict: false\n{}');
    assert.match(e.message, /names must be unique in the value of a directive/);
    assert.deepEqual([e.line, e.column], [1, 21]);
    assert.match(error('%strict: false\n%define: s = "\\uFFFF"\n[1]').message, /not permitted in the value of a directive/);
    // the content is checked from the first token after the directives
    assert.match(error('%strict: true\n%define: a = 1\n{x: a, x: a}').message, /names must be unique in strict mode/);
    assert.deepEqual(parse('%strict: false\n%define: a = 1\n{x: a, x: a}'), { x: 1 });
  });

  test('%strict: false contradicts strict mode of the application', () => {
    const e = error('%version: 1\n%strict: false\n{}', strict);
    assert.match(e.message, /%strict: false contradicts strict mode, which the application requests with the option strict/);
    assert.deepEqual([e.line, e.column], [2, 1]);
    assert.match(error('%define: no = false\n%strict: no\n[1]', strict).message, /contradicts strict mode/);
    assert.deepEqual(parse('%strict: true\n[1]', strict), [1]);
  });
});

describe('numbers', () => {
  test('decimal numbers like JSON', () => {
    for (const text of ['0', '-0', '1.5', '-2.5e-3', '1E5', '123456789012345678901234567890', '5e-324']) {
      assert.ok(Object.is(parse(text), JSON.parse(text)), text);
    }
  });

  test('decimal numbers are correctly rounded at every length', () => {
    // Numbers of up to 15 digits take a fast path in the parser; the texts
    // cover both sides of that limit.
    const texts = ['-0.0', '0.1', '0.3', '1.005', '123.456', '999999999999999', '9999999999999999',
      '0.000000000000001', '0.0000000000000001', '99999999.9999999', '99999999.99999999',
      '9007199254740993', '0.1234567890123456789012', '4.35', '-8.41', '1.7976931348623157e308'];
    let seed = 1;
    for (let i = 0; i < 2000; i++) {
      seed = (seed * 48271) % 2147483647;
      const digits = String(seed) + String(seed % 9973);
      const point = seed % (digits.length + 1);
      texts.push((seed % 3 === 0 ? '-' : '') + (digits.slice(0, point) || '0').replace(/^0+(?=\d)/, '') + '.' + (digits.slice(point) || '0'));
    }
    for (const text of texts) {
      assert.ok(Object.is(parse(text), JSON.parse(text)), text);
      assert.ok(Object.is(parse(`[${text}]`)[0], JSON.parse(text)), text);
      // 9.5: the quotient is rounded once, like the decimal with a shifted point.
      if (!text.includes('e')) assert.ok(Object.is(parse(text + 'ms'), Number(text + 'e-3')), text + 'ms');
    }
  });

  test('decimal numbers out of range are an error, not Infinity', () => {
    assert.match(error('1e400').message, /out of range/);
    assert.match(error('-1e400').message, /out of range/);
    assert.match(error('1e306mb').message, /out of range/);
  });

  test('hexadecimal, octal and binary numbers are exact or an error (9.4)', () => {
    assert.equal(parse('0x1F_FFFF_FFFF_FFFF'), 2 ** 53 - 1);
    assert.equal(parse('0x20_0000_0000_0000'), 2 ** 53);
    assert.equal(parse('0xFFFF_FFFF_FFFF_F800'), 2 ** 64 - 2048);
    assert.equal(parse('0b' + '1'.repeat(53)), 2 ** 53 - 1);
    assert.equal(parse('0x' + '0'.repeat(100) + 'ff'), 255);
    assert.match(error('0x20_0000_0000_0001').message, /cannot be represented exactly/);
    assert.match(error('0o' + '7'.repeat(30)).message, /octal number cannot be represented exactly/);
    assert.match(error('0x1' + '0'.repeat(300)).message, /cannot be represented exactly/);
    assert.ok(Object.is(parse('-0x0'), -0));
  });

  test('suffixes give the exact product or quotient (9.5)', () => {
    assert.equal(parse('100ms'), 0.1);
    assert.equal(parse('0.3ms'), 0.0003);
    assert.equal(parse('7pct'), 0.07);
    assert.equal(parse('0.07pct'), 0.0007);
    assert.equal(parse('1.1min'), 66);
    assert.equal(parse('0.1h'), 360);
    assert.equal(parse('0x10ms'), 0.016);
    assert.equal(parse('9007199254740993ms'), 9007199254740.993);
    assert.equal(parse('0.1px'), 0.1);
    assert.ok(Object.is(parse('-0ms'), -0));
    assert.ok(Object.is(parse('-0.0pct'), -0));
    assert.ok(Object.is(parse('-0x0h'), -0));
  });

  test('the result of a suffix must be in range', () => {
    assert.match(error('1e308k').message, /out of range/);
    assert.match(error('1e305h').message, /out of range/);
    assert.match(error('1e400px').message, /out of range/);
    // only the result counts (9.4)
    assert.equal(parse('4.4e308pct'), 4.4e306);
    assert.equal(parse('-1e310ms'), -1e307);
    assert.equal(parse('1e-400k'), 0);
  });

  test('all suffixes of the table in 9.5', () => {
    const table = {
      k: 2000, K: 2000, kb: 2048, Kb: 2048, kB: 2048, KB: 2048,
      mb: 2097152, Mb: 2097152, mB: 2097152, MB: 2097152,
      ms: 0.002, s: 2, min: 120, h: 7200, pct: 0.02, px: 2, L: 2, n: 2n,
    };
    for (const [suffix, expected] of Object.entries(table)) {
      assert.equal(parse('2' + suffix), expected, suffix);
    }
  });

  test('integers with the suffix n become a BigInt', () => {
    const cases = [
      ['10n', 10n], ['-3n', -3n], ['0n', 0n], ['-0n', 0n], ['1_000n', 1000n],
      ['9007199254740993n', 9007199254740993n], ['0xFFn', 255n], ['-0xFFn', -255n], ['0o17n', 15n],
      ['0b101n', 5n], ['0x1_0000_0000_0000_0001n', 18446744073709551617n],
      ['1e3n', 1000n], ['120e-1n', 12n], ['0e-5n', 0n], ['1e30n', 10n ** 30n],
    ];
    for (const [text, expected] of cases) assert.equal(parse(text), expected, text);
    assert.deepEqual(parse('a: 1n, b: [2n, 3]'), { a: 1n, b: [2n, 3] });
    // the reviver receives the BigInt
    assert.equal(parse('[5n]', (k, v) => (typeof v === 'bigint' ? Number(v) * 2 : v))[0], 10);
  });

  test('numbers with a fraction part or a non-integer value stay numbers with the suffix n', () => {
    for (const [text, expected] of [['1.5n', 1.5], ['1.0n', 1], ['12e-1n', 1.2], ['1e-3n', 0.001], ['1.5L', 1.5], ['100L', 100]]) {
      const value = parse(text);
      assert.equal(typeof value, 'number', text);
      assert.equal(value, expected, text);
    }
  });

  test('the exponent of a BigInt is limited', () => {
    assert.equal(String(parse('1e10000n')).length, 10001);
    assert.match(error('a: 1e10001n').message, /exponent of a BigInt number \(suffix n\) exceeds the limit of 10000 \(line 1, column 4\)/);
    assert.equal(parse('0e99999n'), 0n);
  });

  test('predefined factors give the exact product (9.5)', () => {
    assert.equal(parse('0.1kb'), 102.4);
    assert.equal(parse('0.3k'), 300);
    assert.equal(parse('1.1mb'), 1153433.6);
    assert.equal(parse('1e-3k'), 1);
    assert.equal(parse('9007199254740993k'), 9007199254740993000);
    assert.equal(parse('-0.000_001K'), -0.001);
    assert.equal(parse('0x1F_FFFF_FFFF_FFFFkb'), (2 ** 53 - 1) * 1024);
    assert.equal(parse('1e-99999999999k'), 0);
  });
});

describe('strings', () => {
  test('escape sequences', () => {
    assert.equal(parse(String.raw`"\u{1F600}\uD83D\uDE00\x41\v\0\'\""`), '\u{1F600}\u{1F600}A\v\0\'"');
    assert.equal(parse(String.raw`"\uDEAD"`), '\uDEAD'); // like JSON
    assert.equal(parse(String.raw`"\u{0000000000041}"`), 'A');
  });

  test('unpaired surrogates in the text are an error (section 4)', () => {
    const e = error('a: "x\uD800"');
    assert.match(e.message, /Unpaired surrogate U\+D800/);
    assert.equal(e.column, 6);
  });

  test('string across several lines as a value of a member', () => {
    const text = 'sql: "\n    SELECT 1\n      FROM t\n    "\nn: 1';
    assert.deepEqual(parse(text), { sql: 'SELECT 1\n  FROM t\n', n: 1 });
    assert.deepEqual(parse("a: 'x\r\ny'\r\nb: 2"), { a: 'x\ny', b: 2 });
    assert.equal(parse('"a\tb"'), 'a\tb');
  });

  test('line continuation', () => {
    assert.equal(parse('"\n  long \\\n  line\\\n  "'), 'long line');
    assert.equal(parse('"a\\\r\nb\\\rc\\\nd"'), 'abcd');
    assert.equal(parse('"a  \\\n  b"'), 'a    b'); // no empty first line: nothing removed
    assert.equal(parse('"\\\n  a"'), '  a'); // the first line is not empty
    assert.equal(parse('"\n\\\n  a\n  "'), '  a\n  '); // a line with only the backslash counts
    assert.equal(parse('"a\\\\\nb"'), 'a\\\nb'); // an escaped backslash
  });

  test('names across several lines', () => {
    assert.deepEqual(parse('"\n  a\n  ": 1'), { 'a\n': 1 });
    assert.deepEqual(parse('{"a\\\nb": 1}'), { ab: 1 });
  });

  test('long strings with and without escapes', () => {
    const plain = 'x'.repeat(100000);
    assert.equal(parse(`"${plain}"`), plain);
    assert.equal(parse(`'${plain}\\n${plain}'`), `${plain}\n${plain}`);
  });
});

describe('limits', () => {
  test('nesting up to 1000 levels', () => {
    const ok = '['.repeat(1000) + ']'.repeat(1000);
    assert.equal(parse(ok).length, 1);
    const e = error('['.repeat(1001) + ']'.repeat(1001));
    assert.match(e.message, /Nesting depth exceeds the limit of 1000/);
    assert.match(error('a: ' + '{a: '.repeat(1001)).message, /Nesting depth/);
  });

  test('the implicit root object is a level as well', () => {
    const nested = (n) => '['.repeat(n) + ']'.repeat(n);
    assert.deepEqual(parse('a: ' + nested(999)).a.length, 1);
    const e = error('a: ' + nested(1000));
    assert.match(e.message, /Nesting depth exceeds the limit of 1000 \(option maxDepth\)/);
    assert.deepEqual([e.line, e.column], [1, 1003]);
  });

  test('maxDepth changes the limit', () => {
    const nested = (n) => '['.repeat(n) + ']'.repeat(n);
    assert.equal(parse(nested(2), { maxDepth: 2 }).length, 1);
    assert.match(error(nested(3), { maxDepth: 2 }).message, /limit of 2 \(option maxDepth\)/);
    assert.equal(parse('1', { maxDepth: 1 }), 1);
    assert.deepEqual(parse('a: 1', { maxDepth: 1 }), { a: 1 });
    assert.match(error('a: []', { maxDepth: 1 }).message, /limit of 1/);
    assert.equal(parse(nested(1500), { maxDepth: 2000 }).length, 1);
    assert.equal(new Options().maxDepth, 1000);
    assert.equal(new Options({ maxDepth: 5 }).maxDepth, 5);
    assert.equal(new Options(new Options({ maxDepth: 5 })).maxDepth, 5);
  });

  test('maxDepth must be a positive integer', () => {
    for (const maxDepth of [0, -1, 1.5, Infinity, NaN, '10', 2 ** 53, true]) {
      assert.throws(() => new Options({ maxDepth }), /"maxDepth" must be a positive integer/, String(maxDepth));
    }
  });

  test('maxExpansion limits the size after replacing named values (11, 13)', () => {
    // each level multiplies the size by ten
    let bomb = '%define: s0 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]\n';
    for (let i = 1; i < 12; i++) bomb += `%define: s${i} = [${Array(10).fill(`s${i - 1}`).join(', ')}]\n`;
    bomb += 's11';
    const e = error(bomb);
    assert.match(e.message, /Replacing named values produces more than 1000000 values \(option maxExpansion\)/);
    // a: 3 values; b = [a, a]: 6 replaced, 7 values; [b, b]: 14 replaced; 20 in all
    const small = '%define: a = [1, 1]\n%define: b = [a, a]\n[b, b]';
    assert.equal(parse(small, { maxExpansion: 20 }).length, 2);
    assert.match(error(small, { maxExpansion: 19 }).message, /more than 19 values/);
    assert.deepEqual(parse('%define: a = 1\n[a, a, a]', { maxExpansion: 3 }), [1, 1, 1]);
    assert.equal(new Options().maxExpansion, 1000000);
  });

  test('maxDepth also applies to the values of named values', () => {
    const text = '%define: a = [[1]]\n%define: b = [a]\n{x: b}';
    assert.deepEqual(parse(text, { maxDepth: 4 }), { x: [[[1]]] });
    const e = error(text, { maxDepth: 3 });
    assert.match(e.message, /Nesting depth exceeds the limit of 3 \(option maxDepth\) when the named value 'b' is replaced/);
    assert.deepEqual([e.line, e.column], [3, 5]);
    // a long chain of definitions cannot nest deeper than maxDepth; d999 has depth 1000
    let chain = '%define: d0 = []\n';
    for (let i = 1; i <= 999; i++) chain += `%define: d${i} = [d${i - 1}]\n`;
    assert.equal(parse(chain + 'd999').length, 1);
    assert.match(error(chain + '[d999]').message, /limit of 1000 \(option maxDepth\) when the named value 'd999' is replaced/);
    assert.match(error(chain + '%define: d1000 = [d999]\n1').message, /limit of 1000/);
  });

  test('a maxDepth beyond the call stack is reported as an error of the document', () => {
    const n = 200000;
    const e = error('a: ' + '['.repeat(n) + ']'.repeat(n), { maxDepth: n + 1 });
    assert.match(e.message, /exceeds the call stack of the JavaScript engine; use a smaller maxDepth/);
    assert.ok(e.cause !== undefined);
  });
});

describe('error messages', () => {
  const cases = [
    // [text, message pattern, line, column]
    ['', /The document is empty/, 1, 1],
    ['  // only a comment\n', /The document is empty/, 2, 1],
    ['[1 2]', /Expected ',', a line break or '\]', found '2'/, 1, 4],
    ['a: 1 b: 2', /Expected a comma or a line break between two members, found 'b'/, 1, 6],
    ['a: 1 }', /implicit root object is not closed with '}'/, 1, 6],
    ['{a: 1} b: 2', /Unexpected 'b' after the root value/, 1, 8],
    ['[1,,2]', /Unexpected ',', expected a value/, 1, 4],
    ['{,}', /Unexpected ',', expected a name/, 1, 2],
    ['[1, 2', /Unterminated array: expected '\]' for the array opened at line 1, column 1/, 1, 6],
    ['x: {\n  a: 1\n', /Unterminated object: expected '}' for the object opened at line 1, column 4/, 3, 1],
    ['{a 1}', /expected ':' after the name "a"/, 1, 4],
    ['[ture]', /Undefined named value 'ture'; text without quotation marks is not a string/, 1, 2],
    ['[True]', /did you mean 'true'\? Named values are case-sensitive/, 1, 2],
    ['NaN', /NaN is not a JSON value/, 1, 1],
    ['{2fa: true}', /must begin with a letter/, 1, 2],
    ['{max-age: 1}', /Unexpected '-' in an identifier/, 1, 5],
    ['{größe: 1}', /Unexpected 'ö' \(U\+00F6\) in an identifier/, 1, 4],
    ['{"""a""": 1}', /Three quotation marks in a row do not delimit a string; a string in " may extend across several lines/, 1, 2],
    ['"""a""": 1', /Three quotation marks in a row/, 1, 1],
    ["'''a'''", /Three quotation marks in a row/, 1, 1],
    ["'It's'", /Unexpected 's' after the root value/, 1, 5],
    ['"a\\ \nb"', /White space between a backslash and a line break is not permitted/, 1, 3],
    ['"a\\\t\r\nb"', /White space between a backslash and a line break/, 1, 3],
    ['"a\\ b"', /Unknown escape sequence '\\ '/, 1, 3],
    ['"\\a"', /Unknown escape sequence '\\a'/, 1, 2],
    ['"\\1"', /no octal escape sequences/, 1, 2],
    ['"\\01"', /'\\0' must not be followed by a digit/, 1, 2],
    ['"\\x4"', /exactly two hexadecimal digits/, 1, 2],
    ['"\\u12"', /exactly four hexadecimal digits/, 1, 2],
    ['"\\u{110000}"', /greater than 10FFFF/, 1, 2],
    ['"\\u{D800}"', /must not denote a surrogate/, 1, 2],
    ['"\\u{ 41 }"', /at least one hexadecimal digit/, 1, 2],
    ['"\\u{41 }"', /must be closed with '}'/, 1, 2],
    ['"abc', /Unterminated string/, 1, 1],
    ['"a\n  b', /Unterminated string/, 1, 1],
    ['x: "\n\ta\n  b\n  "', /Inconsistent indentation in a string/, 3, 1],
    ['"a\fb"', /Control character U\+000C must be escaped/, 1, 3],
    ['"a\n\u000bb"', /Control character U\+000B must be escaped/, 2, 1],
    ['[1\u000b2]', /found '2'/, 1, 4],
    ['[1\u20282]', /U\+2028 and U\+2029 are not line breaks/, 1, 4],
    ['[1,\u200b2]', /U\+200B, which is not a white space character/, 1, 4],
    ['{a: 1 /* x\n */ b: 2}', /a line break inside a block comment does not separate items/, 2, 5],
    ['/* open', /Unterminated block comment/, 1, 1],
    ['0755', /leading zeros/, 1, 1],
    ['0x', /Expected a hexadecimal digit after '0x'/, 1, 3],
    ['0x_FF', /'_' is only permitted between two digits/, 1, 3],
    ['1__000', /'_' is only permitted between two digits/, 1, 2],
    ['1_', /'_' is only permitted between two digits/, 1, 2],
    ['0b102', /'2' is not a valid binary digit/, 1, 5],
    ['0o78', /'8' is not a valid octal digit/, 1, 4],
    ['0x1.8', /hexadecimal number cannot have a fraction part/, 1, 4],
    ['- 1', /No white space or comment is permitted between '-' and the digits/, 1, 2],
    ['+1', /must not begin with '\+'/, 1, 1],
    ['.5', /must not begin with '\.'/, 1, 1],
    ['5.', /Expected a decimal digit after '\.'/, 1, 3],
    ['10e', /Expected a decimal digit in the exponent/, 1, 4],
    ['10q', /Unknown number suffix 'q'\. The suffixes are k, K, kb, .* L and n/, 1, 3],
    ['10kbs', /Unknown number suffix 'kbs'; 'kbs' is read as one suffix, not as 'kb' followed by 's'/, 1, 3],
    ['10MS', /Unknown number suffix 'MS'; did you mean 'ms'\? Suffixes are case-sensitive/, 1, 3],
    ['10kB_', /Unknown number suffix 'kB_'/, 1, 3],
    ['10l', /did you mean 'L'\?/, 1, 3],
    ['50%', /Unexpected '%' after the root value/, 1, 3],
    ['10k%', /Unexpected '%' after the root value/, 1, 4],
    ['10_k', /'_' is only permitted between two digits/, 1, 3],
    ['10ab', /a number suffix cannot begin with a to f, o or x/, 1, 3],
    ['10x', /a number suffix cannot begin with a to f, o or x/, 1, 3],
  ];
  for (const [text, pattern, line, column] of cases) {
    test(JSON.stringify(text), () => {
      const e = error(text);
      assert.match(e.message, pattern);
      assert.deepEqual([e.line, e.column], [line, column], e.message);
      assert.ok(e.message.endsWith(`(line ${line}, column ${column})`));
      assert.equal(e.message, `${e.reason} (line ${line}, column ${column})`);
    });
  }

  test('lines: LF, CR and CR LF are line breaks; U+2028 is not', () => {
    assert.equal(error('a: 1\r\nb: 2\r\nc: x').line, 3);
    assert.equal(error('a: 1\rb: 2\rc: x').line, 3);
    assert.equal(error('a: 1\n\r\nc: x').line, 3);
    assert.equal(error('[1, // c\u2028 2\n x]').line, 2);
  });

  test('columns count code points', () => {
    assert.equal(error('["\u{1F600}", x]').column, 7);
  });
});
