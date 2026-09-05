// Algoritmo difuso de similitud y clasificador inteligente de categorías
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9\s]/g, ' ')     // Quitar caracteres especiales
    .replace(/\s+/g, ' ')             // Espacios únicos
    .trim();
}

function levenshteinDistance(s1, s2) {
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function stringSimilarity(str1, str2) {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);
  if (!norm1 || !norm2) return 0.0;
  if (norm1 === norm2) return 1.0;

  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    return 0.8 + (minLen / maxLen) * 0.2;
  }

  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  return Math.max(0, 1 - distance / maxLength);
}

export function findBestProductMatch(rawName, existingProducts) {
  if (!rawName || !existingProducts || existingProducts.length === 0) return null;
  let bestMatch = null;
  let highestScore = 0;

  for (const product of existingProducts) {
    const score = stringSimilarity(rawName, product.name);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = product;
    }
  }

  if (highestScore >= 0.50) {
    return {
      product: bestMatch,
      similarity: highestScore,
      isExact: highestScore > 0.90
    };
  }
  return null;
}

export function findBestStoreMatch(rawMerchant, existingStores) {
  if (!rawMerchant || !existingStores || existingStores.length === 0) return null;
  let bestMatch = null;
  let highestScore = 0;

  for (const store of existingStores) {
    const score = stringSimilarity(rawMerchant, store.name);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = store;
    }
  }

  if (highestScore >= 0.45) {
    return {
      store: bestMatch,
      similarity: highestScore,
      isExact: highestScore > 0.90
    };
  }
  return null;
}

