/**
 * Benchmark for XTJSON.parse and XTJSON.stringify.
 *
 * Runs unchanged with Node.js, Deno and Bun:
 *
 *     node bench/bench.js [filter] [--json]
 *     deno run bench/bench.js [filter] [--json]
 *     bun bench/bench.js [filter] [--json]
 *
 * `filter` is a substring of the case names to run. `--json` prints the
 * results as JSON instead of a table. The documents are generated with a
 * fixed seed, so runs are comparable. `JSON.parse` and `JSON.stringify` are
 * measured on the same data as a point of reference.
 */

import XTJSON, { XTJSONOptions } from '../xtjson.js';

const args = globalThis.Deno ? globalThis.Deno.args : globalThis.process.argv.slice(2);
const asJSON = args.includes('--json');
const filter = args.find((arg) => !arg.startsWith('--')) ?? '';

/** Time per measurement round, in milliseconds. */
const ROUND_MS = 300;
const ROUNDS = 7;

// ---------------------------------------------------------------------------
// Data (deterministic)

let seed = 0x2f6e2b1;
function random() {
  // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (n) => Math.floor(random() * n);
const pick = (list) => list[int(list.length)];

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'server', 'client', 'timeout', 'cache', 'path',
  'enabled', 'port', 'host', 'retries', 'level', 'name', 'size', 'mode', 'user', 'group', 'limit'];
const TEXTS = ['', 'demo-service', 'localhost', '/var/lib/data', 'Hello, world', 'a longer text with several words in it',
  'Grüße aus Köln', 'line\nbreak', 'tab\there', 'quote "x"', 'C:\\Temp\\file.txt', '日本語のテキスト', 'emoji 😀 text'];

function randomValue(depth) {
  const r = random();
  if (depth > 0 && r < 0.25) {
    const obj = {};
    const n = 1 + int(8);
    for (let i = 0; i < n; i++) obj[pick(WORDS) + (i > 3 ? '_' + i : '')] = randomValue(depth - 1);
    return obj;
  }
  if (depth > 0 && r < 0.4) {
    const arr = [];
    const n = int(10);
    for (let i = 0; i < n; i++) arr.push(randomValue(depth - 1));
    return arr;
  }
  if (r < 0.6) return pick(TEXTS);
  if (r < 0.75) return int(100000);
  if (r < 0.85) return Math.round(random() * 1e6) / 1000;
  if (r < 0.9) return -int(1000);
  if (r < 0.95) return random() < 0.5;
  return null;
}

/** A mixed document of nested objects and arrays, as JSON would hold it. */
function mixedData() {
  const records = [];
  for (let i = 0; i < 400; i++) records.push(randomValue(4));
  return { records };
}

/** A configuration file as a person would write it: all extensions in use. */
function configText(sections) {
  const lines = ['# Service configuration', '/* generated for the benchmark,', '   not written by hand */', ''];
  for (let i = 0; i < sections; i++) {
    lines.push(
      `// section ${i}`,
      `section_${i}: {`,
      `  name: 'service-${i}'  # the display name`,
      `  host: "host${i}.example.org"`,
      `  port: ${8000 + i}`,
      `  enabled: ${i % 3 === 0 ? 'false' : 'true'}`,
      `  owner: null`,
      `  cache: ${1 + (i % 64)}mb`,
      `  timeout: ${100 + i}ms`,
      `  ratio: ${(i % 100) + 0.5}pct`,
      `  mask: 0x${(0xff00 + i).toString(16)}`,
      `  mode: 0o755`,
      `  budget: 1_000_000`,
      `  weights: [0.25, 0.5, 1.5e3, -2,]`,
      `  tags: [`,
      `    'alpha'`,
      `    'beta', 'gamma'`,
      `  ]`,
      `  motd: """`,
      `    Welcome to service ${i}.`,
      `    Second line with a tab:\\t and a quote "x".`,
      ``,
      `    Last line.`,
      `    """`,
      `  "quoted name": 'it\\'s \\u{1F600} \\x41\\u0042'`,
      `  limits: { soft: 10k, hard: 2h, window: 5min }`,
      `}`,
      '',
    );
  }
  return lines.join('\n');
}

/** A small configuration file: measures the fixed cost of a call. */
const SMALL = `# Service configuration
name: 'demo-service'
port: 8080            // a line break replaces the comma
cache: 64mb
debug: false
hosts: ['a.example.org', 'b.example.org']
motd: """
  Welcome.
  """
`;

function stringArray(texts, n) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(texts[i % texts.length] + ' ' + i);
  return arr;
}

function numberText() {
  const items = [];
  for (let i = 0; i < 5000; i++) {
    switch (i % 8) {
      case 0: items.push(String(int(1e9))); break;
      case 1: items.push((random() * 1e4).toFixed(3)); break;
      case 2: items.push('-' + int(1000) + 'e' + (int(20) - 10)); break;
      case 3: items.push('0x' + int(0xffffff).toString(16)); break;
      case 4: items.push('1_' + String(int(1000)).padStart(3, '0') + '_000'); break;
      case 5: items.push(int(500) + 'kb'); break;
      case 6: items.push(int(5000) + 'ms'); break;
      default: items.push((int(1000) / 10) + 'pct'); break;
    }
  }
  return '[' + items.join(', ') + ']';
}

