// Personajes del "Solitario de Superhéroes": uno por carta. Cada uno es una ficha con los rasgos
// que usa el dibujante (HeroHead) para armar una caricatura propia y simple de la cabeza:
// colores, máscara o casco, ojos, pelo, boca y algunos detalles. No copia dibujos ni logos oficiales.
import type { Suit } from './solitaire';

export type Hood = 'full' | 'cowl' | 'domino' | 'helmet';
export type Eyes = 'lens' | 'slit' | 'dot' | 'glow' | 'angry' | 'none';
export type HairStyle = 'short' | 'long' | 'spiky' | 'wild' | 'slick' | 'curl' | 'bun' | 'pigtails' | 'mohawk';
export type Mouth = 'smile' | 'grin' | 'frown' | 'flat' | 'smirk' | 'none';
export type Extra =
  | 'web' | 'letterA' | 'capWings' | 'batEars' | 'boltEars' | 'lokiHorns' | 'antlers' | 'wolverineFins' | 'antennae'
  | 'topHat' | 'bowler' | 'splitFace' | 'sack' | 'goggles' | 'freezeDome' | 'tentacles' | 'beard' | 'stubble' | 'chinLines'
  | 'magnetoCrest' | 'hoodCloth' | 'star' | 'hammer' | 'cloak' | 'tiara' | 'ring' | 'arrowHood' | 'gem' | 'shades'
  | 'skull' | 'faceplate' | 'leaves' | 'diamondTattoo' | 'stoneFace' | 'rhinoHorn' | 'tubes' | 'amulet' | 'cyborgHalf' | 'jesterHat' | 'devilHorns';

export interface Look {
  skin?: string;
  costume: string;
  hood?: [Hood, string];
  eyes?: Eyes;
  eyeColor?: string;
  hair?: [HairStyle, string];
  mouth?: Mouth;
  extras?: Extra[];
  accent?: string; // color de detalles (letras, alas, gemas)
}
export interface Hero { name: string; look: Look }

export const SKIN = '#f5c9a0';
const BROWN = '#8d5a3b', PALE = '#f3e9e1';

