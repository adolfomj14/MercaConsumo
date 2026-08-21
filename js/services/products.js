// Gestión de catálogo de productos y categorías
import { getSupabase } from './supabase.js';
import { state } from '../state.js';
import { normalizeText, findBestProductMatch } from '../utils/matcher.js';

const LOCAL_PRODUCTS_KEY = 'mc_local_products';
const LOCAL_CATEGORIES_KEY = 'mc_local_categories';

export async function fetchCategories() {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('categories').select('*').order('name');
    if (!error && data) {
      state.categories = data;
      return data;
    }
  }

  const cached = localStorage.getItem(LOCAL_CATEGORIES_KEY);
  if (cached) {
    state.categories = JSON.parse(cached);
    return state.categories;
  }

  const defaultCategories = [
    { id: 'cat-1', name: 'Frutas y Verduras', icon: '🍌', color: '#10B981' },
    { id: 'cat-2', name: 'Lácteos y Huevos', icon: '🥛', color: '#3B82F6' },
    { id: 'cat-3', name: 'Granos y Despensa', icon: '🍚', color: '#F59E0B' },
    { id: 'cat-4', name: 'Carnes y Proteínas', icon: '🥩', color: '#EF4444' },
    { id: 'cat-5', name: 'Aseo y Limpieza', icon: '🧹', color: '#8B5CF6' },
    { id: 'cat-6', name: 'Cuidado Personal', icon: '🧴', color: '#EC4899' },
    { id: 'cat-7', name: 'Bebidas y Snacks', icon: '🥤', color: '#6366F1' }
  ];
  localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(defaultCategories));
  state.categories = defaultCategories;
  return defaultCategories;
}

export async function fetchProducts() {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('products').select('*, categories(name, icon, color)').order('name');
    if (!error && data) {
      const formatted = data.map(p => ({
        ...p,
        categoryName: p.categories?.name,
        categoryIcon: p.categories?.icon
      }));
      state.setProducts(formatted);
      return formatted;
    }
  }

  const cached = localStorage.getItem(LOCAL_PRODUCTS_KEY);
  const products = cached ? JSON.parse(cached) : [];
  state.setProducts(products);
  return products;
}

export async function createProduct({ name, categoryId, baseUnit = 'unidad', brand = '', minStock = 1 }) {
  const normName = normalizeText(name);
  const newProduct = {
    id: 'prod-' + Date.now(),
    name: name.trim(),
    normalized_name: normName,
    category_id: categoryId,
    base_unit: baseUnit,
    brand: brand.trim(),
    min_stock_alert: Number(minStock) || 1,
    created_at: new Date().toISOString()
  };

  const sb = getSupabase();
  if (sb && state.user) {
    const { data, error } = await sb.from('products').insert({
      user_id: state.user.id,
      name: newProduct.name,
      normalized_name: normName,
      category_id: categoryId || null,
      base_unit: baseUnit,
      brand: brand || null,
      min_stock_alert: Number(minStock) || 1
    }).select().single();

    if (error) throw error;
    await fetchProducts();
    return data;
  }

  // Local Storage
  const current = [...state.products, newProduct];
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(current));
  state.setProducts(current);
  return newProduct;
}

export function checkDuplicateProduct(rawName) {
  return findBestProductMatch(rawName, state.products);
}
