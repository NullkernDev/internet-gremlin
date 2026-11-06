/**
 * The Gremlin's palette. Every pixel of every asset comes from here so the
 * character looks identical in the extension, the icons, the stickers and
 * the promo video.
 */
export const PALETTE = {
  outline: '#1c1230',
  body: '#a982ff',
  bodyShade: '#7a52e0',
  bodyHi: '#d9c6ff',
  belly: '#e6d9ff',
  earInner: '#ff7ab8',
  white: '#fbf8ff',
  iris: '#b8ff3c',
  irisShade: '#6fcf1f',
  pupil: '#1c1230',
  tongue: '#ff5d8f',
  mouth: '#3a1744',
  tooth: '#ffffff',
  blush: '#ff9fd0',
  tear: '#4cc8ff',
  tearLight: '#c4f1ff',
  cable: '#3b2f63',
  cableHi: '#6a58a8',
  plug: '#b8ff3c',
  plugMetal: '#d8d6ea',
  gold: '#ffc83a',
  goldHi: '#fff3a6',
  vein: '#ff3b5c',
  heart: '#ff4f9a',
  heartHi: '#ffb3d4',
  star: '#fff36b',
  bags: '#7f63c9',
  angryBody: '#c77dff',
  angryShade: '#9b47e0',
  paleBody: '#cdb8ff',
  paleShade: '#a58ae8',
} as const;

export type PaletteKey = keyof typeof PALETTE;
