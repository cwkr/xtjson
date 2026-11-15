// Unit tests for XTJSON.stringify.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import XTJSON, { stringify, XTJSONOptions } from '../xtjson.js';

const ch = (...codes) => String.fromCharCode(...codes);
const LS = ch(0x2028);

/** XTJSON.stringify must read back as the value JSON.stringify gives. */
function assertRoundTrip(value, args = [], options = undefined) {
  const text = XTJSON.stringify(value, ...args);
  const json = JSON.stringify(value, ...args.filter((a) => !(a instanceof XTJSONOptions) && !isPlainOptions(a)));
  if (json === undefined) {
    assert.equal(text, undefined);
    return;
  }
  let back;
  try {
    back = XTJSON.parse(text, options);
  } catch (error) {
    assert.fail(`output does not parse: ${JSON.stringify(text)}\n${error.message}`);
  }
  assert.deepEqual(back, JSON.parse(json), `output: ${JSON.stringify(text)}`);
}

function isPlainOptions(a) {
  return a !== null && typeof a === 'object' && !Array.isArray(a) && !(a instanceof Number) && !(a instanceof String);
}

describe('API', () => {
  test('stringify is a method of XTJSON and a named export', () => {
    assert.equal(XTJSON.stringify, stringify);
    assert.deepEqual(Object.keys(XTJSON), []);
  });

  test('call forms are told apart by type', () => {
    const value = { a: null, list: [1, 2] };
    const options = new XTJSONOptions({ values: { nil: null } });
    const upper = (k, v) => (typeof v === 'number' ? v * 10 : v);
    assert.equal(XTJSON.stringify(value), 'a:null,list:[1,2]');
    assert.equal(XTJSON.stringify(value, options), 'a:nil,list:[1,2]');
    assert.equal(XTJSON.stringify(value, { values: { nil: null } }), 'a:nil,list:[1,2]');
    assert.equal(XTJSON.stringify(value, 1, options), 'a: nil\nlist: [\n 1\n 2\n]');
    assert.equal(XTJSON.stringify(value, '\t', options), 'a: nil\nlist: [\n\t1\n\t2\n]');
    assert.equal(XTJSON.stringify(value, null, 1, options), 'a: nil\nlist: [\n 1\n 2\n]');
    assert.equal(XTJSON.stringify(value, upper, options), 'a:nil,list:[10,20]');
    assert.equal(XTJSON.stringify(value, upper, 1), 'a: null\nlist: [\n 10\n 20\n]');
    assert.equal(XTJSON.stringify(value, ['list'], undefined, options), 'list:[1,2]');
    assert.equal(XTJSON.stringify(value, undefined, null, null), 'a:null,list:[1,2]');
  });

  test('invalid arguments are a TypeError', () => {
    const options = { values: {} };
    assert.throws(() => XTJSON.stringify(1, options, 2), /the space is in the wrong position/);
    assert.throws(() => XTJSON.stringify(1, 2, 4), /the space is given twice/);
    assert.throws(() => XTJSON.stringify(1, options, options), /the options is given twice/);
    assert.throws(() => XTJSON.stringify(1, 2, () => 1), /the replacer is in the wrong position/);
    assert.throws(() => XTJSON.stringify(1, true), /unexpected argument of type boolean/);
    assert.throws(() => XTJSON.stringify(1, null, 2, 'x'), /unexpected argument of type string|the space is given twice/);
    assert.throws(() => XTJSON.stringify(1, { values: { true: 1 } }), /predefined/);
  });

  test('space: numbers and strings as in JSON.stringify', () => {
    const value = [1];
    assert.equal(XTJSON.stringify(value, 0), '[1]');
    assert.equal(XTJSON.stringify(value, -3), '[1]');
    assert.equal(XTJSON.stringify(value, 2.9), '[\n  1\n]');
    assert.equal(XTJSON.stringify(value, 20), `[\n${' '.repeat(10)}1\n]`);
    assert.equal(XTJSON.stringify(value, ' '.repeat(12)), `[\n${' '.repeat(10)}1\n]`);
    assert.equal(XTJSON.stringify(value, ''), '[1]');
    assert.equal(XTJSON.stringify(value, new Number(1)), '[\n 1\n]');
    assert.equal(XTJSON.stringify(value, new String('\t')), '[\n\t1\n]');
    assert.equal(XTJSON.stringify(value, ' \t'), '[\n \t1\n]');
  });

  test('space with characters other than space and tab is a TypeError', () => {
    for (const space of ['--', '  x', ch(0xa0), '\n']) {
      assert.throws(() => XTJSON.stringify([1], space), /"space" may only contain spaces and tabs/);
    }
  });
});

