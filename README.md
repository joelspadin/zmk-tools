# ZMK Tools

Visual Studio Code tools for working with [ZMK Firmware](https://zmkfirmware.dev/).

## Features

ZMK Tools currently only provides some features for `.keymap` files. If you can
think of something that would be useful to add to this extension, let me know
by creating an issue or joining the ZMK Discord server to discuss it (see the
Discord link at the bottom of the [ZMK Firmware homepage](https://zmkfirmware.dev/).)

### Keymaps

-   Code completion in `bindings` and `sensor-bindings` properties.
-   Very basic syntax checking (as of this writing, Tree-sitter does not provide useful error messages).

## Credits

-   Keymap parsing uses the amazing [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) library.
-   Some parsing code is adapted from [Tree Sitter for VSCode](https://github.com/georgewfraser/vscode-tree-sitter)
    (Copyright &copy; 2016 George Fraser, [MIT license](https://github.com/georgewfraser/vscode-tree-sitter/blob/master/LICENSE.md)).
