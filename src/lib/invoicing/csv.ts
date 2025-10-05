import type { TreatmentCodeCsvRow } from './validation';
import { treatmentCodeCsvRowSchema } from './validation';

export type ParsedTreatmentCsv = {
  entries: Array<{ line: number; data: TreatmentCodeCsvRow }>;
  errors: Array<{ line: number; message: string }>; // includes header-level errors with line 1
};

function canonicalHeader(
  name: string,
): 'code' | 'description' | 'category' | 'priceUsd' | 'priceEur' | 'active' | null {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'code':
      return 'code';
    case 'description':
    case 'desc':
      return 'description';
    case 'category':
    case 'group':
      return 'category';
    case 'price_usd':
    case 'usd':
    case 'amount_usd':
      return 'priceUsd';
    case 'price_eur':
    case 'eur':
    case 'amount_eur':
      return 'priceEur';
    case 'active':
    case 'enabled':
    case 'is_active':
      return 'active';
    default:
      return null;
  }
}

function detectDelimiter(text: string): ',' | ';' {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const commaCount = (trimmed.match(/,/g) || []).length;
    const semicolonCount = (trimmed.match(/;/g) || []).length;
    if (semicolonCount > commaCount) return ';';
    if (commaCount > semicolonCount) return ',';
  }
  return ',';
}

function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    current.push(field);
    field = '';
  };

  const pushRow = () => {
    // Ignore trailing empty row when no data has been added
    if (current.length === 1 && current[0] === '') {
      current = [];
      return;
    }
    rows.push(current);
    current = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    switch (char) {
      case '"':
        inQuotes = true;
        break;
      case ',':
        if (delimiter === ',') {
          pushField();
          break;
        }
        field += char;
        break;
      case ';':
        if (delimiter === ';') {
          pushField();
          break;
        }
        field += char;
        break;
      case '\n':
        pushField();
        pushRow();
        break;
      case '\r':
        pushField();
        if (text[i + 1] === '\n') i++;
        pushRow();
        break;
      default:
        field += char;
    }
  }

  // Push final field/row
  pushField();
  if (current.length) {
    pushRow();
  }

  return rows;
}

export function parseTreatmentCodeCsv(text: string): ParsedTreatmentCsv {
  const rows = parseCsv(text);
  const errors: ParsedTreatmentCsv['errors'] = [];

  // Remove leading empty rows
  while (rows.length && rows[0].every((value) => value.trim() === '')) {
    rows.shift();
  }

  if (!rows.length) {
    errors.push({ line: 1, message: 'The CSV file is empty.' });
    return { entries: [], errors };
  }

  const header = rows.shift()!;
  const headerMap = new Map<ReturnType<typeof canonicalHeader>, number>();

  header.forEach((value, index) => {
    const key = canonicalHeader(value);
    if (!key) return;
    if (!headerMap.has(key)) {
      headerMap.set(key, index);
    }
  });

  if (!headerMap.has('code') || !headerMap.has('description')) {
    errors.push({
      line: 1,
      message: 'Header must include at least "code" and "description" columns.',
    });
    return { entries: [], errors };
  }

  const entries: ParsedTreatmentCsv['entries'] = [];

  rows.forEach((row, rowIndex) => {
    const lineNumber = rowIndex + 2; // account for header line
    const raw = {
      code: headerMap.has('code') ? (row[headerMap.get('code')!] ?? '') : '',
      description: headerMap.has('description') ? (row[headerMap.get('description')!] ?? '') : '',
      category: headerMap.has('category') ? (row[headerMap.get('category')!] ?? '') : undefined,
      priceUsd: headerMap.has('priceUsd') ? (row[headerMap.get('priceUsd')!] ?? '') : undefined,
      priceEur: headerMap.has('priceEur') ? (row[headerMap.get('priceEur')!] ?? '') : undefined,
      active: headerMap.has('active') ? (row[headerMap.get('active')!] ?? '') : undefined,
    };

    const allEmpty = Object.values(raw).every((value) => (value ?? '').trim() === '');
    if (allEmpty) {
      return; // skip blank lines silently
    }

    const parsed = treatmentCodeCsvRowSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.errors
        .map((issue) => issue.message || 'Invalid value')
        .join('; ');
      errors.push({ line: lineNumber, message });
      return;
    }

    entries.push({ line: lineNumber, data: parsed.data });
  });

  return { entries, errors };
}
