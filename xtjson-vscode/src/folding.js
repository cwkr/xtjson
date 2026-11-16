/**
 * Folding ranges for XTJSON documents.
 *
 * The scanner is lexical, like the formatter of xtjson-js: it knows strings
 * and comments, so that brackets inside them are ignored, but it does not
 * check the structure of the document. Unmatched brackets are skipped.
 */

/**
 * @typedef {{ start: number, end: number, kind?: 'comment' | 'region' }} Range
 *   zero-based line numbers; `end` is the last line that is folded
 */

const REGION_START = /^(?:\/\/|#)\s*#?region\b/;
const REGION_END = /^(?:\/\/|#)\s*#?endregion\b/;
const CLOSING = { '{': '}', '[': ']' };

/**
 * Computes the folding ranges of a document: objects and arrays, strings
 * across several lines, block comments, runs of line comments, and regions marked with
 * `// #region` and `// #endregion` (or `#region` and `#endregion`).
 *
 * @param {string} text the document
 * @returns {Range[]}
 */
export function foldingRanges(text) {
  /** @type {Range[]} */
  const ranges = [];
  /** @type {{ char: string, line: number }[]} */
  const brackets = [];
  /** @type {number[]} */
  const regions = [];
  let commentRun = null; // { start, end } of consecutive lines that hold only a line comment
  let line = 0;
  let lineHasToken = false;
  let i = 0;

  const add = (start, end, kind) => {
    if (end > start) ranges.push(kind ? { start, end, kind } : { start, end });
  };
  const closeCommentRun = () => {
    if (commentRun) add(commentRun.start, commentRun.end, 'comment');
    commentRun = null;
  };
  const newline = () => {
    if (text[i] === '\r' && text[i + 1] === '\n') i++;
    i++;
    line++;
    lineHasToken = false;
  };
  /** Skips to `end` and counts the line breaks on the way; returns the line of the end. */
  const skipTo = (end) => {
    for (; i < end; i++) {
      if (text[i] === '\n' || (text[i] === '\r' && text[i + 1] !== '\n')) line++;
    }
    return line;
  };

  while (i < text.length) {
    const c = text[i];
    if (c === '\n' || c === '\r') {
      newline();
      continue;
    }
    if (/\s/.test(c)) {
      i++;
      continue;
    }

    // Line comment
    if (c === '#' || text.startsWith('//', i)) {
      let end = i;
      while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end++;
      const comment = text.slice(i, end);
      i = end;
      if (lineHasToken) continue;
      if (REGION_START.test(comment)) {
        closeCommentRun();
        regions.push(line);
      } else if (REGION_END.test(comment)) {
        closeCommentRun();
        if (regions.length > 0) add(regions.pop(), line, 'region');
      } else if (commentRun && commentRun.end === line - 1) {
        commentRun.end = line;
      } else {
        closeCommentRun();
        commentRun = { start: line, end: line };
      }
      lineHasToken = true;
      continue;
    }

    if (commentRun && commentRun.end !== line) closeCommentRun();
    lineHasToken = true;
    const start = line;

    // Block comment
    if (text.startsWith('/*', i)) {
      const close = text.indexOf('*/', i + 2);
      const end = skipTo(close < 0 ? text.length : close + 2);
      add(start, end, 'comment');
      continue;
    }

    // Strings: a string may extend across several lines (8.1) and folds up
    // to the line before its closing quotation mark.
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1;
      const end = skipTo(Math.min(text.length, j + 1));
      add(start, end - 1);
      continue;
    }

    // Objects and arrays
    if (c === '{' || c === '[') {
      brackets.push({ char: c, line });
    } else if (c === '}' || c === ']') {
      // Unmatched brackets are skipped: look for the nearest matching opening one.
      for (let k = brackets.length - 1; k >= 0; k--) {
        if (CLOSING[brackets[k].char] === c) {
          add(brackets[k].line, line - 1);
          brackets.length = k;
          break;
        }
      }
    }
    i++;
  }
  closeCommentRun();
  return ranges.sort((a, b) => a.start - b.start || b.end - a.end);
}