describe('like JSON.stringify', () => {
  test('values that cannot be written', () => {
    for (const value of [undefined, () => 1, Symbol('s')]) {
      assert.equal(XTJSON.stringify(value), undefined);
    }
    assert.equal(XTJSON.stringify({ a: undefined, b: () => 1, c: Symbol('s'), d: 1 }), 'd:1');
    assert.equal(XTJSON.stringify([undefined, () => 1, Symbol('s')]), '[null,null,null]');
    assert.equal(XTJSON.stringify([NaN, Infinity, -Infinity]), '[null,null,null]');
    assert.equal(XTJSON.stringify(-0), '0');
  });

  test('toJSON, wrapper objects and dates', () => {
    const date = new Date(Date.UTC(2026, 10, 15));
    const value = {
      date,
      custom: { toJSON: (key) => `key ${key}` },
      wrapped: [new Number(5), new String('s'), new Boolean(false), Object(10n) && 1],
    };
    assert.equal(XTJSON.stringify(value),
      'date:"2026-11-15T00:00:00.000Z",custom:"key custom",wrapped:[5,"s",false,1]');
    assertRoundTrip(value);
  });

  test('replacer function: same calls as JSON.stringify', () => {
    const record = (calls) => function (key, value) {
      calls.push([key, Array.isArray(this) ? 'array' : typeof this, typeof value]);
      return key === 'skip' ? undefined : value;
    };
    const value = { a: [1, { b: 2 }], skip: 3, c: 'x' };
    const jsonCalls = [];
    const xtCalls = [];
    JSON.stringify(value, record(jsonCalls));
    assert.equal(XTJSON.stringify(value, record(xtCalls)), 'a:[1,{b:2}],c:"x"');
    assert.deepEqual(xtCalls, jsonCalls);
  });

  test('replacer array', () => {
    const value = { a: 1, b: { a: 2, c: 3 }, 1: 'one', c: 4 };
    assert.equal(XTJSON.stringify(value, ['a', 'b', 1, 'a', {}, new String('c')]), 'a:1,b:{a:2,c:3},"1":"one",c:4');
    assertRoundTrip(value, [['b', 'a']]);
  });

  test('circular references and BigInt are a TypeError', () => {
    const a = { b: {} };
    a.b.a = a;
    assert.throws(() => XTJSON.stringify(a), /circular reference/);
    const list = [];
    list.push(list);
    assert.throws(() => XTJSON.stringify(list), /circular reference/);
    assert.throws(() => XTJSON.stringify({ n: 1n }), /BigInt/);
    assert.equal(XTJSON.stringify({ n: 1n }, (k, v) => (typeof v === 'bigint' ? String(v) : v)), 'n:"1"');
    // the same object twice is not circular
    const shared = { x: 1 };
    assert.equal(XTJSON.stringify([shared, shared]), '[{x:1},{x:1}]');
  });

  test('JSON.rawJSON', { skip: typeof JSON.rawJSON !== 'function' && 'JSON.rawJSON not available' }, () => {
    assert.equal(XTJSON.stringify({ big: JSON.rawJSON('12345678901234567890') }), 'big:12345678901234567890');
  });
});

