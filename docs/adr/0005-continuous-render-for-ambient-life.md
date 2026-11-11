# The World renders continuously while visible, for Ambient Life

The base feature renders on demand: no frames are drawn while nothing moves, and an idle page schedules no `requestAnimationFrame` at all. Ambient Life (animals, fish, butterflies, fireflies, clouds, wind and shore waves) moves all the time, so the World now renders continuously while it is visible. Visible means the tab is shown and the canvas is on screen.

Render on demand stays as the fallback. The World goes back to it when the visitor prefers reduced motion, when the page is hidden or off screen, and when the Ambient Life tier drops to still.

We chose this because a World that only moves when touched does not feel alive, and the user wants it to feel alive. The cost is power and GPU time, so it comes with limits:
- Phones cap at 30 fps and start at the reduced tier.
- Ambient Life has three tiers: full, reduced and still. If frames run slower than the target for several seconds, the tier drops one step and does not climb back during that visit.
- Camera flights and drags must never stutter because of Ambient Life.

## Amendment to ADR 0004

Shaped creatures (deer, squirrels, birds, fish) stay ¼-unit ASCII structures. Particles (butterflies, fireflies, leaves, snow, ash, foam) are single-colour ⅛-unit cubes moved in the shader, with no structure file. ⅛ unit is allowed for particles only. Structures stay at ¼ unit.

## Consequences

- `mountWorld`'s render-on-demand loop becomes a loop with two modes, continuous and on demand, plus a tier controller.
- The Model Gallery and screenshot tooling must be able to freeze time, so that stills are repeatable.
- Every Ambient Life motion reads one shared clock and one wind uniform, so tiers and reduced motion can stop it all in one place.

## Considered Options

- **Bursts of motion after interaction** (for example 10 seconds after a pan, then settle). Cheaper, but the World looks dead while no one touches it.
- **Continuous on desktop only**, still on phones. Rejected: phones are a large share of visitors and would lose the whole feature.
- **Sprite or point particles** instead of ⅛-unit cubes. Lightest, but they break the voxel look.
