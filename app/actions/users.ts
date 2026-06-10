'use server';

import { createServerClient } from '@/lib/supabase';

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Create a new Supabase Auth user with role stored in user_metadata.
// email_confirm: true skips the confirmation email (admin-created accounts).
// ---------------------------------------------------------------------------
export async function actionCreateUser(input: {
  email: string;
  password: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!input.email || !input.password || !input.name || !input.role) {
    return { ok: false, error: 'email, password, name and role are required' };
  }
  if (input.password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters' };
  }

  const db = createServerClient();

  const { data, error } = await db.auth.admin.createUser({
    email:         input.email,
    password:      input.password,
    email_confirm: true,
    user_metadata: {
      name:     input.name,
      role:     input.role,
      initials: input.initials,
      color:    input.color,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.user.id } };
}

// ---------------------------------------------------------------------------
// Update a Supabase Auth user's metadata (name, role, initials, color).
// Silently succeeds for legacy users that don't exist in Supabase Auth.
// ---------------------------------------------------------------------------
export async function actionUpdateUserMetadata(
  userId: string,
  metadata: { name?: string; role?: string; initials?: string; color?: string }
): Promise<ActionResult> {
  const db = createServerClient();
  const { error } = await db.auth.admin.updateUserById(userId, { user_metadata: metadata });

  if (error && !error.message.toLowerCase().includes('not found')) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Delete a Supabase Auth user.
// Silently succeeds for legacy seed users that have no Supabase Auth account.
// ---------------------------------------------------------------------------
export async function actionDeleteUser(userId: string): Promise<ActionResult> {
  const db = createServerClient();
  const { error } = await db.auth.admin.deleteUser(userId);

  if (error && !error.message.toLowerCase().includes('not found')) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}
