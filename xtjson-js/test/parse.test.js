// Unit tests for the API and behaviour of XTJSON.parse beyond the shared corpus.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import XTJSON, { parse, XTJSONOptions, XTJSONError } from '../xtjson.js';

/** Asserts an XTJSONError and returns it. */
function error(text, defs) {
  try {
    XTJSON.parse(text, null, defs);
  } catch (e) {
    assert.ok(e instanceof XTJSONError, `expected XTJSONError, got ${e}`);
    return e;
  }
  assert.fail(`should be invalid: ${JSON.stringify(text)}`);
}

describe('API', () => {
  test('default export is like JSON', () => {
    assert.equal(Object.prototype.toString.call(XTJSON), '[object XTJSON]');
    assert.ok(Object.isFrozen(XTJSON));
    assert.equal(XTJSON.parse, parse);
    assert.deepEqual(Object.keys(XTJSON), []);
  });

  test('text is converted to a string, like JSON.parse', () => {
    assert.equal(XTJSON.parse(42), 42);
    assert.equal(XTJSON.parse({ toString: () => 'a: 1' }).a, 1);
  });

  test('XTJSONError is a SyntaxError', () => {
    const e = error('[1 2]');
    assert.ok(e instanceof SyntaxError);
    assert.equal(e.name, 'XTJSONError');
  });

  test('parsed objects are plain objects', () => {
    const v = XTJSON.parse('a: {b: [1]}');
    assert.equal(Object.getPrototypeOf(v), Object.prototype);
    assert.ok(Array.isArray(v.a.b));
  });

  test('"__proto__" is an ordinary name', () => {
    const v = XTJSON.parse('{"__proto__": {"x": 1}, __proto__: {"y": 2}}');
    assert.equal(Object.getPrototypeOf(v), Object.prototype);
    assert.deepEqual(Object.keys(v), ['__proto__']);
    assert.deepEqual(v.__proto__, { y: 2 }); // own property, last member applies
    assert.equal(v.y, undefined);
  });

  test('duplicate names: the last member applies (7.2)', () => {
    assert.deepEqual(XTJSON.parse('a: 1\nb: 2\na: 3'), { a: 3, b: 2 });
  });
});

