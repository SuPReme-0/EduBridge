'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { Browser } from '@capacitor/browser';
import {
  Library, Mail, Lock, Loader2,
  ShieldAlert, User, GraduationCap, Sparkles, CheckCircle2,
  ArrowRight, Eye, EyeOff, Brain, Zap, Star,
  LogIn, UserPlus, Chrome
} from 'lucide-react';

// ============================================================================
// THEME CONFIG (Matching Dashboard & Landing Page)
// ============================================================================

const THEME_CONFIG: Record<string, {
  bg: string;
  card: string;
  border: string;
  accent: string;
  accentBg: string;
  gradient: string;
  text: string;
  muted: string;
  isLight: boolean;
  inputBg: string;
  inputBorder: string;
  buttonHover: string;
}> = {
  'minimalist': {
    bg: 'bg-[#F8FAFC]',
    card: 'bg-white/95 backdrop-blur-xl',
    border: 'border-slate-200',
    accent: 'text-indigo-600',
    accentBg: 'bg-indigo-600',
    gradient: 'from-indigo-600 to-blue-600',
    text: 'text-slate-800',
    muted: 'text-slate-500',
    isLight: true,
    inputBg: 'bg-slate-50',
    inputBorder: 'border-slate-200',
    buttonHover: 'hover:bg-indigo-700',
  },
  'cyberpunk': {
    bg: 'bg-[#05050A]',
    card: 'bg-[#0A0A12]/90 backdrop-blur-xl',
    border: 'border-cyan-500/20',
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-500',
    gradient: 'from-cyan-500 to-blue-600',
    text: 'text-slate-100',
    muted: 'text-slate-400',
    isLight: false,
    inputBg: 'bg-slate-900/50',
    inputBorder: 'border-cyan-500/30',
    buttonHover: 'hover:bg-cyan-600',
  },
  'space-odyssey': {
    bg: 'bg-[#020205]',
    card: 'bg-[#0B0B1A]/90 backdrop-blur-xl',
    border: 'border-violet-500/20',
    accent: 'text-violet-400',
    accentBg: 'bg-violet-500',
    gradient: 'from-violet-500 to-fuchsia-600',
    text: 'text-slate-100',
    muted: 'text-slate-400',
    isLight: false,
    inputBg: 'bg-slate-900/50',
    inputBorder: 'border-violet-500/30',
    buttonHover: 'hover:bg-violet-600',
  },
  'library-sage': {
    bg: 'bg-[#FDFBF7]',
    card: 'bg-[#F5F2EA]/95 backdrop-blur-xl',
    border: 'border-[#E2D9C8]',
    accent: 'text-[#8B5E34]',
    accentBg: 'bg-[#8B5E34]',
    gradient: 'from-[#8B5E34] to-[#6B4423]',
    text: 'text-[#2D2420]',
    muted: 'text-[#8B7355]',
    isLight: true,
    inputBg: 'bg-[#F5F2EA]',
    inputBorder: 'border-[#E2D9C8]',
    buttonHover: 'hover:bg-[#6B4423]',
  },
  'zen-garden': {
    bg: 'bg-[#F0FDF4]',
    card: 'bg-white/95 backdrop-blur-xl',
    border: 'border-emerald-200',
    accent: 'text-emerald-600',
    accentBg: 'bg-emerald-600',
    gradient: 'from-emerald-500 to-teal-600',
    text: 'text-slate-800',
    muted: 'text-slate-500',
    isLight: true,
    inputBg: 'bg-emerald-50/50',
    inputBorder: 'border-emerald-200',
    buttonHover: 'hover:bg-emerald-700',
  },
};

// ============================================================================
// FLOATING PARTICLE COMPONENT
// ============================================================================

