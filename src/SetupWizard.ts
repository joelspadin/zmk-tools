import * as vscode from 'vscode';
import { addToBuildMatrix, BuildItem } from './build';
import { ConfigLocation, ConfigMissingError, getConfigLocation } from './config';
import {
    Board,
    filterToShield,
    getHardware,
    getKeyboardFiles,
    GroupedHardware,
    Hardware,
    Keyboard,
    Shield,
} from './hardware';

const OPEN_REPO_ACTION = 'Open ZMK config template';
const TEMPLATE_URL =
    'https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fzmkfirmware%2Funified-zmk-config-template';

interface KeyboardParts {
    keyboard: Keyboard;
    board: Board;
    shield?: Shield;
}

export class SetupWizard implements vscode.Disposable {
    private disposable: vscode.Disposable;

    constructor(private context: vscode.ExtensionContext) {
        this.disposable = vscode.commands.registerCommand('zmk.addKeyboard', this.runWizard, this);
    }

    dispose() {
        this.disposable.dispose();
    }

    private async runWizard() {
        // TODO: make a custom quick pick which allows going back a step.
        const config = await getConfig();
        if (!config) {
            return;
        }

        const parts = await this.pickKeyboardParts(config);
        if (!parts) {
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Fetching keyboard files',
            },
            async () => {
                await copyConfigFiles(config, parts.keyboard);
            },
        );

        try {
            const builds = getBuildItems(parts);
            await addToBuildMatrix(this.context, config, builds);
        } catch (e) {
            console.error(e);
            vscode.window.showErrorMessage(`Failed to update build matrix: ${e}`);
        }
    }

    private async pickKeyboardParts(config: ConfigLocation): Promise<KeyboardParts | undefined> {
        const hardware = getHardware(this.context, config);

        const keyboard = await this.pickKeyboard(hardware);
        if (!keyboard) {
            return undefined;
        }

        switch (keyboard.type) {
            case 'board':
                return { keyboard, board: keyboard };

            case 'shield': {
                const board = await this.pickController(hardware, keyboard);
                if (!board) {
                    return undefined;
                }

                return {
                    keyboard,
                    board,
                    shield: keyboard,
                };
            }
        }
    }

    private async pickKeyboard(hardware: Promise<GroupedHardware>) {
        const getItems = async () => {
            return getHardwarePickItems((await hardware).keyboards);
        };

        const result = await vscode.window.showQuickPick(getItems(), {
            title: 'Pick a keyboard',
            placeHolder: 'Keyboard',
            ignoreFocusOut: true,
            matchOnDescription: true,
        });

        return result?.item;
    }

    private async pickController(hardware: Promise<GroupedHardware>, shield: Shield) {
        const getItems = async () => {
            const compatible = filterToShield((await hardware).controllers, shield);
            return getHardwarePickItems(compatible);
        };

        const result = await vscode.window.showQuickPick(getItems(), {
            title: 'Pick an MCU board',
            placeHolder: 'Controller',
            ignoreFocusOut: true,
            matchOnDescription: true,
        });

        return result?.item;
    }
}

async function getConfig() {
    try {
        return await getConfigLocation();
    } catch (e: unknown) {
        if (e instanceof ConfigMissingError) {
            showConfigMissingError();
        }
        console.error(e);
    }
    return undefined;
}

async function showConfigMissingError() {
    const response = await vscode.window.showErrorMessage(
        'Could not find a ZMK config repo in the workspace. Go to the template repo and click "Use this template" to create a new repo.',
        OPEN_REPO_ACTION,
    );
    if (response === OPEN_REPO_ACTION) {
        vscode.env.openExternal(vscode.Uri.parse(TEMPLATE_URL));
    }
}

function getBuildItems(parts: KeyboardParts) {
    if (parts.shield) {
        return getShieldBuildItems(parts.board, parts.shield);
    }

    return getBoardBuildItems(parts.board);
}

function getBoardBuildItems(board: Board): BuildItem[] {
    const ids = board.siblings ?? [board.id];

    return ids.map((id) => {
        return { board: id };
    });
}

function getShieldBuildItems(board: Board, shield: Shield): BuildItem[] {
    const ids = shield.siblings ?? [shield.id];

    return ids.map((id) => {
        return { shield: id, board: board.id };
    });
}

interface HardwarePickItem<T extends Hardware> extends vscode.QuickPickItem {
    item: T;
}

function getHardwarePickItems<T extends Hardware>(hardware: T[]): HardwarePickItem<T>[] {
    return hardware.map((item) => {
        return {
            label: item.name,
            description: item.id,
            item,
        };
    });
}

async function copyConfigFiles(config: ConfigLocation, keyboard: Keyboard) {
    const files = getKeyboardFiles(keyboard);

    const configUri = vscode.Uri.joinPath(config.config, `${keyboard.id}.conf`);
    const keymapUri = vscode.Uri.joinPath(config.config, `${keyboard.id}.keymap`);

    await Promise.all([copyFile(config, configUri, files.configUrl), copyFile(config, keymapUri, files.keymapUrl)]);

    const keymap = await vscode.workspace.openTextDocument(keymapUri);
    vscode.window.showTextDocument(keymap);
}

async function exists(uri: vscode.Uri) {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch (e) {
        if (e instanceof vscode.FileSystemError) {
            return false;
        }

        throw e;
    }
}

async function copyFile(config: ConfigLocation, dest: vscode.Uri, source: vscode.Uri) {
    // Don't overwrite existing files.
    if (await exists(dest)) {
        return;
    }

    try {
        const buffer = await fetchFile(config, source);
        await vscode.workspace.fs.writeFile(dest, buffer);
    } catch (e) {
        vscode.window.showWarningMessage(`Failed to copy [${source}](${source}): ${e}`);
        return;
    }
}

async function fetchFile(config: ConfigLocation, uri: vscode.Uri): Promise<Uint8Array> {
    if (uri.toString().startsWith(config.workspace.uri.toString())) {
        return await vscode.workspace.fs.readFile(uri);
    }

    const response = await fetch(uri.toString());
    if (!response.ok) {
        throw new Error(await response.text());
    }

    return new Uint8Array(await response.arrayBuffer());
}
