declare module 'markdown-escape' {
    function escape(markdown: string, skips?: string[]): string;
    export = escape;
}
