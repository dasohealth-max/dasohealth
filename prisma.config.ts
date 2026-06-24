import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '.env.local' });

// Keep Prisma CLI SSL behavior aligned with lib/prisma.ts.
// Supabase pooler certificates can fail local chain verification unless strict
// verification is explicitly enabled for the environment.
const sslMode = process.env['DATABASE_SSL_REJECT_UNAUTHORIZED'] === 'true' ? 'require' : 'no-verify';
const migrationUrl = process.env['DIRECT_URL']
  ? `${process.env['DIRECT_URL']}${process.env['DIRECT_URL']!.includes('?') ? '&' : '?'}sslmode=${sslMode}`
  : undefined;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: migrationUrl,
  },
});
