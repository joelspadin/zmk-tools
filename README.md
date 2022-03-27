# ZMK Tools

Visual Studio Code tools for working with [ZMK Firmware](https://zmk.dev/).

It is primarily intended for editing keymaps in a ZMK user config repo, but it
also works in the main ZMK repo.

## Create a ZMK User Config Repo

If you do not yet have a repo:

1. Open the [ZMK config template repo](https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Fzmkfirmware%2Funified-zmk-config-template) on GitHub.
2. Click the **Use this template** button and follow the instructions to create your own repo.
   (If you don't know what to name it, `zmk-config` is a good default name.)

Next, open the repo in VS Code using one of the options below:

### Edit in a Web Browser

Using [github.dev](https://github.dev) you can edit your repo completely within your web browser.

1. Open a web browser to your repo in GitHub, then press the `.` (period) key to open the repo in github.dev.
2. If you have not installed this extension in github.dev before, press `Ctrl+P` and enter this command:

    ```
    ext install spadin.zmk-tools
    ```

### Edit with the GitHub Repositories Extension

Using an extension, you can run VS Code locally but edit the repo remotely without cloning it.

1. Install the [GitHub Repositories](https://marketplace.visualstudio.com/items?itemName=GitHub.remotehub) extension.
2. Click the green **Open a Remote Window** button at the lower-left corner of the window.
3. Select **Open Remote Repository...**
4. Select **Open Repository from GitHub**.
5. Select your repository from the list.
6. If you have not installed this extension in a GitHub remote window before, press `Ctrl+P` and enter this command:

    ```
    ext install spadin.zmk-tools
    ```

### Clone and Edit Locally

Clone the repo to your computer and open it in VS Code.

If you don't know how to do this, check [Learn the Basics of Git in Under 10 Minutes](https://www.freecodecamp.org/news/learn-the-basics-of-git-in-under-10-minutes-da548267cc91/)
or try one of the options above instead.

## Add a Keyboard

Once the repo is open in VS Code, you can run the **Add Keyboard** command to add a keyboard:

1. Press **F1** and run the **ZMK: Add keyboard** command.
2. Follow the prompts to select a keyboard. ZMK Tools will copy the necessary files into your repo and add it to your `build.yaml` file so GitHub will build it for you.
3. Edit your `.keymap` and/or `.conf` files. See the [ZMK docs](https://zmk.dev/docs/customization) for help.
4. Select the **Source Control** tab on the side bar.
5. Hover over the header for the **Changes** list and click the **Stage All Changes** button (plus icon).
6. Enter a commit message and press `Ctrl+Enter` or click the **Commit** button (checkmark icon) to save your changes.
    - If you are editing the repo locally, click the **Sync Changes** button to push your changes to GitHub.

Ever time you commit a change, GitHub will automatically build the firmware for you.
Open a web browser to your repo in GitHub and click the **Actions** tab at the top,
then click the latest build (at the top of the list).

If the build succeeded, you can download the firmware from the **Artifacts** section.

### Troubleshooting

If the build failed, click the failed job from the list on the left, then look for
the error message. Correct the error, then repeat steps 3-6 above.

The error probably looks something like `Error: nice_nano.dts.pre.tmp:760.12-13 syntax error`.
If so, the following step of the build (named `<board> DTS File`) shows the `.dts.pre.tmp` file,
which is a combination of your `.keymap` and a few other files.

Match the line number from the error (760 in this example) to a line in the file,
using the right-most column of line numbers. There is probably a typo on that line.
Find the line in your `.keymap` and fix it.

## Keymap Features

-   Syntax highlighting
-   Code completion in `bindings` and `sensor-bindings` properties.
-   Very basic syntax checking (as of this writing, Tree-sitter does not provide useful error messages).

## DeviceTree Overlays

-   This extension marks `.overlay` files as DeviceTree files so the
    [DeviceTree extension](https://marketplace.visualstudio.com/items?itemName=plorefice.devicetree)
    will provide syntax highlighting if it is installed.

## Help and Feedback

If you run into an issue or you have an idea for something to add to this extension,
let me know by [creating an issue](https://github.com/joelspadin/zmk-tools/issues)
or joining the ZMK Discord server (see the Discord link at the bottom of the
[ZMK Firmware homepage](https://zmk.dev/).)

## Credits

-   Keymap parsing uses the amazing [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) library.
-   Some parsing code is adapted from [Tree Sitter for VSCode](https://github.com/georgewfraser/vscode-tree-sitter)
    (Copyright &copy; 2016 George Fraser, [MIT license](https://github.com/georgewfraser/vscode-tree-sitter/blob/master/LICENSE.md)).
-   Syntax highlighting of `.keymap` files is taken from [vscode-devicetree](https://github.com/plorefice/vscode-devicetree)
    (Copyright &copy; 2017 Pietro Lorefice, [MIT license](https://github.com/plorefice/vscode-devicetree/blob/master/LICENSE)).
-   The [ZMK logo](https://github.com/zmkfirmware/zmk/blob/main/docs/static/img/zmk_logo.svg)
    is part of the [ZMK documentation](https://github.com/zmkfirmware/zmk/tree/main/docs)
    and is licensed [CC-BY-NC-SA](http://creativecommons.org/licenses/by-nc-sa/4.0/).

## Developing the Extension

The following documentation covers tasks specific to building this extension. For general instructions, see [VS Code's extension documentation](https://code.visualstudio.com/api).

### Updating the Tree Sitter parser

**Using Docker**

Run the following command to build tree-sitter-devicetree.wasm.

```
npm run build-wasm
```

This method may not work on Windows due to an issue with tree-sitter incorrectly handling path separators.

**Using Emscripten**

1. [Install Emscripten](https://emscripten.org/docs/getting_started/downloads.html).
2. Find the [version of Emscripten used by tree-sitter](https://github.com/tree-sitter/tree-sitter/blob/master/cli/emscripten-version).
3. In a Bash or PowerShell terminal, cd to the emsdk directory and run:
    ```sh
    ./emsdk install <version>
    ./emsdk activate <version>
    ```
    replacing `<version>` with the version from step 2.
4. In the same terminal, cd back to this repo and run:
    ```
    npm run build-wasm
    ```

For subsequent builds, run the following command to set up the Emscripten environment again, then run step 4 above:

PowerShell:

```sh
<path-to-emsdk>/emsdk_env.ps1
```

Bash:

```sh
source <path-to-emsdk>/emsdk_env.sh
```