const FloatingParticle = ({ delay, duration, size, color, theme }: {
  delay: number;
  duration: number;
  size: number;
  color: string;
  theme: any;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0, y: 0 }}
    animate={{
      opacity: [0, 0.5, 0],
      scale: [0, 1, 0.5],
      y: [0, -150, -300],
      rotate: [0, 180, 360]
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      repeatDelay: Math.random() * 3 + 2,
      ease: "easeOut"
    }}
    className={`absolute rounded-full ${color} blur-sm`}
    style={{
      width: size,
      height: size,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100 + 50}%`
    }}
  />
);

// ============================================================================
// INPUT FIELD COMPONENT
// ============================================================================

const AuthInput = ({
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  required,
  error,
  label,
  theme,
  rightElement,
}: {
  icon: any;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  error?: boolean;
  label: string;
  theme: any;
  rightElement?: React.ReactNode;
}) => (
  <div className="space-y-2">
    <label className={`text-[11px] font-bold uppercase tracking-wider ${theme.muted} flex items-center gap-2`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </label>
    <div className="relative">
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className={`h-12 ${theme.inputBg} ${theme.inputBorder} ${theme.text} focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl transition-all outline-none ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : ''}`}
      />
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// AUTH CONTENT COMPONENT
// ============================================================================

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode = searchParams.get('mode') === 'register' ? false : true;
  const [isLogin, setIsLogin] = useState(initialMode);

  // Form State
  const [fullName, setFullName] = useState('');
  const [classLevel, setClassLevel] = useState('10');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // UI State
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [activeTheme, setActiveTheme] = useState(THEME_CONFIG['minimalist']);

  const redirectUrl = searchParams.get('redirect') || '/dashboard';

  // Sync with URL params
  useEffect(() => {
    setIsLogin(searchParams.get('mode') === 'register' ? false : true);
  }, [searchParams]);

  // Live Email Validation
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValidEmail(emailRegex.test(email));
  }, [email]);

  // Handle Auth
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!isValidEmail) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    if (!isLogin && !acceptedTerms) {
      setError('You must accept the Terms of Service to continue.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });

        if (signUpError) {
          if (signUpError.message.toLowerCase().includes('already registered')) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          throw signUpError;
        }

        if (data?.user && !data?.session) {
          setError('Account created! Please check your email to verify your identity.');
          setLoading(false);
          return;
        }
      }

      router.push(isLogin ? redirectUrl : '/onboarding');

    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

// Helper to detect native app (no import needed)
const isNative = () => {
  if (typeof window === 'undefined') return false;
  return (window as any).Capacitor?.isNativePlatform?.() || false;
};

const handleGoogleAuth = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: isNative()
          ? 'com.priyanshu.edubridge://auth' // 👈 replace with your actual custom scheme
          : window.location.origin + '/auth/callback',
        skipBrowserRedirect: isNative(), // prevents automatic window.open
      },
    });

    if (error) throw error;

    if (isNative() && data.url) {
      // Open the OAuth URL in an in‑app browser tab
      await Browser.open({ url: data.url });
      // The redirect will be handled by the app's URL listener (Step 3)
    } else {
      // In web, fallback to normal redirect
      window.location.href = data.url;
    }
  } catch (err) {
    console.error('Google sign-in error:', err);
  }
};

  const t = activeTheme;

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} flex items-center justify-center p-4 relative overflow-hidden font-sans`}>

      {/* Background */}
      <div className={`fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${t.gradient} pointer-events-none`} />
      <div className="fixed inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(${t.text.replace('text-', 'text-')} 1px, transparent 1px), linear-gradient(90deg, ${t.text.replace('text-', 'text-')} 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />
      {!t.isLight && (
        <>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
        </>
      )}

      {/* Floating Particles */}
      {[...Array(12)].map((_, i) => (
        <FloatingParticle
          key={i}
          delay={i * 0.3}
          duration={3 + Math.random() * 2}
          size={4 + Math.random() * 8}
          color={['bg-indigo-500/30', 'bg-purple-500/30', 'bg-cyan-500/30'][i % 3]}
          theme={t}
        />
      ))}

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className={`${t.card} ${t.border} shadow-2xl rounded-[2.5rem] overflow-hidden border backdrop-blur-xl`}>

          {/* Header */}
          <div className={`h-40 ${t.isLight ? 'bg-gradient-to-br from-indigo-50 to-purple-50' : 'bg-gradient-to-br from-slate-900 to-slate-800'} flex flex-col items-center justify-center relative border-b ${t.border}`}>
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className={`relative z-10 w-20 h-20 ${t.card} ${t.border} rounded-2xl shadow-lg flex items-center justify-center`}
            >
              <Brain className={`w-10 h-10 ${t.accent}`} />
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className={`text-xs font-bold uppercase tracking-widest ${t.muted} mt-3`}
            >
              EduBridge
            </motion.p>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Title */}
            <div className="text-center space-y-2">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-2xl font-black ${t.text} tracking-tight`}
              >
                {isLogin ? 'Welcome Back' : 'Begin Your Journey'}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className={`text-sm ${t.muted} font-medium`}
              >
                {isLogin ? 'Access your learning workspace' : 'Create your academic profile'}
              </motion.p>
            </div>

            {/* Toggle */}
            <div className={`flex p-1 ${t.isLight ? 'bg-slate-100/80' : 'bg-slate-800/50'} rounded-xl ${t.border} border relative`}>
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all z-10 ${isLogin ? t.accent : t.muted}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all z-10 ${!isLogin ? t.accent : t.muted}`}
              >
                Register
              </button>
              <motion.div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] ${t.card} rounded-lg shadow-sm ${t.border} border`}
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ left: isLogin ? '4px' : 'calc(50% + 2px)' }}
              />
            </div>

            {/* Form */}
            <form onSubmit={handleAuth} className="space-y-4">
              <AnimatePresence>
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    <AuthInput
                      icon={User}
                      type="text"
                      placeholder="e.g. Marie Curie"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={!isLogin}
                      label="Full Name"
                      theme={t}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AuthInput
                icon={Mail}
                type="email"
                placeholder="student@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                error={email.length > 0 && !isValidEmail}
                label="Email Address"
                theme={t}
                rightElement={email.length > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    {isValidEmail ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                    )}
                  </motion.span>
                )}
              />

              <AuthInput
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                label="Password"
                theme={t}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`${t.muted} hover:${t.accent} transition-colors`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              {isLogin && (
                <div className="flex justify-end -mt-2">
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className={`text-xs ${t.accent} hover:underline font-semibold`}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <AnimatePresence>
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 mt-2 p-1">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="terms" className={`text-[11px] ${t.muted} leading-tight`}>
                        I agree to the <Link href="/terms" className={`${t.accent} hover:underline font-bold`}>Terms of Service</Link> and <Link href="/privacy" className={`${t.accent} hover:underline font-bold`}>Privacy Policy</Link>
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl text-sm font-medium">
                      <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="leading-snug">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  className={`w-full h-12 text-[15px] font-bold ${t.accentBg} ${t.buttonHover} text-white rounded-xl shadow-lg transition-all disabled:opacity-50`}
                  disabled={loading || googleLoading || !email || !password || !isValidEmail || (!isLogin && !acceptedTerms)}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  {loading ? 'Authenticating...' : isLogin ? 'Access Workspace' : 'Initialize Profile'}
                </Button>
              </motion.div>
            </form>

            {/* Divider */}
            <div className="relative flex items-center justify-center py-2">
              <div className={`absolute w-full border-t ${t.border}`} />
              <span className={`relative ${t.card} px-4 text-[10px] font-bold uppercase tracking-widest ${t.muted}`}>
                Or continue with
              </span>
            </div>

            {/* Google OAuth */}
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleAuth}
                disabled={loading || googleLoading}
                className={`w-full h-12 text-[14px] font-bold ${t.card} ${t.border} ${t.text} hover:${t.inputBg} rounded-xl shadow-sm transition-all`}
              >
                {googleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Chrome className="w-5 h-5 mr-3" />
                )}
                {isLogin ? 'Sign in with Google' : 'Register with Google'}
              </Button>
            </motion.div>

            {/* Features Preview */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className={`pt-4 border-t ${t.border} flex items-center justify-center gap-4 text-xs ${t.muted}`}
            >
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Free Forever Plan</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>No Credit Card</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>AI-Powered</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Back to Home */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-6"
        >
          <Link
            href="/"
            className={`text-sm ${t.muted} hover:${t.accent} transition-colors inline-flex items-center gap-2`}
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to Home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// PAGE COMPONENT WITH SUSPENSE
// ============================================================================

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-10 h-10 text-indigo-600 opacity-80" />
          </motion.div>
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}