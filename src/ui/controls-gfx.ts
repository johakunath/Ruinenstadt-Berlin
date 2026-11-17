// U3: the three controls graphics of the options screen, ported from 2D `js/panels.js` (padSVG,
// keySVG, touchSVG) and relabelled with the 3D bindings (`src/input/input.ts`, touch layout in style.css).
export type ControlDevice = 'touch' | 'key' | 'pad';

const T = (x: number, y: number, s: string, a?: 'end' | 'middle'): string => `<text x="${x}" y="${y}"${a ? ` text-anchor="${a}"` : ''}>${s}</text>`;
const L = (d: string): string => `<path d="${d}" class="ln"/>`;

/** Xbox layout (standard mapping), as 2D padSVG plus the D-pad (Kraft wechseln). */
export function padSVG(): string {
  const bt = (x: number, y: number, c: string, l: string): string => `<circle cx="${x}" cy="${y}" r="13" fill="${c}"/><text x="${x}" y="${y + 5}" class="bk">${l}</text>`;
  const dpad = '<path d="M332 174h12v10h10v12h-10v10h-12v-10h-10v-12h10z" class="sm"/><path d="M338 176l-4 6h8z" class="dpu"/>';
  return `<svg class="cgfx" viewBox="0 0 760 310" role="img" aria-label="Controller-Belegung"><path d="M260 90 Q300 58 380 64 Q460 58 500 90 Q560 200 540 240 Q520 270 488 244 L462 210 L298 210 L272 244 Q240 270 220 240 Q200 200 260 90Z" class="body"/>
  <rect x="262" y="52" width="60" height="14" rx="6" class="bmp"/><rect x="438" y="52" width="60" height="14" rx="6" class="bmp"/><circle cx="295" cy="125" r="20" class="stk"/><circle cx="440" cy="185" r="18" class="stk"/>${dpad}
  <rect x="345" y="112" width="18" height="11" rx="4" class="sm"/><rect x="397" y="112" width="18" height="11" rx="4" class="sm"/>${bt(470, 100, '#c9a227', 'Y')}${bt(445, 125, '#3a6ad8', 'X')}${bt(495, 125, '#c23a2e', 'B')}${bt(470, 150, '#3B8D11', 'A')}
  ${L('M262 59 L190 40') + L('M354 112 L340 80 L190 80') + L('M275 125 L190 125') + L('M432 125 L380 150 L200 172') + L('M322 190 L200 222') + L('M498 59 L570 40') + L('M483 100 L570 90') + L('M508 125 L570 140') + L('M483 150 L570 190') + L('M458 185 L520 236 L570 236') + L('M406 123 L406 288 L420 288')}
  ${T(182, 44, 'LB · Ultimativ   LT · Rolle', 'end') + T(182, 84, 'Ansicht · Karte', 'end') + T(182, 129, 'Linker Stick · Laufen', 'end') + T(192, 176, 'X · Molotow', 'end') + T(192, 226, 'Steuerkreuz ▲ · Kraft wechseln', 'end')}
  ${T(578, 44, 'RB · Verband   RT · Schlag') + T(578, 94, 'Y · Kraft') + T(578, 144, 'B · Rolle') + T(578, 194, 'A · Schlag') + T(578, 240, 'Rechter Stick · Zielen') + T(428, 292, 'Start · Pause und Menü')}
  ${T(380, 22, 'Menüs: Steuerkreuz wählt, A drückt, B zurück, LB RB Reiter', 'middle')}</svg>`;
}

