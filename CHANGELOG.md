# Change Log

## 1.4.0

-   Fixed an issue with parsing an empty build.yaml file.
-   Added code completion for `&mkp` and `&bt BT_DISC`.
-   Added support for reading `board_root` from `zephyr/module.yml`.

## 1.3.0

-   Updated ZMK key codes.
-   Changed how the keymap parser is loaded to hopefully fix the web extension.
-   Changed `*.keymap` files to identify as `dts` instead of `zmk-keymap` for better compatibility with extensions such as [nRF DeviceTree](https://marketplace.visualstudio.com/items?itemName=nordic-semiconductor.nrf-devicetree).

## 1.2.0

-   Disabled syntax error checking, since it gave too many false positives and the parser can't yet provide useful messages for real errors.
-   Updated ZMK behaviors.
-   Added support for macro-specific behaviors in macro bindings.

## 1.1.0

-   **ZMK: Add Keyboard** now grabs the latest version of the hardware list from
    [zmk.dev/hardware-metadata.json](https://zmk.dev/hardware-metadata.json)
    so the extension no longer needs to be updated to support new keyboards.

## 1.0.3

-   Updated ZMK keyboards.

## 1.0.2

-   Various bug fixes.

## 1.0.0

-   Added the **ZMK: Add Keyboard** command.

## 0.5.0

-   Added support for running as a web extension.
-   Added code completions for `&caps_word`, `&key_repeat`, and `&bl`.

## 0.4.0

-   Added code completion for `&to`, `&gresc`, `&sk`, and `&sl`.

## 0.3.0

-   Keymap syntax highlighting now works without the DeviceTree extension.
-   .overlay files are now automatically associated with the DeviceTree extension.
-   Updated Tree-sitter. Appears to fix "extension host terminated unexpectedly" errors.
-   Updated ZMK keycode support data.

## 0.2.0

-   Keymap code completion now automatically inserts missing includes.
-   Adjusted keymap code completion so it doesn't trigger on space when you're just adjusting alignment.
    -   Space no longer triggers completion of behaviors. Use tab or enter instead.

## 0.1.0

-   Initial release
