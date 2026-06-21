import { createClient, type User } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const OLD_REGION = 'Hiiraan State';
const NEW_REGION = 'Hiiran Region';
const PAGE_SIZE = 100;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function replaceAssignedRegion(metadata: Record<string, unknown> | undefined) {
  if (!metadata || metadata.assignedRegion !== OLD_REGION) {
    return { metadata, changed: false };
  }

  return {
    metadata: { ...metadata, assignedRegion: NEW_REGION },
    changed: true,
  };
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    throw new Error('Refusing to update Supabase Auth metadata without --confirm.');
  }

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let page = 1;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;

    const users: User[] = data.users;
    if (users.length === 0) break;

    for (const user of users) {
      scanned += 1;
      const app = replaceAssignedRegion(user.app_metadata);
      const profile = replaceAssignedRegion(user.user_metadata);

      if (!app.changed && !profile.changed) continue;

      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        app_metadata: app.metadata,
        user_metadata: profile.metadata,
      });
      if (updateError) throw updateError;

      updated += 1;
      console.log(`Updated region metadata for ${user.email ?? user.id}`);
    }

    if (users.length < PAGE_SIZE) break;
    page += 1;
  }

  console.log(`Scanned ${scanned} auth users; updated ${updated}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