const mixed = mixedData();
const mixedCompact = JSON.stringify(mixed);
const mixedIndented = JSON.stringify(mixed, null, 2);
const mixedXT = XTJSON.stringify(mixed, 2);
const config = configText(200);
const configData = XTJSON.parse(config);
const plainStrings = stringArray(['plain ascii text without escapes', 'another fairly long string value, as in prose'], 4000);
const escapedStrings = stringArray(['line\nbreak and\ttab', 'quote " and backslash \\', 'emoji 😀 and \u00e4\u00f6\u00fc'], 4000);
const plainStringsText = JSON.stringify(plainStrings);
const escapedStringsText = JSON.stringify(escapedStrings);
const numbers = numberText();
const options = new XTJSONOptions({ namedValues: { nil: null, unknown: 'not specified' }, ijson: true });
const suffixOptions = new XTJSONOptions({ writeNumberSuffixes: true, writeSingleQuotes: true });

/** [name, size of the document in characters, function] */
const CASES = [
  ['parse  JSON compact', mixedCompact.length, () => XTJSON.parse(mixedCompact)],
  ['parse  JSON compact (JSON.parse)', mixedCompact.length, () => JSON.parse(mixedCompact)],
  ['parse  JSON indented', mixedIndented.length, () => XTJSON.parse(mixedIndented)],
  ['parse  JSON indented (JSON.parse)', mixedIndented.length, () => JSON.parse(mixedIndented)],
  ['parse  XTJSON generated', mixedXT.length, () => XTJSON.parse(mixedXT)],
  ['parse  XTJSON config', config.length, () => XTJSON.parse(config)],
  ['parse  XTJSON config, I-JSON + named values', config.length, () => XTJSON.parse(config, options)],
  ['parse  small document', SMALL.length, () => XTJSON.parse(SMALL)],
  ['parse  plain strings', plainStringsText.length, () => XTJSON.parse(plainStringsText)],
  ['parse  escaped strings', escapedStringsText.length, () => XTJSON.parse(escapedStringsText)],
  ['parse  numbers', numbers.length, () => XTJSON.parse(numbers)],
  ['parse  with reviver', mixedCompact.length, () => XTJSON.parse(mixedCompact, (key, value) => value)],
  ['stringify  compact', mixedCompact.length, () => XTJSON.stringify(mixed)],
  ['stringify  compact (JSON.stringify)', mixedCompact.length, () => JSON.stringify(mixed)],
  ['stringify  indented', mixedXT.length, () => XTJSON.stringify(mixed, 2)],
  ['stringify  indented (JSON.stringify)', mixedIndented.length, () => JSON.stringify(mixed, null, 2)],
  ['stringify  config indented', config.length, () => XTJSON.stringify(configData, 2)],
  ['stringify  config, suffixes + single quotes', config.length, () => XTJSON.stringify(configData, 2, suffixOptions)],
  ['stringify  plain strings', plainStringsText.length, () => XTJSON.stringify(plainStrings)],
  ['stringify  escaped strings', escapedStringsText.length, () => XTJSON.stringify(escapedStrings, 2)],
  ['stringify  small document', SMALL.length, () => XTJSON.stringify({ name: 'demo-service', port: 8080, debug: false, hosts: ['a', 'b'] }, 2)],
];

// ---------------------------------------------------------------------------
// Measurement

let sink;

/** Median over the rounds of the calls per second. */
function measure(fn) {
  // Warm-up, and calibrate the number of calls per round.
  let calls = 1;
  for (;;) {
    const start = performance.now();
    for (let i = 0; i < calls; i++) sink = fn();
    const elapsed = performance.now() - start;
    if (elapsed >= ROUND_MS / 2) {
      calls = Math.max(1, Math.round((calls * ROUND_MS) / elapsed));
      break;
    }
    calls *= 2;
  }
  const rates = [];
  for (let round = 0; round < ROUNDS; round++) {
    const start = performance.now();
    for (let i = 0; i < calls; i++) sink = fn();
    rates.push((calls * 1000) / (performance.now() - start));
  }
  rates.sort((a, b) => a - b);
  return rates[ROUNDS >> 1];
}

function runtime() {
  if (globalThis.Bun) return `Bun ${globalThis.Bun.version}`;
  if (globalThis.Deno) return `Deno ${globalThis.Deno.version.deno}`;
  return `Node.js ${globalThis.process.versions.node}`;
}

const results = {};
if (!asJSON) console.log(`${runtime()}\n`);
for (const [name, size, fn] of CASES) {
  if (!name.includes(filter)) continue;
  const rate = measure(fn);
  const mbPerSecond = (rate * size) / 1e6;
  results[name] = { opsPerSecond: rate, megaCharsPerSecond: mbPerSecond };
  if (!asJSON) {
    console.log(`${name.padEnd(46)} ${rate.toFixed(rate < 100 ? 1 : 0).padStart(10)} ops/s ${mbPerSecond.toFixed(1).padStart(8)} Mchar/s`);
  }
}
if (asJSON) console.log(JSON.stringify({ runtime: runtime(), results }, null, 2));
if (sink === Symbol.for('never')) console.log(sink);
