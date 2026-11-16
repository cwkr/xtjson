/**
 * VS Code extension for XTJSON: registers the formatter and the folding
 * ranges. Syntax highlighting and the language configuration are declared in
 * package.json.
 */

import * as vscode from 'vscode';
import { formatText } from './format.js';
import { foldingRanges } from './folding.js';

const SELECTOR = { language: 'xtjson' };

const KINDS = {
  comment: vscode.FoldingRangeKind.Comment,
  region: vscode.FoldingRangeKind.Region,
};

/** @param {vscode.ExtensionContext} context */
export function activate(context) {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(SELECTOR, {
      provideDocumentFormattingEdits(document, options) {
        const text = document.getText();
        const formatted = formatText(text, options);
        // VS Code converts the LF line breaks to the line ending of the document.
        if (formatted === text.replace(/\r\n?/g, '\n')) return [];
        const all = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
        return [vscode.TextEdit.replace(all, formatted)];
      },
    }),
    vscode.languages.registerFoldingRangeProvider(SELECTOR, {
      provideFoldingRanges(document) {
        return foldingRanges(document.getText()).map(
          (r) => new vscode.FoldingRange(r.start, r.end, r.kind && KINDS[r.kind]),
        );
      },
    }),
  );
}

export function deactivate() {}
