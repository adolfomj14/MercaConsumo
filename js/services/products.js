// Catálogo de Productos y Categorías en Supabase
import { getSupabase } from './supabase.js';
import { state } from '../state.js';
import { normalizeText, findBestProductMatch } from '../utils/matcher.js';

export async function fetchCategories() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('categories').select('*').order('name');
  if (error) {
    console.error('Error al consultar categories:', error);
    return [];
  }
  state.categories = data || [];
  return state.categories;
}

export async function fetchProducts() {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('products').select('*, categories(name, icon, color)').order('name');
  if (error) {
    console.error('Error al consultar products:', error);
    return [];
  }
  const formatted = (data || []).map(p => ({
    ...p,
    categoryName: p.categories?.name || 'General',
    categoryIcon: p.categories?.icon || '📦'
  }));
  state.setProducts(formatted);
  return formatted;
}

export async function createProduct({ name, categoryId, baseUnit = 'unidad', brand = '', minStock = 1 }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const normName = normalizeText(name);
  const { data, error } = await sb.from('products').insert({
    user_id: state.user.id,
    name: name.trim(),
    normalized_name: normName,
    category_id: categoryId || null,
    base_unit: baseUnit,
    brand: brand ? brand.trim() : null,
    min_stock_alert: Number(minStock) || 1
  }).select().single();

  if (error) throw error;
  await fetchProducts();
  return data;
}

export async function updateProduct({ id, name, categoryId, baseUnit, brand, minStock }) {
  const sb = getSupabase();
  if (!sb || !state.user) throw new Error('No autenticado');

  const updates = {};
  if (name !== undefined) {
    updates.name = name.trim();
    updates.normalized_name = normalizeText(name);
  }
  if (categoryId !== undefined) updates.category_id = categoryId || null;
  if (baseUnit !== undefined) updates.base_unit = baseUnit;
  if (brand !== undefined) updates.brand = brand ? brand.trim() : null;
  if (minStock !== undefined) updates.min_stock_alert = Number(minStock) || 1;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await sb.from('products').update(updates).eq('id', id).select().single();
  if (error) throw error;

  await fetchProducts();
  return data;
}

export function checkDuplicateProduct(rawName) {
  return findBestProductMatch(rawName, state.products);
}
