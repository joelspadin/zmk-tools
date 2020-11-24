import Parser = require('web-tree-sitter');

// TODO: remove this if queries ever get added to tree-sitter's .d.ts

export interface QueryableLanguage extends Parser.Language {
    query(expression: string): Query;
}

export interface Query {
    matches(node: Parser.SyntaxNode): QueryResult[];
}

export interface QueryResult {
    pattern: number;
    captures: Capture[];
}

export interface Capture {
    name: string;
    node: Parser.SyntaxNode;
}

export function query(language: Parser.Language, expression: string): Query {
    return (language as QueryableLanguage).query(expression);
}
