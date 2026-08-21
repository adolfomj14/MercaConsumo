// OCR Real con Tesseract.js (sin servidor, corre en el navegador)

// Carga Tesseract.js dinámicamente si no está disponible
async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error('No se pudo cargar Tesseract.js'));
    document.head.appendChild(s);
  });
}

// Convierte File a base64 data URL
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Extrae líneas relevantes de una factura colombiana / latinoamericana
function parseReceiptText(rawText) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2);

  // Patrones de precio colombiano: 12.000  12,000  $12000  12000
  const pricePattern = /\$?\s*(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d{2})?(?:\s|$)/g;

  // Palabras a ignorar (encabezados y pies de factura)
  const SKIP_WORDS = [
    'total','subtotal','iva','rte','descuento','descto','efectivo','cambio',
    'gracias','visita','nit','tel','caja','cajero','pos','ticket','factura',
    'fecha','hora','cliente','vendedor','item','cod','ref','cant','precio',
    'valor','unitario','sucursal','tienda','mercado','supermercado','nro',
    'transaccion','recibo','vale','pagado','entregado','pendiente','saldo',
    'base','gravable','retencion','bolsa','domicilio','servicio','propina',
    'numero','autorizacion','terminal','tarjeta','debito','credito','visa',
    'master','cuota','comprobante','remision','pedido'
  ];

  const items = [];
  const today = new Date().toISOString().split('T')[0];
  let detectedMerchant = '';
  let detectedDate = today;
  let detectedTotal = 0;

  // Intentar detectar la fecha en el texto (DD/MM/YYYY o YYYY-MM-DD)
  const dateMatch = rawText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const year = y.length === 2 ? '20' + y : y;
    detectedDate = `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // Intentar detectar el nombre del comercio (primeras 3 líneas con texto largo)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (line.length > 4 && !/\d{4,}/.test(line) && !SKIP_WORDS.some(w => line.toLowerCase().includes(w))) {
      detectedMerchant = line;
      break;
    }
  }

  // Procesar líneas buscando productos
  for (const line of lines) {
    const lower = line.toLowerCase();

    // Saltar líneas que sean claramente encabezados/pie de página
    if (SKIP_WORDS.some(w => {
      const words = lower.split(/\s+/);
      return words.length <= 3 && words.some(word => word === w);
    })) continue;

    // Buscar todos los números en la línea
    const numbers = [];
    let m;
    const numRe = /[\$]?\s*(\d{1,3}(?:[.,]\d{3})+|\d{2,})/g;
    while ((m = numRe.exec(line)) !== null) {
      const raw = m[1].replace(/\./g, '').replace(',', '.');
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) numbers.push(val);
    }

    // Necesitamos al menos un número (precio) y texto antes de él
    if (numbers.length === 0) continue;

    // El texto del producto es la parte sin números
    const productText = line
      .replace(/[\$]?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (productText.length < 3) continue;
    if (SKIP_WORDS.some(w => productText.toLowerCase() === w)) continue;

    // Detectar si es la línea del total
    if (/total/i.test(line) && numbers.length > 0) {
      detectedTotal = Math.max(...numbers);
      continue;
    }

    // Detectar cantidad y precio
    let quantity = 1;
    let unitPrice = 0;
    let totalPrice = 0;

    if (numbers.length === 1) {
      totalPrice = numbers[0];
      unitPrice = numbers[0];
    } else if (numbers.length === 2) {
      // Asumir: primer número = cantidad o precio unitario, segundo = total
      if (numbers[0] < 100 && numbers[1] > numbers[0]) {
        quantity = numbers[0];
        totalPrice = numbers[1];
        unitPrice = quantity > 0 ? totalPrice / quantity : totalPrice;
      } else {
        unitPrice = numbers[0];
        totalPrice = numbers[1];
        quantity = 1;
      }
    } else if (numbers.length >= 3) {
      quantity = numbers[0] < 100 ? numbers[0] : 1;
      unitPrice = numbers[numbers.length - 2];
      totalPrice = numbers[numbers.length - 1];
    }

    // Filtrar precios irreales (menos de $50 o más de $5.000.000)
    if (totalPrice < 50 || totalPrice > 5_000_000) continue;

    // Detectar unidad en el nombre del producto
    let unit = 'unidad';
    const unitMatch = productText.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|l|lb|oz)\b/i);
    if (unitMatch) {
      unit = unitMatch[2].toLowerCase();
      if (unit === 'gr') unit = 'g';
    }

    items.push({
      rawName: productText.toUpperCase(),
      quantity: Math.round(quantity * 100) / 100,
      unit,
      unitPrice: Math.round(unitPrice),
      totalPrice: Math.round(totalPrice)
    });
  }

  // Si no se detectó total, sumar los ítems
  if (detectedTotal === 0 && items.length > 0) {
    detectedTotal = items.reduce((s, it) => s + it.totalPrice, 0);
  }

  return {
    merchant: detectedMerchant || 'Establecimiento',
    date: detectedDate,
    confidence: items.length > 0 ? 0.75 : 0.2,
    items,
    total: detectedTotal,
    rawText
  };
}

// Función principal: recibe un File de imagen, devuelve los datos estructurados
export async function parseReceiptImage(file, onProgress = null) {
  const Tesseract = await loadTesseract();
  const dataURL = await fileToDataURL(file);

  const result = await Tesseract.recognize(dataURL, 'spa', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  const rawText = result.data.text;
  console.log('[OCR] Texto extraído:\n', rawText);

  const parsed = parseReceiptText(rawText);
  return parsed;
}
