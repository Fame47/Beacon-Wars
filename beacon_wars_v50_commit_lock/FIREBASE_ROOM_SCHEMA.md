# Beacon Wars Firebase Room Schema Draft

Collection: `rooms`
Document ID: room code, for example `ABCD12`

```js
{
  roomCode: "ABCD12",
  hostUid: "firebase-auth-uid",
  guestUid: "firebase-auth-uid-or-null",
  hostColor: "blue" | "red",
  guestColor: "red" | "blue",
  firstAttackTeam: "red" | "blue", // always guestColor
  battlefield: "mars" | "earth",
  commander: "fleet" | "mirlock" | "naya" | "jay",
  tactic: "tacticalWarp" | "emergencyShield",
  phase: "lobby" | "deploy" | "battle" | "complete",
  turnTeam: "blue" | "red",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

Subcollection: `moves`

```js
{
  moveNumber: 1,
  team: "blue" | "red",
  type: "move" | "attack" | "scan" | "commanderPower",
  from: {r: 7, c: 0},
  to: {r: 6, c: 0},
  payload: {},
  createdAt: serverTimestamp()
}
```

Host chooses color. Guest automatically receives the opposite color and gets first attack.
