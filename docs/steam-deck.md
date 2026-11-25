# Steam Deck

How the web game runs on the Deck in Game Mode (playtest 2026-11-25). Not a native build: Chrome as a non-Steam game.

| Step | Setting |
|---|---|
| Browser | Google Chrome from Discover, then "Add to Steam". Firefox in Game Mode has a broken Fullscreen API (Mozilla bug 1867649) and its Flatpak did not see the Deck pad (bug 1784381) |
| Launch options | Keep Steam's text, append `--kiosk --force-device-scale-factor=1.5 "<game URL>"`. Kiosk hides tabs and the address bar; scale 1.5 makes the 7" 1280×800 screen read like a tablet (1.0 makes the UI tiny) |
| Controller | Steam › the shortcut › controller layout › template **Gamepad with Mouse Trackpad**. The desktop layout turns the stick into a mouse, and the browser sees no pad |

In code: `isSteamDeck` (`src/options.ts`) starts the Deck on Leistung; `activePad` (`src/input/pad.ts`) reads the pad that moves when the browser lists several; a connected pad switches the play labels to pad buttons.
