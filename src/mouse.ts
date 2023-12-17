import * as vscode from 'vscode';
import { IncludeInfo, addMissingSystemInclude } from './keymap';

const MOUSE_INCLUDE = 'dt-bindings/zmk/mouse.h';

// TODO: parse this from dt-bindings/zmk/mouse.h?
const mouseButtonCompletions: vscode.CompletionItem[] = [
    {
        label: 'LCLK',
        kind: vscode.CompletionItemKind.EnumMember,
        documentation: 'Left click',
    },
    {
        label: 'RCLK',
        kind: vscode.CompletionItemKind.EnumMember,
        documentation: 'Right click',
    },
    {
        label: 'MCLK',
        kind: vscode.CompletionItemKind.EnumMember,
        documentation: 'Middle click',
    },
    {
        label: 'MB1',
        kind: vscode.CompletionItemKind.EnumMember,
        documentation: 'Mouse button 1 (left click)',
    },
    {
        label: 'MB2',
        kind: vscode.CompletionItemKind.EnumMember,
        documentation: 'Mouse button 2 (right click)',
    },
    {
        label: 'MB3',
        kind: vscode.CompletionItemKind.EnumMember,
        documentation: 'Mouse button 3 (middle click)',
    },
    {
        label: 'MB4',
        kind: vscode.CompletionItemKind.EnumMember,
        documentation: 'Mouse button 4',
    },
    {
        label: 'MB5',
        kind: vscode.CompletionItemKind.EnumMember,
        documentation: 'Mouse button 5',
    },
];

export function getMouseButtonCompletions(includeInfo: IncludeInfo): vscode.CompletionItem[] {
    const additionalTextEdits = addMissingSystemInclude(includeInfo, MOUSE_INCLUDE);
    if (additionalTextEdits.length > 0) {
        return mouseButtonCompletions.map((item) => {
            return { ...item, additionalTextEdits };
        });
    }

    return mouseButtonCompletions;
}
