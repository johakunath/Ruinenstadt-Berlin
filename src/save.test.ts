import { describe, expect, it } from 'vitest';
import { createSim } from './sim/sim';
import { snapshot } from './sim/save';
import { parseSaveCode, saveCode } from './save';

describe('Spielstand kopieren und laden (2D exportSave/importSave)', () => {
  const save = snapshot(createSim({ empty: true }), 'koepenick', false, 123);
  save.profile.inventory.scrap = 77;

  it('a copied code loads back to the same save, also with spaces and line breaks around it', () => {
    const code = saveCode(save);
    expect(parseSaveCode(code)).toEqual(save);
    expect(parseSaveCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `)).toEqual(save);
  });

  it('a cut-off, foreign or damaged code is refused', () => {
    const code = saveCode(save);
    expect(parseSaveCode(code.slice(0, code.length - 10))).toBeNull();
    expect(parseSaveCode('RS1:abc\nEND')).toBeNull();
    expect(parseSaveCode('RB1:!!!!\nEND')).toBeNull();
    expect(parseSaveCode('')).toBeNull();
  });
});
