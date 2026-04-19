import { z } from 'zod';
import pino from 'pino';

export const log = pino({ level: 'info' });

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  MONGO_URI: z.string().default('mongodb://localhost:27017/pokemon_stadium'),
  POKEMON_API_BASE_URL: z
    .string()
    .url()
    .default('https://pokemon-api-92034153384.us-central1.run.app'),
  CORS_ORIGIN: z.string().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    log.error({ err: parsed.error.format() }, 'Invalid environment variables');
    process.exit(1);
  }
  return parsed.data;
}
