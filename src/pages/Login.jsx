import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { LockKeyhole, LogIn, UserRound } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ username, password });
      toast.success('Login successful!');
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="login-grid" aria-hidden="true" />
      <div className="login-light login-light-primary" aria-hidden="true" />
      <div className="login-light login-light-teal" aria-hidden="true" />

      <div className="w-full max-w-4xl animate-rise-in relative z-10">
        <div className="rounded-[var(--radius-xl)] overflow-hidden shadow-[var(--shadow-lg)] flex flex-col md:flex-row bg-white md:min-h-[560px]">

          {/* Left brand panel */}
          <div
            className="relative md:w-[42%] flex flex-col justify-between px-8 py-10 sm:px-10 sm:py-12 text-white overflow-hidden"
            style={{ background: 'linear-gradient(160deg, var(--color-primary), var(--color-voice))' }}
          >
            {/* Decorative curve into the white panel — desktop only */}
            <svg
              className="hidden md:block absolute top-0 right-0 h-full w-16 translate-x-1/2 pointer-events-none"
              viewBox="0 0 100 800"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0,0 L55,0 C90,140 20,280 60,400 C95,510 15,650 55,800 L0,800 Z"
                fill="var(--color-primary)"
              />
            </svg>

            <div className="relative z-10 flex flex-col items-center text-center md:items-start md:text-left">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-[var(--shadow-md)] mb-5">
                <img
                  src="/logo-transparent.png"
                  alt=""
                  className="w-10 h-11 object-contain"
                  draggable="false"
                />
              </div>
              <p className="font-display font-bold tracking-tight text-sm mb-8">
                Cedu<span className="opacity-80">Sync</span>
              </p>

              <h1 className="font-display text-3xl sm:text-[2rem] font-extrabold leading-tight mb-3">
                Welcome Back!
              </h1>
              <p className="text-white/80 text-sm leading-relaxed max-w-[26ch]">
                Sign in with your staff credentials to continue processing barangay records.
              </p>
            </div>

            <div className="relative z-10 mt-10 flex justify-center md:justify-start">
              <span className="inline-flex items-center px-6 py-2.5 rounded-full border border-white/60 text-white text-sm font-semibold tracking-wide">
                STAFF ACCESS
              </span>
            </div>
          </div>

          {/* Right form panel */}
          <div className="flex-1 flex flex-col justify-center px-8 py-10 sm:px-12 sm:py-14">
            <div className="max-w-sm w-full mx-auto">
              <h2 className="font-display text-4xl font-extrabold lowercase text-[var(--color-neutral-900)] mb-1">
                welcome
              </h2>
              <p className="text-[var(--color-neutral-500)] text-sm mb-8">
                Log in to your account to continue
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <div className="space-y-4">
                  <Input
                    label="Username"
                    icon={UserRound}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    autoComplete="username"
                    required
                  />
                  <Input
                    label="Password"
                    icon={LockKeyhole}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="flex justify-end mt-2">
                  <span className="text-xs text-[var(--color-neutral-400)]">
                    Forgot your password? Contact your administrator.
                  </span>
                </div>

                <Button
                  type="submit"
                  loading={loading}
                  disabled={loading}
                  icon={LogIn}
                  className="login-submit w-full mt-6 rounded-full shadow-[var(--shadow-md)] hover:-translate-y-0.5"
                  size="lg"
                >
                  {loading ? 'Logging in...' : 'Log in'}
                </Button>
              </form>

              <p className="text-center text-xs text-[var(--color-neutral-400)] mt-8">
                Don't have an account?{' '}
                <span className="text-[var(--color-primary)] font-semibold">
                  Contact your system administrator
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;