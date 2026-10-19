// LandlordRepo on Supabase. Mirrors packages/db/src/json/landlords.ts.
// deleteFloorPlan relies on ON DELETE CASCADE for saves, shortlist items, votes, photos (and their
// ratings); swipes have no FK and are left alone, like the JSON store.
import { RepoError, type LandlordRepo } from '../repository';
import { unwrap, unwrapOne, type SupabaseCtx } from './client';
import {
  accessibilityFromRow,
  accessibilityToRow,
  floorPlanFromRow,
  floorPlanToRow,
  landlordFromRow,
  photoFromRow,
  propertyFromRow,
  propertyToRow,
  type AccessibilityRow,
  type FloorPlanRow,
  type LandlordRow,
  type PhotoRow,
  type PropertyRow,
} from './mappers';

const PROPERTY_FK = { code: 'not_found' as const, message: 'property not found' };

export function landlordRepo(ctx: SupabaseCtx): LandlordRepo {
  const { sb } = ctx;
  const exists = async (table: string, col: string, id: string): Promise<boolean> =>
    unwrap(await sb.from(table).select(col).eq(col, id).limit(1)) ?.length === 1;
  const requireProperty = async (id: string): Promise<void> => {
    if (!(await exists('properties', 'id', id))) throw new RepoError('not_found', 'property not found');
  };

  return {
    getLandlord: async (id) => {
      const row = unwrap(await sb.from('landlords').select('*').eq('id', id).maybeSingle()) as LandlordRow | null;
      return row ? landlordFromRow(row) : null;
    },

    getLandlordByUser: async (userId) => {
      const row = unwrap(
        await sb.from('landlords').select('*').eq('user_id', userId).maybeSingle(),
      ) as LandlordRow | null;
      return row ? landlordFromRow(row) : null;
    },

    listLandlords: async () => {
      const rows = unwrap(await sb.from('landlords').select('*').order('id')) as LandlordRow[] | null;
      return (rows ?? []).map(landlordFromRow);
    },

    createLandlord: async (input) => {
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (!name) throw new RepoError('invalid', 'landlord name required');
      if (input.userId !== undefined) {
        if (!(await exists('users', 'id', input.userId))) throw new RepoError('not_found', 'user not found');
        if (await exists('landlords', 'user_id', input.userId)) {
          throw new RepoError('conflict', 'user already has a landlord record');
        }
      }
      const row = {
        id: crypto.randomUUID(),
        user_id: input.userId ?? null,
        name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        verified: false,
        created_at: ctx.now(),
      };
      const saved = unwrapOne(await sb.from('landlords').insert(row).select('*').single(), {
        conflict: 'user already has a landlord record',
      }) as LandlordRow;
      return landlordFromRow(saved);
    },

    upsertProperty: async (input) => {
      if (input.landlordId !== undefined && !(await exists('landlords', 'id', input.landlordId))) {
        throw new RepoError('not_found', 'landlord not found');
      }
      const clash = unwrap(await sb.from('properties').select('id').eq('slug', input.slug).limit(2)) as
        | { id: string }[]
        | null;
      if ((clash ?? []).some((p) => p.id !== input.id)) throw new RepoError('conflict', 'slug already in use');
      const id = input.id ?? crypto.randomUUID();
      const isUpdate = input.id !== undefined && (await exists('properties', 'id', input.id));
      const row = propertyToRow({ ...input, id, ...(isUpdate ? {} : { dataStatus: 'unverified_seed' as const }) });
      const res = await sb.from('properties').upsert(row, { onConflict: 'id' }).select('*').single();
      const saved = unwrapOne(res, {
        conflict: 'slug already in use',
        fk: { code: 'not_found', message: 'landlord not found' },
      }) as PropertyRow;
      return propertyFromRow(saved);
    },

    upsertFloorPlan: async (input) => {
      await requireProperty(input.propertyId);
      const row = floorPlanToRow({ ...input, id: input.id ?? crypto.randomUUID() });
      const saved = unwrapOne(await sb.from('floor_plans').upsert(row, { onConflict: 'id' }).select('*').single(), {
        fk: PROPERTY_FK,
      }) as FloorPlanRow;
      return floorPlanFromRow(saved);
    },

    deleteFloorPlan: async (id) => {
      const open = unwrap(
        await sb.from('applications').select('id').eq('floor_plan_id', id).not('status', 'in', '(denied,withdrawn,signed)').limit(1),
      ) as { id: string }[] | null;
      if ((open ?? []).length > 0) {
        throw new RepoError('conflict', 'this floor plan has open applications; decide or wait for them to be withdrawn first');
      }
      unwrap(await sb.from('floor_plans').delete().eq('id', id));
    },

    upsertPhoto: async (input) => {
      await requireProperty(input.propertyId);
      const fields = {
        property_id: input.propertyId,
        floor_plan_id: input.floorPlanId ?? null,
        url: input.url,
        alt: input.alt,
        is_rendering: input.isRendering,
        credit: input.credit ?? null,
      };
      const fk = { code: 'not_found' as const, message: 'floor plan not found' };
      const existing = input.id !== undefined && (await exists('photos', 'id', input.id));
      // Update keeps looks_rating and rating_count (not in `fields`).
      const res = existing
        ? await sb.from('photos').update(fields).eq('id', input.id as string).select('*').single()
        : await sb
            .from('photos')
            .insert({ id: input.id ?? crypto.randomUUID(), ...fields, looks_rating: null, rating_count: 0 })
            .select('*')
            .single();
      return photoFromRow(unwrapOne(res, { fk }) as PhotoRow);
    },

    deletePhoto: async (id) => {
      // photo_ratings cascade.
      unwrap(await sb.from('photos').delete().eq('id', id));
    },

    upsertAccessibility: async (info) => {
      await requireProperty(info.propertyId);
      const saved = unwrapOne(
        await sb.from('accessibility').upsert(accessibilityToRow(info), { onConflict: 'property_id' }).select('*').single(),
        { fk: PROPERTY_FK },
      ) as AccessibilityRow;
      return accessibilityFromRow(saved);
    },

    confirmAvailability: async (floorPlanId, unitsAvailable, on) => {
      if (unitsAvailable !== null && (!Number.isFinite(unitsAvailable) || unitsAvailable < 0)) {
        throw new RepoError('invalid', 'unitsAvailable must be >= 0');
      }
      const fp = unwrap(
        await sb
          .from('floor_plans')
          .update({ units_available: unitsAvailable, last_verified: on })
          .eq('id', floorPlanId)
          .select('*')
          .maybeSingle(),
        { invalid: 'unitsAvailable must be >= 0' },
      ) as FloorPlanRow | null;
      if (!fp) throw new RepoError('not_found', 'floor plan not found');
      unwrap(await sb.from('properties').update({ last_verified: on }).eq('id', fp.property_id));
      return floorPlanFromRow(fp);
    },
  };
}
