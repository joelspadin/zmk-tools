# Change Log

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
