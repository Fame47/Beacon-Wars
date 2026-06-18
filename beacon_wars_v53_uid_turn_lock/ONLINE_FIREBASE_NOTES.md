# Beacon Wars Online Mode Prep

This version adds the room flow that will connect to Firebase next.

## Current UI flow
1. Main Menu: click **ONLINE MATCH**.
2. Host clicks **CREATE ROOM**.
3. Host chooses **HOST BLUE** or **HOST RED**.
4. The room code is stored locally as a temporary stub.
5. The joining player enters the room code under **JOIN ROOM**.
6. Joiner automatically gets the opposite color.
7. Joiner gets first attack.

## Firebase pieces to wire next
The script already includes placeholder hook names:

- `firebaseCreateRoom(roomCode, hostColor)`
- `firebaseJoinRoom(roomCode)`
- `firebaseListenRoom(roomCode, onRemoteMove)`
- `firebaseSendMove(roomCode, movePayload)`

## Turn rule
Host chooses color.
Guest gets the other color.
Guest attacks first.

## Current limitation
Until Firebase is connected, online mode is a UI/turn-state scaffold. It uses `localStorage` only so the room screens can be tested safely.
