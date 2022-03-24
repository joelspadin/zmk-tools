import * as vscode from 'vscode';
import { KeymapAnalyzer } from './KeymapAnalyzer';
import { KeymapParser } from './Parser';
import { checkForIncorrectFileAssociations } from './settings';

export async function activate(context: vscode.ExtensionContext) {
    const parser = await KeymapParser.init(context);
    context.subscriptions.push(parser, new KeymapAnalyzer(parser));

    checkForIncorrectFileAssociations();
}

export function deactivate() {}
