# Voxel World Ambient Life: design grilling

Date: 2026-11-11

## Discussed

The user asked to make the World feel alive, added to the polish feature `.scratch/voxel-world-polish/`:
- animals, butterflies, fireflies and so on
- wind, falling leaves, flowers
- clouds
- fish
- waves breaking on the shore

Flower clumps were already planned as Decoration (ticket 08), and a gentle water bob was already planned (ticket 07). Everything else is new motion. That clashes with the base rule that no frames render while nothing moves.

## Decided

1. **The render loop.**
   - While the World is visible (the tab is shown and the canvas is on screen), it renders continuously so Ambient Life can move.
   - Phones cap at 30 fps and get fewer living things.
   - Under reduced motion everything stands still, and the World goes back to rendering on demand.
   - This is recorded in ADR 0005.
2. **Ambient Life is a new glossary term.**
   - It covers everything that moves without standing for anything.
   - It cannot be clicked. Pointers pass through it to Landmarks and hotspots.
   - It never hides a Landmark for long.
3. **Sets per Biome and per Day/Night.**
   - The Biome decides which creatures there are, for example:
     - tropical: bright butterflies, seabirds, tropical fish
     - northern: deer, drifting snow, salmon
     - autumn: red falling leaves, squirrels
     - volcanic: drifting ash, bats
   - Day/Night decides which of them are out. Butterflies and birds are out by Day. Fireflies (emissive) and bats are out at Night.
   - Wind, shore waves, clouds and fish appear in every Biome.
   - The Seed decides spawn points and routes, so a World always looks the same.
4. **Scale.**
   - Shaped creatures (deer, squirrels, birds, fish) are ¼-unit ASCII structures drawn with `InstancedMesh`.
   - Particles (butterflies, fireflies, leaves, snow, ash, foam) are single-colour ⅛-unit cubes, not structure files. They are moved in the shader.
   - ⅛ unit is allowed for particles only. This amends ADR 0004 through ADR 0005.
5. **Wind.**
   - Only instanced plants sway: Garden trees and flowers, and Decoration's small trees, grass and flower clumps.
   - The wind blows in one direction across the whole World, in gusts that roll across the Isles.
   - Only the canopy moves. The base stays still, and the sway is at most ½ voxel, so tree hotspots still line up.
   - Boats and ships rock on the swell. Falling leaves drift with the wind.
   - Landmarks stay still.
6. **Clouds.**
   - Clouds are slightly translucent 1-unit voxel masses, drifting high with the wind.
   - Cloud bodies drift only over the sea round the Isles, never over an Isle.
   - Soft cloud shadows drift across the whole World, Isles included.
   - Clouds fade out as the camera zooms in on a Landmark.
   - At Night clouds darken and cast no shadow.
7. **The sea.**
   - Shore waves are white ⅛-unit foam that runs in towards the coast, breaks along the Isle's edge and draws back. They are computed in the shader from the same distance-from-coast data that shades the water from shallow to deep.
   - Small schools of 3–5 fish swim in the shallows, seen through the translucent water. Now and then one leaps and splashes. The species follows the Biome.
   - At Night the foam dims, and a faint bioluminescent glow shows where waves break.
8. **Land animals.**
   - `generateWorld` gives each land animal a rest point and a short route, decided by the Seed.
   - Routes are tested never to cross a footprint, never to enter the Garden and never to cross a bridge. They also never stand between the camera and a Landmark, using the same occlusion check as Decoration.
   - At runtime an animal walks its route, then stops to rest, graze or turn its head.
   - Birds circle above the Isles, higher than the Landmarks, and never fly through the camera's view of a Landmark.
   - Each Isle has at most 2–3 animals.
9. **Slow devices.**
   - Ambient Life has three tiers: full, reduced and still.
   - Desktop starts at full and phones at reduced.
   - If frames run slower than the target for several seconds in a row, the tier drops one step. It does not climb back during that page visit.
   - Still means everything stops and rendering goes back to on demand.
   - Ambient Life keeps moving during camera flights and drags, but must never make a flight stutter.

## Open questions

- The Day/Night theme belongs to the base feature. If it is not built when these tickets start, the Night sets (fireflies, bats, glowing foam) wait for it.
- The exact frame target and the "several seconds" window for dropping a tier are set when ticket 09 measures real devices.

## Follow-up

The spec `.scratch/voxel-world-polish/spec.md` gained an Ambient Life section, and tickets 09–14 were added: render loop and tiers, wind, Biome particles, clouds, shore waves and fish, land animals and birds.
