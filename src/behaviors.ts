import * as vscode from 'vscode';
import behaviorsFile = require('./behaviors.yaml');
import Parser = require('web-tree-sitter');

import { getKeycodeCompletions, getModifierCompletions } from './keycodes';
import { IncludeInfo, addMissingSystemInclude } from './keymap';
import { getMouseButtonCompletions } from './mouse';
import { camelCaseToWords, truncateAtWhitespace } from './util';

const BEHAVIORS_INCLUDE = 'behaviors.dtsi';
const PREFERRED_BEHAVIOR = '&kp';

export interface ParameterValue {
    label: string;
    documentation?: string;
}

export type ParameterType = 'keycode' | 'modifier' | 'mouseButton' | 'integer' | ParameterValue[];

export type Parameter = vscode.ParameterInformation & {
    type?: ParameterType;
    include?: string;
};

export interface BehaviorFilter {
    params?: string[];
    paramsNot?: string[];
}

export interface Behavior {
    label: string;
    documentation?: string;
    parameters: Parameter[];
    if?: BehaviorFilter;
}

interface BehaviorsDocument {
    behaviors: Record<string, Behavior[]>;
    macroBehaviors: Record<string, Behavior[]>;
}

const BEHAVIORS = (behaviorsFile as BehaviorsDocument).behaviors;
const MACRO_BEHAVIORS = (behaviorsFile as BehaviorsDocument).macroBehaviors;

function isParamMatch(behavior: Parser.SyntaxNode, params: readonly string[]) {
    let node = behavior.nextNamedSibling;
    for (const param of params) {
        if (!node || node.text !== param) {
            return false;
        }

        node = node.nextNamedSibling;
    }

    return true;
}

export function getBehaviors(property: string, compatible?: string): readonly Behavior[] | undefined {
    if (compatible === 'zmk,behavior-macro') {
        const result = (BEHAVIORS[property] ?? []).concat(MACRO_BEHAVIORS[property] ?? []);
        return result.length > 0 ? result : undefined;
    }

    return BEHAVIORS[property];
}

export function testBehavior(behavior: Parser.SyntaxNode, filter: BehaviorFilter | BehaviorFilter[]): boolean {
    if (Array.isArray(filter)) {
        return filter.every((f) => testBehavior(behavior, f));
    }

    if (filter.params && !isParamMatch(behavior, filter.params)) {
        return false;
    }

    if (filter.paramsNot && isParamMatch(behavior, filter.paramsNot)) {
        return false;
    }

    return true;
}

/**
 * Gets a list of function signatures for behaviors.
 * @param behaviors A list of behaviors valid for this location.
 * @param activeParameter The index of the active parameter. The returned
 *      signatures will be filtered to those where this is a valid parameter.
 */
export function behaviorsToSignatures(
    behaviors: readonly Behavior[],
    activeParameter?: number,
): vscode.SignatureInformation[] {
    let filtered: readonly Behavior[] = behaviors;

    if (activeParameter !== undefined) {
        filtered = behaviors.filter((b) => activeParameter < b.parameters.length);
    }

    return filtered.map((b) => {
        const sig = new vscode.SignatureInformation(b.label, new vscode.MarkdownString(b.documentation));
        sig.parameters = b.parameters.map(getParameterInformation);
        sig.activeParameter = activeParameter;
        return sig;
    });
}

/**
 * Gets a list of code completions for behaviors.
 * @param behaviors A list of behaviors valid for this location.
 * @param range The range to replace when a completion is committed.
 */
export function behaviorsToCompletions(
    behaviors: readonly Behavior[],
    includeInfo: IncludeInfo,
    range?: vscode.Range,
): vscode.CompletionItem[] {
    const additionalTextEdits = addMissingSystemInclude(includeInfo, BEHAVIORS_INCLUDE);

    function getEntry(b: Behavior): [string, vscode.CompletionItem] {
        const label = truncateAtWhitespace(b.label);
        const completion = new vscode.CompletionItem(label, vscode.CompletionItemKind.Function);
        completion.documentation = new vscode.MarkdownString(b.documentation);
        completion.range = range;
        completion.additionalTextEdits = additionalTextEdits;

        // TODO: remember the last-used behavior and prefer that.
        if (label === PREFERRED_BEHAVIOR) {
            completion.preselect = true;
        }

        return [label, completion];
    }

    const dedupe = new Map(behaviors.map(getEntry));

    return [...dedupe.values()];
}

/**
 * Gets a list of code completions for the active parameter.
 * @param parameter The active parameter.
 */
export function parameterToCompletions(parameter: Parameter, includeInfo: IncludeInfo): vscode.CompletionItem[] {
    if (Array.isArray(parameter.type)) {
        const additionalTextEdits = parameter.include ? addMissingSystemInclude(includeInfo, parameter.include) : [];

        return parameter.type.map((v) => {
            const completion = new vscode.CompletionItem(v.label, vscode.CompletionItemKind.EnumMember);
            completion.documentation = new vscode.MarkdownString(v.documentation);
            completion.additionalTextEdits = additionalTextEdits;

            return completion;
        });
    }

    switch (parameter.type) {
        case 'keycode':
            return getKeycodeCompletions(includeInfo);

        case 'modifier':
            return getModifierCompletions(includeInfo);

        case 'mouseButton':
            return getMouseButtonCompletions(includeInfo);
    }

    return [];
}

/**
 * Gets the ParameterInformation for a parameter
 */
function getParameterInformation(parameter: Parameter): vscode.ParameterInformation {
    let documentation = parameter.documentation;
    if (typeof documentation === 'string' && parameter.type) {
        const typeName = camelCaseToWords(parameter.type as string);

        documentation = new vscode.MarkdownString(`\`${typeName}\`: ${documentation}`);
    }

    return { label: parameter.label, documentation };
}
