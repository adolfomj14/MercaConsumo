// Algoritmo difuso de similitud para normalización no destructiva
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
  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // Si uno contiene al otro completamente
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

  // Sugerir solo si la similitud supera el 60%
  if (highestScore >= 0.60) {
    return {
      product: bestMatch,
      similarity: highestScore,
      isExact: highestScore > 0.95
    };
  }
  return null;
}
