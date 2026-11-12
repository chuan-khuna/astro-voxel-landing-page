/**
 * The Services' content order: by `order`, then by id. The Station's list
 * (`ServiceList.astro`) follows it, and so does the World: the first
 * Services take the places round the lighthouse (`world/station.ts`).
 */
export function serviceOrder<T extends { id: string; data: { order: number } }>(services: readonly T[]): T[] {
  return services.toSorted((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id));
}
