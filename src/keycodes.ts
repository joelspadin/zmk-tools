import markdownEscape from 'markdown-escape';
import * as vscode from 'vscode';

import { addMissingSystemInclude, IncludeInfo } from './keymap';
import codes from './zmk/data/hid';
import oses from './zmk/data/operating-systems';

type KeyDefinition = (typeof codes)[number];
type OsKey = keyof KeyDefinition['os'];

const KEYS_INCLUDE = 'dt-bindings/zmk/keys.h';

const keycodeCompletions: vscode.CompletionItem[] = [];
const modifierCompletions: vscode.CompletionItem[] = [];

/**
 * Gets completion items for a keycode value.
 */
export function getKeycodeCompletions(includeInfo: IncludeInfo): vscode.CompletionItem[] {
    if (keycodeCompletions.length === 0) {
        initKeycodeCompletions();
    }

    const additionalTextEdits = addMissingSystemInclude(includeInfo, KEYS_INCLUDE);
    if (additionalTextEdits.length > 0) {
        return keycodeCompletions.map((item) => {
            return { ...item, additionalTextEdits };
        });
    }

    return keycodeCompletions;
}

/**
 * Gets completion items for a modifier value.
 */
export function getModifierCompletions(includeInfo: IncludeInfo): vscode.CompletionItem[] {
    if (modifierCompletions.length === 0) {
        initModifierCompletions();
    }

    const additionalTextEdits = addMissingSystemInclude(includeInfo, KEYS_INCLUDE);
    if (additionalTextEdits.length > 0) {
        return modifierCompletions.map((item) => {
            return { ...item, additionalTextEdits };
        });
    }

    return modifierCompletions;
}

function initKeycodeCompletions() {
    for (const definition of codes) {
        addKeyDefinition(definition);
    }
}

function addKeyDefinition(def: KeyDefinition) {
    const documentation = getKeyDocumentation(def);

    for (const name of def.names) {
        const completion: vscode.CompletionItem = {
            label: name,
            detail: def.context,
            kind: vscode.CompletionItemKind.EnumMember,
            documentation,
        };

        if (isMacro(name)) {
            // Don't insert the "(code)" part of a macro.
            // TODO: can this be implemented so that committing with tab/enter
            // also inserts the parenthesis?
            completion.insertText = name.split('(')[0];
            completion.commitCharacters = ['('];
        }

        keycodeCompletions.push(completion);
    }
}

function initModifierCompletions() {
    for (const definition of codes) {
        addModifierDefinition(definition);
    }
}

function addModifierDefinition(def: KeyDefinition) {
    // Keys with a macro as a possible name are modifiers.
    if (!def.names.some(isMacro)) {
        return;
    }

    const documentation = getKeyDocumentation(def);

    for (const name of def.names) {
        // ...but the macro itself is only valid as a modifier to a keycode.
        if (isMacro(name)) {
            continue;
        }

        const completion: vscode.CompletionItem = {
            label: name,
            detail: 'Modifier',
            kind: vscode.CompletionItemKind.EnumMember,
            documentation,
        };

        modifierCompletions.push(completion);
    }
}

function getKeyDocumentation(def: KeyDefinition) {
    const support = oses.map((os) => `* ${os.title}: ${supportIcon(def.os[os.key as OsKey])}`);

    let aliases = '';
    if (def.names.length > 1) {
        aliases = 'Aliases: ' + def.names.map((n) => `\`${n}\``).join(', ');
    }

    const markdown = `${markdownEscape(def.description)}\n\n${aliases}\n\n${support.join('\n')}`;

    return new vscode.MarkdownString(markdown, true);
}

function isMacro(name: string): boolean {
    return name.includes('(');
}

function supportIcon(support: boolean | null): string {
    if (support === true) {
        return '✔️';
    }

    if (support === false) {
        return '❌';
    }

    return '❔';
}
