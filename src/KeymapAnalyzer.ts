import * as vscode from 'vscode';
import Parser = require('web-tree-sitter');
import {
    Behavior,
    behaviorsToCompletions,
    behaviorsToSignatures,
    BINDINGS_BEHAVIORS,
    parameterToCompletions,
    SENSOR_BEHAVIORS,
} from './behaviors';

import * as keymap from './keymap';
import {
    KeymapParser,
    nodeAtPosition,
    findPreviousToken,
    asPosition,
    getPropertyName,
    isDescendantOf,
    getNodeRange,
    ParseChangedEvent,
} from './Parser';
import { Capture, Query, QueryResult } from './query';
import { truncateAtWhitespace } from './util';

const DIAGNOSTICS_UPDATE_DELAY = 500;

type CompletionResult = vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>>;
type SignatureResult = vscode.ProviderResult<vscode.SignatureHelp>;

/**
 * Manages all code analysis for .keymap files.
 */
export class KeymapAnalyzer implements vscode.CompletionItemProvider, vscode.SignatureHelpProvider, vscode.Disposable {
    private disposable: vscode.Disposable;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private errorQuery: Query;
    private updateTimeout?: NodeJS.Timeout;
    private staleDocuments: Set<vscode.TextDocument> = new Set();

    public constructor(private parser: KeymapParser) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('zmk-keymap');

        this.errorQuery = this.parser.query('(ERROR) @error');

        this.disposable = vscode.Disposable.from(
            this.diagnosticCollection,
            this.parser.onDidChangeParse(this.handleParseChanged, this),
            vscode.languages.registerCompletionItemProvider(keymap.SELECTOR, this, ' ', '&', '('),
            vscode.languages.registerSignatureHelpProvider(keymap.SELECTOR, this, ' ')
        );

        for (const document of vscode.workspace.textDocuments) {
            if (keymap.isKeymap(document)) {
                this.staleDocuments.add(document);
            }
        }
        this.setUpdateTimeout();
    }

    dispose() {
        this.clearUpdateTimeout();
        this.disposable.dispose();
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): CompletionResult {
        return getCompletions(this.getAnalysisArgs(document, position), context);
    }

    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext
    ): SignatureResult {
        return getSignatureHelp(this.getAnalysisArgs(document, position), context);
    }

    private handleParseChanged(e: ParseChangedEvent) {
        this.staleDocuments.add(e.document);
        this.setUpdateTimeout();
    }

    private getAnalysisArgs(document: vscode.TextDocument, position: vscode.Position): AnalysisArgs {
        const tree = this.parser.parse(document);
        let node = nodeAtPosition(tree.rootNode, position);
        let isAfter = false;

        const prevToken = findPreviousToken(document, position);
        const prevNode = prevToken ? nodeAtPosition(tree.rootNode, prevToken) : undefined;

        if (prevNode && isDescendantOf(prevNode, node)) {
            isAfter = asPosition(prevNode.endPosition).isBefore(position);
            node = prevNode;
        }

        return { document, position, node, isAfter };
    }

    private clearUpdateTimeout() {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
    }

    private setUpdateTimeout() {
        this.clearUpdateTimeout();
        this.updateTimeout = setTimeout(() => {
            for (const document of this.staleDocuments) {
                this.updateDiagnostics(document);
            }
            this.staleDocuments.clear();
        }, DIAGNOSTICS_UPDATE_DELAY);
    }

    private updateDiagnostics(document: vscode.TextDocument) {
        const tree = this.parser.parse(document);

        this.diagnosticCollection.delete(document.uri);

        if (tree.rootNode.hasError()) {
            const diagnostics: vscode.Diagnostic[] = [];

            const errors = this.errorQuery.matches(tree.rootNode);
            for (const capture of getCaptures(errors)) {
                // TODO: provide a more meaningful error message
                // see https://github.com/tree-sitter/tree-sitter/issues/255
                const range = getNodeRange(capture.node);
                diagnostics.push(new vscode.Diagnostic(range, 'Syntax error', vscode.DiagnosticSeverity.Error));
            }

            // TODO: search for missing nodes too.

            this.diagnosticCollection.set(document.uri, diagnostics);
        }
    }
}

function* getCaptures(matches: QueryResult[]): Generator<Capture> {
    for (const match of matches) {
        for (const capture of match.captures) {
            yield capture;
        }
    }
}

interface AnalysisArgs {
    document: vscode.TextDocument;
    position: vscode.Position;
    node: Parser.SyntaxNode;
    isAfter: boolean;
}

function getCompletions(args: AnalysisArgs, context: vscode.CompletionContext): CompletionResult {
    const property = getPropertyName(args.node);
    if (property) {
        return getCompletionsForProperty(args, property);
    }

    return undefined;
}

