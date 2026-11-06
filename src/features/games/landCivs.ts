// Land of Warriors: las 10 civilizaciones (nombres, colores, qué hace cada guerrero, sus construcciones y su poder)
// y los 5 escenarios.
import type { Role, BKind, UnitStats } from './land';

export type CivId = 'humano' | 'zergano' | 'elfos' | 'enanos' | 'nomuerta' | 'sauriano' | 'infernal' | 'mecanico' | 'orcos' | 'abisal';
export const CIV_IDS: CivId[] = ['humano', 'zergano', 'elfos', 'enanos', 'nomuerta', 'sauriano', 'infernal', 'mecanico', 'orcos', 'abisal'];
export type PowerKind = 'strike' | 'rage' | 'heal' | 'shield';
export interface Civ {
  name: string; motto: string; color: string; style: string;
  units: Record<Role, string>; buildings: Record<BKind, string>;
  special: 'heal' | 'splash'; // el especial cura a los suyos o hace daño en área
  power: { kind: PowerKind; name: string };
  mod: Partial<Record<Role, Partial<UnitStats>>>; // lo que cambia respecto de los valores base
}
export const POWER_TEXT: Record<PowerKind, string> = {
  strike: 'Elegí un lugar del mapa: una explosión enorme daña a todos los enemigos y edificios de ahí.',
  rage: 'Durante 12 segundos tu ejército pega un 50% más fuerte y corre más rápido.',
  heal: 'Cura por completo a todo tu ejército, esté donde esté.',
  shield: 'Durante 12 segundos tu ejército recibe la mitad del daño.',
};
export const CIVS: Record<CivId, Civ> = {
  humano: { name: 'Imperio Humano', motto: 'Tecnología · Disciplina · Poder de fuego', color: '#3b82f6', style: 'Equilibrado: buenos tiradores, tanques fuertes y médicos que curan.',
    units: { worker: 'Ingeniero', melee: 'Recluta', ranged: 'Fusilero Pesado', special: 'Médico', heavy: 'Tanque Bastión', elite: 'Exoélite' },
    buildings: { base: 'Centro de Mando', barracks: 'Cuartel', workshop: 'Taller Mecánico', tower: 'Torre Orbital', depot: 'Depósito de Suministros' },
    special: 'heal', power: { kind: 'strike', name: 'Bombardeo Orbital' }, mod: { melee: { range: 110, hp: 110, dmg: 10 }, ranged: { hp: 110 }, elite: { range: 150, dmg: 38 } } },
  zergano: { name: 'Enjambre Zergano', motto: 'Biológico · Masivo · Evolución', color: '#a855f7', style: 'Muchos y baratos: criaturas rápidas que atacan en masa.',
    units: { worker: 'Larva Obrera', melee: 'Zángano Guerrero', ranged: 'Acechador', special: 'Escupidor Ácido', heavy: 'Coloso Quitinoso', elite: 'Reina Colmena' },
    buildings: { base: 'Colmena Principal', barracks: 'Cámara de Cría', workshop: 'Cámara de Mutación', tower: 'Torre de Espinas', depot: 'Sacos de Biomasa' },
    special: 'splash', power: { kind: 'rage', name: 'Oleada del Enjambre' }, mod: { melee: { cost: { stone: 55, gem: 0 }, hp: 105, speed: 98, time: 6 }, ranged: { cost: { stone: 55, gem: 20 }, hp: 75 }, heavy: { range: 50, hp: 460 } } },
  elfos: { name: 'Elfos de Yldran', motto: 'Naturaleza · Magia · Movilidad · Precisión', color: '#22c55e', style: 'Rápidos y certeros: arqueras de largo alcance y druidas que curan.',
    units: { worker: 'Sabio', melee: 'Espadachín Lunar', ranged: 'Arquera del Viento', special: 'Druida', heavy: 'Guardián Arbóreo', elite: 'Dragón Élfico' },
    buildings: { base: 'Árbol Madre', barracks: 'Salón de Arqueros', workshop: 'Círculo Druídico', tower: 'Torre de Runas', depot: 'Depósito de Esencia' },
    special: 'heal', power: { kind: 'heal', name: 'Bendición del Bosque' }, mod: { ranged: { range: 210, speed: 84 }, melee: { speed: 92 }, heavy: { range: 50 }, elite: { range: 170, dmg: 40 } } },
  enanos: { name: 'Clanes Enanos', motto: 'Minería · Forja · Resistencia · Artillería', color: '#f59e0b', style: 'Lentos pero durísimos, con la mejor artillería.',
    units: { worker: 'Minero', melee: 'Guerrero Enano', ranged: 'Arcabucero', special: 'Sacerdote Rúnico', heavy: 'Cañón de Asedio', elite: 'Gólem de Acero' },
    buildings: { base: 'Fortaleza del Clan', barracks: 'Barracón Enano', workshop: 'Taller de Ingeniería', tower: 'Torre Rúnica', depot: 'Depósito de Suministros' },
    special: 'heal', power: { kind: 'shield', name: 'Muralla de Hierro' }, mod: { melee: { hp: 180, speed: 66 }, ranged: { hp: 110, speed: 62, dmg: 13 }, heavy: { range: 230, dmg: 38 }, worker: { hp: 80 } } },
  nomuerta: { name: 'Legión No Muerta', motto: 'Resurrección · Plaga · Control · Desgaste', color: '#8b5cf6', style: 'Un ejército que no se cansa: nigromantes que reparan a los suyos.',
    units: { worker: 'Acólito', melee: 'Esqueleto Guerrero', ranged: 'Banshee', special: 'Nigromante', heavy: 'Abominación', elite: 'Dragón Espectral' },
    buildings: { base: 'Necrópolis', barracks: 'Cripta', workshop: 'Fosa de Carne', tower: 'Torre de Plaga', depot: 'Zigurat' },
    special: 'heal', power: { kind: 'heal', name: 'Resurrección Masiva' }, mod: { melee: { cost: { stone: 65, gem: 0 }, hp: 120 }, heavy: { range: 50, hp: 480 }, elite: { range: 160 } } },
  sauriano: { name: 'Imperio Sauriano', motto: 'Disciplina · Evolución · Sangre · Territorio', color: '#dc2626', style: 'Bestias enormes: dinosaurios que aplastan todo.',
    units: { worker: 'Saurling', melee: 'Guerrero Sauriano', ranged: 'Cazador Acechador', special: 'Chamán Sauriano', heavy: 'Triceratops de Asalto', elite: 'T-Rex Primordial' },
    buildings: { base: 'Nido Sauriano', barracks: 'Pozo de Caza', workshop: 'Vivero Primordial', tower: 'Torre Espinada', depot: 'Estanque de Crianza' },
    special: 'heal', power: { kind: 'rage', name: 'Rugido Ancestral' }, mod: { melee: { hp: 160 }, heavy: { range: 45, hp: 520, speed: 60 }, elite: { hp: 900, dmg: 52 } } },
  infernal: { name: 'Legión Infernal', motto: 'Fuego · Caos · Corrupción · Dominio', color: '#f97316', style: 'Puro daño: fuego que quema a varios a la vez.',
    units: { worker: 'Diablillo', melee: 'Legionario Infernal', ranged: 'Hechicero Infernal', special: 'Súcubo', heavy: 'Bruto del Caos', elite: 'Señor Infernal' },
    buildings: { base: 'Portal Infernal', barracks: 'Altar de Guerra', workshop: 'Herrería Infernal', tower: 'Torre Infernal', depot: 'Extractor de Almas' },
    special: 'splash', power: { kind: 'strike', name: 'Lluvia de Fuego' }, mod: { melee: { dmg: 16, hp: 120 }, ranged: { dmg: 14, hp: 75 }, heavy: { range: 45, dmg: 36 } } },
  mecanico: { name: 'Sindicato Mecánico', motto: 'Industria · Robótica · Producción · Expansión', color: '#eab308', style: 'Fábricas rápidas: robots de largo alcance que se reparan entre ellos.',
    units: { worker: 'Dron', melee: 'Infante Autómata', ranged: 'Francotirador Láser', special: 'Ingeniero Mecánico', heavy: 'Tanque Pesado', elite: 'Mech de Asalto' },
    buildings: { base: 'Centro de Mando', barracks: 'Planta de Unidades', workshop: 'Planta de Máquinas', tower: 'Torre Defensiva', depot: 'Depósito de Componentes' },
    special: 'heal', power: { kind: 'shield', name: 'Sobrecarga de Red' }, mod: { melee: { range: 120, dmg: 10 }, ranged: { range: 240, dmg: 14, cool: 1.6 }, elite: { range: 150 } } },
  orcos: { name: 'Clanes Orcos', motto: 'Fuerza · Brutalidad · Tribu · Conquista', color: '#b91c1c', style: 'Fuerza bruta: guerreros baratos que pegan muy fuerte de cerca.',
    units: { worker: 'Orco Peón', melee: 'Guerrero Orco', ranged: 'Cazador de Fieras', special: 'Brujo Orco', heavy: 'Trol de Combate', elite: 'Drakko Salvaje' },
    buildings: { base: 'Gran Sala del Clan', barracks: 'Campamento de Guerra', workshop: 'Taller de Asedio', tower: 'Torre Orca', depot: 'Choza de Trabajo' },
    special: 'splash', power: { kind: 'rage', name: 'Furia Tribal' }, mod: { melee: { hp: 170, dmg: 15, cost: { stone: 75, gem: 0 } }, ranged: { range: 120 }, heavy: { range: 45, hp: 470 } } },
  abisal: { name: 'Dominio Abisal', motto: 'Océano · Mutación · Psiónica · Profundidad', color: '#06b6d4', style: 'Criaturas del fondo del mar: medusas que electrocutan a varios a la vez.',
    units: { worker: 'Siervo Abisal', melee: 'Guerrero Abisal', ranged: 'Acosador Profundo', special: 'Medusa Psiónica', heavy: 'Kraken de Guerra', elite: 'Hidra Abisal' },
    buildings: { base: 'Colonia Abisal', barracks: 'Criadero Sombrío', workshop: 'Vivero Mutante', tower: 'Torre Abisal', depot: 'Extractor de Esencia' },
    special: 'splash', power: { kind: 'strike', name: 'Maremoto' }, mod: { melee: { speed: 88 }, special: { range: 120, splash: 80 }, heavy: { range: 60 }, elite: { range: 160 } } },
};
export const ROLE_TEXT: Record<Role, string> = {
  worker: 'Junta piedras y diamantes, levanta las construcciones.',
  melee: 'Soldado de primera línea.',
  ranged: 'Ataca de lejos.',
  special: '',
  heavy: 'Máquina o bestia pesada: rompe edificios y pega en área.',
  elite: 'El más fuerte de todos.',
};
export const roleText = (c: CivId, r: Role) => r === 'special' ? (CIVS[c].special === 'heal' ? 'Cura a los suyos que estén lastimados.' : 'Ataque en área: daña a varios a la vez.') : r === 'melee' && (CIVS[c].mod.melee?.range ?? 0) > 60 ? 'Soldado básico con arma de fuego, de corto alcance.' : ROLE_TEXT[r];
export const BUILD_TEXT: Record<BKind, string> = {
  base: 'Hace trabajadores, investiga las mejoras y recibe lo que juntan. Si la destruyen, perdés.',
  barracks: 'Entrena a los soldados.',
  workshop: 'Construye las máquinas y la unidad élite (necesita el cuartel).',
  tower: 'Defiende sola: le dispara a los enemigos que se acercan.',
  depot: 'Suma 8 de población y es otro lugar donde dejar lo juntado.',
};
export const MAPS = [
  { name: 'La Grieta Corrupta', text: 'Una planta industrial tomada por el ácido y un portal que se abre.' },
  { name: 'Archipiélago Esmeralda', text: 'Islas, manglares y templos entre ríos de agua turquesa.' },
  { name: 'Tierras de Ceniza', text: 'Ruinas góticas entre ríos de lava y un volcán.' },
  { name: 'Valle de Yldran', text: 'Bosques en flor, cascadas y puentes de piedra.' },
  { name: 'Frontera de Acero', text: 'Un cañón con cascadas cruzado por puentes de metal.' },
];
