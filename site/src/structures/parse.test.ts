import { describe, expect, it } from 'vitest';
import { parseStructure, voxelAt } from './parse';

/** A 1×1-cell structure, 8×8 per layer, three layers (the middle one repeated). */
const SMALL = `# A post with a lid on top.
kind: test
biome: tropical
variant: 2
footprint: 1x1
door: +z
anchor: 0 0 0
key:
  P plinth
  W wall
  R roof lid
layer 0
PPPPPPPP
PPPPPPPP
PPPPPPPP
PPPPPPPP
PPPPPPPP
PPPPPPPP
PPPPPPPP
PPPPPPPP
layers 1-2
........
........
........
...WW...
...WW...
........
........
........
layer 3
RRRRRRRR
R......R
R......R
R......R
R......R
R......R
R......R
RRRRRRRR
`;

describe('parseStructure', () => {
  const s = parseStructure(SMALL, 'small.structure');

  it('reads the header: kind, Biome, Variant, footprint, door and anchor', () => {
    expect(s.kind).toBe('test');
    expect(s.biome).toBe('tropical');
    expect(s.variant).toBe(2);
    expect(s.footprint).toEqual({ width: 1, depth: 1 });
    expect(s.door).toBe('+z');
    expect(s.anchor).toEqual({ x: 0, y: 0, z: 0 });
    expect(s.interior).toBeNull();
  });

  it('sizes the voxel grid at 8 voxels a cell, one layer per ⅛ unit of height', () => {
    expect(s.size).toEqual({ x: 8, y: 4, z: 8 });
    expect(s.voxels).toBeInstanceOf(Uint8Array);
    expect(s.voxels.length).toBe(8 * 4 * 8);
  });

  it('lays rows north to south (z) and characters west to east (x), layers bottom to top', () => {
    expect(voxelAt(s, 0, 0, 0)).toEqual({ role: 'plinth', part: 'base' });
    expect(voxelAt(s, 3, 1, 3)).toEqual({ role: 'wall', part: 'base' });
    expect(voxelAt(s, 4, 2, 4)).toEqual({ role: 'wall', part: 'base' });
    expect(voxelAt(s, 2, 1, 3)).toBeNull();
    // A ranged block repeats for every layer it names.
    expect(voxelAt(s, 3, 2, 3)).toEqual({ role: 'wall', part: 'base' });
    expect(voxelAt(s, 0, 3, 7)).toEqual({ role: 'roof', part: 'lid' });
    expect(voxelAt(s, 1, 3, 1)).toBeNull();
  });

  it('reads an interior box', () => {
    const t = parseStructure(SMALL.replace('anchor: 0 0 0', 'anchor: 0 0 0\ninterior: 1 1 1 7 3 7'), 't');
    expect(t.interior).toEqual({ min: { x: 1, y: 1, z: 1 }, max: { x: 7, y: 3, z: 7 } });
  });

  it('is drawn at ⅛ unit unless it says otherwise', () => {
    expect(s.scale).toBe(8);
    expect(s.developer).toBeNull();
  });

  it('reads a 1/16-unit structure (an Interior room): 16 voxels a cell, and where the developer sits', () => {
    const fine = SMALL.replace('anchor: 0 0 0', 'anchor: 0 0 0\nscale: 16\ndeveloper: 3 1 4').replace(/^([.PWR]{8})$/gm, '$1$1');
    const rows = (block: string) => block.split('\n').filter(Boolean);
    // 16 rows a layer: each block's 8 rows twice.
    const text = fine.replace(/((?:^[.PWR]{16}\n){8})/gm, (block) => block + rows(block).join('\n') + '\n');
    const t = parseStructure(text, 'fine');
    expect(t.scale).toBe(16);
    expect(t.size).toEqual({ x: 16, y: 4, z: 16 });
    expect(t.developer).toEqual({ x: 3, y: 1, z: 4 });
  });

  it('rejects a scale other than 8 or 16', () => {
    expect(() => parseStructure(SMALL.replace('anchor: 0 0 0', 'anchor: 0 0 0\nscale: 4'), 'bad')).toThrow(/scale/);
  });

  it('rejects an unknown colour role', () => {
    expect(() => parseStructure(SMALL.replace('W wall', 'W purple'), 'bad')).toThrow(/unknown role "purple"/);
  });

  it('rejects a character missing from the key', () => {
    expect(() => parseStructure(SMALL.replace('...WW...\n...WW...', '...WX...\n...WW...'), 'bad')).toThrow(/"X"/);
  });

  it('rejects a row of the wrong width and a layer with the wrong number of rows', () => {
    expect(() => parseStructure(SMALL.replace('RRRRRRRR\nR......R', 'RRRRRRR\nR......R'), 'bad')).toThrow(/8 wide/);
    expect(() => parseStructure(SMALL.replace('PPPPPPPP\n', ''), 'bad')).toThrow(/8 rows/);
  });

  it('rejects missing or repeated layers', () => {
    expect(() => parseStructure(SMALL.replace('layers 1-2', 'layers 2-2'), 'bad')).toThrow(/layer 1/);
  });
});
