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


# v51 Stronger Commit Lock

Fixes from v50:
- Board lock overlay now sits above unit hotspots, so the board is truly locked in WAITING and COMMIT.
- Firebase uses both `turnRole` and `activeRole` plus `turnTeam` and `activeTeam`.
- Commit writes `lastCommitId`, `lastCommitByRole`, and `moveSeq`.
- Listener re-identifies host/guest by Firebase uid after refresh.
- Start battle no longer resets turn back to guest after a commit has already happened.
- Cache bust moved to `?v=51`.


# v52 Commit Room Only

Fix:
- COMMIT now treats the room document write as the source of truth.
- The optional `rooms/{roomCode}/moves` history write is now non-fatal.
- If the subcollection rule is missing, the turn still passes.
- COMMIT FAILED now shows the actual Firebase error instead of a generic message.
- Cache bust moved to `?v=52`.

Testing:
- After pressing COMMIT, check Firestore `rooms/{ROOMCODE}`.
- These fields should update: `activeRole`, `activeTeam`, `turnRole`, `turnTeam`, `moveSeq`, `lastCommitId`.


# v53 UID Turn Lock

Fix:
- Turn ownership now uses Firebase Auth uid (`activeUid` / `turnUid`) as the main source.
- Role and team are only fallback checks.
- COMMIT reads the room document first, identifies whether the current user is host or guest, then passes the turn to the opponent uid.
- If the opponent has not joined, COMMIT shows a clear error instead of silently trapping both players in waiting.
- Cache bust moved to `?v=53`.

Firestore room document should now show:
- `hostUid`
- `guestUid`
- `activeUid`
- `turnUid`
- `activeRole`
- `activeTeam`
- `moveSeq`
- `lastCommitId`


# v54 Room Move Trace

This version starts moving from "turn flag only" toward real room sync:
- Player deployment uploads to Firestore when START BATTLE is pressed.
- Opponent deployment is mirrored and replaces the temporary AI enemy layout.
- Local moves are saved as `pendingMove`.
- COMMIT writes `lastMoveText` and a `lastMove.payload` to the room document.
- The opponent listener logs the remote commit.
- Simple non-combat moves are auto-applied on the opponent board when the source square matches.
- Attacks are logged as committed combat. Full combat replay is the next layer.
- Cache bust moved to `?v=54`.

Firestore room should now show:
- hostDeployment / guestDeployment
- lastMoveText
- lastMove.payload
- activeUid / turnUid
