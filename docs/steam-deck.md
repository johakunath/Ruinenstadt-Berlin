# Steam Deck

How the web game runs on the Deck in Game Mode (playtest 2026-11-25). Not a native build: Chrome as a non-Steam game.

| Step | Setting |
|---|---|
| Browser | Google Chrome from Discover, then "Add to Steam". Firefox in Game Mode has a broken Fullscreen API (Mozilla bug 1867649) and its Flatpak did not see the Deck pad (bug 1784381) |
| Launch options | Keep Steam's text, append `--force-device-scale-factor=1.25` (optional `--kiosk "<game URL>"`). Chrome runs the 7" 1280×800 screen (about 210 px per inch) at scale 1, so the UI is tiny. 1.25 (page 1024×640) fits every screen without scrolling; 1.5 (853×533, tablet size) scrolls the inventory. Tested 2026-11-25 at Deck size in a cloud browser. A CSS `zoom` inside the page does not work: media queries ignore it and `vh` grows with it |
| Controller | Steam › the shortcut › controller layout › template **Gamepad with Mouse Trackpad**. The desktop layout turns the stick into a mouse, and the browser sees no pad |

In code: `onSteamDeck` (`src/options.ts`) starts the Deck on Leistung and with the controller (pad labels, aim assist, Optionen › Steuerung on Controller, pad line on the start screen); `activePad` (`src/input/pad.ts`) reads the pad that moves when the browser lists several; a connected pad switches the play labels to pad buttons.
