import * as vscode from 'vscode';

export const SELECTOR: vscode.DocumentSelector = {
    pattern: '**/*.keymap',
    scheme: 'file',
};

export function isKeymap(document: vscode.TextDocument) {
    return document.uri.path.endsWith('.keymap');
}
