/**
 * provablyFair.js — Provably Fair seed system
 * 
 * How it works:
 * 1. Server generates a random serverSeed and hashes it → sends hash to client BEFORE game
 * 2. Client provides clientSeed (browser-generated)
 * 3. Nonce increments each bet
 * 4. Result = HMAC-SHA256(serverSeed, clientSeed:nonce) → converted to game outcome
 * 5. After game, server reveals serverSeed → player can verify hash matches
 */
const crypto = require('crypto');

/**
 * Generate a new server seed and its public hash
 */
function generateServerSeed() {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
  return { serverSeed, serverSeedHash };
}

/**
 * Generate a float 0-1 from seeds + nonce (same algorithm used by major PF casinos)
 */
function generateFloat(serverSeed, clientSeed, nonce) {
  const hmac = crypto.createHmac('sha256', serverSeed);
  hmac.update(`${clientSeed}:${nonce}`);
  const hash = hmac.digest('hex');
  // Use first 8 hex chars → 32-bit int → float
  const val = parseInt(hash.slice(0, 8), 16);
  return val / 0x100000000; // divide by 2^32
}

/**
 * Verify: given serverSeed, does its hash match what was shown before the game?
 */
function verifyHash(serverSeed, expectedHash) {
  const actualHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
  return actualHash === expectedHash;
}

/**
 * Generate a game result for each game type
 */
function getResult(game, serverSeed, clientSeed, nonce) {
  const f = generateFloat(serverSeed, clientSeed, nonce);
  switch (game) {
    case 'dice':   return { roll: +(f * 100).toFixed(2) };
    case 'crash':  return { multiplier: +Math.max(1, (99 / (f * 100 + 0.01) * 0.97 )).toFixed(2) };
    case 'roulette': return { number: Math.floor(f * 37) }; // 0-36
    case 'slots': {
      const f2 = generateFloat(serverSeed, clientSeed, nonce + 1);
      const f3 = generateFloat(serverSeed, clientSeed, nonce + 2);
      const symbols = ['🍒','🍋','🍊','⭐','💎','7️⃣'];
      return {
        reels: [
          symbols[Math.floor(f  * symbols.length)],
          symbols[Math.floor(f2 * symbols.length)],
          symbols[Math.floor(f3 * symbols.length)],
        ]
      };
    }
    case 'mines': return { minePositions: shuffleSeeded(f, 25).slice(0, 5) };
    default:      return { value: f };
  }
}

function shuffleSeeded(seed, n) {
  const arr = Array.from({length: n}, (_, i) => i);
  let s = seed;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = { generateServerSeed, generateFloat, verifyHash, getResult };