/** QWERTZ keyboard with the keys the game uses, mouse and a short list (2D keySVG). */
export function keySVG(): string {
  const used: Record<string, string> = { Escape: 'Pause', Tab: 'Inventar', Q: 'Verband', W: '', E: 'Kraft', R: 'Ultimativ', Z: 'Zoom', I: 'Inventar', P: 'Pause', A: '', S: '', D: '', F: 'Schlag', G: 'Molotow', J: 'Schlag', K: 'Rolle', X: 'Kraft wechseln', M: 'Karte', Shift: 'Rolle', Leertaste: 'Rolle' };
  let h = '', y = 40;
  const key = (x: number, ky: number, w: number, l: string): void => { h += `<rect x="${x}" y="${ky}" width="${w}" height="34" rx="4" class="${l in used ? 'k on' : 'k'}"/><text x="${x + w / 2}" y="${ky + 22}" class="kt">${l === 'Escape' ? 'Esc' : l}</text>`; };
  key(20, y, 44, 'Escape'); y += 44;
  for (const [f, fw, r] of [['Tab', 60, 'QWERTZUIOP'], ['', 74, 'ASDFGHJKL'], ['Shift', 90, 'YXCVBNM']] as const) {
    let x = 20;
    if (f) { key(x, y, fw, f); x += fw + 4; } else x += fw + 4;
    for (const c of r) { key(x, y, 34, c); x += 38; }
    y += 40;
  }
  key(130, y, 230, 'Leertaste');
  const list = ['WASD · Laufen', 'Maus links, J · Schlag', 'Leertaste, Shift · Rolle', 'E Kraft · R Ultimativ', 'X · Kraft wechseln', 'Q · Verband', 'G · Molotow', 'Z, Mausrad · Zoom', 'Esc, P · Pause', 'I, Tab · Inventar', 'M · Karte'];
  return `<svg class="cgfx" viewBox="0 0 760 300" role="img" aria-label="Tastatur und Maus">${h}
  <rect x="470" y="40" width="80" height="120" rx="38" class="body"/><path d="M470 85 L550 85 M510 40 L510 85" class="ln2"/><path d="M470 85 L470 78 Q470 40 510 40 L510 85Z" class="k on"/><path d="M510 40 Q550 40 550 78 L550 85 L510 85Z" class="k on"/><rect x="505" y="52" width="10" height="20" rx="4" class="sm"/>
  ${L('M490 60 L460 20 L440 20') + L('M530 60 L580 20')}${T(436, 24, 'Links · Schlag', 'end') + T(584, 24, 'Rechts · Rolle') + T(510, 182, 'Zeiger zielt', 'middle') + T(510, 204, 'Rad · Zoom', 'middle')}
  ${list.map((s, i) => T(600, 52 + i * 22, s)).join('')}</svg>`;
}

/**
 * Phone in landscape with the 3D touch layout (style.css: #btn-attack, #btn-dodge, body.touch-on
 * #actions): the device frame stands for 844 × 390, buttons sit where they are on screen.
 */
export function touchSVG(): string {
  const c = (x: number, y: number, r: number, cls = 'k'): string => `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>`;
  return `<svg class="cgfx" viewBox="-44 0 848 320" role="img" aria-label="Touch-Steuerung"><rect x="150" y="30" width="460" height="230" rx="22" class="body"/>
  <circle cx="250" cy="180" r="44" class="stk"/>${c(262, 170, 16, 'k on')}
  ${c(567, 213, 28, 'k on')}${c(511, 227, 21)}${c(519, 181, 19)}${c(567, 158, 20, 'k ult')}${c(532, 146, 10)}${c(469, 199, 15)}${c(467, 233, 15)}${c(589, 50, 12)}<rect x="556" y="66" width="44" height="44" rx="4" class="map"/><rect x="551" y="38" width="24" height="24" rx="4" class="k"/>
  ${L('M206 180 L120 180') + L('M595 213 L650 236') + L('M601 50 L650 50') + L('M600 88 L650 92') + L('M542 146 L650 134') + L('M587 158 L650 172') + L('M538 184 L650 206') + L('M511 248 L511 290 L530 290') + L('M454 199 L430 199 L430 280 L420 280') + L('M467 248 L467 304 L420 304') + L('M563 38 L563 14 L650 14')}
  ${T(116, 176, 'Links ziehen · Laufen', 'end') + T(116, 196, 'Zielen geht automatisch', 'end')}
  ${T(656, 18, 'Vollbild') + T(656, 54, 'Pause und Inventar') + T(656, 96, 'Minikarte · Karte') + T(656, 138, 'Kraft wechseln') + T(656, 176, 'Ultimativ') + T(656, 210, 'Kraft') + T(656, 240, 'Schlag') + T(536, 294, 'Rolle') + T(414, 284, 'Verband', 'end') + T(414, 308, 'Molotow', 'end')}</svg>`;
}

export const DEVICE_SVG: Record<ControlDevice, () => string> = { touch: touchSVG, key: keySVG, pad: padSVG };
