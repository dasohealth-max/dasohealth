'use server';

import { createServerClient, createBrowserClient } from '@/lib/supabase';

export async function actionRequestPasswordReset(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  if (!email) return { ok: false, error: 'Email is required.' };

  const adminDb = createServerClient();
  const { data, error } = await adminDb.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { ok: false, error: 'Unable to process request.' };

  const match = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!match) {
    // Don't reveal whether the email exists — return ok so enumeration isn't possible.
    // The user will wait for an OTP that never arrives.
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

  const anonDb = createBrowserClient();
  const { error: otpError } = await anonDb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (otpError) return { ok: false, error: otpError.message };
  return { ok: true };
}
