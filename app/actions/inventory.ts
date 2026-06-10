'use server';

import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { fromPrisma, getAllInventoryItems } from '@/lib/api/inventory';
import { guard } from '@/lib/auth-server';
import type { InventoryItem } from '@/types';
import type { InventoryCategory } from '@/lib/generated/prisma/client';

export { getAllInventoryItems };

type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const InventorySchema = z.object({
  sku:          z.string().min(1, 'SKU is required'),
  name:         z.string().min(1, 'Name is required'),
  category:     z.enum(['IOL', 'Medication', 'Equipment', 'Consumable', 'PPE']),
  quantity:     z.number().int().min(0),
  reorderLevel: z.number().int().min(0),
  unit:         z.string().min(1, 'Unit is required'),
  expiryDate:   z.string().optional(),
  supplier:     z.string(),
  locationId:   z.string().uuid('Valid location required'),
  notes:        z.string(),
});

export async function actionCreateInventoryItem(
  input: unknown
): Promise<ActionResult<InventoryItem>> {
  const denied = await guard('inventory', 'create');
  if (denied) return denied;

  const parsed = InventorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const row = await prisma.inventoryItem.create({
      data: {
        sku:          d.sku,
        name:         d.name,
        category:     d.category as InventoryCategory,
        quantity:     d.quantity,
        reorderLevel: d.reorderLevel,
        unit:         d.unit,
        expiryDate:   d.expiryDate ? new Date(d.expiryDate) : null,
        supplier:     d.supplier,
        locationId:   d.locationId,
        notes:        d.notes,
      },
    });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionUpdateInventoryItem(
  id: string,
  input: unknown
): Promise<ActionResult<InventoryItem>> {
  const denied = await guard('inventory', 'edit');
  if (denied) return denied;

  const parsed = InventorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const row = await prisma.inventoryItem.update({
      where: { id },
      data: {
        sku:          d.sku,
        name:         d.name,
        category:     d.category as InventoryCategory,
        quantity:     d.quantity,
        reorderLevel: d.reorderLevel,
        unit:         d.unit,
        expiryDate:   d.expiryDate ? new Date(d.expiryDate) : null,
        supplier:     d.supplier,
        locationId:   d.locationId,
        notes:        d.notes,
      },
    });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionAdjustInventoryQuantity(
  id: string,
  delta: number
): Promise<ActionResult<InventoryItem>> {
  const denied = await guard('inventory', 'edit');
  if (denied) return denied;

  try {
    const current = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!current) return { ok: false, error: 'Item not found' };
    const newQty = Math.max(0, current.quantity + delta);
    const row = await prisma.inventoryItem.update({ where: { id }, data: { quantity: newQty } });
    return { ok: true, data: fromPrisma(row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function actionDeleteInventoryItem(id: string): Promise<ActionResult> {
  const denied = await guard('inventory', 'delete');
  if (denied) return denied;

  try {
    await prisma.inventoryItem.delete({ where: { id } });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
