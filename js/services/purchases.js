// Compras en Supabase con Edición, Eliminación y Gestión de Stock
import { getSupabase } from './supabase.js';
import { state } from '../state.js';
import { convertQuantity } from '../utils/unitConverter.js';
import { fetchInventory } from './inventory.js';

export async function fetchPurchases() {
  const sb = getSupabase();
  if (!sb) return [];
  
  const { data, error } = await sb.from('purchases').select(`
    *,
    stores(name, platform),
    purchase_items(*, products(name, base_unit, category_id, categories(name, icon)))
  `).order('purchase_date', { ascending: false });

  if (error) {
    console.error('Error al consultar purchases:', error);
    return [];
  }

  const formatted = (data || []).map(p => ({
    ...p,
    storeName: p.stores ? `${p.stores.name}${p.stores.platform ? ' (' + p.stores.platform + ')' : ''}` : 'Tienda General',
    rawStoreName: p.stores?.name || '',
    items: (p.purchase_items || []).map(it => ({
      ...it,
      productName: it.products?.name || 'Producto',
      baseUnit: it.products?.base_unit || it.unit,
      categoryName: it.products?.categories?.name || 'General',
      categoryIcon: it.products?.categories?.icon || '📦'
    }))
  }));

  state.setPurchases(formatted);
  return formatted;
}

export async function registerPurchase({ storeId, purchaseDate, items, paymentMethod = 'Efectivo', source = 'manual', notes = '' }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const totalAmount = items.reduce((sum, it) => sum + Number(it.total_price || (it.quantity * it.unit_price)), 0);

  // 1. Insertar Cabecera de Compra
  const { data: purData, error: purError } = await sb.from('purchases').insert({
    user_id: state.user.id,
    store_id: storeId || null,
    purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
    total_amount: totalAmount,
    payment_method: paymentMethod,
    source: source,
    notes: notes || null
  }).select().single();

  if (purError) throw purError;

  // 2. Insertar Detalle de Ítems
  const itemsToInsert = items.map(it => ({
    purchase_id: purData.id,
    product_id: it.product_id,
    quantity: Number(it.quantity),
    unit: it.unit,
    unit_price: Number(it.unit_price),
    total_price: Number(it.total_price || (it.quantity * it.unit_price)),
    notes: it.notes || null
  }));

  const { error: itemsError } = await sb.from('purchase_items').insert(itemsToInsert);
  if (itemsError) throw itemsError;

  // 3. Actualizar Inventario en Supabase (Sumar stock)
  for (const it of items) {
    const { data: currentInv } = await sb.from('inventory').select('*').eq('product_id', it.product_id).single();
    const product = state.products.find(p => p.id === it.product_id);
    const baseUnit = product ? product.base_unit : it.unit;
    const normAddQty = convertQuantity(it.quantity, it.unit, baseUnit);

    const newStock = currentInv ? (Number(currentInv.current_stock) + normAddQty) : normAddQty;
    await sb.from('inventory').upsert({
      product_id: it.product_id,
      user_id: state.user.id,
      current_stock: Math.max(0, newStock),
      unit: baseUnit,
      last_purchased_at: purData.purchase_date,
      status: newStock > 0 ? 'in_stock' : 'depleted',
      updated_at: new Date().toISOString()
    });
  }

  await fetchPurchases();
  await fetchInventory();
  return purData;
}

// ── EDITAR COMPRA EXISTENTE (con ajuste diferencial de inventario) ────────────
export async function updatePurchase({ purchaseId, storeId, purchaseDate, paymentMethod, items, notes = '' }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  // 1. Obtener los ítems anteriores para calcular la diferencia de inventario
  const { data: oldItems } = await sb.from('purchase_items').select('*').eq('purchase_id', purchaseId);

  // 2. Revertir el stock de los ítems anteriores
  if (oldItems && oldItems.length > 0) {
    for (const oldIt of oldItems) {
      const { data: curInv } = await sb.from('inventory').select('*').eq('product_id', oldIt.product_id).single();
      if (curInv) {
        const product = state.products.find(p => p.id === oldIt.product_id);
        const baseUnit = product ? product.base_unit : oldIt.unit;
        const normOldQty = convertQuantity(oldIt.quantity, oldIt.unit, baseUnit);
        const revertedStock = Math.max(0, Number(curInv.current_stock) - normOldQty);

        await sb.from('inventory').update({
          current_stock: revertedStock,
          status: revertedStock > 0 ? 'in_stock' : 'depleted',
          updated_at: new Date().toISOString()
        }).eq('product_id', oldIt.product_id);
      }
    }
  }

  // 3. Eliminar los items antiguos
  await sb.from('purchase_items').delete().eq('purchase_id', purchaseId);

  // 4. Actualizar la cabecera de la compra
  const totalAmount = items.reduce((sum, it) => sum + Number(it.total_price || (it.quantity * it.unit_price)), 0);

  const { error: purError } = await sb.from('purchases').update({
    store_id: storeId || null,
    purchase_date: purchaseDate,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    notes: notes || null
  }).eq('id', purchaseId);

  if (purError) throw purError;

  // 5. Insertar los nuevos items
  const itemsToInsert = items.map(it => ({
    purchase_id: purchaseId,
    product_id: it.product_id,
    quantity: Number(it.quantity),
    unit: it.unit,
    unit_price: Number(it.unit_price),
    total_price: Number(it.total_price || (it.quantity * it.unit_price)),
    notes: it.notes || null
  }));

  const { error: itemsError } = await sb.from('purchase_items').insert(itemsToInsert);
  if (itemsError) throw itemsError;

  // 6. Aplicar el nuevo stock al inventario
  for (const it of items) {
    const { data: curInv } = await sb.from('inventory').select('*').eq('product_id', it.product_id).single();
    const product = state.products.find(p => p.id === it.product_id);
    const baseUnit = product ? product.base_unit : it.unit;
    const normNewQty = convertQuantity(it.quantity, it.unit, baseUnit);

    const newStock = curInv ? (Number(curInv.current_stock) + normNewQty) : normNewQty;
    await sb.from('inventory').upsert({
      product_id: it.product_id,
      user_id: state.user.id,
      current_stock: Math.max(0, newStock),
      unit: baseUnit,
      last_purchased_at: purchaseDate,
      status: newStock > 0 ? 'in_stock' : 'depleted',
      updated_at: new Date().toISOString()
    });
  }

  await fetchPurchases();
  await fetchInventory();
}

// ── ELIMINAR COMPRA (y restaurar inventario con exactitud) ─────────────────────
export async function deletePurchase(purchaseId) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  // 1. Obtener items comprados para descontarlos del inventario
  const { data: items } = await sb.from('purchase_items').select('*').eq('purchase_id', purchaseId);

  if (items && items.length > 0) {
    for (const it of items) {
      const { data: curInv } = await sb.from('inventory').select('*').eq('product_id', it.product_id).single();
      if (curInv) {
        const product = state.products.find(p => p.id === it.product_id);
        const baseUnit = product ? product.base_unit : it.unit;
        const normQty = convertQuantity(it.quantity, it.unit, baseUnit);
        const newStock = Math.max(0, Number(curInv.current_stock) - normQty);

        await sb.from('inventory').update({
          current_stock: newStock,
          status: newStock > 0 ? 'in_stock' : 'depleted',
          updated_at: new Date().toISOString()
        }).eq('product_id', it.product_id);
      }
    }
  }

  // 2. Eliminar la compra (cascade elimina los items)
  const { error } = await sb.from('purchases').delete().eq('id', purchaseId);
  if (error) throw error;

  await fetchPurchases();
  await fetchInventory();
}
