import * as vscode from 'vscode';

export async function fetchResource(context: vscode.ExtensionContext, ...pathSegments: string[]): Promise<Uint8Array> {
    const uri = vscode.Uri.joinPath(context.extensionUri, ...pathSegments);
    const response = await fetch(uri.toString(), { credentials: 'same-origin' });
    return new Uint8Array(await response.arrayBuffer());
}
