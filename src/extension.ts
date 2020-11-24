import * as vscode from 'vscode';
import { Analyzer } from './Analyzer';
import { KeymapParser } from './Parser';

export async function activate(context: vscode.ExtensionContext) {
    const parser = await KeymapParser.init();
    context.subscriptions.push(parser, new Analyzer(parser));
}

export function deactivate() {}
