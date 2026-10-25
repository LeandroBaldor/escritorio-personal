// Modo prueba (vidas ilimitadas): solo para el dueño, para probar los juegos sin perder. Se prende una vez
// por navegador abriendo la sección de Juegos con un enlace secreto (…#/juegos?vidas=CÓDIGO) y se apaga con
// …#/juegos?vidas=no. El código no está escrito acá: solo su huella (SHA-256), así que no se puede leer del
// programa. Queda guardado en ese navegador; para el resto de la gente los juegos son normales.
//
// Con el modo prueba:
// - Trepaluna y Gravity Swap: perder no descuenta vidas.
// - ¡Cuidado, bloques!: en vez de aplastarte, se rompen los bloques que te aprietan; las bombas no te matan.
// - ¡El piso es de lava!: la lava, el fuego, la electricidad y las antorchas no te hacen nada.
// - Ciudad Tiburón: los tiburones no te comen y el tiempo no se termina.
// - Invasión: no hay límite de civiles ni de tiempo.
// - La serpiente al revés: la serpiente no te come.

const KEY = 'escritorio-personal-juegos:modo-prueba';
const CODE_HASH = '9716422b8f7d0e38eeecb2b9deb49134e3a8455440bfb07afed12749f920a5ab';

let cached: boolean | null = null;
export function isTester(): boolean {
  if (cached === null) { try { cached = localStorage.getItem(KEY) === CODE_HASH; } catch { cached = false; } }
  return cached;
}
// Solo para las pruebas automáticas.
export function setTesterForTests(on: boolean | null) { cached = on; }

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

// Mira si la dirección trae ?vidas=… y prende o apaga el modo prueba. Devuelve si quedó prendido.
export async function applyTesterLink(search: string): Promise<boolean> {
  const value = new URLSearchParams(search).get('vidas');
  if (value === null) return isTester();
  try {
    if (value === 'no') { localStorage.removeItem(KEY); cached = false; }
    else if (crypto?.subtle && (await sha256(value)) === CODE_HASH) { localStorage.setItem(KEY, CODE_HASH); cached = true; }
  } catch { /* sin almacenamiento o sin cripto: queda como estaba */ }
  return isTester();
}
