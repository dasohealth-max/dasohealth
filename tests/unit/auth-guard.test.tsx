import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthGuard, { INACTIVITY_TIMEOUT_MS } from '@/components/layout/AuthGuard';
import { getUser, signOut } from '@/lib/auth';
import { useRouter } from 'next/navigation';

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

describe('AuthGuard inactivity timeout', () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useRouter).mockReturnValue(router);
    vi.mocked(getUser).mockResolvedValue({ id: 'user-1' });
    vi.mocked(signOut).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('signs out and redirects after 20 minutes of inactivity', async () => {
    render(
      <AuthGuard>
        <div>Protected app</div>
      </AuthGuard>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Protected app')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
      await Promise.resolve();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login?reason=timeout');
  });

  it('resets the inactivity timer when the user interacts with the page', async () => {
    render(
      <AuthGuard>
        <div>Protected app</div>
      </AuthGuard>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('Protected app')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1000);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      vi.advanceTimersByTime(999);
    });

    expect(signOut).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 999);
      await Promise.resolve();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login?reason=timeout');
  });
});
