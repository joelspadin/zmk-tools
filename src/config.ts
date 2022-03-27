import * as vscode from 'vscode';
import { dirname } from './util';

export class ConfigMissingError extends Error {}

export interface ConfigLocation {
    workspace: vscode.WorkspaceFolder;
    config: vscode.Uri;
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

async function locateConfigInWorkspace(workspace: vscode.WorkspaceFolder): Promise<ConfigLocation | undefined> {
    const settings = vscode.workspace.getConfiguration('zmk', workspace);
    const path = settings.get<string>('configPath');

    if (path) {
        const config = vscode.Uri.joinPath(workspace.uri, path);
        return { workspace, config };
    }

    const glob = await vscode.workspace.findFiles(new vscode.RelativePattern(workspace.uri, '**/west.yml'));

    if (glob.length === 0) {
        return undefined;
    }

    return {
        workspace,
        config: dirname(glob[0]),
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
