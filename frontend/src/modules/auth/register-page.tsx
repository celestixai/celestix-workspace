import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check, X as XIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/components/ui/toast';
import logoIcon from '@/assets/logo-icon-blue.png';

const registerSchema = z.object({
  displayName: z.string().min(2, 'At least 2 characters').max(50),
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(20, 'Max 20 characters')
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const watchedUsername = watch('username');

  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const { data } = await api.get(`/auth/check-username/${username}`);
      setUsernameStatus(data.data?.available ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  }, []);

  useEffect(() => {
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (!watchedUsername || watchedUsername.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    usernameTimerRef.current = setTimeout(() => {
      checkUsernameAvailability(watchedUsername);
    }, 500);
    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, [watchedUsername, checkUsernameAvailability]);

  const onSubmit = async (data: RegisterForm) => {
    if (usernameStatus === 'taken') {
      toast('Username is already taken', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        displayName: data.displayName,
        username: data.username,
        email: data.email,
        password: data.password,
      });
      const { user, accessToken, refreshToken } = res.data.data;
      login(user, accessToken, refreshToken);
      toast('Welcome to Celestix Workspace!', 'success');
      navigate('/');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast(error.response?.data?.error || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={logoIcon} alt="Celestix" className="w-16 h-16 object-contain" />
          <span className="text-xs font-semibold text-text-tertiary tracking-widest uppercase mt-2">Celestix</span>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-xl p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-text-primary text-center mb-1">Create account</h1>
          <p className="text-sm text-text-secondary text-center mb-6">Get started with Celestix Workspace</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Display name"
              placeholder="John Doe"
              error={errors.displayName?.message}
              {...register('displayName')}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[rgba(255,255,255,0.65)]">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.40)] text-sm select-none">@</span>
                <input
                  placeholder="username"
                  {...register('username', {
                    onChange: (e) => {
                      e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    },
                  })}
                  className={`w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[8px] py-2.5 pl-8 pr-10 text-sm text-[rgba(255,255,255,0.95)] placeholder:text-[rgba(255,255,255,0.40)] outline-none hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.06)] focus:border-[#2563EB] focus:shadow-[0_0_0_2px_rgba(37,99,235,0.2)] transition-[border-color,box-shadow,background] duration-100 ${
                    errors.username ? 'border-[#EF4444] focus:border-[#EF4444] focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]' : ''
                  } ${
                    usernameStatus === 'available' ? 'border-[#22C55E] focus:border-[#22C55E] focus:shadow-[0_0_0_2px_rgba(34,197,94,0.2)]' : ''
                  } ${
                    usernameStatus === 'taken' ? 'border-[#EF4444] focus:border-[#EF4444] focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]' : ''
                  }`}
                />
                {usernameStatus === 'checking' && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.40)] animate-spin" />
                )}
                {usernameStatus === 'available' && (
                  <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#22C55E]" />
                )}
                {usernameStatus === 'taken' && (
                  <XIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#EF4444]" />
                )}
              </div>
              {errors.username && <p className="text-xs text-[#EF4444]" role="alert">{errors.username.message}</p>}
              {usernameStatus === 'taken' && !errors.username && (
                <p className="text-xs text-[#EF4444]">Username is already taken</p>
              )}
              {usernameStatus === 'available' && !errors.username && (
                <p className="text-xs text-[#22C55E]">Username is available</p>
              )}
            </div>

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
                placeholder="Min 8 chars, upper, lower, number"
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

            <Input
              label="Confirm password"
              type="password"
              placeholder="Repeat your password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />

            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>
          </form>

          <p className="text-sm text-text-secondary text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-blue hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