describe('reviver', () => {
  test('is called like in JSON.parse', () => {
    const calls = [];
    const v = XTJSON.parse('a: [1, 2]\nb: {c: 3}', function (key, value) {
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
    assert.deepEqual(XTJSON.parse(text, reviver), JSON.parse(text, reviver));
  });

  test('undefined removes members and leaves holes in arrays', () => {
    const v = XTJSON.parse('[1, 2, 3]', (k, x) => (x === 2 ? undefined : x));
    assert.equal(v.length, 3);
    assert.ok(!(1 in v));
  });

  test('null and undefined mean no reviver', () => {
    assert.deepEqual(XTJSON.parse('[1]', null), [1]);
    assert.deepEqual(XTJSON.parse('[1]', undefined), [1]);
  });

  test('other primitive values as second argument are a TypeError', () => {
    for (const arg of ['not a function', 1, true, 1n, Symbol('s')]) {
      assert.throws(() => XTJSON.parse('[1]', arg), (e) => e instanceof TypeError && !(e instanceof XTJSONError));
    }
  });
});

describe('call forms', () => {
  const init = { values: { nil: null }, suffixes: { '%': (x) => x / 100 } };
  const defs = new XTJSONOptions(init);
  const text = '[nil, 50%, 1]';
  const expected = [null, 0.5, 1];
  const double = (k, v) => (typeof v === 'number' ? v * 2 : v);

  test('options as second argument: instance or plain object', () => {
    assert.deepEqual(XTJSON.parse(text, defs), expected);
    assert.deepEqual(XTJSON.parse(text, init), expected);
    assert.deepEqual(XTJSON.parse('[1, 1k]', {}), [1, 1000]);
  });

  test('options as third argument after a reviver or null', () => {
    assert.deepEqual(XTJSON.parse(text, null, defs), expected);
    assert.deepEqual(XTJSON.parse(text, undefined, init), expected);
    assert.deepEqual(XTJSON.parse(text, double, defs), [null, 1, 2]);
  });

  test('options given twice are a TypeError', () => {
    assert.throws(() => XTJSON.parse(text, defs, defs), /given twice/);
    assert.throws(() => XTJSON.parse(text, init, {}), /given twice/);
    assert.deepEqual(XTJSON.parse(text, defs, null), expected);
    assert.deepEqual(XTJSON.parse(text, defs, undefined), expected);
  });

  test('invalid arguments are a TypeError', () => {
    assert.throws(() => XTJSON.parse(text, { values: { true: 1 } }), TypeError);
    assert.throws(() => XTJSON.parse(text, []), /unexpected argument of type object/);
    assert.throws(() => XTJSON.parse(text, null, 'x'), /unexpected argument of type string/);
    assert.throws(() => XTJSON.parse(text, defs, () => 1), /the reviver is in the wrong position/);
  });
});

describe('options: definitions', () => {
  const init = {
    values: { nil: null, zero: 0, list: [1, { a: 2 }] },
    suffixes: { '%': (x) => x / 100 },
  };

  test('accepts a plain object, a Map or an iterable of pairs', () => {
    const text = '[nil, zero, list, 50%]';
    const expected = [null, 0, [1, { a: 2 }], 0.5];
    assert.deepEqual(XTJSON.parse(text, null, init), expected);
    assert.deepEqual(XTJSON.parse(text, null, {
      values: new Map(Object.entries(init.values)),
      suffixes: new Map(Object.entries(init.suffixes)),
    }), expected);
    assert.deepEqual(XTJSON.parse(text, null, {
      values: Object.entries(init.values),
      suffixes: Object.entries(init.suffixes),
    }), expected);
  });

  test('XTJSONOptions keeps the order of the named values', () => {
    const defs = new XTJSONOptions({ values: [['zeta', 1], ['alpha', 2], ['mid', 3]] });
    assert.deepEqual([...defs.values.keys()], ['zeta', 'alpha', 'mid']);
    const fromObject = new XTJSONOptions({ values: { zeta: 1, alpha: 2, $x: 3, _y: 4 } });
    assert.deepEqual([...fromObject.values.keys()], ['zeta', 'alpha', '$x', '_y']);
  });

  test('XTJSONOptions is immutable and independent of its input', () => {
    const source = { list: [1, 2] };
    const defs = new XTJSONOptions({ values: source });
    source.list.push(3);
    source.other = 1;
    assert.deepEqual(XTJSON.parse('list', null, defs), [1, 2]);
    assert.ok(Object.isFrozen(defs));
    assert.ok(Object.isFrozen(defs.values.get('list')));
    defs.values.set('other', 1); // a copy; does not change defs
    assert.throws(() => XTJSON.parse('other', null, defs), XTJSONError);
  });

  test('an XTJSONOptions instance can be used as init', () => {
    const defs = new XTJSONOptions(init);
    const copy = new XTJSONOptions(defs);
    assert.deepEqual(XTJSON.parse('[list, 1%]', null, copy), [[1, { a: 2 }], 0.01]);
  });

  test('results are fresh copies', () => {
    const defs = new XTJSONOptions(init);
    const a = XTJSON.parse('[list, list]', null, defs);
    assert.notEqual(a[0], a[1]);
    a[0][1].a = 99;
    assert.deepEqual(XTJSON.parse('list', null, defs), [1, { a: 2 }]);
  });

  test('without definitions only the predefined ones are active', () => {
    assert.match(error('nil').message, /Undefined named value 'nil'/);
    assert.match(error('50%').message, /Undefined number suffix '%'/);
    assert.equal(XTJSON.parse('10k'), 10000);
  });

  test('invalid options throw TypeError', () => {
    const cases = [
      [{ values: [['a', 1], ['a', 2]] }, /defined more than once/],
      [{ values: { x: undefined } }, /undefined/],
      [{ values: { x: () => 1 } }, /function/],
      [{ values: { x: 1n } }, /bigint/],
      [{ values: { x: Infinity } }, /not a JSON number/],
      [{ values: { x: new Date() } }, /plain object/],
      [{ values: { x: [1, , 3] } }, /sparse/], // eslint-disable-line no-sparse-arrays
      [{ values: 'abc' }, /must be an object/],
      [{ values: [1, 2] }, /pairs/],
      [{ suffixes: { '%': 'x' } }, /conversion function/],
      ['abc', /must be an object/],
    ];
    const cyclic = { a: [] };
    cyclic.a.push(cyclic);
    cases.push([{ values: { c: cyclic } }, /circular/]);
    for (const [defs, pattern] of cases) {
      assert.throws(() => new XTJSONOptions(defs), (e) => e instanceof TypeError && pattern.test(e.message));
      assert.throws(() => XTJSON.parse('1', null, defs), TypeError);
    }
  });

  test('errors in conversion functions are errors of the document', () => {
    const cause = new RangeError('too large');
    const defs = { suffixes: { q: () => { throw cause; }, r: () => '1', s: () => NaN } };
    const e = error('a: 1\nb: 7q', defs);
    assert.equal(e.cause, cause);
    assert.match(e.message, /The conversion of '7q' failed: too large \(line 2, column 4\)/);
    assert.match(error('1r', defs).message, /did not return a finite number/);
    assert.match(error('1s', defs).message, /did not return a finite number/);
  });

  test('conversion functions receive the value including the sign', () => {
    const seen = [];
    const defs = { suffixes: { px: (x) => { seen.push(x); return x; } } };
    XTJSON.parse('[-1.5px, 0x10px, 1_000px, -0px]', null, defs);
    assert.deepEqual(seen, [-1.5, 16, 1000, -0]);
  });
});

describe('I-JSON mode', () => {
  const ijson = new XTJSONOptions({ ijson: true });

  test('is off by default and can be read back', () => {
    assert.equal(new XTJSONOptions().ijson, false);
    assert.equal(ijson.ijson, true);
    assert.equal(new XTJSONOptions(ijson).ijson, true);
    assert.deepEqual(XTJSON.parse('{"a": 1, "a": 2}'), { a: 2 });
  });

  test('"ijson" must be a boolean', () => {
    for (const value of [1, 'true', null, {}]) {
      if (value === null) continue; // null means "not given"
      assert.throws(() => new XTJSONOptions({ ijson: value }), /"ijson" must be true or false/);
    }
  });

  test('duplicate names are an error, independent of their notation', () => {
    const e = error('{\n  a: 1\n  "\\u0061": 2\n}', ijson);
    assert.match(e.message, /Duplicate name "a"; names must be unique in I-JSON mode \(first occurrence at line 2, column 3\)/);
    assert.deepEqual([e.line, e.column], [3, 3]);
    assert.match(error("a: 1\nb: 2\n'a': 3", ijson).message, /first occurrence at line 1, column 1/);
    assert.match(error('[{x: 1}, {y: {z: 1, z: 2}}]', ijson).message, /Duplicate name "z"/);
    assert.match(error('{"__proto__": 1, __proto__: 2}', ijson).message, /Duplicate name "__proto__"/);
  });

  test('the same name in different objects is permitted', () => {
    assert.deepEqual(XTJSON.parse('a: {a: {a: 1}}\nb: [{a: 1}, {a: 2}]', ijson),
      { a: { a: { a: 1 } }, b: [{ a: 1 }, { a: 2 }] });
  });

  test('unpaired surrogates in strings and names are an error', () => {
    for (const text of [String.raw`"\uDEAD"`, String.raw`"\uD83D"`, String.raw`["\uDE00\uD83D"]`,
      String.raw`{"\uD800": 1}`, String.raw`'''x\uDC00'''`, String.raw`a: "\uD83Dx"`]) {
      assert.match(error(text, ijson).message, /unpaired surrogate U\+D[89A-F][0-9A-F]{2}, which is not permitted in I-JSON mode/, text);
    }
    assert.equal(XTJSON.parse(String.raw`"😀\u{1F600}"`, ijson), '\u{1F600}\u{1F600}');
  });

  test('noncharacters in strings and names are an error', () => {
    const nonchars = ['\\uFDD0', '\\uFDEF', '\\uFFFE', '\\uFFFF', '\\u{1FFFE}', '\\u{10FFFF}', '\\uD83F\\uDFFF'];
    for (const escape of nonchars) {
      assert.match(error(`"x${escape}"`, ijson).message, /the noncharacter U\+[0-9A-F]+, which is not permitted/, escape);
      assert.match(error(`{"${escape}": 1}`, ijson).message, /noncharacter/, escape);
    }
    // written directly, not as an escape sequence
    assert.match(error('"' + String.fromCharCode(0xffff) + '"', ijson).message, /noncharacter U\+FFFF/);
    // the neighbours are permitted
    assert.equal(XTJSON.parse(String.raw`"﷏ﷰ�\u{1FFFD}\u{10000}"`, ijson).length, 7);
  });

  test('values of named values count as well', () => {
    const defs = new XTJSONOptions({
      ijson: true,
      values: { bad: ['ok', { [String.fromCharCode(0xffff)]: 1 }], lone: '\uD800', good: { a: 'b' } },
    });
    assert.deepEqual(XTJSON.parse('[good]', defs), [{ a: 'b' }]);
    const e = error('x: 1\ny: [good, bad]', defs);
    assert.match(e.message, /The value of the named value 'bad' contains the noncharacter U\+FFFF/);
    assert.deepEqual([e.line, e.column], [2, 11]);
    assert.match(error('lone', defs).message, /unpaired surrogate U\+D800/);
    // outside the I-JSON mode the same definitions are fine
    assert.equal(XTJSON.parse('lone', { values: { lone: '\uD800' } }), '\uD800');
  });

  test('large numbers are not rejected (only a SHOULD in section 12)', () => {
    assert.equal(XTJSON.parse('0xFFFF_FFFF_FFFF_F800', ijson), 2 ** 64 - 2048);
  });
});

describe('numbers', () => {
  test('decimal numbers like JSON', () => {
    for (const text of ['0', '-0', '1.5', '-2.5e-3', '1E5', '123456789012345678901234567890', '5e-324']) {
      assert.ok(Object.is(XTJSON.parse(text), JSON.parse(text)), text);
    }
  });

  test('decimal numbers out of range are an error, not Infinity', () => {
    assert.match(error('1e400').message, /out of range/);
    assert.match(error('-1e400').message, /out of range/);
    assert.match(error('1e306mb').message, /out of range/);
  });

  test('hexadecimal, octal and binary numbers are exact or an error (9.4)', () => {
    assert.equal(XTJSON.parse('0x1F_FFFF_FFFF_FFFF'), 2 ** 53 - 1);
    assert.equal(XTJSON.parse('0x20_0000_0000_0000'), 2 ** 53);
    assert.equal(XTJSON.parse('0xFFFF_FFFF_FFFF_F800'), 2 ** 64 - 2048);
    assert.equal(XTJSON.parse('0b' + '1'.repeat(53)), 2 ** 53 - 1);
    assert.equal(XTJSON.parse('0x' + '0'.repeat(100) + 'ff'), 255);
    assert.match(error('0x20_0000_0000_0001').message, /cannot be represented exactly/);
    assert.match(error('0o' + '7'.repeat(30)).message, /octal number cannot be represented exactly/);
    assert.match(error('0x1' + '0'.repeat(300)).message, /cannot be represented exactly/);
    assert.ok(Object.is(XTJSON.parse('-0x0'), -0));
  });

  test('predefined suffixes give the exact product (9.5)', () => {
    assert.equal(XTJSON.parse('0.1kb'), 102.4);
    assert.equal(XTJSON.parse('0.3k'), 300);
    assert.equal(XTJSON.parse('1.1mb'), 1153433.6);
    assert.equal(XTJSON.parse('1e-3k'), 1);
    assert.equal(XTJSON.parse('9007199254740993k'), 9007199254740993000);
    assert.equal(XTJSON.parse('-0.000_001K'), -0.001);
    assert.equal(XTJSON.parse('0x1F_FFFF_FFFF_FFFFkb'), (2 ** 53 - 1) * 1024);
    assert.equal(XTJSON.parse('1e-99999999999k'), 0);
  });
});

describe('strings', () => {
  test('escape sequences', () => {
    assert.equal(XTJSON.parse(String.raw`"\u{1F600}\uD83D\uDE00\x41\v\0\'\""`), '\u{1F600}\u{1F600}A\v\0\'"');
    assert.equal(XTJSON.parse(String.raw`"\uDEAD"`), '\uDEAD'); // like JSON
    assert.equal(XTJSON.parse(String.raw`"\u{0000000000041}"`), 'A');
  });

  test('unpaired surrogates in the text are an error (section 4)', () => {
    const e = error('a: "x\uD800"');
    assert.match(e.message, /Unpaired surrogate U\+D800/);
    assert.equal(e.column, 6);
  });

  test('multi-line string as a value of a member', () => {
    const text = 'sql: """\n    SELECT 1\n      FROM t\n    """\nn: 1';
    assert.deepEqual(XTJSON.parse(text), { sql: 'SELECT 1\n  FROM t\n', n: 1 });
  });

  test('long strings with and without escapes', () => {
    const plain = 'x'.repeat(100000);
    assert.equal(XTJSON.parse(`"${plain}"`), plain);
    assert.equal(XTJSON.parse(`'${plain}\\n${plain}'`), `${plain}\n${plain}`);
  });
});

describe('limits', () => {
  test('nesting up to 1000 levels', () => {
    const ok = '['.repeat(1000) + ']'.repeat(1000);
    assert.equal(XTJSON.parse(ok).length, 1);
    const e = error('['.repeat(1001) + ']'.repeat(1001));
    assert.match(e.message, /Nesting depth exceeds the limit of 1000/);
    assert.match(error('a: ' + '{a: '.repeat(1001)).message, /Nesting depth/);
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
    ['{"""a""": 1}', /multi-line string is not permitted as a name/, 1, 2],
    ['"""a""": 1', /multi-line string is not permitted as a name/, 1, 1],
    ["'It's'", /Unexpected 's' after the root value/, 1, 5],
    ['"a\nb"', /Line break in a single-line string/, 1, 3],
    ['"a\\\nb"', /no line continuation/, 1, 3],
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
    ['"""abc', /Unterminated multi-line string/, 1, 1],
    ['x: """\n\ta\n  b\n  """', /Inconsistent indentation/, 3, 1],
    ['"a\tb"', /Control character U\+0009 must be escaped/, 1, 3],
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
    ['10q', /Undefined number suffix 'q'/, 1, 3],
    ['10kbs', /Unexpected 's' after the number suffix 'kb'/, 1, 5],
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
