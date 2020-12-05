/**
 * Removes all text after the first instance of whitespace in the given string.
 */
export function truncateAtWhitespace(text: string): string {
    return text.replace(/\s.+$/s, '');
}

export function stripIncludeQuotes(text: string): string {
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('<') && text.endsWith('>'))) {
        return text.substring(1, text.length - 1);
    }

    return text;
}
