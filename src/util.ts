/**
 * Removes all text after the first instance of whitespace in the given string.
 */
export function truncateAtWhitespace(text: string): string {
    return text.replace(/\s.+$/s, '');
}