// ── Taxonomía de Supermercado para Auto-Clasificación Inteligente ─────────────
const CATEGORY_KEYWORDS = {
  'Lácteos y Huevos': [
    'leche', 'queso', 'yogur', 'yogurt', 'mantequilla', 'crema de leche', 'huevo', 'huevos',
    'kumis', 'cuajada', 'suero', 'parmesano', 'mozzarella', 'quesito', 'arequipe',
    'condensada', 'leche en polvo', 'lacteo', 'lacteos', 'kefir', 'ghee'
  ],
  'Frutas y Verduras': [
    'platano', 'platanos', 'banano', 'bananos', 'manzana', 'manzanas', 'pera', 'peras',
    'tomate', 'tomates', 'cebolla', 'cebollas', 'papa', 'papas', 'limon', 'limones',
    'aguacate', 'aguacates', 'zanahoria', 'zanahorias', 'lechuga', 'fresa', 'fresas',
    'naranja', 'naranjas', 'mango', 'mangos', 'cilantro', 'pimenton', 'ahuyama',
    'guayaba', 'papaya', 'melon', 'sandia', 'uva', 'uvas', 'durazno', 'espinaca',
    'apio', 'pepino', 'brocoli', 'coliflor', 'champinon', 'champiñon', 'champiñones',
    'ajo', 'yuca', 'moras', 'mora', 'arandano', 'arandanos', 'maracuya', 'lulo',
    'hierbabuena', 'perejil', 'albahaca', 'remolacha', 'calabacin', 'choclo', 'mazorca'
  ],
  'Carnes y Proteínas': [
    'pollo', 'pechuga', 'pechugas', 'pernil', 'alas', 'muslo', 'carne', 'res', 'cerdo',
    'pescado', 'salmon', 'atun', 'trucha', 'tilapia', 'lomo', 'tocino', 'costilla',
    'costillas', 'jamon', 'salchicha', 'salchichas', 'chorizo', 'chorizos', 'molida',
    'albondiga', 'milanesa', 'chuleta', 'chicharron', 'tocineta', 'butifarra', 'mortadela',
    'bife', 'churrasco', 'filete', 'morcilla', 'longaniza', 'pavo', 'camaron', 'mariscos'
  ],
  'Granos y Cereales': [
    'arroz', 'frijol', 'frijoles', 'lenteja', 'lentejas', 'garbanzo', 'garbanzos',
    'avena', 'pasta', 'pastas', 'espagueti', 'espaguetis', 'macarron', 'macarrones',
    'fideo', 'fideos', 'harina', 'harina pan', 'harina de trigo', 'harina trigo',
    'cereal', 'cereales', 'maiz', 'quinoa', 'granola', 'trigo', 'cebada', 'chickpeas',
    'maicena', 'semola', 'cuscus', 'pan', 'tostadas'
  ],
  'Aseo del Hogar': [
    'jabon', 'detergente', 'clorox', 'limpido', 'hipoclorito', 'suavizante', 'fabuloso',
    'esponja', 'esponjilla', 'papel higienico', 'servilleta', 'servilletas',
    'toalla de cocina', 'lavaloza', 'axion', 'blancox', 'desinfectante', 'trapero',
    'escoba', 'ambientador', 'bolsa de basura', 'bolsas', 'guantes', 'blanqueador',
    'limpiador', 'lustramuebles', 'insecticida', 'bayetilla'
  ],
  'Cuidado Personal': [
    'champu', 'shampoo', 'acondicionador', 'jabon de bano', 'jabon de tocador',
    'desodorante', 'crema dental', 'colgate', 'cepillo', 'bloqueador', 'protector solar',
    'toallas higienicas', 'tampones', 'protector diario', 'afeitadora', 'gillette',
    'gel', 'crema corporal', 'locion', 'talco', 'enjuague bucal', 'hilo dental',
    'isopos', 'copitos', 'algodon', 'panal', 'pañales', 'panales'
  ],
  'Bebidas y Snacks': [
    'gaseosa', 'coca cola', 'pepsi', 'postobon', 'jugo', 'jugos', 'hit', 'tampico',
    'agua', 'cristal', 'brisa', 'cerveza', 'poker', 'club colombia', 'aguila', 'vino',
    'papas fritas', 'doritos', 'cheetos', 'galleta', 'galletas', 'ducales', 'festival',
    'chocolatina', 'jet', 'mani', 'snack', 'snacks', 'tostacos', 'natuchips',
    'refresco', 'soda', 'te', 'energizante', 'monster', 'red bull'
  ],
  'Despensa y Condimentos': [
    'aceite', 'aceite de oliva', 'sal', 'azucar', 'panela', 'cafe', 'cafe molido',
    'cafe soluble', 'salsa de tomate', 'salsa', 'mayonesa', 'mostaza', 'vinagre',
    'especias', 'pimienta', 'caldo', 'maggi', 'dona gallina', 'color', 'comino',
    'achiote', 'oregano', 'canela', 'levadura', 'polvo para hornear', 'miel',
    'mermelada', 'sirope', 'aderezo', 'bicarbonato', 'vainilla', 'soya', 'shoyu'
  ]
};

export function guessCategory(productName, categories = []) {
  if (!productName) return null;
  const norm = normalizeText(productName);

  // 1. Buscar coincidencias por palabras clave en nuestra taxonomía
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      const normKw = normalizeText(kw);
      // Coincidencia de palabra completa o inclusión
      const regex = new RegExp(`\\b${normKw}\\b`, 'i');
      if (regex.test(norm) || norm.includes(normKw)) {
        // Buscar el objeto categoría correspondiente en las categorías del usuario
        const matchedCategory = categories.find(c =>
          normalizeText(c.name) === normalizeText(catName) ||
          stringSimilarity(c.name, catName) > 0.70
        );
        if (matchedCategory) return matchedCategory;
      }
    }
  }

  // 2. Si no encontró por palabra clave, buscar similitud directa con nombres de categorías
  let bestCat = null;
  let highestSim = 0;
  for (const cat of categories) {
    const sim = stringSimilarity(norm, cat.name);
    if (sim > highestSim && sim >= 0.5) {
      highestSim = sim;
      bestCat = cat;
    }
  }

  return bestCat;
}
