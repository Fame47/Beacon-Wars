# Beacon Wars v44 Help Me Notes

## What was broken
Earth had blocked cells inside the CPU deployment row. The CPU needs all 30 top-row deployment spaces, but Earth only left 26 open spaces. That crashed setup during `placeAI()`, so the CPU units and your unit tray never finished rendering.

## What changed in v44
- Earth blockers were moved into the middle two rows only.
- `normalizeBlockedCells()` now ignores any blocker that accidentally lands in deployment rows.
- `placeAI()` and `randomPlaceBlue()` now check deployment capacity before placing units.
- The side-choice bug where RED player pieces could behave like enemy pieces was cleaned up.
- Movement logs now use the moving unit’s real team instead of always saying BLUE.
- Code is split into:
  - `beacon_wars_v44_clean_earth_help.html` for screens and layout.
  - `style.css` for visual/HUD styling.
  - `script.js` for game logic.
- A HELP ME screen was added inside the setup menu.

## Board coordinate rules
- Internal board rows are `0` at the top and `7` at the bottom.
- Player-facing row labels are `8` at the top and `1` at the bottom.
- CPU deployment rows: internal rows `0,1,2`.
- Player deployment rows: internal rows `5,6,7`.
- Safe impassable rows on an 8x10 board: internal rows `3,4` only.

## Unit count
Beacon Wars currently places 30 pieces per side:
10, 9, 8, 7, two 6s, two 5s, two 4s, five 3s, five 2s, two 1s, one Infiltrator, six Mines, and one Beacon.

## Main gameplay functions
- `startGame(fieldId)` locks the chosen battlefield and starts a fresh game.
- `initGame()` resets the board and places the CPU.
- `placeAI()` places all CPU units in the top 3 rows.
- `randomPlaceBlue()` places all player units in the bottom 3 rows. The name stayed for compatibility, but it works for either side color.
- `renderBoard()` draws hidden enemies, visible pieces, move markers, scan markers, and coordinate numbers.
- `performAction()` moves or attacks.
- `resolveCombat()` handles rank comparison, mines, infiltrator rules, beacon capture, and commander defeat.
- `aiTurn()` chooses a fair CPU move without knowing hidden ranks unless revealed or scanned.

## Important design guardrail
If a new battlefield breaks deployment, check its `blocked` list first. Blockers must not be placed in rows `0,1,2,5,6,7` unless the total unit count or deployment system changes.


## v45 Earth zone alignment

This version fixes the Earth map blocker coding.

### What was wrong
The Earth quarantine blocker cells were shifted one column to the right:
- old left blocker was board columns 2-3 instead of 1-2
- old right blocker was board columns 9-10 instead of 8-9

That made units appear in the red quarantine art and made the wrong squares behave as blocked.

### Correct Earth blocked cells
Visual board labels:
- Left quarantine: columns 1-2, rows 4-5
- Right quarantine: columns 8-9, rows 4-5

Internal zero-based cells:
- Left: `3,0`, `3,1`, `4,0`, `4,1`
- Right: `3,7`, `3,8`, `4,7`, `4,8`

### Deployment safety
AI deploys top 3 rows.
Player deploys bottom 3 rows.
Earth blockers stay in middle rows so both sides still have all 30 deployment spaces.


## v46 Help cleanup
- Cleaned the Combat section in HELP ME.
- Added image cards next to each combat rule for quick visual reading.
- Core combat notes now highlight rank wins, equal-rank removal, Tech Engineer vs Shield Mine, Infiltrator vs Fleet Commander, and win conditions.


## v47 Online room prep
- Removed Deployment, Commander Powers, and Code Map boxes from HELP ME.
- Added ONLINE MATCH button on the main menu.
- Added online room screen over the starfield background.
- Added Create Room / Join Room UI with room-code input.
- Host chooses color; guest receives the opposite color and attacks first.
- Added Firebase hook placeholders and ONLINE_FIREBASE_NOTES.md for the next wiring pass.
