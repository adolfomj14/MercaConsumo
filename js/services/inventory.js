// Inventario y Ciclos en Supabase con Ratio Fijo de Peso por Unidad
import { getSupabase } from './supabase.js';
import { state } from '../state.js';
import { convertQuantity, parseUnitWeight, formatUnitWeightMetadata } from '../utils/unitConverter.js';
import { updateProduct } from './products.js';

export async function fetchInventory() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('inventory').select('*, products(name, brand, base_unit, min_stock_alert, categories(name, icon))');
  if (error) {
    console.error('Error al consultar inventory:', error);
    return [];
  }
  const formatted = (data || []).map(inv => {
    const brandStr = inv.products?.brand || '';
    const unitWeight = parseUnitWeight(brandStr);
    return {
      ...inv,
      productName: inv.products?.name || 'Producto',
      brand: brandStr,
      unitWeight: unitWeight,
      categoryName: inv.products?.categories?.name || 'General',
      categoryIcon: inv.products?.categories?.icon || '📦',
      minStockAlert: inv.products?.min_stock_alert || 1
    };
  });
  state.setInventory(formatted);
  return formatted;
}

export async function updateInventoryStock({ productId, currentStock, unit, unitWeight = null, approxUnits = null, minStockAlert = 1 }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const stockNum = Math.max(0, Number(currentStock));
  const minAlert = Number(minStockAlert) || 1;

  let status = 'in_stock';
  if (stockNum === 0) status = 'depleted';
  else if (stockNum <= minAlert) status = 'low_stock';

  // 1. Actualizar tabla inventory
  const { error: invErr } = await sb.from('inventory').upsert({
    product_id: productId,
    user_id: state.user.id,
    current_stock: stockNum,
    unit: unit,
    status: status,
    updated_at: new Date().toISOString()
  });

  if (invErr) throw invErr;

  // 2. Calcular y guardar peso unitario fijo (unitWeight)
  let calculatedUnitWeight = unitWeight;
  if (!calculatedUnitWeight && approxUnits && Number(approxUnits) > 0 && stockNum > 0 && unit !== 'unidad') {
    calculatedUnitWeight = stockNum / Number(approxUnits);
  }

  const brandMetadata = calculatedUnitWeight ? formatUnitWeightMetadata(calculatedUnitWeight, unit, approxUnits) : '';

  await updateProduct({
    id: productId,
    baseUnit: unit,
    brand: brandMetadata,
    minStock: minAlert
  });

  await fetchInventory();
}

export async function fetchConsumptions() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('consumptions').select('*, products(name, base_unit, brand, categories(name, icon))').order('consumption_date', { ascending: false }).order('created_at', { ascending: false });
  if (error) {
    console.error('Error al consultar consumptions:', error);
    return [];
  }
  const formatted = (data || []).map(c => ({
    ...c,
    productName: c.products?.name || 'Producto',
    brand: c.products?.brand || '',
    unitWeight: parseUnitWeight(c.products?.brand || ''),
    categoryName: c.products?.categories?.name || 'General',
    categoryIcon: c.products?.categories?.icon || '🍽️',
    baseUnit: c.products?.base_unit || c.unit
  }));
  state.setConsumptions(formatted);
  return formatted;
}

export async function fetchCycles() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('consumption_cycles').select('*').order('end_date', { ascending: false });
  if (error) return [];
  state.setCycles(data || []);
  return state.cycles;
}

// Función auxiliar para normalizar la cantidad a descontar del inventario
function calculateDeduction(quantity, unit, product) {
  const numQty = Number(quantity);
  if (isNaN(numQty) || numQty <= 0) return 0;

  const baseUnit = product ? product.base_unit : unit;
  const unitWeight = parseUnitWeight(product?.brand);

  // Caso 1: El usuario consume en "unidades", pero el stock base está en kg o g y tenemos unitWeight fijo
  if (unit.toLowerCase() === 'unidad' && baseUnit.toLowerCase() !== 'unidad' && unitWeight) {
    return numQty * unitWeight;
  }

  // Caso 2: El usuario consume en kg/g/L/ml compatibles con la unidad base
  return convertQuantity(numQty, unit, baseUnit);
}

