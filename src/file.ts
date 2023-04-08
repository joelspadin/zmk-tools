import * as vscode from 'vscode';

export async function fetchResource(context: vscode.ExtensionContext, ...pathSegments: string[]): Promise<Uint8Array> {
    const uri = vscode.Uri.joinPath(context.extensionUri, ...pathSegments);
    return await vscode.workspace.fs.readFile(uri);
}
