import * as vscode from 'vscode';
import Parser = require('web-tree-sitter');

import { getKeycodeCompletions, getModifierCompletions } from './keycodes';
import { addMissingSystemInclude, IncludeInfo } from './keymap';
import { truncateAtWhitespace } from './util';

const BEHAVIORS_INCLUDE = 'behaviors.dtsi';
const PREFERRED_BEHAVIOR = '&kp';

export type ParameterType = 'keycode' | 'modifier' | 'integer';

export interface ParameterValue {
    label: string;
    documentation?: string;
}

export type Parameter = vscode.ParameterInformation & {
    type?: ParameterType;
    include?: string;
    values?: ParameterValue[];
};

export interface Behavior {
    label: string;
    documentation?: string;
    parameters: Parameter[];
    isMatch?: (behavior: Parser.SyntaxNode) => boolean;
}

/**
 * Gets a list of function signatures for behaviors.
 * @param behaviors A list of behaviors valid for this location.
 * @param activeParameter The index of the active parameter. The returned
 *      signatures will be filtered to those where this is a valid parameter.
 */
export function behaviorsToSignatures(
    behaviors: readonly Behavior[],
    activeParameter?: number
): vscode.SignatureInformation[] {
    let filtered: readonly Behavior[] = behaviors;

    if (activeParameter !== undefined) {
        filtered = behaviors.filter((b) => activeParameter < b.parameters.length);
    }

    return filtered.map((b) => {
        const sig = new vscode.SignatureInformation(b.label, new vscode.MarkdownString(b.documentation));
        sig.parameters = b.parameters.map(getParameterInformation);
        sig.activeParameter = activeParameter;
        return sig;
    });
}

/**
 * Gets a list of code completions for behaviors.
 * @param behaviors A list of behaviors valid for this location.
 * @param range The range to replace when a completion is committed.
 */
export function behaviorsToCompletions(
    behaviors: readonly Behavior[],
    includeInfo: IncludeInfo,
    range?: vscode.Range
): vscode.CompletionItem[] {
    const additionalTextEdits = addMissingSystemInclude(includeInfo, BEHAVIORS_INCLUDE);

    function getEntry(b: Behavior): [string, vscode.CompletionItem] {
        const label = truncateAtWhitespace(b.label);
        const completion = new vscode.CompletionItem(label, vscode.CompletionItemKind.Function);
        completion.documentation = new vscode.MarkdownString(b.documentation);
        completion.range = range;
        completion.additionalTextEdits = additionalTextEdits;

        // TODO: remember the last-used behavior and prefer that.
        if (label === PREFERRED_BEHAVIOR) {
            completion.preselect = true;
        }

        return [label, completion];
    }

    const dedupe = new Map(behaviors.map(getEntry));

    return [...dedupe.values()];
}

/**
 * Gets a list of code completions for the active parameter.
 * @param parameter The active parameter.
 */
export function parameterToCompletions(parameter: Parameter, includeInfo: IncludeInfo): vscode.CompletionItem[] {
    if (parameter.values) {
        const additionalTextEdits = parameter.include ? addMissingSystemInclude(includeInfo, parameter.include) : [];

        return parameter.values.map((v) => {
            const completion = new vscode.CompletionItem(v.label, vscode.CompletionItemKind.EnumMember);
            completion.documentation = new vscode.MarkdownString(v.documentation);
            completion.additionalTextEdits = additionalTextEdits;

            return completion;
        });
    }

    switch (parameter.type) {
        case 'keycode':
            return getKeycodeCompletions(includeInfo);

        case 'modifier':
            return getModifierCompletions(includeInfo);
    }

    return [];
}

/**
 * Gets the ParameterInformation for a parameter
 */
function getParameterInformation(parameter: Parameter): vscode.ParameterInformation {
    let documentation = parameter.documentation;
    if (typeof documentation === 'string' && parameter.type) {
        documentation = new vscode.MarkdownString(`\`${parameter.type}\`: ${documentation}`);
    }

    return { label: parameter.label, documentation };
}

