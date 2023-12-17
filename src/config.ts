import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { decode, dirname } from './util';

export class ConfigMissingError extends Error {}

export interface ConfigLocation {
    workspace: vscode.WorkspaceFolder;
    config: vscode.Uri;
    boardRoot: vscode.Uri;
}

interface ZephyrModuleFile {
    build?: {
        settings?: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            board_root?: string;
        };
    };
}

/**
 * If there is only one ZMK config in the workspace, returns it.
 *
 * If there are multiple, prompts the user to select one and returns it or
 * undefined if the user cancels selection.
 *
 * @throws ConfigMissingError if there are no ZMK configs in the workspace.
 */
export async function getConfigLocation(): Promise<ConfigLocation | undefined> {
    const allConfigs = await findAllConfigs();
    if (allConfigs.length === 0) {
        throw new ConfigMissingError();
    }
    if (allConfigs.length === 1) {
        return allConfigs[0];
    }

    const items = getConfigPickItems(allConfigs);
    const result = await vscode.window.showQuickPick(items, {
        title: 'Add to which workspace?',
        placeHolder: 'Pick ZMK config workspace',
        ignoreFocusOut: true,
    });

    return result?.location;
}

async function findAllConfigs(): Promise<ConfigLocation[]> {
    const configs = await Promise.all(vscode.workspace.workspaceFolders?.map(locateConfigInWorkspace) ?? []);
    return configs.filter((x) => x !== undefined) as ConfigLocation[];
}

async function locateBoardRoot(workspace: vscode.WorkspaceFolder): Promise<vscode.Uri | undefined> {
    try {
        const uri = vscode.Uri.joinPath(workspace.uri, 'zephyr/module.yml');
        const file = decode(await vscode.workspace.fs.readFile(uri));

        const module = yaml.parse(file) as ZephyrModuleFile;
        const boardRoot = module?.build?.settings?.board_root;

        if (boardRoot) {
            return vscode.Uri.joinPath(workspace.uri, boardRoot);
        }
    } catch (e) {
        if (e instanceof vscode.FileSystemError) {
            return undefined;
        }

        throw e;
    }

    return undefined;
}

async function locateConfigInWorkspace(workspace: vscode.WorkspaceFolder): Promise<ConfigLocation | undefined> {
    const boardRoot = await locateBoardRoot(workspace);

    const settings = vscode.workspace.getConfiguration('zmk', workspace);
    const path = settings.get<string>('configPath');

    if (path) {
        const config = vscode.Uri.joinPath(workspace.uri, path);
        return { workspace, config, boardRoot: boardRoot ?? config };
    }

    const glob = await vscode.workspace.findFiles(new vscode.RelativePattern(workspace, '**/west.yml'));

    if (glob.length === 0) {
        return undefined;
    }

    const config = dirname(glob[0]);

    return {
        workspace,
        config,
        boardRoot: boardRoot ?? config,
    };
}

interface ConfigPickItem extends vscode.QuickPickItem {
    location: ConfigLocation;
}

async function getConfigPickItems(configs: ConfigLocation[]) {
    return configs.map<ConfigPickItem>((location) => {
        return {
            label: location.workspace.name,
            description: location.config.path.substring(location.workspace.uri.path.length),
            location,
        };
    });
}