describe('output format', () => {
  test('the object at the top level is written without braces', () => {
    assert.equal(XTJSON.stringify({ a: 1, b: { c: 2 } }), 'a:1,b:{c:2}');
    assert.equal(XTJSON.stringify({ a: 1, b: { c: 2 } }, 2), 'a: 1\nb: {\n  c: 2\n}');
    assert.equal(XTJSON.stringify({}), '{}');
    assert.equal(XTJSON.stringify({}, 2), '{}');
    assert.equal(XTJSON.stringify({ a: undefined }), '{}');
    assert.equal(XTJSON.stringify([{ a: 1 }]), '[{a:1}]');
    assert.equal(XTJSON.stringify({ toJSON: () => ({ x: 1 }) }), 'x:1');
  });

  test('with space: items on their own lines without commas', () => {
    const value = { name: 'demo', list: [1, [2, 3], {}, []], obj: { a: { b: true } } };
    assert.equal(XTJSON.stringify(value, 2), [
      'name: "demo"',
      'list: [',
      '  1',
      '  [',
      '    2',
      '    3',
      '  ]',
      '  {}',
      '  []',
      ']',
      'obj: {',
      '  a: {',
      '    b: true',
      '  }',
      '}',
    ].join('\n'));
  });

  test('names: identifiers without quotation marks, others with "', () => {
    const value = { a: 1, $x: 2, _: 3, a1: 4, true: 5, '1a': 6, 'a-b': 7, 'a b': 8, '': 9, 'ä': 10, 'q"': 11 };
    assert.equal(XTJSON.stringify(value),
      'a:1,$x:2,_:3,a1:4,true:5,"1a":6,"a-b":7,"a b":8,"":9,"' + ch(0xe4) + '":10,"q\\"":11');
    assertRoundTrip(value);
  });

  test('strings are written with " and the escapes of JSON', () => {
    assert.equal(XTJSON.stringify(["it's", 'say "hi"', 'a\\b', 'tab\there', 'nl\nx', ch(0, 0x1f, 0x7f)]),
      '["it\'s","say \\"hi\\"","a\\\\b","tab\\there","nl\\nx","\\u0000\\u001f' + ch(0x7f) + '"]');
    assert.equal(XTJSON.stringify(ch(0xd800)), '"\\ud800"');
    assert.equal(XTJSON.stringify('a' + LS + 'b' + ch(0x2029)), '"a\\u2028b\\u2029"');
  });

  test('numbers: grouping with _ and the suffixes mb, kb and k', () => {
    const cases = [
      [0, '0'], [1, '1'], [999, '999'], [1000, '1k'], [1001, '1_001'], [1024, '1kb'], [1500, '1_500'],
      [2000, '2k'], [2048, '2kb'], [3000, '3k'], [3072, '3kb'], [5120000, '5_000kb'], [1048576, '1mb'],
      [2 * 1048576, '2mb'], [1000000, '1_000k'], [1024000, '1_000kb'], [3000000, '3_000k'],
      [64 * 1048576, '64mb'], [10485760, '10mb'], [8080, '8_080'], [123456789, '123_456_789'],
      [-1000, '-1k'], [-2048, '-2kb'], [-1234, '-1_234'], [1.5, '1.5'], [1234.5, '1_234.5'],
      [0.001, '0.001'], [-1234567.25, '-1_234_567.25'], [1e-7, '1e-7'], [1.5e300, '1.5e+300'],
      [1e21, '953_674_316_406_250mb'], [2 ** 53, '8_589_934_592mb'], [2 ** 53 + 2, '9_007_199_254_740_994'],
      [123456789012345680000, '123_456_789_012_345_680_000'],
    ];
    for (const [n, text] of cases) {
      assert.equal(XTJSON.stringify(n), text, String(n));
      assert.equal(XTJSON.parse(text), n, text);
    }
  });

  test('suffixes other than mb, kb and k are not used', () => {
    assert.equal(XTJSON.stringify([0.5, 0.001, 60, 3600, 7200000]), '[0.5,0.001,60,3_600,7_200k]');
  });

  test('custom suffixes are a TypeError', () => {
    assert.throws(() => XTJSON.stringify([1], { suffixes: { q: Math.abs } }), /custom number suffixes are not supported/);
  });
});

describe('named values', () => {
  test('primitive values are written as named values', () => {
    const options = new XTJSONOptions({
      values: { nil: null, yes: true, no: false, zero: 0, unknown: 'not specified' },
    });
    const value = { a: null, b: true, c: false, d: 0, e: -0, f: 'not specified', g: [1], h: { a: 1 }, nil: 'x' };
    const text = XTJSON.stringify(value, options);
    assert.equal(text, 'a:nil,b:yes,c:no,d:zero,e:zero,f:unknown,g:[1],h:{a:1},nil:"x"');
    assert.deepEqual(XTJSON.parse(text, options), { ...value, e: 0 });
  });

  test('the named value defined last wins; predefined ones only if none matches', () => {
    const options = new XTJSONOptions({ values: [['nil', null], ['none', null], ['one', 1], ['uno', 1]] });
    assert.equal(XTJSON.stringify([null, 1, true], options), '[none,uno,true]');
    assert.equal(XTJSON.stringify([null], { values: { nil: null } }), '[nil]');
    assert.equal(XTJSON.stringify([null]), '[null]');
  });

  test('values that JSON writes as null use the named value for null', () => {
    const options = { values: { nil: null } };
    assert.equal(XTJSON.stringify([NaN, undefined, () => 1], options), '[nil,nil,nil]');
  });

  test('named values for numbers come before suffixes', () => {
    assert.equal(XTJSON.stringify([1000, 2000], { values: { thousand: 1000 } }), '[thousand,2k]');
  });

  test('a string that equals a named value is not a multi-line string', () => {
    assert.equal(XTJSON.stringify(['a\nb'], 2, { values: { ab: 'a\nb' } }), '[\n  ab\n]');
  });
});

