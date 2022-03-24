import * as vscode from 'vscode';

export async function fetchWasm(uri: vscode.Uri): Promise<Uint8Array> {
    const response = await fetch(uri.toString(), { credentials: 'same-origin' });
    return new Uint8Array(await response.arrayBuffer());
}