const RGB_VALUES: ParameterValue[] = [
    {
        label: 'RGB_TOG',
        documentation: 'Toggles the RGB feature on and off.',
    },
    {
        label: 'RGB_HUI',
        documentation: 'Increases the hue of the RGB feature.',
    },
    {
        label: 'RGB_HUD',
        documentation: 'Decreases the hue of the RGB feature.',
    },
    {
        label: 'RGB_SAI',
        documentation: 'Increases the saturation of the RGB feature.',
    },
    {
        label: 'RGB_SAD',
        documentation: 'Decreases the saturation of the RGB feature. 😢',
    },
    {
        label: 'RGB_BRI',
        documentation: 'Increases the brightness of the RGB feature.',
    },
    {
        label: 'RGB_BRD',
        documentation: 'Decreases the brightness of the RGB feature.',
    },
    {
        label: 'RGB_SPI',
        documentation: "Increases the speed of the RGB feature effect's animation.",
    },
    {
        label: 'RGB_SPD',
        documentation: "Decreases the speed of the RGB feature effect's animation.",
    },
    {
        label: 'RGB_EFF',
        documentation: "Cycles the RGB feature's effect forwards.",
    },
    {
        label: 'RGB_EFR',
        documentation: "Cycles the RGB feature's effect reverse.",
    },
];

/**
 * Behaviors valid for the `bindings` property.
 */
