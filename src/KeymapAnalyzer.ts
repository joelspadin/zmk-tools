import * as vscode from 'vscode';
import type Parser from 'web-tree-sitter';
import {
    KeymapParser,
    ParseChangedEvent,
    asPosition,
    findPreviousToken,
    getAncesorOfType,
    getCompatible,
    getNodeRange,
    getPropertyName,
    isDescendantOf,
    nodeAtPosition,
    nodesEqual,
} from './Parser';
import {
    Behavior,
    behaviorsToCompletions,
    behaviorsToSignatures,
    getBehaviors,
    parameterToCompletions,
    testBehavior,
} from './behaviors';
import * as keymap from './keymap';
import { IncludeInfo } from './keymap';
import { stripIncludeQuotes, truncateAtWhitespace } from './util';

const DIAGNOSTICS_UPDATE_DELAY = 500;

type CompletionResult = vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>>;
type SignatureResult = vscode.ProviderResult<vscode.SignatureHelp>;

/**
 * Manages all code analysis for .keymap files.
 */
export class KeymapAnalyzer implements vscode.CompletionItemProvider, vscode.SignatureHelpProvider, vscode.Disposable {
    private disposable: vscode.Disposable;
    private diagnosticCollection: vscode.DiagnosticCollection;
    // private errorQuery: Parser.Query;
    private includeQuery: Parser.Query;
    private updateTimeout?: ReturnType<typeof setTimeout>;
    private staleDocuments: Set<vscode.TextDocument> = new Set();

    public constructor(private parser: KeymapParser) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('zmk-keymap');

        // this.errorQuery = this.parser.query('(ERROR) @error');
        this.includeQuery = this.parser.query('(preproc_include path: (_) @include)');

        this.disposable = vscode.Disposable.from(
            this.diagnosticCollection,
            this.parser.onDidChangeParse(this.handleParseChanged, this),
            vscode.languages.registerCompletionItemProvider(keymap.SELECTOR, this, ' ', '&', '('),
            vscode.languages.registerSignatureHelpProvider(keymap.SELECTOR, this, ' '),
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
        context: vscode.CompletionContext,
    ): CompletionResult {
        return this.getCompletions(this.getAnalysisArgs(document, position, context));
    }

    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext,
    ): SignatureResult {
        return this.getSignatureHelp(this.getAnalysisArgs(document, position, context));
    }

    private handleParseChanged(e: ParseChangedEvent) {
        this.staleDocuments.add(e.document);
        this.setUpdateTimeout();
    }

    private getAnalysisArgs<T>(document: vscode.TextDocument, position: vscode.Position, context: T): AnalysisArgs<T> {
        const tree = this.parser.parse(document);
        let node = nodeAtPosition(tree.rootNode, position);
        let isAfter = false;

        const prevToken = findPreviousToken(document, position);
        const prevNode = prevToken ? nodeAtPosition(tree.rootNode, prevToken) : undefined;

        if (prevNode && isDescendantOf(prevNode, node)) {
            isAfter = asPosition(prevNode.endPosition).isBefore(position);
            node = prevNode;
        }

        return { document, position, context, node, isAfter };
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
        // TODO: Disabled until tree-sitter provides better error diagnostics.
        // const tree = this.parser.parse(document);
        // this.diagnosticCollection.delete(document.uri);
        // if (tree.rootNode.hasError()) {
        //     const diagnostics: vscode.Diagnostic[] = [];
        //     const errors = this.errorQuery.matches(tree.rootNode);
        //     for (const capture of getCaptures(errors)) {
        //         // TODO: provide a more meaningful error message
        //         // see https://github.com/tree-sitter/tree-sitter/issues/255
        //         const range = getNodeRange(capture.node);
        //         diagnostics.push(new vscode.Diagnostic(range, 'Syntax error', vscode.DiagnosticSeverity.Error));
        //     }
        //     // TODO: search for missing nodes too.
        //     this.diagnosticCollection.set(document.uri, diagnostics);
        // }
    }

    private getIncludeInfo(document: vscode.TextDocument): IncludeInfo {
        const tree = this.parser.parse(document);
        const includes = this.includeQuery.matches(tree.rootNode);

        const captures = [...getCaptures(includes)];

        let insertPosition: vscode.Position;

        if (captures.length > 0) {
            insertPosition = asPosition(captures[captures.length - 1].node.endPosition)
                .translate({ lineDelta: 1 })
                .with({ character: 0 });
        } else {
            insertPosition = findFirstPositionForInclude(document, tree);
        }

        return {
            paths: captures.map((capture) => stripIncludeQuotes(capture.node.text)),
            insertPosition,
        };
    }

    private getCompletions(args: CompletionArgs): CompletionResult {
        const property = getPropertyName(args.node);
        if (property) {
            const compatible = getCompatible(args.node);
            return this.getCompletionsForProperty(args, property, compatible);
        }

        return undefined;
    }

    private getSignatureHelp(args: SignatureArgs): SignatureResult {
        const property = getPropertyName(args.node);
        if (property) {
            const compatible = getCompatible(args.node);
            return this.getSignaturesForProperty(args, property, compatible);
        }

        return undefined;
    }

    private getCompletionsForProperty(args: CompletionArgs, property: string, compatible?: string): CompletionResult {
        const behaviors = getBehaviors(property, compatible);
        if (behaviors) {
            return this.getCompletionsForBindings(args, behaviors);
        }
        return undefined;
    }

    private getSignaturesForProperty(args: SignatureArgs, property: string, compatible?: string): SignatureResult {
        const behaviors = getBehaviors(property, compatible);
        if (behaviors) {
            return this.getSignaturesForBindings(args, behaviors);
        }
        return undefined;
    }

    private getCompletionsForBindings(args: CompletionArgs, validBehaviors: readonly Behavior[]): CompletionResult {
        const { node } = args;
        if (node.type === 'integer_cells') {
            return this.getCompletionsForBehaviors(args, validBehaviors);
        }

        const { behavior, paramIndex } = findCurrentBehavior(args);
        if (behavior) {
            if (paramIndex !== undefined) {
                return this.getBehaviorParamCompletions(args, validBehaviors, behavior, paramIndex);
            }

            return this.getCompletionsForBehaviors(args, validBehaviors, behavior);
        }

        return undefined;
    }

    private getSignaturesForBindings(args: SignatureArgs, validBehaviors: readonly Behavior[]): SignatureResult {
        const { behavior, paramIndex } = findCurrentBehavior(args);
        if (behavior && paramIndex !== undefined) {
            const filteredBehaviors = filterBehaviors(validBehaviors, behavior, { matchFullWord: true });
            const signatures = behaviorsToSignatures(filteredBehaviors, paramIndex);
            return {
                signatures,
                activeSignature: 0, // TODO?
                activeParameter: paramIndex,
            };
        }

        return undefined;
    }

    private getCompletionsForBehaviors(
        args: CompletionArgs,
        validBehaviors: readonly Behavior[],
        behavior?: Parser.SyntaxNode,
    ): CompletionResult {
        // Don't trigger completion for behaviors on space if there's a behavior
        // right after the cursor. You're probably just changing alignment.
        if (args.context.triggerCharacter === ' ') {
            const node = getAncesorOfType(args.node, 'reference') ?? args.node;

            if (asPosition(node.startPosition).isEqual(args.position)) {
                return;
            }

            if (getNextSiblingOnLine(node)?.type === 'reference') {
                return;
            }
        }

        if (behavior) {
            let range = getNodeRange(behavior);
            if (!range.isSingleLine) {
                range = range.with({ end: args.position });
            }

            return behaviorsToCompletions(
                filterBehaviors(validBehaviors, behavior),
                this.getIncludeInfo(args.document),
                range,
            );
        }

        return behaviorsToCompletions(validBehaviors, this.getIncludeInfo(args.document));
    }

    private getBehaviorParamCompletions(
        args: CompletionArgs,
        validBehaviors: readonly Behavior[],
        behaviorNode: Parser.SyntaxNode,
        paramIndex: number,
    ): CompletionResult {
        // Don't trigger completion for behaviors on space unless there's a behavior
        // right after the cursor. You're probably just changing alignment.
        if (args.context.triggerCharacter === ' ') {
            const node = isDescendantOf(args.node, behaviorNode) ? behaviorNode : args.node;
            if (asPosition(node.startPosition).isEqual(args.position)) {
                return;
            }

            const next = getNextSiblingOnLine(node);
            if (next && next.type !== 'reference') {
                return;
            }
        }

        const filteredBehaviors = filterBehaviors(validBehaviors, behaviorNode);

        if (filteredBehaviors.length > 0) {
            const behavior = filteredBehaviors[0];
            if (paramIndex < behavior.parameters.length) {
                return parameterToCompletions(behavior.parameters[paramIndex], this.getIncludeInfo(args.document));
            }
        }

        // This is after the last parameter for the behavior. Suggest a new
        // behavior instead.
        return this.getCompletionsForBehaviors(args, validBehaviors);
    }
}

