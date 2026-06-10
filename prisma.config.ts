import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '.env.local' });

// Supabase requires SSL and the session pooler (port 6543) for external connections.
// We append sslmode=require so Prisma CLI can complete the TLS handshake.
const migrationUrl = process.env['DIRECT_URL']
  ? `${process.env['DIRECT_URL']}${process.env['DIRECT_URL']!.includes('?') ? '&' : '?'}sslmode=require`
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
