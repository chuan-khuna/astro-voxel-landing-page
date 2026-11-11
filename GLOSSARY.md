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
One of a few hand-tuned, muted colour and vegetation sets (e.g. tropical, northern, autumn, volcanic) that a Seed picks for the whole World. Brand and UI colours never change with the Biome.
_Avoid_: palette, theme (Theme means Day/Night)

**Landmark**:
A place in the world that stands for one section of the site. Every Seed contains every Landmark. Five are places in the World; Overview and House Interior are views, of the whole World and of the inside of the House. The seven are, in story order: Overview (Hero), Station (Services), House (About), House Interior (Team), Garden (Portfolio), Dock (Clients), Mailbox (Contact).
_Avoid_: hotspot, POI, node

**Story Order**:
The fixed sequence in which the visitor is guided through the Landmarks; it never depends on the Seed.

**Project**:
A piece of past work shown in the portfolio. Each Project appears as one tree in the Garden.
_Avoid_: case, work item

**Client**:
An organisation that has hired the company. Each Client appears as one boat moored at the Dock.
_Avoid_: customer

**Partner**:
A technology vendor the company is allied with, such as a cloud or data platform. Partners appear as larger ships sailing between the islands. A Partner is never a Client.
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
