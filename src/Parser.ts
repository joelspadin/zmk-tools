import * as vscode from 'vscode';
import Parser = require('web-tree-sitter');

const GRAMMAR_FILE = `${__dirname}/../tree-sitter-devicetree.wasm`;
const WHITESPACE_RE = /\s/;

async function createParser() {
    await Parser.init();
    const parser = new Parser();
    const language = await Parser.Language.load(GRAMMAR_FILE);

    parser.setLanguage(language);
    return { parser, language };
}

export interface ParseChangedEvent {
    document: vscode.TextDocument;
}

/**
 * Parses `.keymap` files.
 */
export class KeymapParser implements vscode.Disposable {
    static async init(): Promise<KeymapParser> {
        const { parser, language } = await createParser();
        return new KeymapParser(parser, language);
    }

    private _onDidChangeParse = new vscode.EventEmitter<ParseChangedEvent>();
    public onDidChangeParse = this._onDidChangeParse.event;

    private disposable: vscode.Disposable;
    private trees: Record<string, Parser.Tree> = {};

    private constructor(private parser: Parser, private language: Parser.Language) {
        this.disposable = vscode.Disposable.from(
            vscode.workspace.onDidCloseTextDocument((document) => this.deleteTree(document)),
            vscode.workspace.onDidChangeTextDocument((e) => this.updateTree(e))
        );
    }

    dispose() {
        this.disposable.dispose();
    }

    /**
     * Returns an up-to-date parse tree for a document.
     */
    parse(document: vscode.TextDocument): Parser.Tree {
        return this.trees[document.uri.toString()] ?? this.openDocument(document);
    }

    /**
     * Builds a tree-sitter query for keymap files.
     */
    query(expression: string): Parser.Query {
        return this.language.query(expression);
    }

    private getTree(document: vscode.TextDocument): Parser.Tree | undefined {
        return this.trees[document.uri.toString()];
    }

    private setTree(document: vscode.TextDocument, tree: Parser.Tree): Parser.Tree {
        this.trees[document.uri.toString()] = tree;
        this._onDidChangeParse.fire({ document });
        return tree;
    }

    private deleteTree(document: vscode.TextDocument) {
        delete this.trees[document.uri.toString()];
    }

    private getParserInput(document: vscode.TextDocument): Parser.Input {
        return (index, startPosition) => {
            if (startPosition && startPosition.row < document.lineCount) {
                const line = document.lineAt(startPosition.row);
                return line.text.slice(startPosition.column);
            }

            return null;
        };
    }

    private openDocument(document: vscode.TextDocument): Parser.Tree {
        return this.setTree(document, this.parser.parse(document.getText()));
    }

    private updateTree(e: vscode.TextDocumentChangeEvent) {
        const tree = this.getTree(e.document);
        if (!tree) {
            return;
        }

        for (const change of e.contentChanges) {
            const startIndex = change.rangeOffset;
            const oldEndIndex = change.rangeOffset + change.rangeLength;
            const newEndIndex = change.rangeOffset + change.text.length;
            const startPosition = asPoint(e.document.positionAt(startIndex));
            const oldEndPosition = asPoint(e.document.positionAt(oldEndIndex));
            const newEndPosition = asPoint(e.document.positionAt(newEndIndex));
            tree.edit({ startIndex, oldEndIndex, newEndIndex, startPosition, oldEndPosition, newEndPosition });
        }

        // TODO: figure out how to make this work to be more efficient.
        // const newTree = this.parser.parse(this.getParserInput(e.document), tree);
        const newTree = this.parser.parse(e.document.getText(), tree);
        this.setTree(e.document, newTree);
    }
}

/**
 * Converts a vscode position to a tree-sitter point.
 */
export function asPoint(position: vscode.Position): Parser.Point {
    return { row: position.line, column: position.character };
}

/**
 * Converts a tree-sitter point to a vscode position.
 */
export function asPosition(point: Parser.Point): vscode.Position {
    return new vscode.Position(point.row, point.column);
}

/**
 * Returns whether two nodes are equal.
 * TODO: replace this with a.equals(b) once tree-sitter's equals() is fixed.
 */
export function nodesEqual(a: Parser.SyntaxNode, b: Parser.SyntaxNode): boolean {
    type NodeWithId = Parser.SyntaxNode & { id: number };

    return (a as NodeWithId).id === (b as NodeWithId).id;
}

/**
 * Returns whether `node` is a descendant of `other`.
 */
export function isDescendantOf(node: Parser.SyntaxNode, other: Parser.SyntaxNode): boolean {
    let current: Parser.SyntaxNode | null = node;

    while (current) {
        if (nodesEqual(current, other)) {
            return true;
        }

        current = current.parent;
    }

    return false;
}

/**
 * Finds a position inside the first non-whitespace token which is before the
 * given position.
 */
export function findPreviousToken(
    document: vscode.TextDocument,
    position: vscode.Position
): vscode.Position | undefined {
    const line = document.lineAt(position.line);

    for (let i = position.character - 1; i >= 0; i--) {
        const char = line.text[i];

        if (char !== undefined && !WHITESPACE_RE.test(char)) {
            return position.with({ character: i });
        }
    }

    return undefined;
}

/**
 * Gets the named descendant of `root` at a position.
 */
export function nodeAtPosition(root: Parser.SyntaxNode, position: vscode.Position): Parser.SyntaxNode {
    const point = asPoint(position);
    return root.namedDescendantForPosition(point);
}

/**
 * Returns the closest ancestor that has a given node type.
 */
export function getAncesorOfType(node: Parser.SyntaxNode | null, type: string): Parser.SyntaxNode | null {
    while (node && node.type !== type) {
        node = node.parent;
    }

    return node;
}

/**
 * Gets the start/end position of a node as a vscode range.
 */
export function getNodeRange(node: Parser.SyntaxNode): vscode.Range {
    return new vscode.Range(asPosition(node.startPosition), asPosition(node.endPosition));
}

/**
 * Gets the name of the DeviceTree property which includes the given node,
 * or `undefined` if it is not part of a property.
 */
export function getPropertyName(node: Parser.SyntaxNode): string | undefined {
    const prop = getAncesorOfType(node, 'property');
    return prop?.childForFieldName('name')?.text;
}
