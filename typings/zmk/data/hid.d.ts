export type Context = 'Keyboard' | 'Keypad' | 'Consumer' | 'Consumer AC' | 'Consumer AL' | 'Consumer KBIA';

export interface Usage {
    application: number;
    item: number;
}

export interface KeyDefinition {
    names: string[];
    description: string;
    context: Context;
    clarify: boolean;
    usages: Usage[];
    documentation: string;
    os: Record<string, boolean | null>;
    footnotes: {};
}

declare const keys: KeyDefinition[];

export default keys;
