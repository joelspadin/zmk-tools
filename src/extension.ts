import * as vscode from 'vscode';
import { KeymapAnalyzer } from './KeymapAnalyzer';
import { KeymapParser } from './Parser';
import { SetupWizard } from './SetupWizard';
import { checkForIncorrectFileAssociations } from './settings';

export async function activate(context: vscode.ExtensionContext) {
    const parser = await KeymapParser.init(context);
    const analyzer = new KeymapAnalyzer(parser);

    const setupWizard = new SetupWizard(context);

    context.subscriptions.push(parser, analyzer, setupWizard);

    checkForIncorrectFileAssociations();
}

export function deactivate() {}
