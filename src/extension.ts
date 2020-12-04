import * as vscode from 'vscode';
import { KeymapAnalyzer } from './KeymapAnalyzer';
import { KeymapParser } from './Parser';

export async function activate(context: vscode.ExtensionContext) {
    const parser = await KeymapParser.init();
    context.subscriptions.push(parser, new KeymapAnalyzer(parser));
}

export function deactivate() {}
