// Registro y consulta de compras
import { getSupabase } from './supabase.js';
import { state } from '../state.js';
import { convertQuantity } from '../utils/unitConverter.js';
import { fetchInventory } from './inventory.js';

const LOCAL_PURCHASES_KEY = 'mc_local_purchases';
const LOCAL_INVENTORY_KEY = 'mc_local_inventory';

export async function fetchPurchases() {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('purchases').select(`
      *,
      stores(name, platform),
      purchase_items(*, products(name, base_unit))
    `).order('purchase_date', { ascending: false });

    if (!error && data) {
      const formatted = data.map(p => ({
        ...p,
        storeName: p.stores ? `${p.stores.name}${p.stores.platform ? ' (' + p.stores.platform + ')' : ''}` : 'Tienda General',
        items: (p.purchase_items || []).map(it => ({
          ...it,
          productName: it.products?.name,
          baseUnit: it.products?.base_unit
        }))
      }));
      state.setPurchases(formatted);
      return formatted;
    }
  }

  const cached = localStorage.getItem(LOCAL_PURCHASES_KEY);
  const purchases = cached ? JSON.parse(cached) : [];
  state.setPurchases(purchases);
  return purchases;
}

export async function registerPurchase({ storeId, purchaseDate, items, paymentMethod = 'Efectivo', source = 'manual', notes = '' }) {
  const totalAmount = items.reduce((sum, it) => sum + Number(it.total_price || (it.quantity * it.unit_price)), 0);

  const purchaseId = 'pur-' + Date.now();
  const newPurchase = {
    id: purchaseId,
    store_id: storeId,
    purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
    total_amount: totalAmount,
    payment_method: paymentMethod,
    source: source,
    notes: notes,
    items: items.map((it, idx) => ({
      id: `it-${purchaseId}-${idx}`,
      purchase_id: purchaseId,
      product_id: it.product_id,
      productName: it.productName,
      quantity: Number(it.quantity),
      unit: it.unit,
      unit_price: Number(it.unit_price),
      total_price: Number(it.total_price || (it.quantity * it.unit_price))
    }))
  };

  const sb = getSupabase();
  if (sb && state.user) {
    // 1. Insert Purchase
    const { data: purData, error: purError } = await sb.from('purchases').insert({
      user_id: state.user.id,
      store_id: storeId || null,
      purchase_date: newPurchase.purchase_date,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      source: source,
      notes: notes
    }).select().single();

    if (purError) throw purError;

    // 2. Insert Items
    const itemsToInsert = items.map(it => ({
      purchase_id: purData.id,
      product_id: it.product_id,
      quantity: Number(it.quantity),
      unit: it.unit,
      unit_price: Number(it.unit_price),
      total_price: Number(it.total_price || (it.quantity * it.unit_price))
    }));

    const { error: itemsError } = await sb.from('purchase_items').insert(itemsToInsert);
    if (itemsError) throw itemsError;

    // 3. Update Inventory
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
        last_purchased_at: newPurchase.purchase_date,
        status: newStock > 0 ? 'in_stock' : 'depleted',
        updated_at: new Date().toISOString()
      });
    }

    await fetchPurchases();
    await fetchInventory();
    return purData;
  }

  // Local fallback
  const currentPurchases = [newPurchase, ...state.purchases];
  localStorage.setItem(LOCAL_PURCHASES_KEY, JSON.stringify(currentPurchases));
  state.setPurchases(currentPurchases);

  // Actualizar inventario local
  const cachedInv = localStorage.getItem(LOCAL_INVENTORY_KEY);
  let invList = cachedInv ? JSON.parse(cachedInv) : [];

  for (const it of items) {
    const product = state.products.find(p => p.id === it.product_id);
    const baseUnit = product ? product.base_unit : it.unit;
    const normAddQty = convertQuantity(it.quantity, it.unit, baseUnit);

    const existingIdx = invList.findIndex(inv => inv.product_id === it.product_id);
    if (existingIdx >= 0) {
      invList[existingIdx].current_stock = Number(invList[existingIdx].current_stock) + normAddQty;
      invList[existingIdx].last_purchased_at = newPurchase.purchase_date;
      invList[existingIdx].status = invList[existingIdx].current_stock > 0 ? 'in_stock' : 'depleted';
    } else {
      invList.push({
        product_id: it.product_id,
        current_stock: normAddQty,
        unit: baseUnit,
        last_purchased_at: newPurchase.purchase_date,
        status: 'in_stock'
      });
    }
  }

  localStorage.setItem(LOCAL_INVENTORY_KEY, JSON.stringify(invList));
  await fetchInventory();
  return newPurchase;
}
