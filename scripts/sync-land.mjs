/* global process, console */
// node scripts/sync-land.mjs <ruta-al-otro-repositorio> [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetArg = process.argv[2];
if (!targetArg || targetArg.startsWith('--')) throw new Error('Indicá la ruta al otro repositorio y, opcionalmente, --check.');
const target = fs.realpathSync(path.resolve(targetArg));
if (target === fs.realpathSync(source) || !fs.existsSync(path.join(target, 'src/features/games/LandGame.tsx'))) throw new Error('El destino debe ser el otro repositorio de MiniJuegos.');
const check = process.argv.includes('--check');
const files = [
  ...fs.readdirSync(path.join(source, 'src/features/games')).filter(n => /^(?:LandGame\.tsx|LandIcon\.tsx|land.*\.(?:tsx?|css))$/.test(n)).map(n => 'src/features/games/' + n),
  'src/features/games/fonts/orbitron.ttf', 'src/features/games/fonts/OFL-orbitron.txt',
  'tests/land-corrections.spec.ts', 'scripts/sync-land.mjs', 'scripts/prepare-land-art.mjs', 'docs/land-correcciones-6.md',
  'docs/land-partida.png', 'docs/land-atlas.png',
  'tests/land7.spec.ts', 'scripts/prepare-land-world.mjs', 'docs/land-correcciones-7.md',
  'docs/land7-menu.png', 'docs/land7-paisajes.png',
  'tests/land8.spec.ts', 'scripts/prepare-land-walls.mjs', 'docs/land-correcciones-8.md',
  'docs/land8-infograma.png', 'docs/land8-resumen.png', 'docs/land8-muros.png',
  'tests/land9.spec.ts', 'docs/land-correcciones-9.md',
  'docs/land9-informe.png', 'docs/land9-tropas.png', 'docs/land9-construccion.png',
  'tests/land10.spec.ts', 'docs/land-correcciones-10.md',
  'docs/land10-cuarteles.png', 'docs/land10-produccion.png',
];
function collect(dir) {
  for (const entry of fs.readdirSync(path.join(source, dir), { withFileTypes: true })) {
    const name = dir + '/' + entry.name;
    if (entry.isDirectory()) collect(name); else files.push(name);
  }
}
collect('src/features/games/assets/land');
let differences = 0;
for (const file of files) {
  const from = path.join(source, file), to = path.join(target, file);
  if (fs.existsSync(to) && fs.readFileSync(from).equals(fs.readFileSync(to))) continue;
  differences++; console.log((check ? 'Difiere: ' : 'Sincronizado: ') + file);
  if (!check) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); }
}
console.log(`${files.length} archivos comprobados; ${differences} ${check ? 'diferencias' : 'actualizados'}.`);
if (check && differences) process.exitCode = 1;
