import * as vscode from 'vscode';
import * as fs from 'fs';

export async function fetchWasm(uri: vscode.Uri): Promise<Uint8Array> {
    const file = await fs.promises.readFile(uri.fsPath);
    return new Uint8Array(file.buffer);
}
