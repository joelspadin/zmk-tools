/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention */
//@ts-check
'use strict';

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const ZmkHardwarePlugin = require('./src/webpack-zmk-hardware-plugin');

/** @type {import('webpack').RuleSetRule[]} */
const rules = [
    {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [{ loader: 'ts-loader' }],
    },
    {
        test: /\.ya?ml$/,
        type: 'json',
        use: [{ loader: 'yaml-loader', options: { asJSON: true } }],
    },
];

/** @type WebpackConfig */
const webExtensionConfig = {
    mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
    target: 'webworker', // extensions run in a webworker context
    entry: {
        extension: './src/extension.ts',
        'test/suite/index': './src/test/suite/index.ts',
    },
    output: {
        filename: '[name].js',
        path: path.join(__dirname, './dist/web'),
        libraryTarget: 'commonjs',
        devtoolModuleFilenameTemplate: '../../[resource-path]',
    },
    resolve: {
        mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
        extensions: ['.ts', '.js'],
        fallback: {
            // Webpack 5 no longer polyfills Node.js core modules automatically.
            // see https://webpack.js.org/configuration/resolve/#resolvefallback
            // for the list of Node.js core module polyfills.
            assert: require.resolve('assert'),
            // web-tree-sitter tries to import "fs", which can be ignored.
            // https://github.com/tree-sitter/tree-sitter/issues/466
            fs: false,
            path: false,
        },
    },
    module: {
        rules,
    },
    plugins: [
        new webpack.optimize.LimitChunkCountPlugin({
            maxChunks: 1, // disable chunks by default since web extensions must be a single bundle
        }),
        new webpack.ProvidePlugin({
            process: 'process/browser.js', // provide a shim for the global `process` variable
        }),
    ],
    externals: {
        vscode: 'commonjs vscode', // ignored because it doesn't exist
    },
    performance: {
        hints: false,
    },
    devtool: 'nosources-source-map', // create a source map that points to the original source file
    infrastructureLogging: {
        level: 'log', // enables logging required for problem matchers
    },
};

/** @type WebpackConfig */
const extensionConfig = {
    mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
    target: 'node', // vscode extensions run in a Node.js-context

    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2',
    },
    externals: {
        vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded.
        // Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        // modules added here also need to be added in the .vscodeignore file
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules,
    },
    plugins: [
        // hardware.yaml only needs to be built once, so this isn't needed in both configs.
        new ZmkHardwarePlugin('hardware.json'),
        new CopyPlugin({
            patterns: [
                require.resolve('web-tree-sitter/tree-sitter.wasm'),
                path.resolve(__dirname, 'tree-sitter-devicetree.wasm'),
            ],
        }),
    ],
    devtool: 'nosources-source-map', // create a source map that points to the original source file
    infrastructureLogging: {
        level: 'log', // enables logging required for problem matchers
    },
};

module.exports = [extensionConfig, webExtensionConfig];