export const BINDINGS_BEHAVIORS: readonly Behavior[] = [
    {
        label: '&kp KEYCODE',
        documentation:
            '[Key press](https://zmkfirmware.dev/docs/behaviors/key-press)\n\nSends standard keycodes on press/release.',
        parameters: [
            {
                label: 'KEYCODE',
                documentation: 'Key code',
                type: 'keycode',
            },
        ],
    },
    {
        label: '&mo LAYER',
        documentation:
            '[Momentary layer](https://zmkfirmware.dev/docs/behaviors/layers#momentary-layer)\n\nswitches to a layer while the key is held.',
        parameters: [
            {
                label: 'LAYER',
                documentation: 'Layer index',
                type: 'integer',
            },
        ],
    },
    {
        label: '&lt LAYER TAP',
        documentation:
            '[Layer-tap](https://zmkfirmware.dev/docs/behaviors/layers#layer-tap)\n* **Hold behavior:** switches to a layer\n* **Tap behavior:** sends a keycode',
        parameters: [
            {
                label: 'LAYER',
                documentation: 'Layer index to use when held',
                type: 'integer',
            },
            {
                label: 'TAP',
                documentation: 'Keycode to send when tapped',
                type: 'keycode',
            },
        ],
    },
    {
        label: '&tog LAYER',
        documentation:
            '[Toggle layer](https://zmkfirmware.dev/docs/behaviors/layers#toggle-layer)\n\nEnables/disables a layer each time the key is pressed.',
        parameters: [
            {
                label: 'LAYER',
                documentation: 'Layer index',
                type: 'integer',
            },
        ],
    },
    {
        label: '&trans',
        documentation:
            '[Transparent](https://zmkfirmware.dev/docs/behaviors/misc#transparent)\n\nPasses key presses down to the next active layer in the stack.',
        parameters: [],
    },
    {
        label: '&none',
        documentation:
            '[None](https://zmkfirmware.dev/docs/behaviors/misc#none)\n\nIgnores a key press so it will *not* be passed down to the next active layer in the stack.',
        parameters: [],
    },
    {
        label: '&mt MODIFIER TAP',
        documentation:
            '[Mod-tap](https://zmkfirmware.dev/docs/behaviors/mod-tap)\n* **Hold behavior:** holds a modifier\n* **Tap behavior:** sends a keycode',
        parameters: [
            {
                label: 'MODIFIER',
                documentation: 'Modifier to send when held',
                type: 'modifier',
            },
            {
                label: 'TAP',
                documentation: 'Keycode to send when tapped',
                type: 'keycode',
            },
        ],
    },
    {
        label: '&reset',
        documentation:
            '[Reset](https://zmkfirmware.dev/docs/behaviors/reset#reset)\n\nResets the keyboard and re-runs its firmware.',
        parameters: [],
    },
    {
        label: '&bootloader',
        documentation:
            '[Bootloader reset](https://zmkfirmware.dev/docs/behaviors/reset#bootloader-reset)\n\nResets the keyboard and puts it into bootloader mode, allowing you to flash new firmware.',
        parameters: [],
    },
    {
        label: '&bt ACTION',
        documentation: '[Bluetooth command](https://zmkfirmware.dev/docs/behaviors/bluetooth)',
        isMatch: (behavior) => {
            const param0 = behavior.nextNamedSibling;
            return param0?.text !== 'BT_SEL';
        },
        parameters: [
            {
                label: 'ACTION',
                include: 'dt-bindings/zmk/bt.h',
                values: [
                    {
                        label: 'BT_CLR',
                        documentation: 'Clear bond information between the keyboard and host for the selected profile.',
                    },
                    {
                        label: 'BT_NXT',
                        documentation:
                            'Switch to the next profile, cycling through to the first one when the end is reached.',
                    },
                    {
                        label: 'BT_PRV',
                        documentation:
                            'Switch to the previous profile, cycling through to the last one when the beginning is reached.',
                    },
                    {
                        label: 'BT_SEL',
                        documentation: 'Select the 0-indexed profile by number.',
                    },
                ],
            },
        ],
    },
    {
        label: '&bt BT_SEL PROFILE',
        documentation:
            '[Bluetooth command](https://zmkfirmware.dev/docs/behaviors/bluetooth)\n\nSelect the 0-indexed profile by number.',
        isMatch: (behavior) => {
            const param0 = behavior.nextNamedSibling;
            return param0?.text === 'BT_SEL';
        },
        parameters: [
            {
                label: 'BT_SEL',
                include: 'dt-bindings/zmk/bt.h',
                values: [
                    {
                        label: 'BT_SEL',
                        documentation: 'Select the 0-indexed profile by number.',
                    },
                ],
            },
            {
                label: 'PROFILE',
                documentation: '0-based index of the profile to select.',
                type: 'integer',
            },
        ],
    },
    {
        label: '&out ACTION',
        documentation: '[Output selection command](https://zmkfirmware.dev/docs/behaviors/outputs)',
        parameters: [
            {
                label: 'ACTION',
                include: 'dt-bindings/zmk/outputs.h',
                values: [
                    {
                        label: 'OUT_USB',
                        documentation: 'Prefer sending to USB.',
                    },
                    {
                        label: 'OUT_BLE',
                        documentation: 'Prefer sending to the current bluetooth profile.',
                    },
                    {
                        label: 'OUT_TOG',
                        documentation: 'Toggle between USB and BLE.',
                    },
                ],
            },
        ],
    },
    {
        label: '&rgb_ug ACTION',
        documentation: '[RGB underglow command](https://zmkfirmware.dev/docs/behaviors/lighting#rgb-underglow)',
        parameters: [
            {
                include: 'dt-bindings/zmk/rgb.h',
                label: 'ACTION',
                values: RGB_VALUES,
            },
        ],
    },
    {
        label: '&ext_power ACTION',
        documentation: '[External power control](https://zmkfirmware.dev/docs/behaviors/power#external-power-control)',
        parameters: [
            {
                label: 'ACTION',
                include: 'dt-bindings/zmk/ext_power.h',
                values: [
                    {
                        label: 'EP_OFF',
                        documentation: 'Disable the external power.',
                    },
                    {
                        label: 'EP_ON',
                        documentation: 'Enable the external power.',
                    },
                    {
                        label: 'EP_TOG',
                        documentation: 'Toggle the external power on/off.',
                    },
                ],
            },
        ],
    },
];

/**
 * Bindings valid for the `sensor-bindings` property.
 */
export const SENSOR_BEHAVIORS: readonly Behavior[] = [
    {
        label: '&inc_dec_kp CW_KEY CCW_KEY',
        documentation:
            '[Encoder key press](https://zmkfirmware.dev/docs/features/encoders)\n\nSends keycodes when rotating an encoder',
        parameters: [
            {
                label: 'CW_KEY',
                documentation: 'Keycode to send when the encoder is rotated clockwise.',
                type: 'keycode',
            },
            {
                label: 'CCW_KEY',
                documentation: 'Keycode to send when the encoder is rotated counter-clockwise.',
                type: 'keycode',
            },
        ],
    },
];
