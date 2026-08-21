// Generador de Datos de Demostración Realistas (Contexto Colombiano)
import { state } from '../state.js';
import { fetchProducts } from './products.js';
import { fetchStores } from './stores.js';
import { fetchPurchases } from './purchases.js';
import { fetchInventory, fetchConsumptions, fetchCycles } from './inventory.js';

export async function loadDemoData() {
  // 1. Categorías
  const categories = [
    { id: 'cat-1', name: 'Frutas y Verduras', icon: '🍌', color: '#10B981' },
    { id: 'cat-2', name: 'Lácteos y Huevos', icon: '🥛', color: '#3B82F6' },
    { id: 'cat-3', name: 'Granos y Cereales', icon: '🍚', color: '#F59E0B' },
    { id: 'cat-4', name: 'Carnes y Proteínas', icon: '🥩', color: '#EF4444' },
    { id: 'cat-5', name: 'Aseo del Hogar', icon: '🧹', color: '#8B5CF6' }
  ];
  localStorage.setItem('mc_local_categories', JSON.stringify(categories));

  // 2. Establecimientos
  const stores = [
    { id: 'store-1', name: 'Merca Z', platform: 'Directo' },
    { id: 'store-2', name: 'Éxito', platform: 'Directo' },
    { id: 'store-3', name: 'Rappi (Éxito)', platform: 'Rappi' },
    { id: 'store-4', name: 'D1', platform: 'Directo' }
  ];
  localStorage.setItem('mc_local_stores', JSON.stringify(stores));

  // 3. Productos
  const products = [
    { id: 'prod-platano', name: 'Plátano', normalized_name: 'platano', category_id: 'cat-1', categoryName: 'Frutas y Verduras', base_unit: 'kg', min_stock_alert: 1.5, brand: '' },
    { id: 'prod-leche', name: 'Leche Entera', normalized_name: 'leche entera', category_id: 'cat-2', categoryName: 'Lácteos y Huevos', base_unit: 'L', min_stock_alert: 2, brand: 'Alquería' },
    { id: 'prod-arroz', name: 'Arroz', normalized_name: 'arroz', category_id: 'cat-3', categoryName: 'Granos y Cereales', base_unit: 'kg', min_stock_alert: 2, brand: 'Diana' },
    { id: 'prod-huevos', name: 'Huevos AA', normalized_name: 'huevos aa', category_id: 'cat-2', categoryName: 'Lácteos y Huevos', base_unit: 'unidad', min_stock_alert: 12, brand: 'Santa Reyes' },
    { id: 'prod-pollo', name: 'Pechuga de Pollo', normalized_name: 'pechuga de pollo', category_id: 'cat-4', categoryName: 'Carnes y Proteínas', base_unit: 'kg', min_stock_alert: 1, brand: 'Bucanero' },
    { id: 'prod-detergente', name: 'Detergente Líquido', normalized_name: 'detergente liquido', category_id: 'cat-5', categoryName: 'Aseo del Hogar', base_unit: 'L', min_stock_alert: 1, brand: 'Fab' }
  ];
  localStorage.setItem('mc_local_products', JSON.stringify(products));

  // 4. Inventario Actual
  const inventory = [
    { product_id: 'prod-platano', current_stock: 1.2, unit: 'kg', last_purchased_at: '2026-08-10', status: 'low_stock', minStockAlert: 1.5, productName: 'Plátano', categoryName: 'Frutas y Verduras' },
    { product_id: 'prod-leche', current_stock: 1.0, unit: 'L', last_purchased_at: '2026-08-16', status: 'low_stock', minStockAlert: 2, productName: 'Leche Entera', categoryName: 'Lácteos y Huevos' },
    { product_id: 'prod-arroz', current_stock: 3.5, unit: 'kg', last_purchased_at: '2026-08-01', status: 'in_stock', minStockAlert: 2, productName: 'Arroz', categoryName: 'Granos y Cereales' },
    { product_id: 'prod-huevos', current_stock: 18, unit: 'unidad', last_purchased_at: '2026-08-14', status: 'in_stock', minStockAlert: 12, productName: 'Huevos AA', categoryName: 'Lácteos y Huevos' },
    { product_id: 'prod-pollo', current_stock: 0.0, unit: 'kg', last_purchased_at: '2026-07-28', status: 'depleted', minStockAlert: 1, productName: 'Pechuga de Pollo', categoryName: 'Carnes y Proteínas' },
    { product_id: 'prod-detergente', current_stock: 2.0, unit: 'L', last_purchased_at: '2026-07-15', status: 'in_stock', minStockAlert: 1, productName: 'Detergente Líquido', categoryName: 'Aseo del Hogar' }
  ];
  localStorage.setItem('mc_local_inventory', JSON.stringify(inventory));

  // 5. Historial de Compras
  const purchases = [
    {
      id: 'pur-1',
      store_id: 'store-1',
      storeName: 'Merca Z',
      purchase_date: '2026-08-10',
      total_amount: 14500,
      payment_method: 'Tarjeta Débito',
      source: 'receipt_ocr',
      items: [
        { product_id: 'prod-platano', productName: 'Plátano', quantity: 5, unit: 'kg', unit_price: 2900, total_price: 14500 }
      ]
    },
    {
      id: 'pur-2',
      store_id: 'store-2',
      storeName: 'Éxito',
      purchase_date: '2026-08-16',
      total_amount: 38400,
      payment_method: 'Nequi',
      source: 'manual',
      items: [
        { product_id: 'prod-leche', productName: 'Leche Entera', quantity: 6, unit: 'L', unit_price: 3900, total_price: 23400 },
        { product_id: 'prod-huevos', productName: 'Huevos AA', quantity: 30, unit: 'unidad', unit_price: 500, total_price: 15000 }
      ]
    },
    {
      id: 'pur-3',
      store_id: 'store-3',
      storeName: 'Rappi (Éxito)',
      purchase_date: '2026-07-28',
      total_amount: 47000,
      payment_method: 'Tarjeta Crédito',
      source: 'manual',
      items: [
        { product_id: 'prod-platano', productName: 'Plátano', quantity: 5, unit: 'kg', unit_price: 3800, total_price: 19000 },
        { product_id: 'prod-pollo', productName: 'Pechuga de Pollo', quantity: 2, unit: 'kg', unit_price: 14000, total_price: 28000 }
      ]
    },
    {
      id: 'pur-4',
      store_id: 'store-1',
      storeName: 'Merca Z',
      purchase_date: '2026-07-15',
      total_amount: 48500,
      payment_method: 'Efectivo',
      source: 'receipt_ocr',
      items: [
        { product_id: 'prod-arroz', productName: 'Arroz', quantity: 5, unit: 'kg', unit_price: 4300, total_price: 21500 },
        { product_id: 'prod-detergente', productName: 'Detergente Líquido', quantity: 3, unit: 'L', unit_price: 9000, total_price: 27000 }
      ]
    },
    {
      id: 'pur-5',
      store_id: 'store-1',
      storeName: 'Merca Z',
      purchase_date: '2026-07-01',
      total_amount: 14000,
      payment_method: 'Efectivo',
      source: 'manual',
      items: [
        { product_id: 'prod-platano', productName: 'Plátano', quantity: 5, unit: 'kg', unit_price: 2800, total_price: 14000 }
      ]
    }
  ];
  localStorage.setItem('mc_local_purchases', JSON.stringify(purchases));

  // 6. Ciclos de Consumo Completados (Aprendizaje Estadístico)
  const cycles = [
    { id: 'cyc-1', product_id: 'prod-platano', start_date: '2026-07-01', end_date: '2026-07-12', total_quantity: 5, unit: 'kg', duration_days: 11, daily_consumption_rate: 0.4545 },
    { id: 'cyc-2', product_id: 'prod-platano', start_date: '2026-07-13', end_date: '2026-07-24', total_quantity: 5, unit: 'kg', duration_days: 11, daily_consumption_rate: 0.4545 },
    { id: 'cyc-3', product_id: 'prod-platano', start_date: '2026-07-28', end_date: '2026-08-08', total_quantity: 5, unit: 'kg', duration_days: 11, daily_consumption_rate: 0.4545 },
    { id: 'cyc-4', product_id: 'prod-leche', start_date: '2026-07-10', end_date: '2026-07-20', total_quantity: 6, unit: 'L', duration_days: 10, daily_consumption_rate: 0.6 },
    { id: 'cyc-5', product_id: 'prod-leche', start_date: '2026-07-25', end_date: '2026-08-05', total_quantity: 6, unit: 'L', duration_days: 11, daily_consumption_rate: 0.5454 },
    { id: 'cyc-6', product_id: 'prod-huevos', start_date: '2026-07-15', end_date: '2026-08-05', total_quantity: 30, unit: 'unidad', duration_days: 21, daily_consumption_rate: 1.4285 },
    { id: 'cyc-7', product_id: 'prod-pollo', start_date: '2026-07-28', end_date: '2026-08-15', total_quantity: 2, unit: 'kg', duration_days: 18, daily_consumption_rate: 0.1111 }
  ];
  localStorage.setItem('mc_local_cycles', JSON.stringify(cycles));

  // Recargar estado
  await fetchCategories();
  await fetchStores();
  await fetchProducts();
  await fetchInventory();
  await fetchPurchases();
  await fetchCycles();
  await fetchConsumptions();
}

export function clearDemoData() {
  localStorage.removeItem('mc_local_categories');
  localStorage.removeItem('mc_local_stores');
  localStorage.removeItem('mc_local_products');
  localStorage.removeItem('mc_local_inventory');
  localStorage.removeItem('mc_local_purchases');
  localStorage.removeItem('mc_local_cycles');
  localStorage.removeItem('mc_local_consumptions');
  window.location.reload();
}
