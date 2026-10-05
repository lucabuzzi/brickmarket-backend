// The "shot list": which photos are worth taking for each kind of item. The photo step shows one suggested
// shot per position (position 1 is always the cover) and the guide explains each of them.
// Labels and tips are translated as t(`sell.ui.shots.${id}.label`) / t(`sell.ui.shots.${id}.tip`).
import { MAX_PHOTOS } from './form.js';

export const SHOT_LISTS = {
  lego_set: ['box_front', 'box_back', 'box_corners', 'contents', 'flaws'],
  lego_loose: ['overview', 'closeup', 'other_side', 'details', 'scale'], // MOCs and minifigures: no box
  funko: ['box_front', 'box_side', 'box_back', 'box_corners', 'flaws'],
  tcg: ['card_front', 'card_back', 'card_corners', 'card_light', 'card_extra'],
};

export const ALL_SHOT_IDS = [...new Set(Object.values(SHOT_LISTS).flat())];

/** Which list applies to the form: by product type, and for LEGO by what is being sold (set vs MOC/minifigure). */
export function shotListKey(form) {
  if (form.productType === 'tcg') return 'tcg';
  if (form.productType === 'funko') return 'funko';
  return form.mainCategory === 'mocs' || form.mainCategory === 'minifigures' ? 'lego_loose' : 'lego_set';
}

export const shotListFor = (form) => SHOT_LISTS[shotListKey(form)].slice(0, MAX_PHOTOS);

/** The seven general rules shown in the guide, in order: t(`sell.ui.guide.tips.${id}.title`) / .text */
export const GUIDE_TIP_IDS = ['light', 'noflash', 'background', 'frame', 'parallel', 'focus', 'honest'];