function getSignatureHelp(args: AnalysisArgs, context: vscode.SignatureHelpContext): SignatureResult {
    const property = getPropertyName(args.node);
    if (property) {
        return getSignaturesForProperty(args, property);
    }

    return undefined;
}

function getCompletionsForProperty(args: AnalysisArgs, property: string): CompletionResult {
    switch (property) {
        case 'bindings':
            return getCompletionsForBindings(args, BINDINGS_BEHAVIORS);

        case 'sensor-bindings':
            return getCompletionsForBindings(args, SENSOR_BEHAVIORS);
    }

    return undefined;
}

function getSignaturesForProperty(args: AnalysisArgs, property: string): SignatureResult {
    switch (property) {
        case 'bindings':
            return getSignaturesForBindings(args, BINDINGS_BEHAVIORS);

        case 'sensor-bindings':
            return getSignaturesForBindings(args, SENSOR_BEHAVIORS);
    }

    return undefined;
}

function getCompletionsForBindings(args: AnalysisArgs, validBehaviors: readonly Behavior[]): CompletionResult {
    const { node } = args;
    if (node.type === 'integer_cells') {
        return getCompletionsForBehaviors(args, validBehaviors);
    }

    const { behavior, paramIndex } = findCurrentBehavior(args);
    if (behavior) {
        if (paramIndex !== undefined) {
            return getBehaviorParamCompletions(args, validBehaviors, behavior, paramIndex);
        }

        return getCompletionsForBehaviors(args, validBehaviors, behavior);
    }

    return undefined;
}

function getSignaturesForBindings(args: AnalysisArgs, validBehaviors: readonly Behavior[]): SignatureResult {
    const { behavior, paramIndex } = findCurrentBehavior(args);
    if (behavior && paramIndex !== undefined) {
        const filteredBehaviors = filterBehaviors(validBehaviors, behavior);
        const signatures = behaviorsToSignatures(filteredBehaviors, paramIndex);
        return {
            signatures,
            activeSignature: 0, // TODO?
            activeParameter: paramIndex,
        };
    }

    return undefined;
}

function getCompletionsForBehaviors(
    args: AnalysisArgs,
    validBehaviors: readonly Behavior[],
    behavior?: Parser.SyntaxNode
): CompletionResult {
    if (behavior) {
        let range = getNodeRange(behavior);
        if (!range.isSingleLine) {
            range = range.with({ end: args.position });
        }

        return behaviorsToCompletions(filterBehaviors(validBehaviors, behavior), range);
    }

    return behaviorsToCompletions(validBehaviors);
}

function getBehaviorParamCompletions(
    args: AnalysisArgs,
    validBehaviors: readonly Behavior[],
    behaviorNode: Parser.SyntaxNode,
    paramIndex: number
): CompletionResult {
    const filteredBehaviors = filterBehaviors(validBehaviors, behaviorNode);

    if (filteredBehaviors.length > 0) {
        const behavior = filteredBehaviors[0];
        if (paramIndex < behavior.parameters.length) {
            return parameterToCompletions(behavior.parameters[paramIndex]);
        }
    }

    // This is after the last parameter for the behavior. Suggest a new
    // behavior instead.
    return getCompletionsForBehaviors(args, validBehaviors);
}

interface BehaviorLocation {
    behavior: Parser.SyntaxNode | null;
    paramIndex?: number;
}

function findCurrentBehavior({ node, isAfter }: AnalysisArgs): BehaviorLocation {
    // Find the child of the integer cells array we're in.
    let current: Parser.SyntaxNode | null = node;
    while (current && current.parent?.type !== 'integer_cells') {
        current = current.parent;
    }

    if (!current) {
        return { behavior: null };
    }

    if (current.type === 'reference') {
        // We're inside the reference node.
        return { behavior: current, paramIndex: isAfter ? 0 : undefined };
    }

    // Walk back through siblings until we find the reference node.
    let paramIndex = isAfter ? 0 : -1;
    while (current && current.type !== 'reference') {
        paramIndex++;
        current = current.previousNamedSibling;
    }

    if (!current) {
        // Reached start without finding a reference node.
        return { behavior: null };
    }

    return { behavior: current, paramIndex };
}

function filterBehaviors(validBehaviors: readonly Behavior[], behavior: Parser.SyntaxNode): Behavior[] {
    const text = truncateAtWhitespace(behavior.text);
    let filtered = validBehaviors.filter((b) => {
        if (!b.label.startsWith(text)) {
            return false;
        }

        if (b.isMatch) {
            return b.isMatch(behavior);
        }

        return true;
    });

    return filtered;
}
