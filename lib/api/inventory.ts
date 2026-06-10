import 'server-only';
import { prisma } from '@/lib/prisma';
import type { InventoryItem as PrismaItem } from '@/lib/generated/prisma/client';
import type { InventoryItem } from '@/types';

export function fromPrisma(row: PrismaItem): InventoryItem {
  return {
    id:           row.id,
    sku:          row.sku,
    name:         row.name,
    category:     row.category as InventoryItem['category'],
    quantity:     row.quantity,
    reorderLevel: row.reorderLevel,
    unit:         row.unit,
    expiryDate:   row.expiryDate ? (row.expiryDate as Date).toISOString().split('T')[0] : '',
    supplier:     row.supplier,
    locationId:   row.locationId,
    notes:        row.notes,
    createdAt:    (row.createdAt as Date).toISOString(),
  };
}

export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  const rows = await prisma.inventoryItem.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(fromPrisma);
}
