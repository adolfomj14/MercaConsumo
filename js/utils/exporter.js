// Utilidad para Exportar Datos a Excel (CSV compatible con UTF-8)
import { formatCurrency } from './formatters.js';

function downloadCSV(csvContent, fileName) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Exporta el historial completo de compras
export function exportPurchasesToCSV(purchases = [], products = [], stores = [], categories = []) {
  if (!purchases || purchases.length === 0) {
    throw new Error('No hay compras registradas para exportar.');
  }

  const prodMap = new Map(products.map(p => [p.id, p]));
  const storeMap = new Map(stores.map(s => [s.id, s.name]));
  const catMap = new Map(categories.map(c => [c.id, c.name]));

  const headers = [
    'Fecha de Compra',
    'Supermercado / Tienda',
    'Producto',
    'Categoría',
    'Cantidad',
    'Unidad',
    'Precio Unitario (COP)',
    'Subtotal (COP)',
    'Total Factura (COP)',
    'Tipo de Registro',
    'Notas'
  ];

  const rows = [];

  purchases.forEach(p => {
    const storeName = storeMap.get(p.store_id) || p.store_name || 'Desconocido';
    const purchaseDate = p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('es-CO') : '';
    const totalReceipt = Number(p.total_amount) || 0;
    const items = p.items || p.purchase_items || [];

    if (items.length === 0) {
      rows.push([
        escapeCSV(purchaseDate),
        escapeCSV(storeName),
        escapeCSV('Gasto General / Sin Detalle'),
        escapeCSV('Varios'),
        escapeCSV('1'),
        escapeCSV('un'),
        escapeCSV(totalReceipt),
        escapeCSV(totalReceipt),
        escapeCSV(totalReceipt),
        escapeCSV(p.source === 'receipt_ocr' ? 'IA Escáner' : 'Manual'),
        escapeCSV(p.notes || '')
      ].join(';'));
    } else {
      items.forEach(item => {
        const prod = prodMap.get(item.product_id);
        const prodName = item.product_name || prod?.name || 'Producto';
        const catName = catMap.get(prod?.category_id) || 'General';
        const qty = Number(item.quantity) || 1;
        const unit = item.unit || prod?.base_unit || 'un';
        const unitPrice = Number(item.unit_price) || 0;
        const subtotal = Number(item.subtotal) || (qty * unitPrice);

        rows.push([
          escapeCSV(purchaseDate),
          escapeCSV(storeName),
          escapeCSV(prodName),
          escapeCSV(catName),
          escapeCSV(qty),
          escapeCSV(unit),
          escapeCSV(unitPrice),
          escapeCSV(subtotal),
          escapeCSV(totalReceipt),
          escapeCSV(p.source === 'receipt_ocr' ? 'IA Escáner' : 'Manual'),
          escapeCSV(p.notes || '')
        ].join(';'));
      });
    }
  });

  const csv = [headers.join(';'), ...rows].join('\r\n');
  const now = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `mercaconsumo_compras_${now}.csv`);
}

// Exporta el inventario actual y cálculos de despensa
export function exportInventoryToCSV(inventory = [], products = [], categories = [], metricsList = []) {
  if (!products || products.length === 0) {
    throw new Error('No hay productos en el inventario para exportar.');
  }

  const catMap = new Map(categories.map(c => [c.id, c.name]));
  const metricsMap = new Map(metricsList.map(m => [m.productId, m]));

  const headers = [
    'Producto',
    'Categoría',
    'Stock Actual',
    'Unidad',
    'Stock Mínimo',
    'Consumo Diario Estimado',
    'Días Restantes Estimados',
    'Estado',
    'Gasto Mensual Estimado (COP)'
  ];

  const rows = products.map(p => {
    const inv = inventory.find(i => i.product_id === p.id);
    const m = metricsMap.get(p.id);
    const catName = catMap.get(p.category_id) || 'General';
    const currentStock = Number(inv?.current_stock ?? 0);
    const minStock = Number(inv?.min_stock ?? 0);
    const dailyRate = m ? Number(m.dailyRate.toFixed(2)) : 0;
    const daysLeft = m && m.daysRemaining !== null ? m.daysRemaining : 'N/A';
    
    let status = 'Suficiente';
    if (currentStock <= 0) status = 'Agotado';
    else if (typeof daysLeft === 'number' && daysLeft <= 3) status = 'Por agotar (Crítico)';
    else if (currentStock <= minStock) status = 'Bajo stock';

    const monthlyBudget = m ? Math.round(m.monthlyBudget.expected) : 0;

    return [
      escapeCSV(p.name),
      escapeCSV(catName),
      escapeCSV(currentStock),
      escapeCSV(p.base_unit || 'un'),
      escapeCSV(minStock),
      escapeCSV(dailyRate),
      escapeCSV(daysLeft),
      escapeCSV(status),
      escapeCSV(monthlyBudget)
    ].join(';');
  });

  const csv = [headers.join(';'), ...rows].join('\r\n');
  const now = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `mercaconsumo_inventario_${now}.csv`);
}