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
A place in the world that stands for one section of the site. Every Seed contains every Landmark. Five are places in the World; Overview and House Interior are views, of the whole World and of the inside of the House. The seven are, in story order: Overview (Hero), Station (Services), House (About), House Interior (Team), Garden (Portfolio), Dock (Clients), Mailbox (Contact).
_Avoid_: hotspot, POI, node

**Landmark Variant**:
One of the designs a Landmark can take. Each Biome has its own style for every Landmark (a stilt house in the tropics, a timber cabin in the north), and within that style a few Variants differ in shape, such as the roof or an extra wing. The Seed picks the Variant.
_Avoid_: skin, model type

**Decoration**:
Scenery that stands for nothing and cannot be clicked: small trees, grass, flower clumps, and minor buildings such as sheds, fences, lamps or windmills. Each Biome has its own set, and the Seed decides where it goes. Decoration never stands in a Landmark's place, inside the Garden, or in front of a Landmark, and is never taller than the Landmarks near it.
_Avoid_: props, scatter, filler

**Story Order**:
The fixed sequence in which the visitor is guided through the Landmarks; it never depends on the Seed.

**Project**:
A piece of past work shown in the portfolio. Each Project grows in the Garden: a Pinned Project as a flower, every other Project as a tree.
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
A capability the company sells, such as data engineering or ML. Services are shown at the Station.
_Avoid_: product, offering

**Team Member**:
A person at the company, shown inside the House.
_Avoid_: staff, employee, developer

**Data Card**:
A floating card, tilted to the world's isometric plane, that shows one company metric beside the Landmark it belongs to.
_Avoid_: tooltip, label, popup

**Guide**:
The floating voxel cube with a screen face that leads the Tour and talks in speech bubbles. It assembles itself from voxels and re-forms whenever a new Seed is rolled.
_Avoid_: mascot, bot, assistant

**Tour**:
An optional guided walk that moves the view through every Landmark in Story Order. Without it, the visitor explores freely.
_Avoid_: walkthrough, autoplay