describe('multi-line strings', () => {
  // The member `s` one level deep, without the enclosing object:
  // 's: """' at indentation 2 (removed here), the text at indentation 4.
  const ml = (value) => {
    const text = XTJSON.stringify({ o: { s: value } }, 2);
    assert.ok(text.startsWith('o: {\n  ') && text.endsWith('\n}'));
    return text.slice('o: {\n  '.length, -'\n}'.length);
  };

  test('strings with a line break are multi-line strings when space is given', () => {
    assert.equal(ml('a\nb'), 's: """\n    a\n    b"""');
    assert.equal(ml('a\nb\n'), 's: """\n    a\n    b\n    """');
    assert.equal(ml('a\n\nb'), 's: """\n    a\n\n    b"""');
    assert.equal(ml('\n'), 's: """\n\n    """');
    assert.equal(XTJSON.stringify({ s: 'a\nb' }), 's:"a\\nb"');
    assert.equal(XTJSON.stringify('a\nb', '\t'), '"""\n\ta\n\tb"""');
  });

  test('nested indentation follows the structure', () => {
    assert.equal(XTJSON.stringify({ x: { list: ['a\nb'] } }, 2),
      'x: {\n  list: [\n    """\n      a\n      b"""\n  ]\n}');
  });

  test('white space that 8.3 would remove is escaped', () => {
    assert.equal(ml('a  \nb'), 's: """\n    a \\x20\n    b"""');
    assert.equal(ml('a\t\nb'), 's: """\n    a\\t\n    b"""');
    assert.equal(ml('  \nb'), 's: """\n     \\x20\n    b"""');
    assert.equal(ml('a\nb  '), 's: """\n    a\n    b  """');
  });

  test('indentation of all lines is kept', () => {
    assert.equal(ml('  a\n  b'), 's: """\n      a\n    \\x20 b"""');
    assert.equal(ml('  a\n  b\n'), 's: """\n      a\n      b\n    """');
    assert.equal(ml('  a\nb'), 's: """\n      a\n    b"""');
    assert.equal(ml('\ta\n\tb'), 's: """\n    \ta\n    \\tb"""');
  });

  test('quotation marks, backslashes and control characters', () => {
    assert.equal(ml('say "hi"\nx'), 's: """\n    say "hi"\n    x"""');
    assert.equal(ml('a"""b\nx'), 's: """\n    a""\\"b\n    x"""');
    assert.equal(ml('x\nend"'), 's: """\n    x\n    end\\""""');
    assert.equal(ml('x\nend""'), 's: """\n    x\n    end"\\""""');
    assert.equal(ml('a\\b\nc\rd\ne\u0000'), 's: """\n    a\\\\b\n    c\\rd\n    e\\u0000"""');
    assert.equal(ml('a\r\nb'), 's: """\n    a\\r\n    b"""');
    assert.equal(ml('x' + LS + '\ny'), 's: """\n    x\\u2028\n    y"""');
    assert.equal(ml(ch(0xd83d, 0xde00) + '\n' + ch(0xdead)), 's: """\n    ' + ch(0xd83d, 0xde00) + '\n    \\uDEAD"""');
  });

  test('every example reads back as the same string', () => {
    const values = [
      'a\nb', 'a\nb\n', '\n', '\n\n', 'a\n\n', '\na', '  a\n  b', '  a\n  b\n', ' \n ', '\t\n\t',
      'a  \n  b  ', '"\n"', '""\n""', '"""\n"""', 'x"\n"x', '\\\n\\', 'a\r\nb\r\n', ' a\n\tb',
      '#!\n// no comment\n/* */', "'''\n'''", ch(0x3000) + 'a' + ch(0xa0) + '\n' + ch(0x3000),
    ];
    for (const value of values) {
      for (const space of [1, 2, '\t', ' \t']) {
        const text = XTJSON.stringify({ s: value, list: [value] }, space);
        assert.deepEqual(XTJSON.parse(text), { s: value, list: [value] }, JSON.stringify(text));
        assert.equal(XTJSON.parse(XTJSON.stringify(value, space)), value);
      }
    }
  });
});

