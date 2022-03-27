import * as fs from 'fs';
import * as vscode from 'vscode';

export async function fetchResource(context: vscode.ExtensionContext, ...pathSegments: string[]): Promise<Uint8Array> {
    const uri = vscode.Uri.joinPath(context.extensionUri, ...pathSegments);
    const file = await fs.promises.readFile(uri.fsPath);
    return new Uint8Array(file.buffer);
}
