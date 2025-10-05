import { CurrencyCode } from '@prisma/client';
import { z } from 'zod';

function normalizeCode(value: string, ctx: z.RefinementCtx): string {
  const trimmed = value.trim();
  if (!trimmed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Code is required.' });
    return trimmed;
  }
  if (trimmed.length > 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Code must be 32 characters or fewer.',
    });
  }
  return trimmed.toUpperCase();
}

function normalizeDescription(value: string, ctx: z.RefinementCtx): string {
  const trimmed = value.trim();
  if (!trimmed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Description is required.' });
    return trimmed;
  }
  if (trimmed.length > 200) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Description must be 200 characters or fewer.',
    });
  }
  return trimmed;
}

function normalizeOptionalText(
  value: unknown,
  ctx: z.RefinementCtx,
  options: { max?: number; defaultNull?: boolean } = {},
): string | null | undefined {
  const { max = 80, defaultNull = false } = options;
  if (value === undefined) return defaultNull ? null : undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid text input.' });
    return defaultNull ? null : undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Value must be ${max} characters or fewer.`,
    });
  }
  return trimmed;
}

function normalizeOptionalCode(value: unknown, ctx: z.RefinementCtx): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid code input.' });
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Code must be 32 characters or fewer.',
    });
  }
  return trimmed.toUpperCase();
}

function normalizeOptionalDescription(value: unknown, ctx: z.RefinementCtx): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid description input.' });
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 200) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Description must be 200 characters or fewer.',
    });
  }
  return trimmed;
}

function normalizeOptionalId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeCurrencyValue(value: string, ctx: z.RefinementCtx): string {
  let normalized = value.trim();
  normalized = normalized.replace(/[$€\s]/g, '');
  normalized = normalized.replace(/^USD/i, '').replace(/USD$/i, '');
  normalized = normalized.replace(/^EUR/i, '').replace(/EUR$/i, '');
  normalized = normalized.replace(/'/g, '');
  if (!normalized) return normalized;

  const commaThousands = /^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$/.test(normalized);
  const dotThousands = /^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(normalized);
  if (commaThousands) {
    normalized = normalized.replace(/,/g, '');
  } else if (dotThousands) {
    normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
  } else if (/^\d+(?:,\d{1,2})?$/.test(normalized)) {
    normalized = normalized.replace(',', '.');
  } else if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Use numbers with up to 2 decimal places.',
    });
    return normalized;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid number.' });
    return normalized;
  }
  if (parsed < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Price cannot be negative.' });
  }
  return parsed.toFixed(2);
}

function normalizeCurrencyInput(
  value: unknown,
  ctx: z.RefinementCtx,
  options: { defaultNull?: boolean } = {},
): string | null | undefined {
  const { defaultNull = false } = options;
  if (value === undefined) return defaultNull ? null : undefined;
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid number.' });
      return undefined;
    }
    if (value < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Price cannot be negative.' });
    }
    return value.toFixed(2);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return normalizeCurrencyValue(trimmed, ctx);
  }
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid price input.' });
  return undefined;
}

const priceField = (options: { defaultNull?: boolean } = {}) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((value, ctx) => normalizeCurrencyInput(value, ctx, options));

const optionalTextField = (options: { max?: number; defaultNull?: boolean } = {}) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value, ctx) => normalizeOptionalText(value, ctx, options));

const codeField = z.string().transform((value, ctx) => normalizeCode(value, ctx));
const descriptionField = z.string().transform((value, ctx) => normalizeDescription(value, ctx));

const booleanField = (options: { defaultValue?: boolean } = {}) =>
  z
    .union([z.boolean(), z.string(), z.number(), z.null()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === null) {
        return options.defaultValue ?? true;
      }
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return options.defaultValue ?? true;
        if (['1', 'true', 'yes', 'y', 'active'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'n', 'inactive'].includes(normalized)) return false;
      }
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid boolean value.' });
      return options.defaultValue ?? true;
    });

export const treatmentCodeCreateSchema = z
  .object({
    code: codeField,
    description: descriptionField,
    category: optionalTextField({ max: 80, defaultNull: true }).default(null),
    priceUsd: priceField({ defaultNull: true }).default(null),
    priceEur: priceField({ defaultNull: true }).default(null),
    active: booleanField({ defaultValue: true }).default(true),
  })
  .transform((value) => ({
    ...value,
    category: value.category ?? null,
    priceUsd: value.priceUsd ?? null,
    priceEur: value.priceEur ?? null,
    active: value.active ?? true,
  }));

export const treatmentCodeUpdateSchema = z
  .object({
    code: codeField.optional(),
    description: descriptionField.optional(),
    category: optionalTextField({ max: 80, defaultNull: false }),
    priceUsd: priceField({ defaultNull: false }),
    priceEur: priceField({ defaultNull: false }),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!Object.values(data).some((value) => value !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update.',
      });
    }
  });

export const treatmentCodeCsvRowSchema = z
  .object({
    code: codeField,
    description: descriptionField,
    category: optionalTextField({ max: 80, defaultNull: true }).default(null),
    priceUsd: priceField({ defaultNull: true }).default(null),
    priceEur: priceField({ defaultNull: true }).default(null),
    active: booleanField({ defaultValue: true }).default(true),
  })
  .transform((value) => ({
    ...value,
    category: value.category ?? null,
    priceUsd: value.priceUsd ?? null,
    priceEur: value.priceEur ?? null,
    active: value.active ?? true,
  }));

export type TreatmentCodeCreateInput = z.infer<typeof treatmentCodeCreateSchema>;
export type TreatmentCodeUpdateInput = z.infer<typeof treatmentCodeUpdateSchema>;
export type TreatmentCodeCsvRow = z.infer<typeof treatmentCodeCsvRowSchema>;

const nameField = z.string().transform((value, ctx) => {
  const trimmed = value.trim();
  if (!trimmed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Name is required.' });
    return trimmed;
  }
  if (trimmed.length > 80) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Name must be 80 characters or fewer.',
    });
  }
  return trimmed;
});

export const priceListCreateSchema = z
  .object({
    name: nameField,
    description: optionalTextField({ max: 200, defaultNull: true }).default(null),
    isDefault: z.boolean().optional().default(false),
    active: z.boolean().optional().default(true),
  })
  .transform((value) => ({
    ...value,
    description: value.description ?? null,
    isDefault: value.isDefault ?? false,
    active: value.active ?? true,
  }));

export const priceListUpdateSchema = z
  .object({
    name: nameField.optional(),
    description: optionalTextField({ max: 200, defaultNull: false }),
    isDefault: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!Object.values(data).some((value) => value !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update.',
      });
    }
  });

export const priceListEntryUpsertSchema = z
  .object({
    treatmentCodeId: z.string().min(1, 'Treatment code is required.'),
    priceUsd: priceField({ defaultNull: false }),
    priceEur: priceField({ defaultNull: false }),
  })
  .superRefine((data, ctx) => {
    const hasUsd = data.priceUsd !== undefined && data.priceUsd !== null;
    const hasEur = data.priceEur !== undefined && data.priceEur !== null;
    if (!hasUsd && !hasEur) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one price (USD or EUR).',
        path: ['priceUsd'],
      });
    }
  });

export const patientPriceOverrideUpsertSchema = z
  .object({
    treatmentCodeId: z.string().min(1, 'Treatment code is required.'),
    priceUsd: priceField({ defaultNull: false }),
    priceEur: priceField({ defaultNull: false }),
    notes: optionalTextField({ max: 200, defaultNull: true }).default(null),
  })
  .superRefine((data, ctx) => {
    const hasUsd = data.priceUsd !== undefined && data.priceUsd !== null;
    const hasEur = data.priceEur !== undefined && data.priceEur !== null;
    if (!hasUsd && !hasEur) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one price (USD or EUR).',
        path: ['priceUsd'],
      });
    }
  })
  .transform((data) => ({
    ...data,
    notes: data.notes ?? null,
  }));

export const assignPatientPriceListSchema = z.object({
  priceListId: z
    .union([z.string().min(1), z.null(), z.literal('')])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (value === '' || value === null) return null;
      return value;
    }),
});

export type PriceListCreateInput = z.infer<typeof priceListCreateSchema>;
export type PriceListUpdateInput = z.infer<typeof priceListUpdateSchema>;
export type PriceListEntryUpsertInput = z.infer<typeof priceListEntryUpsertSchema>;
export type PatientPriceOverrideUpsertInput = z.infer<typeof patientPriceOverrideUpsertSchema>;
export type AssignPatientPriceListInput = z.infer<typeof assignPatientPriceListSchema>;

const dueDateField = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid date value.',
        });
        return null;
      }
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date value.' });
      return null;
    }
    return parsed;
  });

export const invoiceDraftCreateSchema = z.object({
  patientId: z.string().min(1, 'Patient is required.'),
  currency: z.nativeEnum(CurrencyCode).optional(),
  dueDate: dueDateField,
  csrf: z.string().optional(),
});

export type InvoiceDraftCreatePayload = z.infer<typeof invoiceDraftCreateSchema>;

const quantityField = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return 1;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Quantity must be greater than 0.' });
      return 1;
    }
    return Math.min(num, 9999);
  });

const decimalNumberField = (options: { min?: number; max?: number } = {}) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      if (typeof value === 'string' && value.trim() === '') {
        return undefined;
      }
      const num = Number(value);
      if (!Number.isFinite(num)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid number.' });
        return undefined;
      }
      if (options.min !== undefined && num < options.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Value must be at least ${options.min}.`,
        });
      }
      if (options.max !== undefined && num > options.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Value must not exceed ${options.max}.`,
        });
      }
      return num;
    });

const lineNotesField = optionalTextField({ max: 200, defaultNull: true }).transform(
  (value) => value ?? null,
);

const invoiceLineCodeField = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => normalizeOptionalCode(value, ctx));

const invoiceLineDescriptionField = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => normalizeOptionalDescription(value, ctx));

const treatmentCodeField = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => normalizeOptionalId(value));

const providerIdField = z
  .string()
  .min(1, 'Select a provider.')
  .transform((value) => value.trim());

const optionalProviderIdField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === undefined || value === null) return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  });

export const invoiceLineCreateSchema = z
  .object({
    treatmentCodeId: treatmentCodeField,
    code: invoiceLineCodeField,
    description: invoiceLineDescriptionField,
    providerStaffId: providerIdField,
    quantity: quantityField,
    unitPrice: decimalNumberField({ min: 0 }),
    discountAmount: decimalNumberField({ min: 0 }).default(0),
    currency: z.nativeEnum(CurrencyCode).optional(),
    notes: lineNotesField,
    csrf: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.treatmentCodeId) {
      if (!data.code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide a code when no treatment is selected.',
          path: ['code'],
        });
      }
      if (!data.description) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide a description when no treatment is selected.',
          path: ['description'],
        });
      }
    }
  });

export const invoiceLineUpdateSchema = z
  .object({
    quantity: quantityField,
    unitPrice: decimalNumberField({ min: 0 }),
    discountAmount: decimalNumberField({ min: 0 }).optional(),
    notes: lineNotesField,
    providerStaffId: optionalProviderIdField,
    csrf: z.string().optional(),
  })
  .refine(
    (data) =>
      data.quantity !== undefined ||
      data.unitPrice !== undefined ||
      data.discountAmount !== undefined ||
      data.notes !== undefined ||
      data.providerStaffId !== undefined,
    {
      message: 'Provide a value to update.',
      path: ['quantity'],
    },
  );

export const invoiceRoundingUpdateSchema = z
  .object({
    mode: z.enum(['manual', 'nearest']).default('manual'),
    roundingDelta: decimalNumberField().optional(),
    roundTo: decimalNumberField({ min: 0.01 }).optional(),
    reason: optionalTextField({ max: 200, defaultNull: true }).transform((value) => value ?? null),
    csrf: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'manual') {
      if (data.roundingDelta === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Provide a rounding adjustment amount.',
          path: ['roundingDelta'],
        });
      }
    } else if (data.roundTo === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide the increment to round to.',
        path: ['roundTo'],
      });
    }
  });

const paymentAmountField = decimalNumberField({ min: 0.01 }).pipe(
  z.number({ message: 'Provide a payment amount.' }),
);

const paymentReferenceField = optionalTextField({ max: 80, defaultNull: true }).transform(
  (value) => value ?? null,
);

const paymentNotesField = optionalTextField({ max: 200, defaultNull: true }).transform(
  (value) => value ?? null,
);

const paymentDueField = dueDateField.transform((value) => value ?? null);

export const invoicePaymentItemSchema = z.object({
  paymentMethodId: z.string().min(1, 'Select a payment method.'),
  amount: paymentAmountField,
  reference: paymentReferenceField,
  notes: paymentNotesField,
  dueAt: paymentDueField.optional(),
});

export const invoicePaymentBatchSchema = z.object({
  csrf: z.string().optional(),
  payments: z.array(invoicePaymentItemSchema).min(1, 'Provide at least one payment.'),
});

export type InvoiceLineCreatePayload = z.infer<typeof invoiceLineCreateSchema>;
export type InvoiceLineUpdatePayload = z.infer<typeof invoiceLineUpdateSchema>;
export type InvoiceRoundingUpdatePayload = z.infer<typeof invoiceRoundingUpdateSchema>;
export type InvoicePaymentItemPayload = z.infer<typeof invoicePaymentItemSchema>;
export type InvoicePaymentBatchPayload = z.infer<typeof invoicePaymentBatchSchema>;

export const priceListEntryCsvRowSchema = z
  .object({
    code: codeField,
    priceUsd: priceField({ defaultNull: true }).default(null),
    priceEur: priceField({ defaultNull: true }).default(null),
  })
  .transform((value) => ({
    ...value,
    priceUsd: value.priceUsd ?? null,
    priceEur: value.priceEur ?? null,
  }));

export type PriceListEntryCsvRow = z.infer<typeof priceListEntryCsvRowSchema>;