export const HEROES: Record<Suit, Hero[]> = {
  // ♥ Héroes de Marvel
  corazon: [
    { name: 'Spider-Man', look: { costume: '#dc2626', hood: ['full', '#dc2626'], eyes: 'lens', extras: ['web'] } },
    { name: 'Ant-Man', look: { costume: '#b91c1c', hood: ['helmet', '#991b1b'], eyes: 'lens', eyeColor: '#7dd3fc', extras: ['antennae'], mouth: 'smile' } },
    { name: 'Falcon', look: { skin: BROWN, costume: '#e2e8f0', eyes: 'dot', extras: ['goggles'], hair: ['short', '#1f2937'], mouth: 'smile' } },
    { name: 'Black Widow', look: { costume: '#111827', hair: ['long', '#c2410c'], eyes: 'dot', mouth: 'smirk' } },
    { name: 'Daredevil', look: { costume: '#991b1b', hood: ['cowl', '#991b1b'], eyes: 'slit', eyeColor: '#450a0a', mouth: 'flat', extras: ['devilHorns'] } },
    { name: 'Doctor Strange', look: { costume: '#1e3a8a', hair: ['slick', '#1f2937'], eyes: 'dot', mouth: 'flat', extras: ['stubble', 'cloak', 'amulet'], accent: '#dc2626' } },
    { name: 'Black Panther', look: { costume: '#111827', hood: ['full', '#111827'], eyes: 'slit', eyeColor: '#e5e7eb', extras: ['batEars'], accent: '#a78bfa' } },
    { name: 'Wolverine', look: { costume: '#facc15', hood: ['cowl', '#facc15'], eyes: 'slit', eyeColor: '#fff', mouth: 'frown', extras: ['wolverineFins', 'stubble'] } },
    { name: 'Hulk', look: { skin: '#4ade80', costume: '#7c3aed', hair: ['wild', '#14532d'], eyes: 'angry', mouth: 'frown' } },
    { name: 'Thor', look: { costume: '#475569', hair: ['long', '#f59e0b'], eyes: 'dot', mouth: 'smile', extras: ['beard', 'hammer'], accent: '#94a3b8' } },
    { name: 'Capitán América', look: { costume: '#1d4ed8', hood: ['cowl', '#1d4ed8'], eyes: 'dot', mouth: 'smile', extras: ['letterA', 'capWings', 'star'], accent: '#f8fafc' } },
    { name: 'Capitana Marvel', look: { costume: '#1e40af', hair: ['long', '#fbbf24'], eyes: 'dot', mouth: 'smile', extras: ['star'], accent: '#facc15' } },
    { name: 'Iron Man', look: { costume: '#b91c1c', hood: ['helmet', '#b91c1c'], eyes: 'slit', eyeColor: '#e0f2fe', mouth: 'none', extras: ['faceplate', 'gem'], accent: '#facc15' } },
  ],
  // ♦ Villanos de Marvel
  diamante: [
    { name: 'Thanos', look: { skin: '#a78bfa', costume: '#1e3a8a', eyes: 'dot', mouth: 'smirk', extras: ['chinLines'], accent: '#facc15' } },
    { name: 'Rhino', look: { skin: '#9ca3af', costume: '#6b7280', hood: ['cowl', '#6b7280'], eyes: 'angry', mouth: 'frown', extras: ['rhinoHorn'] } },
    { name: 'Duende Verde', look: { skin: '#4d7c0f', costume: '#7e22ce', eyes: 'glow', eyeColor: '#fde047', mouth: 'grin', extras: ['jesterHat'], accent: '#7e22ce' } },
    { name: 'Doctor Octopus', look: { costume: '#15803d', hair: ['slick', '#1f2937'], eyes: 'dot', mouth: 'frown', extras: ['shades', 'tentacles'] } },
    { name: 'Venom', look: { costume: '#0f172a', hood: ['full', '#0f172a'], eyes: 'lens', mouth: 'grin' } },
    { name: 'Mysterio', look: { costume: '#15803d', hood: ['helmet', '#bae6fd'], eyes: 'none', extras: ['freezeDome', 'cloak'], accent: '#7e22ce' } },
    { name: 'Ultron', look: { skin: '#cbd5e1', costume: '#94a3b8', hood: ['helmet', '#94a3b8'], eyes: 'glow', eyeColor: '#ef4444', mouth: 'grin' } },
    { name: 'Cráneo Rojo', look: { skin: '#dc2626', costume: '#14532d', eyes: 'angry', mouth: 'grin', extras: ['skull'] } },
    { name: 'Magneto', look: { costume: '#7e22ce', hood: ['cowl', '#b91c1c'], eyes: 'dot', mouth: 'flat', extras: ['magnetoCrest'], accent: '#b91c1c' } },
    { name: 'Hela', look: { skin: PALE, costume: '#14532d', hood: ['cowl', '#052e16'], eyes: 'angry', mouth: 'smirk', extras: ['antlers'] } },
    { name: 'Loki', look: { costume: '#15803d', hair: ['long', '#111827'], eyes: 'dot', mouth: 'smirk', extras: ['lokiHorns'], accent: '#facc15' } },
    { name: 'Mística', look: { skin: '#2563eb', costume: '#f8fafc', hair: ['slick', '#dc2626'], eyes: 'glow', eyeColor: '#facc15', mouth: 'smirk' } },
    { name: 'Doctor Muerte', look: { costume: '#15803d', hood: ['helmet', '#9ca3af'], eyes: 'slit', eyeColor: '#111827', mouth: 'flat', extras: ['hoodCloth'], accent: '#15803d' } },
  ],
  // ♠ Héroes de DC
  pica: [
    { name: 'Superman', look: { costume: '#1d4ed8', hair: ['curl', '#111827'], eyes: 'dot', mouth: 'smile', extras: ['cloak'], accent: '#dc2626' } },
    { name: 'Robin', look: { costume: '#dc2626', hood: ['domino', '#111827'], eyes: 'lens', hair: ['short', '#111827'], mouth: 'smile' } },
    { name: 'Cyborg', look: { skin: BROWN, costume: '#94a3b8', eyes: 'dot', mouth: 'flat', extras: ['cyborgHalf'], accent: '#ef4444' } },
    { name: 'Aquaman', look: { costume: '#f97316', hair: ['long', '#a16207'], eyes: 'dot', mouth: 'smile', extras: ['beard'], accent: '#16a34a' } },
    { name: 'Flash', look: { costume: '#dc2626', hood: ['cowl', '#dc2626'], eyes: 'lens', mouth: 'smile', extras: ['boltEars'], accent: '#facc15' } },
    { name: 'Linterna Verde', look: { costume: '#15803d', hood: ['domino', '#15803d'], eyes: 'glow', eyeColor: '#fff', hair: ['short', '#78350f'], mouth: 'smile', extras: ['ring'] } },
    { name: 'Detective Marciano', look: { skin: '#22c55e', costume: '#1e3a8a', eyes: 'glow', eyeColor: '#dc2626', mouth: 'flat', extras: ['cloak'], accent: '#dc2626' } },
    { name: 'Flecha Verde', look: { costume: '#15803d', hood: ['domino', '#15803d'], eyes: 'dot', hair: ['short', '#fbbf24'], mouth: 'smirk', extras: ['arrowHood', 'beard'], accent: '#14532d' } },
    { name: 'Nightwing', look: { costume: '#111827', hood: ['domino', '#111827'], eyes: 'lens', hair: ['spiky', '#111827'], mouth: 'smile', accent: '#2563eb' } },
    { name: 'Batgirl', look: { costume: '#6b21a8', hood: ['cowl', '#4c1d95'], eyes: 'lens', hair: ['long', '#c2410c'], mouth: 'smile', extras: ['batEars'] } },
    { name: 'Shazam', look: { costume: '#dc2626', hair: ['short', '#111827'], eyes: 'dot', mouth: 'grin', extras: ['cloak'], accent: '#facc15' } },
    { name: 'Mujer Maravilla', look: { costume: '#b91c1c', hair: ['long', '#111827'], eyes: 'dot', mouth: 'smile', extras: ['tiara'], accent: '#facc15' } },
    { name: 'Batman', look: { costume: '#374151', hood: ['cowl', '#1f2937'], eyes: 'lens', mouth: 'frown', extras: ['batEars', 'cloak'], accent: '#111827' } },
  ],
  // ♣ Villanos de DC
  trebol: [
    { name: 'Joker', look: { skin: '#f8fafc', costume: '#7e22ce', hair: ['slick', '#16a34a'], eyes: 'angry', mouth: 'grin' } },
    { name: 'Pingüino', look: { costume: '#111827', eyes: 'dot', mouth: 'smirk', extras: ['topHat'], hair: ['short', '#111827'], accent: '#7e22ce' } },
    { name: 'Acertijo', look: { costume: '#16a34a', hood: ['domino', '#14532d'], eyes: 'dot', mouth: 'smirk', extras: ['bowler'], accent: '#7e22ce' } },
    { name: 'Dos Caras', look: { costume: '#475569', hair: ['slick', '#9ca3af'], eyes: 'dot', mouth: 'flat', extras: ['splitFace'] } },
    { name: 'Espantapájaros', look: { skin: '#d6b26e', costume: '#78350f', eyes: 'glow', eyeColor: '#fde047', mouth: 'grin', extras: ['sack'] } },
    { name: 'Bane', look: { costume: '#374151', hood: ['full', '#1f2937'], eyes: 'glow', eyeColor: '#fff', mouth: 'none', extras: ['tubes'] } },
    { name: 'Sr. Frío', look: { skin: '#bfdbfe', costume: '#94a3b8', eyes: 'dot', mouth: 'flat', extras: ['goggles', 'freezeDome'], accent: '#dc2626' } },
    { name: 'Hiedra Venenosa', look: { costume: '#15803d', hair: ['long', '#c2410c'], eyes: 'dot', eyeColor: '#16a34a', mouth: 'smirk', extras: ['leaves'] } },
    { name: 'Sinestro', look: { skin: '#e879f9', costume: '#111827', hair: ['slick', '#111827'], eyes: 'angry', mouth: 'flat', extras: ['ring'], accent: '#facc15' } },
    { name: 'Deathstroke', look: { costume: '#1f2937', hood: ['full', '#f97316'], eyes: 'slit', eyeColor: '#111827', mouth: 'none', extras: ['splitFace'], accent: '#111827' } },
    { name: 'Lex Luthor', look: { costume: '#15803d', eyes: 'dot', mouth: 'smirk', accent: '#7e22ce' } },
    { name: 'Harley Quinn', look: { skin: '#fff7f7', costume: '#111827', hair: ['pigtails', '#fde68a'], eyes: 'dot', mouth: 'grin', extras: ['diamondTattoo'], accent: '#dc2626' } },
    { name: 'Darkseid', look: { skin: '#6b7280', costume: '#1e3a8a', eyes: 'glow', eyeColor: '#ef4444', mouth: 'frown', extras: ['stoneFace'], hood: ['cowl', '#1e3a8a'] } },
  ],
};

export const heroOf = (suit: Suit, rank: number) => HEROES[suit][rank - 1];
