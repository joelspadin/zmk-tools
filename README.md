# ZMK Tools

Visual Studio Code tools for working with [ZMK Firmware](https://zmkfirmware.dev/).

## Features

ZMK Tools currently only provides some features for `.keymap` files. If you can
think of something that would be useful to add to this extension, let me know
by creating an issue or joining the ZMK Discord server to discuss it (see the
Discord link at the bottom of the [ZMK Firmware homepage](https://zmkfirmware.dev/).)

### Keymaps

-   Syntax highlighting
-   Code completion in `bindings` and `sensor-bindings` properties.
-   Very basic syntax checking (as of this writing, Tree-sitter does not provide useful error messages).

### DeviceTree Overlays

-   This extension marks `.overlay` files as DeviceTree files so the
    [DeviceTree extension](https://marketplace.visualstudio.com/items?itemName=plorefice.devicetree)
    will provide syntax highlighting if it is installed.

## Credits

-   Keymap parsing uses the amazing [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) library.
-   Some parsing code is adapted from [Tree Sitter for VSCode](https://github.com/georgewfraser/vscode-tree-sitter)
    (Copyright &copy; 2016 George Fraser, [MIT license](https://github.com/georgewfraser/vscode-tree-sitter/blob/master/LICENSE.md)).
-   Syntax highlighting of `.keymap` files is taken from [vscode-devicetree](https://github.com/plorefice/vscode-devicetree)
    (Copyright &copy; 2017 Pietro Lorefice, [MIT license](https://github.com/plorefice/vscode-devicetree/blob/master/LICENSE)).
-   The [ZMK logo](https://github.com/zmkfirmware/zmk/blob/main/docs/static/img/zmk_logo.svg)
    is part of the [ZMK documentation](https://github.com/zmkfirmware/zmk/tree/main/docs)
    and is licensed [CC-BY-NC-SA](http://creativecommons.org/licenses/by-nc-sa/4.0/).
