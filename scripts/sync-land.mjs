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
  'tests/land29.spec.ts', 'scripts/prepare-land-directions.mjs', 'docs/land-correcciones-29.md', 'docs/land29-frente-espalda.png', 'docs/land29-columnas.png', 'docs/land29-cosecha.png',
  'tests/land28.spec.ts', 'docs/land-correcciones-28.md', 'docs/land28-menu.png', 'docs/land28-cuartel.png',
  'tests/land27.spec.ts', 'docs/land-correcciones-27.md', 'docs/land27-censo.png', 'docs/land27-construcciones.png', 'docs/land27-economia.png', 'docs/land27-cuartel.png', 'docs/land27-puentes.png',
  'tests/land26.spec.ts', 'docs/land-correcciones-26.md', 'docs/land26-cuartel-larva.png',
  'tests/land25.spec.ts', 'scripts/prepare-land-voices25.mjs', 'docs/land-correcciones-25.md', 'docs/land25-lider-cola.png', 'docs/land25-biomas.png',
  'tests/land24.spec.ts', 'docs/land-correcciones-24.md', 'docs/land24-controles.png', 'docs/land24-marcha.png', 'docs/land24-marcha.webm',
  'tests/land23.spec.ts', 'scripts/prepare-land-dig.mjs', 'docs/land-correcciones-23.md',
  'docs/land23-resumen.png', 'docs/land23-soldados.png', 'docs/land23-costos.png',
  'tests/land22.spec.ts', 'docs/land-correcciones-22.md', 'docs/land22-aldea.png',
  'tests/land21.spec.ts', 'scripts/prepare-land-animation.mjs', 'docs/land-correcciones-21.md', 'docs/land21-prompts.json',
  'docs/land21-hud.png', 'docs/land21-animaciones.png', 'docs/land21-animaciones.webm',
  'docs/land20-panel-frutos.png', 'tests/land20.spec.ts', 'docs/land-correcciones-20.md', 'docs/land20-prompt.json', 'scripts/prepare-land-fruits.mjs',
  'tests/land19.spec.ts', 'docs/land-correcciones-19.md', 'docs/land19-animaciones.png', 'docs/land19-poblacion.png', 'docs/land19-minerales.png',
  'tests/land18.spec.ts', 'docs/land-correcciones-18.md', 'docs/land18-prompts.json',
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
  'tests/land-sounds.spec.ts', 'scripts/prepare-land-sounds.mjs', 'docs/land-sonidos-personajes.md',
  'docs/land-sonidos-pasos.wav', 'docs/land-sonidos-elfos.wav',
  'tests/land11.spec.ts', 'scripts/prepare-land-combat.mjs', 'docs/land-correcciones-11.md',
  'tests/land12.spec.ts', 'docs/land-correcciones-12.md',
  'tests/land13.spec.ts', 'scripts/prepare-land-steps.mjs', 'docs/land-correcciones-13.md',
  'tests/land14.spec.ts', 'scripts/prepare-land-events.mjs', 'docs/land-correcciones-14.md',
  'tests/land15.spec.ts', 'docs/land-correcciones-15.md',
  'tests/land16.spec.ts', 'scripts/prepare-land-portraits.mjs', 'docs/land-correcciones-16.md',
  'tests/land17.spec.ts', 'scripts/prepare-land-evolutions.mjs', 'docs/land-correcciones-17.md', 'docs/land17-prompts.json',
  'docs/land17-cuartel.png', 'docs/land17-cosecha.png', 'docs/land17-evoluciones.png',
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
