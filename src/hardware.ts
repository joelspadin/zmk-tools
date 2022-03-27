/* eslint-disable @typescript-eslint/naming-convention */

import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { ConfigLocation } from './config';
import { fetchResource } from './file';
import { decode, dirname } from './util';

export type Feature = 'keys' | 'display' | 'encoder' | 'underglow' | 'backlight' | 'pointer';
export type Output = 'usb' | 'ble';

export type Variant =
    | string
    | {
          id: string;
          features: Feature[];
      };

export interface Board {
    type: 'board';
    file_format?: string;
    id: string;
    name: string;
    baseUri: string;
    url?: string;
    arch?: string;
    outputs?: Output[];
    description?: string;
    manufacturer?: string;
    version?: string;
    siblings?: string[];
    features?: Feature[];
    variants?: Variant[];
    exposes?: string[];
}

export interface Shield {
    type: 'shield';
    file_format?: string;
    id: string;
    name: string;
    baseUri: string;
    url?: string;
    description?: string;
    manufacturer?: string;
    version?: string;
    siblings?: string[];
    features?: Feature[];
    variants?: Variant[];
    exposes?: string[];
    requires?: string[];
}

export interface Interconnect {
    type: 'interconnect';
    file_format?: string;
    id: string;
    name: string;
    baseUri: string;
    url?: string;
    description?: string;
    manufacturer?: string;
    version?: string;
}

export type Keyboard = Board | Shield;
export type Hardware = Board | Shield | Interconnect;

export interface GroupedHardware {
    keyboards: Keyboard[];
    controllers: Board[];
}

export interface KeyboardFiles {
    configUrl: vscode.Uri;
    keymapUrl: vscode.Uri;
}

export async function getHardware(context: vscode.ExtensionContext, config: ConfigLocation): Promise<GroupedHardware> {
    const sources = await Promise.all([getZmkHardware(context), getUserHardware(config)]);

    const groups = sources.flat().reduce<GroupedHardware>(
        (groups, hardware) => {
            if (isKeyboard(hardware)) {
                groups.keyboards.push(hardware);
            } else if (isController(hardware)) {
                groups.controllers.push(hardware);
            }

            return groups;
        },
        { keyboards: [], controllers: [] }
    );

    sortHardware(groups.keyboards);
    sortHardware(groups.controllers);

    return groups;
}

function sortHardware<T extends Hardware>(hardware: T[]) {
    hardware.sort((a, b) => a.name.localeCompare(b.name));
}

export function getKeyboardFiles(keyboard: Keyboard): KeyboardFiles {
    return {
        configUrl: vscode.Uri.parse(`${keyboard.baseUri}/${keyboard.id}.conf`),
        keymapUrl: vscode.Uri.parse(`${keyboard.baseUri}/${keyboard.id}.keymap`),
    };
}

export function filterToShield(boards: Board[], shield: Shield): Board[] {
    if (shield.requires === undefined || shield.requires.length === 0) {
        throw new Error(`Shield ${shield.id} is missing "requires" field.`);
    }

    return boards.filter((board) => shield.requires?.every((interconnect) => board.exposes?.includes(interconnect)));
}

function isKeyboard(hardware: Hardware): hardware is Keyboard {
    switch (hardware.type) {
        case 'board':
            return hardware.features?.includes('keys') ?? false;

        case 'shield':
            return true;
    }
    return false;
}

function isController(hardware: Hardware): hardware is Board {
    return hardware.type === 'board' && !isKeyboard(hardware);
}

async function getZmkHardware(context: vscode.ExtensionContext): Promise<Hardware[]> {
    const file = decode(await fetchResource(context, 'dist/hardware.yaml'));
    return yaml.parse(file) as Hardware[];
}

async function getUserHardware(config: ConfigLocation): Promise<Hardware[]> {
    // TODO: set a file watcher on .zmk.yml files, cache result, and invalidate if files change
    const meta = await vscode.workspace.findFiles(new vscode.RelativePattern(config.config, '**/*.zmk.yml'));

    return Promise.all(
        meta.map(async (uri) => {
            const file = decode(await vscode.workspace.fs.readFile(uri));
            const hardware = yaml.parse(file) as Hardware;

            return {
                ...hardware,
                baseUri: dirname(uri).toString(),
            };
        })
    );
}
