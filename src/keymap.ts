import * as vscode from 'vscode';

export const SELECTOR: vscode.DocumentSelector = {
    pattern: '**/*.keymap',
};

export function isKeymap(document: vscode.TextDocument) {
    return document.uri.path.endsWith('.keymap');
}

export interface IncludeInfo {
    /** existing includes */
    paths: string[];
    /** location where a new include can be inserted */
    insertPosition: vscode.Position;
}

export function addMissingSystemInclude(includeInfo: IncludeInfo, path: string): vscode.TextEdit[] {
    if (includeInfo.paths.includes(path)) {
        return [];
    }

    return [getSystemIncludeTextEdit(includeInfo.insertPosition, path)];
}

function getSystemIncludeTextEdit(position: vscode.Position, path: string): vscode.TextEdit {
    return vscode.TextEdit.insert(position, `#include <${path}>\n`);
}