function* getCaptures(matches: Parser.QueryMatch[]): Generator<Parser.QueryCapture> {
    for (const match of matches) {
        for (const capture of match.captures) {
            yield capture;
        }
    }
}

function findFirstPositionForInclude(document: vscode.TextDocument, tree: Parser.Tree): vscode.Position {
    let line = 0;
    do {
        const node = tree.rootNode.descendantForPosition({ row: line, column: 0 });
        if (nodesEqual(node, tree.rootNode)) {
            break;
        }

        if (node.type !== 'comment') {
            break;
        }

        line++;
    } while (line < document.lineCount);

    return new vscode.Position(line, 0);
}

interface AnalysisArgs<T = unknown> {
    document: vscode.TextDocument;
    position: vscode.Position;
    context: T;
    node: Parser.SyntaxNode;
    isAfter: boolean;
}

type CompletionArgs = AnalysisArgs<vscode.CompletionContext>;
type SignatureArgs = AnalysisArgs<vscode.SignatureHelpContext>;

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

function filterBehaviors(
    validBehaviors: readonly Behavior[],
    behavior: Parser.SyntaxNode,
    options?: { matchFullWord: boolean },
): Behavior[] {
    const { matchFullWord } = { matchFullWord: false, ...options };

    const text = truncateAtWhitespace(behavior.text);
    const filtered = validBehaviors.filter((b) => {
        if (!b.label.startsWith(text)) {
            return false;
        }

        if (matchFullWord) {
            if (truncateAtWhitespace(b.label) !== text) {
                return false;
            }
        }

        if (b.if) {
            return testBehavior(behavior, b.if);
        }

        return true;
    });

    return filtered;
}

function getNextSiblingOnLine(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const next = node.nextNamedSibling;
    if (next?.startPosition.row === node.endPosition.row) {
        return next;
    }

    return null;
}
