/**
 * Formatter for XTJSON: lays out a document again with a given indentation,
 * as `JSON.stringify` would, but keeps comments and the notation of names
 * and values.
 *
 * The formatter does not parse or validate the document. It splits the text
 * into simple tokens (brackets, `,`, `:`, `=`, comments, strings and
 * everything else) and works on a best-effort basis: a valid document stays valid and
 * keeps its value, an invalid one is formatted as far as possible.
 */

const CLOSING = { '{': '}', '[': ']' };

/**
 * Indentation from the `space` argument, as in JSON.stringify: at most 10
 * spaces, or the first 10 characters of a string of spaces and tabs.
 * @param {unknown} space
 * @throws {TypeError} if `space` is not a number or a string, or a string
 *   with characters other than spaces and tabs
 */
function indentation(space) {
  if (space instanceof Number) space = Number(space);
  else if (space instanceof String) space = String(space);
  if (typeof space === 'number') {
    const n = Math.min(10, Math.trunc(space) || 0);
    return n >= 1 ? ' '.repeat(n) : '';
  }
  if (typeof space === 'string') {
    const gap = space.slice(0, 10);
    if (!/^[ \t]*$/.test(gap)) {
      throw new TypeError('format: "space" may only contain spaces and tabs; other characters would make the indentation invalid');
    }
    return gap;
  }
  if (space !== undefined && space !== null) {
    throw new TypeError(`format: space must be a number or a string, not ${typeof space}`);
  }
  return '';
}

/**
 * Formats an XTJSON document.
 *
 * With indentation, every member and array item is placed on a line of its
 * own, indented by `space` per level, a space follows each `:`, and at most
 * one blank line between items is kept. The directive (`%strict: true`) is
 * laid out like a member. Without indentation (`space`
 * omitted, 0 or ''), line breaks and white space are removed where possible;
 * a line break that separates two items becomes a comma, and a line comment
 * still ends its line.
 *
 * @param {string} text the document; converted to a string
 * @param {number | string | null} [space] indentation, as in `JSON.stringify`: a
 *   number of spaces (at most 10) or a string of spaces and tabs
 * @returns {string} the formatted text, without a line break at the end
 * @throws {TypeError} if `space` is invalid
 */
export function format(text, space) {
  const gap = indentation(space);
  const tokens = tokenize(String(text).replace(/\r\n?/g, '\n'));
  const lines = [];
  let line = '';
  let depth = 0;
  let pending = 0; // line breaks before the next token: 0, 1, or 2 for a blank line
  let ended = false; // the last token that is not a comment ends a value
  let previous = ''; // type of the previous token

  const put = (s, separator) => {
    if (line !== '' && pending > 0) {
      lines.push(line);
      if (pending > 1) lines.push('');
      line = '';
    }
    pending = 0;
    line = line === '' ? gap.repeat(depth) + s : line + separator + s;
  };

  for (let i = 0; i < tokens.length; i++) {
    const { type, text: s, breaks } = tokens[i];
    const startsValue = type === 'value' || type === 'open';
    // A line break between two items replaces the comma (7.3).
    const separates = breaks > 0 && ended && startsValue;
    if (gap !== '') {
      const keep = startsValue || type === 'comment';
      if (breaks > 1 && keep && previous !== 'open' && previous !== 'colon') pending = 2;
      else if (breaks > 0 && (separates || type === 'comment' || previous === 'comment')) pending = Math.max(pending, 1);
    } else if (separates && pending === 0) {
      put(',', '');
      ended = false;
      previous = 'comma';
    }

    switch (type) {
      case 'open':
      case 'value': {
        const spaced = ended || previous === 'comment' || (previous === 'colon' && gap !== '');
        put(gap !== '' ? reindent(s, gap.repeat(depth + 1)) : s, spaced ? ' ' : '');
        ended = type === 'value';
        if (type === 'open') {
          const next = tokens[i + 1];
          if (next && next.text === CLOSING[s]) {
            put(next.text, '');
            ended = true;
            previous = 'close';
            i++;
            continue;
          } else {
            depth++;
            if (gap !== '') pending = Math.max(pending, 1);
          }
        }
        break;
      }
      case 'close':
        depth = Math.max(0, depth - 1);
        if (gap !== '') pending = Math.max(pending, 1);
        put(s, '');
        ended = true;
        break;
      case 'comma':
        put(s, '');
        if (gap !== '') pending = Math.max(pending, 1);
        ended = false;
        break;
      case 'colon':
        put(s, '');
        ended = false;
        break;
      case 'comment': {
        // A comment on the line of the previous token stays there.
        const after = breaks === 0 ? pending : 0;
        if (breaks === 0) pending = 0;
        put(s, ' ');
        pending = s.startsWith('/*') ? after : Math.max(after, 1);
        break;
      }
    }
    previous = type;
  }
  if (line !== '') lines.push(line);
  return lines.join('\n');
}

