/**
 * Formatting of XTJSON documents with `format` from xtjson-js.
 */

import { format } from '@cwkr/xtjson';

/**
 * Formats a whole document with the editor's indentation settings.
 *
 * `format` does not validate the document: a valid document keeps its value,
 * an invalid one is formatted as far as possible. A line break at the end of
 * the document is kept.
 *
 * @param {string} text the document
 * @param {{ tabSize: number, insertSpaces: boolean }} options
 * @returns {string} the formatted text, with LF line breaks
 */
export function formatText(text, options) {
  const space = options.insertSpaces ? Math.max(1, Math.min(10, options.tabSize || 2)) : '\t';
  const formatted = format(text, space);
  return formatted !== '' && /[\r\n]$/.test(text) ? formatted + '\n' : formatted;
}
