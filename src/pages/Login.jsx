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

      <div className="w-full max-w-md animate-rise-in relative z-10">
        <div className="login-card rounded-[var(--radius-xl)] p-7 sm:p-10">
          <div className="text-center mb-8">
            <div className="login-logo-wrap mx-auto mb-5" aria-hidden="true">
              <img
                src="/logo-transparent.png"
                alt=""
                className="login-logo"
                draggable="false"
              />
            </div>
            <h1 className="font-display text-3xl font-extrabold text-[var(--color-neutral-900)] leading-tight">
              Cedu<span className="text-[var(--color-primary)]">Sync</span>
            </h1>
            <p className="text-sm font-medium text-[var(--color-neutral-600)] mt-2">
              Barangay San Roque &middot; Mambajao, Camiguin
            </p>
          </div>

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

            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              icon={LogIn}
              className="login-submit w-full mt-6 shadow-[0_12px_24px_rgba(59,75,196,0.22)] hover:shadow-[0_16px_34px_rgba(59,75,196,0.28)] hover:-translate-y-0.5"
              size="lg"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