describe('I-JSON mode', () => {
  const ijson = { ijson: true };

  test('unpaired surrogates and noncharacters are a TypeError', () => {
    assert.throws(() => XTJSON.stringify(ch(0xdead), ijson), /unpaired surrogate U\+DEAD/);
    assert.throws(() => XTJSON.stringify({ a: ['x' + ch(0xffff)] }, ijson), /noncharacter U\+FFFF/);
    assert.throws(() => XTJSON.stringify({ [ch(0xfdd0)]: 1 }, ijson), /the name .* noncharacter U\+FDD0/);
    assert.throws(() => XTJSON.stringify({ a: ch(0xd83f, 0xdfff) }, 2, ijson), /noncharacter U\+1FFFF/);
  });

  test('valid strings are written unchanged', () => {
    const value = { s: ch(0xd83d, 0xde00), t: 'a\nb' };
    assert.equal(XTJSON.stringify(value, ijson), XTJSON.stringify(value));
    assert.equal(XTJSON.stringify(ch(0xdead)), '"\\udead"');
  });
});

describe('round trip', () => {
  // Deterministic pseudo-random values (mulberry32).
  function random(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const ALPHABET = [
    'a', 'b', ' ', ' ', '\t', '\n', '\n', '\r', '"', '"', "'", '\\', '#', '/', '*', '_', '0', 'k',
    ch(0), ch(0x1f), ch(0x7f), ch(0xa0), ch(0x3000), ch(0x2028), ch(0x2029), ch(0xfeff), 'ä',
    ch(0xd83d, 0xde00), ch(0xd800), ch(0xdfff),
  ];
  const NAMES = ['a', 'b', '$x', '_y', 'true', 'nil', '1a', 'a b', 'a-b', '', '"', 'ä', '__proto__'];

  function randomString(rnd) {
    let s = '';
    const n = Math.floor(rnd() * 12);
    for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
    return s;
  }

  function randomNumber(rnd) {
    const r = rnd();
    const int = Math.floor(rnd() * 2000) - 1000;
    if (r < 0.2) return int * [1000, 1024, 1048576, 1000000, 1024000][Math.floor(rnd() * 5)];
    if (r < 0.4) return int;
    if (r < 0.6) return (rnd() - 0.5) * 10 ** Math.floor(rnd() * 40 - 20);
    if (r < 0.7) return (rnd() < 0.5 ? -1 : 1) * Math.floor(rnd() * 2 ** 53) * 2 ** Math.floor(rnd() * 900);
    if (r < 0.8) return [0, -0, 1, -1, 2 ** 53, 2 ** 53 - 1, Number.MAX_VALUE, Number.MIN_VALUE, 1e21][Math.floor(rnd() * 9)];
    return Math.floor(rnd() * 1e12);
  }

  function randomValue(rnd, depth) {
    const r = rnd();
    if (depth > 4 || r < 0.35) {
      const p = rnd();
      if (p < 0.4) return randomString(rnd);
      if (p < 0.8) return randomNumber(rnd);
      return [null, true, false, undefined, NaN][Math.floor(rnd() * 5)];
    }
    const n = Math.floor(rnd() * 5);
    if (r < 0.65) return Array.from({ length: n }, () => randomValue(rnd, depth + 1));
    const obj = {};
    for (let i = 0; i < n; i++) {
      const key = rnd() < 0.7 ? NAMES[Math.floor(rnd() * NAMES.length)] : randomString(rnd);
      Object.defineProperty(obj, key, { value: randomValue(rnd, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    return obj;
  }

  test('XTJSON.parse(XTJSON.stringify(v)) equals JSON.parse(JSON.stringify(v))', () => {
    const rnd = random(12345);
    const options = new XTJSONOptions({ values: [['nil', null], ['one', 1], ['empty', ''], ['nl', '\n'], ['kilo', 1000], ['yes', true]] });
    for (let i = 0; i < 2000; i++) {
      const value = randomValue(rnd, 0);
      for (const space of [undefined, 2, '\t', ' \t']) {
        assertRoundTrip(value, [null, space]);
        assertRoundTrip(value, [null, space, options], options);
      }
    }
  });
});