/**
 * Splits the text into tokens of the types open, close, comma, colon,
 * comment and value (strings and everything else). `breaks` is the number of
 * line breaks before the token.
 */
function tokenize(text) {
  const tokens = [];
  const until = (index, length) => (index < 0 ? text.length : index + length);
  let breaks = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\n') breaks++;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const start = i;
    let type = 'value';
    if (c === '{' || c === '[') {
      type = 'open';
      i++;
    } else if (c === '}' || c === ']') {
      type = 'close';
      i++;
    } else if (c === ',' || c === ':') {
      type = c === ',' ? 'comma' : 'colon';
      i++;
    } else if (c === '#' || text.startsWith('//', i)) {
      type = 'comment';
      i = until(text.indexOf('\n', i), 0);
    } else if (text.startsWith('/*', i)) {
      type = 'comment';
      i = until(text.indexOf('*/', i + 2), 2);
    } else if (c === '"' || c === "'") {
      i = stringEnd(text, i);
    } else {
      while (i < text.length && !/[\s{}[\],:"'#]/.test(text[i]) &&
        !text.startsWith('//', i) && !text.startsWith('/*', i)) i++;
    }
    tokens.push({ type, text: text.slice(start, i), breaks });
    breaks = 0;
  }
  return tokens;
}

/**
 * End of the string that begins at `i`: behind its closing quotation mark,
 * or the end of the text. A string may extend across several lines (8.1).
 */
function stringEnd(text, i) {
  const quote = text[i];
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++;
    else if (text[j] === quote) return j + 1;
  }
  return text.length;
}

/**
 * Indents a string across several lines that begins with an empty line by
 * `indent` instead of its smallest indentation, which keeps its value (8.3).
 * Other strings, strings whose indentation is not uniform, and strings with
 * white space after a backslash at the end of a line (an error, which
 * removing that white space would hide) are returned unchanged.
 */
function reindent(s, indent) {
  const lines = s.split('\n');
  if (lines.length < 2 || !/^["'][ \t]*$/.test(lines[0])) return s;
  const last = lines.length - 1;
  if (lines.some((l, k) => k < last && /(?:^|[^\\])(?:\\\\)*\\[ \t]+$/.test(l))) return s;
  // White space at the end of a line is removed by the rules anyway. A line
  // that ends with a line continuation ends with its backslash.
  const text = lines.map((l, k) => (k === last ? l : l.replace(/[ \t]+$/, '')));
  const counted = text.filter((l, k) => k > 0 && (l !== '' || k === last));
  const min = Math.min(...counted.map((l) => /^[ \t]*/.exec(l)[0].length));
  const removed = text[last].slice(0, min);
  if (!counted.every((l) => l.startsWith(removed))) return s;
  return text.map((l, k) => (k === 0 || l === '' ? l : indent + l.slice(min))).join('\n');
}
