# Predefined voxel structures are ASCII layer files drawn by agents

Every Landmark, Garden plant, boat, ship and piece of Decoration is a predefined voxel structure. Each one is stored in the repo as an ASCII file: one block of characters per ¼-unit layer, from bottom to top, plus a key that maps each character to a colour role (wall, roof, window, foliage and so on). The files are parsed at build time into typed voxel arrays and go through the same mesher and soft-voxel material as the terrain. The browser never parses ASCII.

We chose this because agents draw the models. An agent can write, read, test and review a text grid, and a diff of one shows exactly what changed. Colour roles instead of raw colours keep every structure on the Biome palette, OKLCH and per-voxel jitter.

## Consequences

- Around 40+ structures (Landmark styles × Biomes × Variants, plants, boats, ships, Decoration) are text files the user reviews through a dev-only Model Gallery (`/dev/models`), not by opening the files.
- Structure files can be tested as data: they parse, use known roles, fill their footprint, and have the doors and interior space their Landmark needs.
- Detail stays at ¼ unit. A House is 12×12 voxels. ADR 0005 allows ⅛-unit cubes for Ambient Life particles only. They have no structure file.
- For three.js the source format makes no difference. Repeated structures are drawn with one `InstancedMesh` each, and placed Landmarks are greedy-meshed once.

## Considered Options

- **MagicaVoxel `.vox` files.** The nicest for drawing by hand, and three.js ships a `VOXLoader`. But they are binary, so diffs are unreadable. An agent cannot see what it draws. Raw palette colours would also need a slot-to-role convention. Rejected, because the user does not plan to draw models by hand.
- **Parameterised code builders** (the first placeholders). These are flexible but hard to art-direct detail with, and hard to review shape by shape.
- **⅛-unit detail.** Rejected: about 8× the voxels and file size, heavier on phones, and out of scale with 1-unit terrain.
