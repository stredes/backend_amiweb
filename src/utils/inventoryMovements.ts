import { collectionRef, nowTimestamp } from '../lib/firestore';

export type InventoryMovementType = 'sale_reserved' | 'sale_dispatch';

export type InventoryMovementPayload = {
  orderId: string;
  orderNumber?: string;
  quoteId?: string;
  productId: string;
  productName?: string;
  quantity: number;
  type: InventoryMovementType;
  actorId?: string;
  notes?: string;
};

export async function createInventoryMovement(payload: InventoryMovementPayload) {
  await collectionRef('inventoryMovements').doc().set({
    ...payload,
    createdAt: nowTimestamp(),
    createdAtIso: new Date().toISOString()
  });
}

export async function createInventoryMovementsBatch(
  orderId: string,
  orderNumber: string | undefined,
  items: Array<{ productId: string; productName?: string; quantity: number }>,
  type: InventoryMovementType,
  actorId?: string,
  notes?: string,
  quoteId?: string
) {
  const writes = items.map((item) =>
    createInventoryMovement({
      orderId,
      orderNumber,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      type,
      actorId,
      notes,
      quoteId
    })
  );

  await Promise.all(writes);
}
