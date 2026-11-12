# Corporate Landing Site

A storytelling landing page for a data/AI software company, told as a walk across a small generated isometric world.

## Language

**World**:
Everything one Seed generates: every Isle, the sea around them, the bridges between them, and all the Landmarks.
_Avoid_: map, scene, archipelago

**Isle**:
One landmass in the World. A World has one to four Isles linked by bridges.
_Avoid_: island (clashes with Astro Islands), islet

**Seed**:
The number that deterministically decides how the world is generated; the same Seed always produces the same world. The site ships with one default Seed, and visitors may roll and share others.
_Avoid_: random key, map id

**Biome**:
One of a few hand-tuned, muted colour and vegetation sets (e.g. tropical, northern, autumn, volcanic) that a Seed picks for the whole World. The Biome also sets the building style of every Landmark. Brand and UI colours never change with the Biome.
_Avoid_: palette, theme (Theme means Day/Night)

**Landmark**:
A place in the world that stands for one section of the site. Every Seed contains every Landmark. Five are places in the World; Overview and House Interior are views, of the whole World and of the inside of the House; the House Interior is one furnished room per Biome, drawn in the World at 1/16 unit while the House's lid is lifted. The seven are, in story order: Overview (Hero), Station (Services), House (About), House Interior (Team), Garden (Portfolio), Dock (Clients), Mailbox (Contact). The Mailbox stands in the House's front yard; the Station is a group: a lighthouse at its centre, the company's own building, with a structure for each Service round it.
_Avoid_: hotspot, POI, node

**Landmark Variant**:
One of the designs a Landmark can take. Each Biome has its own style for every Landmark (a stilt house in the tropics, a timber cabin in the north), and within that style a few Variants differ in shape, such as the roof or an extra wing. The Seed picks the Variant.
_Avoid_: skin, model type

**Decoration**:
Scenery that stands for nothing and cannot be clicked: small trees, grass, flower clumps, and minor buildings such as sheds, fences, lamps or windmills. Each Biome has its own set, and the Seed decides where it goes. Decoration never stands in a Landmark's place, inside the Garden, or in front of a Landmark, and is never taller than the Landmarks near it.
_Avoid_: props, scatter, filler

**Ambient Life**:
Everything in the World that moves without standing for anything: animals, birds, fish, butterflies, fireflies, falling leaves, clouds, wind in the plants and waves on the shore. Each Biome has its own creatures, and Day or Night decides which are out. Like Decoration it cannot be clicked, and it never hides a Landmark for long. It all runs on one shared clock and one wind, and scales down through three tiers (full, reduced, still) on slow devices. It stands still under reduced motion.
_Avoid_: critters, wildlife, effects

**Story Order**:
The fixed sequence in which the visitor is guided through the Landmarks; it never depends on the Seed.

**Project**:
A piece of past work shown in the portfolio. Each Project grows in the Garden: a Pinned Project as a flower, every other Project as a tree. The Garden has room for nine; the rest are listed only in the portfolio.
_Avoid_: case, work item

**Pinned Project**:
A Project the company chooses to highlight. It grows as a large flower at the front of the Garden, ahead of the trees, and is listed first in the portfolio. Only the first few Pinned Projects bloom as flowers; any beyond them grow as trees like other Projects.
_Avoid_: featured project, starred project

**Client**:
An organisation that has hired the company. Each Client appears as one boat moored at the Dock, and keeps the same kind of boat in every World; only its style follows the Biome.
_Avoid_: customer

**Partner**:
A technology vendor the company is allied with, such as a cloud or data platform. Partners appear as larger ships sailing between the islands, each keeping the same kind of ship in every World. A Partner is never a Client.
_Avoid_: vendor, alliance

**Service**:
A capability the company sells, such as data engineering or ML. Each Service has a structure of its own in the Station's group.
_Avoid_: product, offering

**Team Member**:
A person at the company, shown inside the House.
_Avoid_: staff, employee, developer

**Data Card**:
A floating card, tilted to the world's isometric plane, that shows one company metric beside the Landmark it belongs to.
_Avoid_: tooltip, label, popup

**Model Gallery**:
The developers' page (`/dev/models`, never published) that shows every predefined voxel model, Biome by Biome and Variant by Variant, so the site owner can review the look before it ships.
_Avoid_: model viewer, showcase

**Guide**:
The floating voxel cube with a screen face that leads the Tour and talks in speech bubbles. It assembles itself from voxels and re-forms whenever a new Seed is rolled.
_Avoid_: mascot, bot, assistant

**Tour**:
An optional guided walk that moves the view through every Landmark in Story Order. Without it, the visitor explores freely.
_Avoid_: walkthrough, autoplay
