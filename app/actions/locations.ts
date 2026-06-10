'use server';

import {
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '@/lib/api/locations';
import type { Location } from '@/types';

export { getAllLocations };

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function actionCreateLocation(
  data: Omit<Location, 'id' | 'createdAt'>
): Promise<ActionResult<Location>> {
  try {
    return { ok: true, data: await createLocation(data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateLocation(
  id: string,
  data: Omit<Location, 'id' | 'createdAt'>
): Promise<ActionResult<Location>> {
  try {
    return { ok: true, data: await updateLocation(id, data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteLocation(id: string): Promise<ActionResult> {
  try {
    await deleteLocation(id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
