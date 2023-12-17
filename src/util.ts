import * as vscode from 'vscode';

export function decode(input: BufferSource): string {
    return new TextDecoder().decode(input);
}

export function encode(input: string): Uint8Array {
    return new TextEncoder().encode(input);
}

/**
 * Removes all text after the first instance of whitespace in the given string.
 */
export function truncateAtWhitespace(text: string): string {
    return text.replace(/\s.+$/s, '');
}

export function stripQuotes(text: string): string {
    if (text.startsWith('"') && text.endsWith('"')) {
        return text.substring(1, text.length - 1);
    }

    return text;
}

export function stripIncludeQuotes(text: string): string {
    if (text.startsWith('<') && text.endsWith('>')) {
        return text.substring(1, text.length - 1);
    }

    return stripQuotes(text);
}

export function dirname(uri: vscode.Uri): vscode.Uri {
    const sepIndex = uri.path.lastIndexOf('/');
    if (sepIndex < 0) {
        return uri;
    }

    const dirname = uri.path.slice(0, sepIndex);
    return uri.with({ path: dirname });
}

export function camelCaseToWords(str: string) {
    return str.replace(/([a-z])([A-Z])/, (_, end: string, start: string) => end + ' ' + start.toLowerCase());
}
