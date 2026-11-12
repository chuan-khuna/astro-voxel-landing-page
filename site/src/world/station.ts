/**
 * The Station's group (polish 15): a lighthouse at the centre of a 6×6
 * footprint and a 2×2 structure for each Service round it. The first four
 * Services (in content order) take the four sides, the next four the
 * corners; at most `MAX_SERVICES` show in the World, the rest only on
 * `/services`. An empty place stays open ground.
 *
 * Which structure a Service gets (`SERVICE_KINDS`) comes from its id alone,
 * never the Seed, so each Service looks the same in every World; only its
 * style follows the Biome (`structures/service/<biome>-<kind>`).
 */
import { hashSeed } from './prng';
import type { Cell } from './types';

/** The Station's footprint, in cells a side. */
export const STATION_SIZE = 6;
/** The lighthouse's 2×2, local to the group's origin: the middle of the group. */
export const LIGHTHOUSE_CELL: Cell = { x: 2, z: 2 };
/** Cells a side of the lighthouse and of each Service's structure. */
export const STATION_PLACE = 2;
/**
 * The Services' places, local to the group's origin (each a 2×2's min
 * corner), in the order Services take them. The camera looks from the
 * south-east, so the places in front of the lighthouse come first: the
 * sides south, east, north, west, then the corners south-east, north-east,
 * south-west and north-west (the last stands right behind the lighthouse).
 */
export const SERVICE_PLACES: readonly Cell[] = [
  { x: 2, z: 4 },
  { x: 4, z: 2 },
  { x: 2, z: 0 },
  { x: 0, z: 2 },
  { x: 4, z: 4 },
  { x: 4, z: 0 },
  { x: 0, z: 4 },
  { x: 0, z: 0 },
];
/** Most Services shown in the World. */
export const MAX_SERVICES = SERVICE_PLACES.length;
/**
 * How tall, in units above the group's ground, a Service's structure may
 * stand. Placement keeps the other Landmarks in view past these columns (and
 * the lighthouse's, `LANDMARK_HEIGHT.station`), so none may be taller (the
 * structure files' tests hold them to it).
 */
export const SERVICE_HEIGHT = 2.5;
/**
 * How tall, in units, a Service's structure stands at least: the lowest
 * kind's top. Decoration by the Station is held to it (`decoration.ts`):
 * its nearest part is a Service's place, never the lighthouse in the middle.
 */
export const SERVICE_MIN_HEIGHT = 1.5;

/**
 * The kinds of Service structure, numbered from 1 in this order: pipes and
 * tanks (data engineering), a warehouse with silos (data platforms), an
 * observatory with a chart board (analytics) and a lab (machine learning).
 */
export const SERVICE_KINDS = ['pipeline', 'warehouse', 'observatory', 'lab'] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

/** Words in a Service's id that name its kind. */
const KIND_WORDS: Record<ServiceKind, readonly string[]> = {
  pipeline: ['engineering', 'pipeline', 'pipelines', 'etl', 'elt', 'ingestion', 'integration', 'streaming'],
  warehouse: ['platform', 'platforms', 'warehouse', 'warehousing', 'lake', 'lakehouse', 'infrastructure', 'cloud'],
  observatory: ['analytics', 'analysis', 'bi', 'dashboard', 'dashboards', 'reporting', 'insight', 'insights', 'visualisation', 'visualization'],
  lab: ['ml', 'ai', 'machine', 'learning', 'model', 'models', 'science', 'research'],
};

/**
 * The kind (1 to `SERVICE_KINDS.length`) of the structure of the Service
 * with this id: the first word of the id (split on `-` and `_`) that names a
 * kind; failing that, a stable hash of the id.
 */
export function serviceKind(id: string): number {
  for (const word of id.toLowerCase().split(/[-_]/)) {
    const k = SERVICE_KINDS.findIndex((kind) => KIND_WORDS[kind].includes(word));
    if (k !== -1) return k + 1;
  }
  return 1 + (hashSeed(`service/${id}`) % SERVICE_KINDS.length);
}
