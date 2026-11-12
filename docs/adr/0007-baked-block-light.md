# Night light is baked block light, not real-time lights

At Night the World's Light Sources (torches, lamps, the lighthouse, the House's windows and room, the buoys) light the voxels round them. They do it the way a torch lights the blocks near it in a block-building game: a flood fill over the World's 1-unit cells, one level less per cell, stopped by the terrain, worked out once per World in the World Web Worker beside the mesher. The result is a small 3D texture (RGBA bytes a cell: the light's colour times its brightness, and the flicker phase of the source that lights the cell). Every voxel material samples it at Night, half a cell out from the surface, and adds `albedo × light × night` after its lighting. `night` is a uniform: 0 by Day, 1 at Night. Switching the theme sets it; nothing is remeshed or recompiled.

We chose this because a World has 10 to 30 Light Sources and three.js evaluates every real-time light in every lit material's fragment shader: 20 point lights would multiply the shading cost of the whole World, on phones too, and change the shaders each time a light is added. A bake costs one texture fetch a fragment and no extra draw call, whatever the number of sources, and it reads like the block light the World's look is borrowed from.

## Consequences

- The light is as coarse as a cell (smoothed by linear filtering) and only the terrain blocks it: structures are smaller than a cell and let it through, so a lamp in the House's room also lights the House's walls a little. Nothing moving throws block light (a ship's lamp, a firefly): they only glow.
- The light reaches the materials as a texture rather than a per-vertex attribute, as the ticket first asked: a per-vertex light would have split the greedy mesher's merged quads wherever the light changes (thousands more triangles round every torch), and could not reach the instanced structures, which the texture lights at their own world position.
- Flames flicker from the shared Ambient Life clock (ADR 0005), each cell with the phase of the source that lights it, so nothing flickers when the clock is frozen.
- The glow of the Light Sources' own flames and glass is their material's emissive, which a bloom pass picks out at the full life tier (a `RenderPipeline` with the scene's emissive in a second target, shared with the outline); the reduced tier draws a camera-facing halo per source instead; the still tier keeps only the block light.
- The texture is baked from the Night theme tokens (`torchLight`, `windowLight`, `buoyLight`): changing a light's colour re-bakes the World, not a uniform.

## Considered Options

- **three.js point lights**, one per source. Real falloff and shadows, but the cost grows with every light in every lit material, and phones could not afford a World's worth.
- **A few point lights for the nearest sources**, moved with the camera. Lights would pop on and off as the camera pans.
- **Light per vertex from the mesher**, smoothed like the baked AO. The original ticket's plan; set aside for the reasons above.
- **The light worked out in each material from a uniform list of sources** (as the House room's lamp was before). As costly as point lights once there are more than a few.