export async function registerConsumption({ productId, quantity, unit, unitsCount = null, date = null, notes = '' }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const consumptionDate = date || new Date().toISOString().split('T')[0];
  const product = state.products.find(p => p.id === productId);
  const normQty = calculateDeduction(quantity, unit, product);

  let finalNotes = notes ? notes.trim() : '';
  if (unitsCount && Number(unitsCount) > 0) {
    const unitTag = `(${unitsCount} ${Number(unitsCount) === 1 ? 'unidad' : 'unidades'})`;
    finalNotes = finalNotes ? `${unitTag} - ${finalNotes}` : unitTag;
  } else if (unit.toLowerCase() === 'unidad' && product && product.base_unit !== 'unidad') {
    const unitTag = `(${quantity} ${Number(quantity) === 1 ? 'unidad' : 'unidades'} ≈ ${normQty.toFixed(2)} ${product.base_unit})`;
    finalNotes = finalNotes ? `${unitTag} - ${finalNotes}` : unitTag;
  }

  // 1. Insertar consumo
  const { data: newCons, error: consErr } = await sb.from('consumptions').insert({
    user_id: state.user.id,
    product_id: productId,
    quantity: Number(quantity),
    unit: unit,
    consumption_date: consumptionDate,
    notes: finalNotes || null,
    is_depletion_event: false
  }).select().single();

  if (consErr) throw consErr;

  // 2. Descontar inventario
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
  return newCons;
}

export async function updateConsumption({ id, productId, oldQuantity, oldUnit, newQuantity, newUnit, unitsCount = null, date, notes = '' }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const product = state.products.find(p => p.id === productId);
  const oldNorm = calculateDeduction(oldQuantity, oldUnit, product);
  const newNorm = calculateDeduction(newQuantity, newUnit, product);
  const diff = newNorm - oldNorm;

  let finalNotes = notes ? notes.trim() : '';
  if (unitsCount && Number(unitsCount) > 0) {
    const unitTag = `(${unitsCount} ${Number(unitsCount) === 1 ? 'unidad' : 'unidades'})`;
    finalNotes = finalNotes ? `${unitTag} - ${finalNotes}` : unitTag;
  }

  // 1. Actualizar registro en consumptions
  const { error: updErr } = await sb.from('consumptions').update({
    quantity: Number(newQuantity),
    unit: newUnit,
    consumption_date: date,
    notes: finalNotes || null
  }).eq('id', id);

  if (updErr) throw updErr;

  // 2. Ajustar inventario
  const { data: inv } = await sb.from('inventory').select('*').eq('product_id', productId).single();
  if (inv) {
    const newStock = Math.max(0, Number(inv.current_stock) - diff);
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
}

export async function deleteConsumption({ id, productId, quantity, unit }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const product = state.products.find(p => p.id === productId);
  const normQty = calculateDeduction(quantity, unit, product);

  const { error: delErr } = await sb.from('consumptions').delete().eq('id', id);
  if (delErr) throw delErr;

  const { data: inv } = await sb.from('inventory').select('*').eq('product_id', productId).single();
  if (inv) {
    const newStock = Number(inv.current_stock) + normQty;
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
}

export async function registerDepletion(productId) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const today = new Date().toISOString().split('T')[0];
  const product = state.products.find(p => p.id === productId);
  const inv = state.inventory.find(i => i.product_id === productId);
  const baseUnit = product ? product.base_unit : (inv?.unit || 'unidad');

  let startDate = inv?.last_purchased_at || today;
  const start = new Date(startDate);
  const end = new Date(today);
  let durationDays = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
  if (durationDays < 1) durationDays = 7;

  const totalQty = inv ? (Number(inv.current_stock) > 0 ? Number(inv.current_stock) : 5) : 5;
  const dailyRate = totalQty / durationDays;

  // 1. Guardar ciclo de consumo
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

  // 2. Registrar evento de agotamiento
  await sb.from('consumptions').insert({
    user_id: state.user.id,
    product_id: productId,
    quantity: 0,
    unit: baseUnit,
    consumption_date: today,
    is_depletion_event: true,
    notes: '¡Se acabó!'
  });

  // 3. Stock en 0
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
}
