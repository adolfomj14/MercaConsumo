// Lector Inteligente de Facturas con IA Gemini (Auto-Descubrimiento Dinámico de Modelos)
import { getGeminiApiKey } from '../config.js';

function optimizeImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Descubre dinámicamente qué modelos soporta la clave del usuario
async function getAvailableGeminiModels(apiKey) {
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (resp.ok) {
      const data = await resp.json();
      const valid = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name); // e.g. "models/gemini-2.0-flash", "models/gemini-1.5-flash"
      
      if (valid.length > 0) {
        // Priorizar modelos flash
        valid.sort((a, b) => {
          if (a.includes('flash') && !b.includes('flash')) return -1;
          if (!a.includes('flash') && b.includes('flash')) return 1;
          if (a.includes('2.0') && !b.includes('2.0')) return -1;
          return 0;
        });
        return valid;
      }
    }
  } catch (e) {
    console.warn('Error descubriendo modelos:', e);
  }

  // Lista de fallback si la llamada listModels falla
  return [
    'models/gemini-2.0-flash',
    'models/gemini-1.5-flash',
    'models/gemini-1.5-flash-latest',
    'models/gemini-1.5-flash-8b',
    'models/gemini-2.5-flash'
  ];
}

export async function testGeminiApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) return { success: false, message: 'La clave no puede estar vacía' };
  
  const key = apiKey.trim();
  const models = await getAvailableGeminiModels(key);

  if (models.length > 0) {
    return { success: true, count: models.length };
  }

  return { success: false, message: 'No se encontraron modelos habilitados para esta API Key.' };
}

export async function parseReceiptWithAI(file, customApiKey = null) {
  const apiKey = (customApiKey || getGeminiApiKey()).trim();

  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const { base64, mimeType } = await optimizeImage(file);
  const today = new Date().toISOString().split('T')[0];

  const promptText = `Analiza detalladamente esta imagen de factura o recibo de compra.
Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta, sin texto adicional:
{
  "merchant": "Nombre del supermercado o comercio",
  "date": "YYYY-MM-DD (fecha del recibo, si no es clara usa ${today})",
  "paymentMethod": "Efectivo / Tarjeta Débito / Tarjeta Crédito / Nequi / etc.",
  "total": 0.0,
  "items": [
    {
      "name": "Nombre limpio del producto (expande abreviaturas, ej: 'Plátano Maduro' en vez de 'PLTN MAD')",
      "quantity": 1.0,
      "unit": "kg / g / unidad / L / ml / paquete / bolsa / caja / lb",
      "unitPrice": 0.0,
      "totalPrice": 0.0
    }
  ]
}
Reglas:
1. Extrae únicamente productos reales comprados.
2. Los precios deben ser números sin símbolos de moneda ni separadores de miles.
3. Si un producto se vendió por peso (kg o g), asigna esa unidad. Si fue por piezas/unidades, usa 'unidad'.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  // 1. Obtener los modelos activos en la cuenta del usuario
  const availableModels = await getAvailableGeminiModels(apiKey);
  let lastError = null;

  for (const modelName of availableModels) {
    // modelName ya viene con el prefijo "models/...", ej: "models/gemini-2.0-flash"
    const cleanModel = modelName.replace(/^models\//, '');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

    try {
      console.log(`[IA OCR] Intentando con modelo: ${cleanModel}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const detailedMsg = errData.error?.message || `HTTP ${response.status}`;
        throw new Error(detailedMsg);
      }

      const result = await response.json();
      let rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('La IA no devolvió respuesta.');
      }

      rawText = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      const parsed = JSON.parse(rawText);

      return {
        merchant: parsed.merchant || 'Supermercado',
        date: parsed.date || today,
        paymentMethod: parsed.paymentMethod || 'Efectivo',
        total: Number(parsed.total) || 0,
        items: (parsed.items || []).map(it => ({
          rawName: it.name || 'Producto',
          name: it.name || 'Producto',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || 'unidad',
          unitPrice: Number(it.unitPrice) || (Number(it.totalPrice) / (Number(it.quantity) || 1)),
          totalPrice: Number(it.totalPrice) || 0
        }))
      };
    } catch (err) {
      lastError = err;
      console.warn(`Fallo con ${cleanModel}:`, err.message);
    }
  }

  throw lastError || new Error('No se pudo procesar la factura con los modelos de Gemini disponibles.');
}
