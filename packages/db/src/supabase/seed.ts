// Catalog load and database reset for the Supabase store. Used by the conformance test and by
// scripts/supabase-seed.ts. Service-role only.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeedData } from '@homed/data';
import { chunks, unwrap, WRITE_CHUNK } from './client';
import {
  accessibilityToRow,
  buildingToRow,
  floorPlanToRow,
  landlordToRow,
  landmarkToRow,
  majorBuildingRows,
  majorToRow,
  photoToRow,
  propertyToRow,
  sectionToRow,
  walkTimeToRow,
} from './mappers';

/** Tables in FK-safe insert order (parents first). */
export const CATALOG_TABLES = [
  'landlords',
  'buildings',
  'landmarks',
  'majors',
  'major_buildings',
  'properties',
  'floor_plans',
  'photos',
  'accessibility',
  'walk_times',
  'sections',
] as const;

/** Every public table, children before parents, so deletes never hit an FK. */
export const RESET_TABLES: { table: string; column: string }[] = [
  { table: 'application_documents', column: 'id' },
  { table: 'application_members', column: 'id' },
  { table: 'applications', column: 'id' },
  { table: 'applicant_profiles', column: 'user_id' },
  { table: 'alert_events', column: 'id' },
  { table: 'alerts', column: 'id' },
  { table: 'reviews', column: 'id' },
  { table: 'votes', column: 'group_id' },
  { table: 'shortlist_items', column: 'group_id' },
  { table: 'group_members', column: 'group_id' },
  { table: 'groups', column: 'id' },
  { table: 'swipes', column: 'user_id' },
  { table: 'saves', column: 'user_id' },
  { table: 'user_schedules', column: 'user_id' },
  { table: 'photo_ratings', column: 'photo_id' },
  { table: 'users', column: 'id' },
  { table: 'photos', column: 'id' },
  { table: 'walk_times', column: 'property_id' },
  { table: 'accessibility', column: 'property_id' },
  { table: 'floor_plans', column: 'id' },
  { table: 'properties', column: 'id' },
  { table: 'landlords', column: 'id' },
  { table: 'major_buildings', column: 'major_id' },
  { table: 'majors', column: 'id' },
  { table: 'buildings', column: 'id' },
  { table: 'landmarks', column: 'id' },
  { table: 'sections', column: 'id' },
];

/** Upserts the whole catalog (no user data) in FK-safe order, <= 500 rows per request. Returns row counts. */
export async function loadCatalog(sb: SupabaseClient, seed: SeedData): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const put = async (table: string, rows: object[], onConflict?: string): Promise<void> => {
    for (const batch of chunks(rows, WRITE_CHUNK)) {
      unwrap(await sb.from(table).upsert(batch, onConflict ? { onConflict } : undefined));
    }
    counts[table] = rows.length;
  };

  await put('landlords', seed.landlords.map(landlordToRow));
  await put('buildings', seed.buildings.map(buildingToRow));
  await put('landmarks', seed.landmarks.map(landmarkToRow));
  await put('majors', seed.majors.map(majorToRow));
  await put('major_buildings', seed.majors.flatMap(majorBuildingRows), 'major_id,building_id');
  await put('properties', seed.properties.map(propertyToRow));
  await put('floor_plans', seed.floorPlans.map(floorPlanToRow));
  await put('photos', seed.photos.map(photoToRow));
  await put('accessibility', seed.accessibility.map(accessibilityToRow));
  await put('walk_times', seed.walkTimes.map(walkTimeToRow), 'property_id,target_id');
  await put('sections', seed.sections.map(sectionToRow));

  return counts;
}

/** Deletes every row of every public table (catalog included). The caller reseeds. */
export async function resetDatabase(sb: SupabaseClient): Promise<void> {
  for (const { table, column } of RESET_TABLES) {
    // The filter is always true (ids are never null); PostgREST refuses an unfiltered delete.
    unwrap(await sb.from(table).delete().not(column, 'is', null));
  }
}
