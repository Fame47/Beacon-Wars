# Earth Map Zones

Visual blocked zones:
- Left quarantine: columns 1-2, rows 4-5
- Right quarantine: columns 8-9, rows 4-5

Internal code cells in `battlefields.earth.blocked`:
- Left: `3,0`, `3,1`, `4,0`, `4,1`
- Right: `3,7`, `3,8`, `4,7`, `4,8`

Why the numbers differ:
- Board labels count columns 1-10.
- Code columns count 0-9.
- Board labels show row 8 at the top and row 1 at the bottom.
- Code rows count 0 at the top and 7 at the bottom.
