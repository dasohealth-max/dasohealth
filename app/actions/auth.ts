'use server';

import { createServerClient, createBrowserClient } from '@/lib/supabase';

export async function actionRequestPasswordReset(
  email: string,
  redirectUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!email) return { ok: false, error: 'Email is required.' };

  // Verify the email belongs to a Super Administrator before sending anything
  const adminDb = createServerClient();
  const { data, error } = await adminDb.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { ok: false, error: 'Unable to process request.' };

  const match = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!match) {
    // Silent success — don't reveal whether the email exists in the system
    return { ok: true };
  }

  const role =
    (match.app_metadata?.role as string) ||
    (match.user_metadata?.role as string) ||
    '';

  if (role !== 'Super Administrator') {
    return {
      ok: false,
      error:
        'Password reset is only available for Super Administrator accounts. Contact your administrator to reset your password.',
    };
  }

  // Send reset link — redirectTo must be in Supabase Dashboard → Auth → URL Configuration → Redirect URLs
  const anonDb = createBrowserClient();
  const { error: resetError } = await anonDb.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (resetError) return { ok: false, error: resetError.message };
  return { ok: true };
}
