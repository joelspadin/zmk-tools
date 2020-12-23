import * as vscode from 'vscode';

export async function checkForIncorrectFileAssociations() {
    const config = vscode.workspace.getConfiguration('files');
    const associations = config.get<Record<string, string>>('associations');

    if (associations?.['*.keymap'] !== 'dts') {
        return;
    }

    if (!(await promptToRemoveKeymapAssocation())) {
        return;
    }

    const newAssociations = Object.fromEntries(
        Object.entries(associations).filter(([key, value]) => key !== '*.keymap')
    );

    config.update('associations', newAssociations, vscode.ConfigurationTarget.Workspace);
}

async function promptToRemoveKeymapAssocation(): Promise<boolean> {
    const yes = 'Yes';
    const no = 'No';
    const response = await vscode.window.showWarningMessage(
        'ZMK keymap files are associated with DeviceTree instead of ZMK Tools, which prevents code completion. Change the association to ZMK Tools?',
        yes,
        no
    );

    return response === yes;
}
