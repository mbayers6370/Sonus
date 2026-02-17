import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const { authMode, signIn, signUp, continueAsDemo } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || undefined, []);

  const handleSubmit = async () => {
    if (loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const { requiresEmailVerification } = await signUp({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          timezone,
        });
        if (requiresEmailVerification) {
          setMessage('Account created. Please verify your email, then sign in.');
          setMode('signin');
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen page-shell px-6 py-8 flex items-center justify-center">
      <div className="w-full max-w-md bg-white/95 border border-border rounded-3xl p-6 shadow-[0_20px_42px_-34px_rgba(31,42,55,0.28)]">
        <div className="flex items-center gap-2 mb-5">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono ${
              mode === 'signin' ? 'bg-[#186E95] text-white' : 'bg-[rgba(55,65,81,0.10)] text-text-med'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono ${
              mode === 'signup' ? 'bg-[#186E95] text-white' : 'bg-[rgba(55,65,81,0.10)] text-text-med'
            }`}
          >
            Sign Up
          </button>
        </div>

        <h1 className="main-font text-[2rem] leading-tight text-[#186E95]">
          {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-sm text-text-med mt-1 mb-4">
          {mode === 'signin'
            ? 'Sign in with your email and password.'
            : 'Use your name, email, and password to create your profile.'}
        </p>
        {authMode === 'mock' && (
          <p className="text-xs text-text-light mb-3">
            Dev mode: use Sign Up/Sign In or continue with demo account `dev@local.test`.
          </p>
        )}

        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white"
            />
          </div>
        )}

        <div className="space-y-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white"
          />
        </div>

        {error && <p className="text-sm text-[#C2410C] mt-3">{error}</p>}
        {message && <p className="text-sm text-[#3E5648] mt-3">{message}</p>}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading}
          className="w-full mt-4 inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-[#186E95] text-white font-semibold hover:bg-[#145C7C] transition-colors disabled:opacity-60"
        >
          {loading ? 'Working…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
        {authMode === 'mock' && (
          <button
            type="button"
            onClick={continueAsDemo}
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-white border border-border text-text-dark font-semibold hover:bg-[rgba(55,65,81,0.08)] transition-colors disabled:opacity-60"
          >
            Continue as Demo
          </button>
        )}
      </div>
    </div>
  );
}
