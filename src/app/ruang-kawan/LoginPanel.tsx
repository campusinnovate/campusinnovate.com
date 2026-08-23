'use client';

import { FormEvent, useState } from 'react';
import { FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import { createClient } from '@/lib/supabase/client';

type LoginPanelProps = {
  initialError?: string;
  initialMessage?: string;
};

export default function LoginPanel({ initialError, initialMessage }: LoginPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'google' | 'password' | null>(null);
  const [error, setError] = useState(initialError ?? '');

  async function loginWithGoogle() {
    setBusy('google');
    setError('');
    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/ruang-kawan/dashboard`,
      },
    });

    if (loginError) {
      setError('Login Google belum dapat dimulai. Silakan coba kembali.');
      setBusy(null);
    }
  }

  async function loginWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('password');
    setError('');
    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
      setError('Email atau password tidak sesuai, atau akun belum didaftarkan.');
      setBusy(null);
      return;
    }

    window.location.assign('/ruang-kawan/dashboard');
  }

  return (
    <div className="rk-login-panel">
      <button className="rk-google-button" type="button" onClick={loginWithGoogle} disabled={busy !== null}>
        <span className="rk-google-mark" aria-hidden="true">G</span>
        {busy === 'google' ? 'Menghubungkan...' : 'Masuk dengan Google'}
      </button>

      <div className="rk-divider"><span>atau gunakan password</span></div>

      <form onSubmit={loginWithPassword}>
        <label htmlFor="rk-email">Email yang terdaftar</label>
        <input
          id="rk-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nama@campusinnovate.com"
          required
        />

        <label htmlFor="rk-password">Password</label>
        <div className="rk-password-field">
          <input
            id="rk-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Masukkan password"
            required
          />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        </div>

        {initialMessage && !error ? <p className="rk-login-message">{initialMessage}</p> : null}
        {error ? <p className="rk-login-error" role="alert">{error}</p> : null}

        <button className="rk-submit-button" type="submit" disabled={busy !== null}>
          {busy === 'password' ? 'Memeriksa...' : <>Masuk ke Ruang Kawan <FiArrowRight /></>}
        </button>
      </form>

      <p className="rk-access-note">Belum punya akses? Hubungi administrator Campus Innovate untuk mendaftarkan emailmu.</p>
    </div>
  );
}
