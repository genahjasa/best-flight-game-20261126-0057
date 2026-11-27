// Sky Courier — Island Run: the hand-in program (Node 22, standard library only).
//
// The game itself is plain static files under game/ (game/index.html plus its ES
// modules — no library, no network request), and the screenshots are the maker's own
// renders of it in a desktop browser. This program hands both in: it copies game/
// and screenshots/ from beside this file to /output and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

/** Count every file and directory under a path, for the run summary. */
function countEntries(path) {
  let files = 0;
  let dirs = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      dirs += 1;
      const sub = countEntries(join(path, entry.name));
      files += sub.files;
      dirs += sub.dirs;
    } else {
      files += 1;
    }
  }
  return { files, dirs };
}

if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: there is no game to hand in');
}
if (!existsSync(shotsDir)) {
  throw new Error('screenshots/ is missing: the entry needs 3 or 4 screenshots');
}
const shotNames = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`screenshots/ holds ${shotNames.length} images: the entry needs 3 or 4`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps, from the competition's gate: only text_max_bytes shapes
// the bytes; the rest refuse an entry the scorer would refuse anyway (more than 4
// screenshots or one over 256 KiB; more than 993 entries in game/ or 48 MiB of game
// files in all, or a path under game/ over 1000 bytes — game/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// The gate refuses a dossier over 1.5 MiB, so fail here — loudly, before submit —
// rather than handing in an entry the scorer would refuse.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
if (dossierBytes > 1572864) {
  throw new Error(`dossier.json is ${dossierBytes} bytes: over the 1.5 MiB gate cap`);
}

const gameCount = countEntries(join(out, 'game'));
const shotFiles = readdirSync(join(out, 'screenshots')).filter((name) => !name.startsWith('.'));
console.log(
  `handed in: game/ ${gameCount.files} files in ${gameCount.dirs} directories, ` +
  `${shotFiles.length} screenshots, dossier.json ${dossierBytes} bytes -> ${out}`,
);
