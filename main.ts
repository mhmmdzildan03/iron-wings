// IRON WINGS — Skies of 1944: the hand-in program (Node 22, no dependencies).
//
// The game itself is the static site under game/ — plain files a desktop
// browser opens offline, PixiJS and anime.js vendored beside it as minified
// builds. This program's one job is to hand that game in the way the bounty
// asks: copy game/ and screenshots/ next to the dossier in the output
// directory and write dossier.json with the kit's own buildDossier, so the
// judges read exactly the files in this repository.
//
// Play it locally first:  node serve.ts   then open http://localhost:8080
// Hand it in outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below are the scorer's own (see the kit's gate): they only refuse
// what the scorer would refuse anyway — screenshot count and size, game file
// count, total bytes and path length — and text_max_bytes shapes the dossier.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
