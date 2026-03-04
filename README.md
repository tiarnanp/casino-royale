# Casino Royale v2.0

## Quick Start
```bash
npm install
npm start
# → http://localhost:3000         (game lobby)
# → http://localhost:3000/admin   (admin panel)
```

## Admin Panel
Default password: `admin1234`
Change it by setting the env var: `ADMIN_PASSWORD=yourpassword npm start`

## File Structure
```
casino_royale_project/
├── public/
│   ├── index.html          ← Full game frontend (8 games)
│   └── admin.html          ← Admin dashboard
├── server/
│   ├── index.js            ← Express entry point
│   ├── db.js               ← Per-user JSON file storage
│   ├── provablyFair.js     ← Seed generation & verification
│   ├── middleware/auth.js  ← JWT auth
│   └── routes/
│       ├── auth.js         ← signup / login / logout
│       ├── balance.js      ← balance + history
│       ├── games.js        ← all game logic + PF
│       └── admin.js        ← admin API
├── data/
│   └── users/              ← one JSON file per player
└── nginx.conf
```

## Games
- Blackjack, Five Card Draw Poker (client-side)
- Roulette, Slots, Crash, Dice (Provably Fair via API)
- Mines, Plinko (hybrid)

## Provably Fair
Each game round uses HMAC-SHA256(serverSeed, clientSeed:nonce).
- Server seed hash shown BEFORE the game
- Server seed revealed AFTER — verify at /admin or the ⚙ VERIFY button

## Security
- bcrypt (12 rounds) password hashing
- HttpOnly JWT cookie auth (7-day expiry)
- Per-user data isolation (separate JSON files)
- Admin has separate cookie + password

## Environment Variables
- `PORT` — default 3000
- `JWT_SECRET` — change in production!
- `ADMIN_PASSWORD` — default admin1234, CHANGE THIS
- `NODE_ENV=production` — enables secure cookies (HTTPS)
