// Unit tests for the API and behaviour of parse and Parser beyond the shared corpus.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import * as xtjson from '../xtjson.js';
import { parse, Parser, Options, ParserError } from '../xtjson.js';

/** Asserts a ParserError and returns it. */
function error(text, options) {
  try {
    parse(text, options);
  } catch (e) {
    assert.ok(e instanceof ParserError, `expected ParserError, got ${e}`);
    return e;
  }
  assert.fail(`should be invalid: ${JSON.stringify(text)}`);
}

describe('API', () => {
  test('named exports only, no default export', () => {
    assert.deepEqual(Object.keys(xtjson).sort(), ['Options', 'Parser', 'ParserError', 'format', 'parse']);
    assert.equal('default' in xtjson, false);
  });

  test('Parser keeps its options and hides its state', () => {
    const parser = new Parser({ strict: true });
    assert.deepEqual(parser.parse('a: nil'), { a: null });
    assert.deepEqual(parser.parse('[1, 2]'), [1, 2]);
    assert.throws(() => parser.parse('{a: 1, a: 2}'), /Duplicate name/);
    assert.deepEqual(Object.keys(parser), []);
    assert.deepEqual(Object.getOwnPropertyNames(Parser.prototype).sort(), ['constructor', 'parse']);
  });

  test('Parser can be reused after an error', () => {
    const parser = new Parser();
    assert.throws(() => parser.parse('[1 2]'), ParserError);
    assert.deepEqual(parser.parse('a: 1'), { a: 1 });
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

describe('options argument', () => {
  const init = { strict: true };
  const defs = new Options(init);
  const text = '[nil, 50pct, 1]';
  const expected = [null, 0.5, 1];

  test('options as second argument: instance or plain object', () => {
    assert.deepEqual(parse(text, defs), expected);
    assert.deepEqual(parse(text, init), expected);
    assert.deepEqual(parse('[1, 1k]', {}), [1, 1000]);
  });

  test('null and undefined mean no options', () => {
    assert.deepEqual(parse('[1]', null), [1]);
    assert.deepEqual(parse('[1]', undefined), [1]);
  });

  test('other values as second argument are a TypeError', () => {
    for (const arg of [(k, v) => v, [], 'not options', 1, true, 1n, Symbol('s')]) {
      assert.throws(() => parse('[1]', arg), (e) => e instanceof TypeError && /must be an object/.test(e.message));
    }
    assert.throws(() => parse(text, { namedValues: { nil: null } }), TypeError);
  });
});

describe('literals and the directive', () => {
  test('true, false, null and nil (6.4)', () => {
    assert.deepEqual(parse('[true, false, null, nil]'), [true, false, null, null]);
    assert.equal(parse('nil'), null);
    assert.deepEqual(parse('{nil: nil, true: false}'), { nil: null, true: false });
    assert.deepEqual(parse('nil: 1'), { nil: 1 });
  });

  test('every other identifier at a value position is an error', () => {
    assert.match(error('[red]').message, /Unexpected identifier 'red'; the values without quotation marks are true, false, null and nil; text without quotation marks is not a string, write "red" for a string/);
    assert.match(error('a: Nil').message, /did you mean 'nil'\? Literals are case-sensitive/);
    assert.match(error('[nullable]').message, /Unexpected identifier 'nullable'/);
    assert.match(error('undefined').message, /undefined is not a JSON value/);
  });

  test('%strict: true and %strict: false (6.5)', () => {
    assert.deepEqual(parse('%strict: true\n{a: 1}'), { a: 1 });
    assert.deepEqual(parse('%strict: false, [1]'), [1]);
    assert.deepEqual(parse('# c\n%strict /* k */ :\n  true // k\n\na: nil'), { a: null });
  });

  test('error messages for the directive', () => {
    const cases = [
      ['% strict: true\n{}', /'strict' must follow '%' directly, without white space or comments; the only directive is %strict/, [1, 2]],
      ['%Strict: true\n{}', /Unknown directive '%Strict'; did you mean '%strict'\? Directives are case-sensitive/, [1, 1]],
      ['%define: a = 1\n[a]', /Unknown directive '%define'\. The only directive is %strict/, [1, 1]],
      ["%version: '0.7'\n{}", /Unknown directive '%version'\. The only directive is %strict/, [1, 1]],
      ['%strict true\n{}', /expected ':' after '%strict'/, [1, 9]],
      ['%strict: 1\n{}', /The value of %strict must be the literal true or false/, [1, 10]],
      ["%strict: 'true'\n{}", /The value of %strict must be the literal true or false/, [1, 10]],
      ['%strict: nil\n{}', /The value of %strict must be the literal true or false/, [1, 10]],
      ['%strict: s = true\n{}', /The value of %strict must be the literal true or false/, [1, 10]],
      ['%strict: true [1]', /Expected a comma or a line break after the directive, found '\['/, [1, 15]],
      ['%strict: true /*\n*/ [1]', /a line break inside a block comment does not separate items/, [2, 4]],
      ['%strict: true\n', /The document contains only the directive/, [2, 1]],
      ['%strict: true\n%strict: true\n{}', /%strict may occur only once, and there are no other directives/, [2, 1]],
      ['a: 1\n%strict: true', /The directive %strict is permitted only at the top level, before the content of the document/, [2, 1]],
      ['[%strict: true]', /The directive %strict is permitted only at the top level/, [1, 2]],
      ['1\n%strict: true', /The directive %strict is permitted only at the top level/, [2, 1]],
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
    const copy = new Options(new Options({ strict: true, maxDepth: 7 }));
    assert.equal(copy.strict, true);
    assert.equal(copy.maxDepth, 7);
  });

  test('the application cannot define values or suffixes', () => {
    assert.throws(() => new Options({ namedValues: { nil: null } }),
      /Unknown XTJSON option "namedValues"; there are no named values, only the literals true, false, null and nil/);
    assert.throws(() => new Options({ suffixes: { q: Math.abs } }), /Unknown XTJSON option "suffixes"\./);
    assert.throws(() => new Options({ maxExpansion: 10 }), /Unknown XTJSON option "maxExpansion"; there are no named values/);
    assert.equal('namedValues' in new Options(), false);
    assert.equal('maxExpansion' in new Options(), false);
  });

  test('unknown options are a TypeError', () => {
    assert.throws(() => parse('1', { strcit: true }),
      /Unknown XTJSON option "strcit"\. The options are "maxDepth" and "strict"/);
    assert.throws(() => parse('1', { ijson: true }), /Unknown XTJSON option "ijson"; the I-JSON mode is strict mode, option "strict"/);
    assert.deepEqual(parse('1', { strict: undefined, maxDepth: undefined }), 1);
  });

  test('invalid options throw TypeError', () => {
    const cases = [
      [{ maxDepth: 0 }, /"maxDepth" must be a positive integer/],
      [{ maxDepth: 1.5 }, /"maxDepth" must be a positive integer/],
      [{ maxDepth: '10' }, /"maxDepth" must be a positive integer/],
      [{ maxDepth: Infinity }, /"maxDepth" must be a positive integer/],
      ['abc', /must be an object/],
    ];
    for (const [options, pattern] of cases) {
      assert.throws(() => new Options(options), (e) => e instanceof TypeError && pattern.test(e.message));
      assert.throws(() => parse('1', options), TypeError);
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

  test('outside strict mode the same values are fine', () => {
    assert.deepEqual(parse('["\\uD800", {a: 1, a: 2}]'), ['\uD800', { a: 2 }]);
  });

  test('large numbers are not rejected (only a SHOULD in section 12)', () => {
    assert.deepEqual(parse('[0xFFFF_FFFF_FFFF_F800]', strict), [2 ** 64 - 2048]);
  });

  test('the root value must be an object or an array', () => {
    for (const text of ['1', '"x"', 'null', 'nil', 'true', '10n', '%strict: true, 1', '  \n\n  "x" // k']) {
      const e = error(text, strict);
      assert.match(e.message, /In strict mode the root value must be an object or an array/, text);
    }
    assert.deepEqual([error('\n  "x"', strict).line, error('\n  "x"', strict).column], [2, 3]);
    assert.deepEqual(parse('a: 1', strict), { a: 1 });
  });

  test('%strict: true requests strict mode for the document', () => {
    assert.deepEqual(parse('%strict: true\n{a: 1}'), { a: 1 });
    assert.deepEqual(parse('%strict: true, [nil]'), [null]);
    assert.match(error('%strict: true\n{a: 1, a: 2}').message, /Duplicate name "a"; names must be unique in strict mode/);
    assert.match(error('%strict: true\n1').message, /root value must be an object or an array/);
    assert.match(error('%strict: true\n["\\uFFFF"]').message, /noncharacter U\+FFFF/);
    // %strict: false and no %strict leave strict mode off
    assert.deepEqual(parse('%strict: false\n{a: 1, a: 2}'), { a: 2 });
    assert.equal(parse('%strict: false\n1'), 1);
  });

  test('%strict: false contradicts strict mode of the application', () => {
    const e = error('# c\n%strict: false\n{}', strict);
    assert.match(e.message, /%strict: false contradicts strict mode, which the application requests with the option strict/);
    assert.deepEqual([e.line, e.column], [2, 1]);
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
    assert.equal(parse('0.1m'), 100000);
    assert.equal(parse('1.5m'), 1500000);
    assert.ok(Object.is(parse('-0ms'), -0));
    assert.ok(Object.is(parse('-0.0pct'), -0));
    assert.ok(Object.is(parse('-0x0h'), -0));
  });

  test('the result of a suffix must be in range', () => {
    assert.match(error('1e308k').message, /out of range/);
    assert.match(error('1e305h').message, /out of range/);
    assert.match(error('1e400s').message, /out of range/);
    assert.match(error('1e303m').message, /out of range/);
    // only the result counts (9.4)
    assert.equal(parse('4.4e308pct'), 4.4e306);
    assert.equal(parse('-1e310ms'), -1e307);
    assert.equal(parse('1e-400k'), 0);
  });

  test('all suffixes of the table in 9.5', () => {
    const table = {
      k: 2000, kb: 2048, m: 2000000, mb: 2097152,
      ms: 0.002, s: 2, min: 120, h: 7200, pct: 0.02, n: 2n,
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
      ['123_456_789_012_345_678_901_234_567_890n', 123456789012345678901234567890n],
    ];
    for (const [text, expected] of cases) assert.equal(parse(text), expected, text);
    assert.deepEqual(parse('a: 1n, b: [2n, 3]'), { a: 1n, b: [2n, 3] });
  });

  test('the suffix n is an error after a fraction part or an exponent', () => {
    for (const text of ['1.5n', '1.0n', '12e-1n', '1e-3n', '1e3n', '0e5n', '-1.0_0n']) {
      assert.match(error(text).message, /The suffix 'n' is only permitted after an integer/, text);
    }
  });

  test('predefined factors give the exact product (9.5)', () => {
    assert.equal(parse('0.1kb'), 102.4);
    assert.equal(parse('0.3k'), 300);
    assert.equal(parse('1.1mb'), 1153433.6);
    assert.equal(parse('1e-3k'), 1);
    assert.equal(parse('9007199254740993k'), 9007199254740993000);
    assert.equal(parse('-0.000_001k'), -0.001);
    assert.equal(parse('9007199254740993m'), 9007199254740993000000);
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
    ['[ture]', /Unexpected identifier 'ture'; the values without quotation marks are true, false, null and nil; text without quotation marks is not a string/, 1, 2],
    ['[True]', /did you mean 'true'\? Literals are case-sensitive/, 1, 2],
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
    ['10q', /Unknown number suffix 'q'\. The suffixes are k, kb, m, mb, ms, s, min, h, pct and n/, 1, 3],
    ['10kbs', /Unexpected 's' after the number suffix 'kb'\. The suffixes are/, 1, 5],
    ['10mi', /Unexpected 'i' after the number suffix 'm'/, 1, 4],
    ['10k5', /Unexpected '5' after the number suffix 'k'/, 1, 4],
    ['10MS', /Unknown number suffix 'MS'; did you mean 'ms'\? Suffixes are written in lower case/, 1, 3],
    ['10K', /Unknown number suffix 'K'; did you mean 'k'\?/, 1, 3],
    ['10kB_', /Unexpected 'B' after the number suffix 'k'/, 1, 4],
    ['12px', /Unknown number suffix 'px'\./, 1, 3],
    ['100L', /Unknown number suffix 'L'\./, 1, 4],
    ['a: 1.5n', /The suffix 'n' is only permitted after an integer/, 1, 7],
    ['50%', /Unexpected '%' after the root value/, 1, 3],
    ['10k%', /Unexpected '%' after the root value/, 1, 4],
    ['10_k', /'_' is only permitted between two digits/, 1, 3],
    ['10ab', /Unknown number suffix 'ab'/, 1, 3],
    ['10x', /Unknown number suffix 'x'/, 1, 3],
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
