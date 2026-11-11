# The World is generated from a Seed, not hand-built

The landing page's World (Isles, terrain, decoration, Landmark placement and variants) is generated deterministically from a Seed instead of being modelled by hand. The same Seed always yields the same World. A visitor can roll a new Seed and share it with `?seed=`.

We chose this because a generated, reproducible World tells the company's data/AI story better than a static diorama ("generated, deterministic, reproducible").

## Consequences

- Landmarks cannot have fixed coordinates. They are placed by rules: House and Garden share an Isle, the Dock sits at the water's edge, and every Isle is reachable by bridge.
- A Seed whose layout breaks the rules is retried deterministically.
- Camera paths, the Tour, Data Card anchors and the House Interior are all computed from the generated layout.
- The generator must be covered by tests: determinism, and every Landmark present for any Seed.
- Content counts feed the generator, so N Projects become N trees and M Clients become M boats.

## Considered Options

- **Hand-modelled scene.** Simpler and fully art-directed, but it loses the generative story and the "roll a new World" interaction.
- **Generated decoration only, fixed layout.** This was rejected in favour of full generation.
