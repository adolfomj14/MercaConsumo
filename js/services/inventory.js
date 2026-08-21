// Gestión de inventario, consumos y ciclo de agotamiento
import { getSupabase } from './supabase.js';
import { state } from '../state.js';
import { convertQuantity } from '../utils/unitConverter.js';

const LOCAL_INVENTORY_KEY = 'mc_local_inventory';
const LOCAL_CONSUMPTIONS_KEY = 'mc_local_consumptions';
const LOCAL_CYCLES_KEY = 'mc_local_cycles';

export async function fetchInventory() {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('inventory').select('*, products(name, base_unit, min_stock_alert, categories(name, icon))');
    if (!error && data) {
      const formatted = data.map(inv => ({
        ...inv,
        productName: inv.products?.name,
        categoryName: inv.products?.categories?.name,
        categoryIcon: inv.products?.categories?.icon,
        minStockAlert: inv.products?.min_stock_alert || 1
      }));
      state.setInventory(formatted);
      return formatted;
    }
  }

  const cached = localStorage.getItem(LOCAL_INVENTORY_KEY);
  const inv = cached ? JSON.parse(cached) : [];
  state.setInventory(inv);
  return inv;
}

export async function fetchConsumptions() {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('consumptions').select('*').order('consumption_date', { ascending: false });
    if (data) {
      state.setConsumptions(data);
      return data;
    }
  }
  const cached = localStorage.getItem(LOCAL_CONSUMPTIONS_KEY);
  const c = cached ? JSON.parse(cached) : [];
  state.setConsumptions(c);
  return c;
}

export async function fetchCycles() {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('consumption_cycles').select('*').order('end_date', { ascending: false });
    if (data) {
      state.setCycles(data);
      return data;
    }
  }
  const cached = localStorage.getItem(LOCAL_CYCLES_KEY);
  const cy = cached ? JSON.parse(cached) : [];
  state.setCycles(cy);
  return cy;
}

export async function registerConsumption({ productId, quantity, unit, date = null, notes = '' }) {
  const consumptionDate = date || new Date().toISOString().split('T')[0];
  const product = state.products.find(p => p.id === productId);
  const baseUnit = product ? product.base_unit : unit;
  const normQty = convertQuantity(quantity, unit, baseUnit);

  const sb = getSupabase();
  if (sb && state.user) {
    // 1. Insert consumption
    await sb.from('consumptions').insert({
      user_id: state.user.id,
      product_id: productId,
      quantity: Number(quantity),
      unit: unit,
      consumption_date: consumptionDate,
      notes: notes,
      is_depletion_event: false
    });

    // 2. Reduce stock
    const { data: inv } = await sb.from('inventory').select('*').eq('product_id', productId).single();
    if (inv) {
      const newStock = Math.max(0, Number(inv.current_stock) - normQty);
      const minAlert = product?.min_stock_alert || 1;
      let status = 'in_stock';
      if (newStock === 0) status = 'depleted';
      else if (newStock <= minAlert) status = 'low_stock';

      await sb.from('inventory').update({
        current_stock: newStock,
        status: status,
        updated_at: new Date().toISOString()
      }).eq('product_id', productId);
    }

    await fetchConsumptions();
    await fetchInventory();
    return;
  }

  // Local fallback
  const newCons = {
    id: 'cons-' + Date.now(),
    product_id: productId,
    quantity: Number(quantity),
    unit: unit,
    consumption_date: consumptionDate,
    notes: notes,
    is_depletion_event: false
  };
  const currentCons = [newCons, ...state.consumptions];
  localStorage.setItem(LOCAL_CONSUMPTIONS_KEY, JSON.stringify(currentCons));
  state.setConsumptions(currentCons);

  // Descontar inventario local
  const currentInv = [...state.inventory];
  const item = currentInv.find(i => i.product_id === productId);
  if (item) {
    item.current_stock = Math.max(0, Number(item.current_stock) - normQty);
    const minAlert = product?.min_stock_alert || 1;
    if (item.current_stock === 0) item.status = 'depleted';
    else if (item.current_stock <= minAlert) item.status = 'low_stock';
    else item.status = 'in_stock';
  }
  localStorage.setItem(LOCAL_INVENTORY_KEY, JSON.stringify(currentInv));
  state.setInventory(currentInv);
}

// Acción Rápida Fundamental: "¡Se acabó!" (Agotamiento)
export async function registerDepletion(productId) {
  const today = new Date().toISOString().split('T')[0];
  const product = state.products.find(p => p.id === productId);
  const inv = state.inventory.find(i => i.product_id === productId);
  const baseUnit = product ? product.base_unit : (inv?.unit || 'unidad');

  // Buscar última compra para calcular duración del ciclo
  let startDate = inv?.last_purchased_at || today;
  const start = new Date(startDate);
  const end = new Date(today);
  let durationDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));

  // Si no hay compra previa o fue hoy, asumimos mínimo 7 días para el ciclo inicial
  if (durationDays < 1) durationDays = 7;

  // Cantidad total estimada del ciclo
  const totalQty = inv ? (Number(inv.current_stock) > 0 ? Number(inv.current_stock) : (product?.min_stock_alert ? product.min_stock_alert * 3 : 5)) : 5;
  const dailyRate = totalQty / durationDays;

  const newCycle = {
    id: 'cycle-' + Date.now(),
    product_id: productId,
    start_date: startDate,
    end_date: today,
    total_quantity: totalQty,
    unit: baseUnit,
    duration_days: durationDays,
    daily_consumption_rate: dailyRate
  };

  const sb = getSupabase();
  if (sb && state.user) {
    // 1. Guardar ciclo
    await sb.from('consumption_cycles').insert({
      user_id: state.user.id,
      product_id: productId,
      start_date: startDate,
      end_date: today,
      total_quantity: totalQty,
      unit: baseUnit,
      duration_days: durationDays,
      daily_consumption_rate: dailyRate
    });

    // 2. Registrar evento de consumo de agotamiento
    await sb.from('consumptions').insert({
      user_id: state.user.id,
      product_id: productId,
      quantity: 0,
      unit: baseUnit,
      consumption_date: today,
      is_depletion_event: true,
      notes: 'Producto marcado como agotado (¡Se acabó!)'
    });

    // 3. Poner stock en 0 y depleted
    await sb.from('inventory').upsert({
      product_id: productId,
      user_id: state.user.id,
      current_stock: 0,
      unit: baseUnit,
      last_depleted_at: today,
      status: 'depleted',
      updated_at: new Date().toISOString()
    });

    await fetchCycles();
    await fetchInventory();
    return;
  }

  // Fallback Local
  const currentCycles = [newCycle, ...state.cycles];
  localStorage.setItem(LOCAL_CYCLES_KEY, JSON.stringify(currentCycles));
  state.setCycles(currentCycles);

  const currentInv = [...state.inventory];
  const item = currentInv.find(i => i.product_id === productId);
  if (item) {
    item.current_stock = 0;
    item.status = 'depleted';
    item.last_depleted_at = today;
  }
  localStorage.setItem(LOCAL_INVENTORY_KEY, JSON.stringify(currentInv));
  state.setInventory(currentInv);
}
