import data from './assets/land/voices/events/cues.json';
import type {CharacterClip} from './landCharacterClips';
export const EVENT_CLIPS=data as Record<'burn'|'built'|'trained'|'dig',CharacterClip>;
