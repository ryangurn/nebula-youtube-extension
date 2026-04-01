const TRAILING_TITLE_SEPARATORS = [" | ", " - ", " — ", " – ", " :: ", " • "];
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "to",
  "for",
  "in",
  "on",
  "with",
  "by"
]);

function stripDiacritics(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function simplifyWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function trimDecorativeSegments(value) {
  let nextValue = value;

  nextValue = nextValue.replace(/\[[^\]]+\]/g, " ");
  nextValue = nextValue.replace(/\([^)]+\)$/g, " ");

  for (const separator of TRAILING_TITLE_SEPARATORS) {
    const index = nextValue.indexOf(separator);

    if (index > 14) {
      nextValue = nextValue.slice(0, index);
      break;
    }
  }

  return simplifyWhitespace(nextValue);
}

export function normalizeTitle(value) {
  if (!value) {
    return "";
  }

  const cleaned = trimDecorativeSegments(stripDiacritics(String(value)).toLowerCase());

  return simplifyWhitespace(
    cleaned
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
  );
}

export function normalizeName(value) {
  return normalizeTitle(value);
}

export function tokenize(value) {
  return normalizeTitle(value)
    .split(" ")
    .filter(Boolean);
}

export function importantTokens(value) {
  return tokenize(value).filter((token) => !STOP_WORDS.has(token));
}

export function bigrams(value) {
  const normalized = normalizeTitle(value).replace(/\s+/g, "");

  if (!normalized) {
    return [];
  }

  if (normalized.length < 2) {
    return [normalized];
  }

  const output = [];

  for (let index = 0; index < normalized.length - 1; index += 1) {
    output.push(normalized.slice(index, index + 2));
  }

  return output;
}
