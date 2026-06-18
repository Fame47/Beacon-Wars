# v49 Firebase Turn Handoff

This version replaces the v47/v48 online waiting stub with real Firebase room turn passing.

What is wired:
- Firebase SDK compat scripts load in `index.html`
- `firebase-config.js` holds the Beacon Wars Firebase config
- Anonymous Auth signs in both browsers
- Host creates a Firestore room after choosing color
- Guest joins the room code
- Guest gets the opposite color and first attack
- Pressing START BATTLE writes `phase: "battle"` and `turnRole: "guest"`
- After a player moves, `firebaseSendTurn()` updates the Firestore room:
  - `turnRole` becomes the other player
  - `turnTeam` becomes the other color
  - `moveSeq` increments
- Each browser listens to the room document with `onSnapshot()` and changes from WAITING to PLAYER when it is their turn

Known current limitation:
This is the turn handoff layer. It passes control between browsers, but full board-state synchronization is the next layer.
