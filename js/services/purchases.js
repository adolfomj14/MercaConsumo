// Compras en Supabase
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
    purchase_items(*, products(name, base_unit))
  `).order('purchase_date', { ascending: false });

  if (error) {
    console.error('Error al consultar purchases:', error);
    return [];
  }

  const formatted = (data || []).map(p => ({
    ...p,
    storeName: p.stores ? `${p.stores.name}${p.stores.platform ? ' (' + p.stores.platform + ')' : ''}` : 'Tienda General',
    items: (p.purchase_items || []).map(it => ({
      ...it,
      productName: it.products?.name || 'Producto',
      baseUnit: it.products?.base_unit || it.unit
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

  // 3. Actualizar Inventario en Supabase
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
