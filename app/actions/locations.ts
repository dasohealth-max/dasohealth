'use server';

import { getAllLocations as fetchAllLocations, createLocation, updateLocation, deleteLocation } from '@/lib/api/locations';
import { guard } from '@/lib/auth-server';
import type { Location } from '@/types';

export async function getAllLocations(): Promise<Location[]> {
  const denied = await guard('locations', 'view');
  if (denied) throw new Error(denied.error);
  return fetchAllLocations();
}

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export async function actionCreateLocation(
  data: Omit<Location, 'id' | 'createdAt'>
): Promise<ActionResult<Location>> {
  const denied = await guard('locations', 'create');
  if (denied) return denied;

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
  const denied = await guard('locations', 'edit');
  if (denied) return denied;

  try {
    return { ok: true, data: await updateLocation(id, data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteLocation(id: string): Promise<ActionResult> {
  const denied = await guard('locations', 'delete');
  if (denied) return denied;

  try {
    await deleteLocation(id);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
