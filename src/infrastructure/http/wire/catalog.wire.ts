import { z } from 'zod';

/**
 * Wire schemas for the external Pokemon Catalog API.
 * These define the expected shape of HTTP responses from the catalog service.
 * Validation happens at the infrastructure layer — domain never sees unvalidated wire data.
 */

const ListWireItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  sprite: z.string().optional(),
});

const DetailWireItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  type: z.array(z.string()).default([]),
  hp: z.number().nonnegative(),
  attack: z.number().nonnegative(),
  defense: z.number().nonnegative(),
  speed: z.number().nonnegative(),
  sprite: z.string(),
});

const EnvelopeSchema = <T>(dataSchema: z.ZodSchema<T>) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
  });

export const WireSchemas = {
  ListWireItem: ListWireItemSchema,
  DetailWireItem: DetailWireItemSchema,
  Envelope: EnvelopeSchema,
};
