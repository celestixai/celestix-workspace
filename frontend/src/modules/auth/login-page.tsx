import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/components/ui/toast';
import logoIcon from '@/assets/logo-icon-blue.png';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      const { user, accessToken, refreshToken } = res.data.data;
      login(user, accessToken, refreshToken);
      navigate('/');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; code?: string } } };
      if (error.response?.data?.code === 'TOTP_REQUIRED') {
        toast('2FA code required', 'info');
      } else {
        toast(error.response?.data?.error || 'Login failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoIcon} alt="Celestix" className="w-16 h-16 object-contain" />
          <span className="text-xs font-semibold text-text-tertiary tracking-widest uppercase mt-2">Celestix</span>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-xl p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-text-primary text-center mb-1">Welcome back</h1>
          <p className="text-sm text-text-secondary text-center mb-6">Sign in to Celestix Workspace</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-[34px] p-1 rounded-lg text-text-tertiary hover:text-text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" className="rounded" {...register('rememberMe')} />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm text-accent-blue hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>

          <p className="text-sm text-text-secondary text-center mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent-blue hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
