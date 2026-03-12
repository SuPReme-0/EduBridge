// app/page.tsx
'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'motion/react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase/client';
import { THEME_CONFIG as THEMES } from '@/lib/themes';
import {
  BookOpen, Sparkles, Brain, ArrowRight, Zap, Target, Layers, Cpu,
  Network, CheckCircle2, ChevronRight, Shield, Star, Play, Users,
  Trophy, Clock, TrendingUp, MessageCircle, Globe, LogIn, UserPlus,
  LogOut, FileText, Image as ImageIcon, Rocket, Hexagon, Atom,
  Download, Smartphone, Monitor, Github, Linkedin, Mail, ExternalLink,
  Loader2, X, Menu, ChevronDown, Heart, Code, Lightbulb, Award
} from 'lucide-react';

// ============================================================================
// PLATFORM DETECTION
// ============================================================================
const isApp = typeof window !== 'undefined' && (
  // Capacitor/PWA detection
  (window as any).Capacitor?.isNativePlatform?.() ||
  // Standalone PWA
  window.matchMedia('(display-mode: standalone)').matches ||
  // Android WebView
  /Android.*wv/.test(navigator.userAgent) ||
  // iOS standalone
  ('standalone' in window.navigator && (window.navigator as any).standalone)
);

// ============================================================================
// FLOATING PARTICLE (Enhanced for round logo)
// ============================================================================
const FloatingParticle = ({ delay, duration, size, color, x = 'random' }: {
  delay: number;
  duration: number;
  size: number;
  color: string;
  x?: number | 'random';
}) => {
  const left = x === 'random' ? `${Math.random() * 100}%` : `${x}%`;
  const top = `${Math.random() * 100}%`;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, y: 0 }}
      animate={{
        opacity: [0, 0.5, 0],
        scale: [0, 1.2, 0.8],
        y: [0, -150, -300],
        x: [0, Math.random() * 40 - 20, 0],
        rotate: [0, 180, 360]
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 3 + 1,
        ease: "easeInOut"
      }}
      className={`absolute rounded-full ${color} blur-[2px]`}
      style={{
        width: size,
        height: size,
        left,
        top
      }}
    />
  );
};

// ============================================================================
// NEON GLOW ORB (Futuristic effect)
// ============================================================================
const NeonGlowOrb = ({ color, size, delay, theme }: {
  color: string;
  size: string;
  delay: number;
  theme: any;
}) => (
  <motion.div
    animate={{
      scale: [1, 1.3, 1],
      opacity: [0.2, 0.5, 0.2],
      rotate: [0, 180, 360]
    }}
    transition={{
      duration: 8 + delay,
      repeat: Infinity,
      ease: "easeInOut",
      delay
    }}
    className={`absolute rounded-full blur-3xl ${color}`}
    style={{ width: size, height: size }}
  />
);

// ============================================================================
// FEATURE CARD (Web version with hover effects)
// ============================================================================
const FeatureCard = ({ icon: Icon, title, desc, color, delay, theme, isApp = false }: {
  icon: any;
  title: string;
  desc: string;
  color: string;
  delay: number;
  theme: any;
  isApp?: boolean;
}) => {
  const CardWrapper = isApp ? 'div' : motion.div;
  
  return (
    <CardWrapper
      {...(!isApp && {
        initial: { opacity: 0, y: 40 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: "-50px" },
        transition: { delay, duration: 0.6, type: 'spring', stiffness: 100 },
        whileHover: { y: -8, scale: 1.02, transition: { duration: 0.2 } }
      })}
      className={`relative group ${isApp ? '' : ''}`}
    >
      {!isApp && (
        <div className={`absolute -inset-0.5 bg-gradient-to-r ${color} rounded-3xl blur opacity-0 group-hover:opacity-20 transition duration-500`} />
      )}
      <Card className={`relative ${theme.card} ${theme.border} backdrop-blur-xl overflow-hidden ${isApp ? 'shadow-md' : 'shadow-lg hover:shadow-2xl'} transition-all h-full`}>
        <CardContent className={`p-${isApp ? '5' : '8'} h-full flex flex-col`}>
          <div className={`w-${isApp ? '12' : '14'} h-${isApp ? '12' : '14'} rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-${isApp ? '4' : '6'} ${isApp ? '' : 'shadow-lg group-hover:rotate-6'} transition-transform`}>
            <Icon className={`w-${isApp ? '6' : '7'} h-${isApp ? '6' : '7'} text-white`} />
          </div>
          <h3 className={`font-bold text-${isApp ? 'lg' : 'xl'} ${theme.text} mb-2`}>{title}</h3>
          <p className={`text-sm ${theme.muted} leading-relaxed flex-1`}>{desc}</p>
        </CardContent>
      </Card>
    </CardWrapper>
  );
};

// ============================================================================
// STAT CARD (Minimal for app, enhanced for web)
// ============================================================================
const StatCard = ({ icon: Icon, value, label, theme, isApp = false }: {
  icon: any;
  value: string;
  label: string;
  theme: any;
  isApp?: boolean;
}) => (
  <motion.div
    initial={isApp ? false : { opacity: 0, scale: 0.9 }}
    animate={isApp ? {} : { opacity: 1, scale: 1 }}
    whileHover={!isApp ? { scale: 1.05 } : undefined}
    className={`${theme.card} ${theme.border} rounded-2xl p-4 text-center backdrop-blur-xl ${isApp ? 'shadow-sm' : 'shadow-lg'} transition-transform`}
  >
    <div className={`w-10 h-10 rounded-xl ${theme.accentLight} flex items-center justify-center mx-auto mb-3`}>
      <Icon className={`w-5 h-5 ${theme.accent}`} />
    </div>
    <p className={`text-2xl font-black ${theme.text} tracking-tight`}>{value}</p>
    <p className={`text-[10px] ${theme.muted} uppercase tracking-widest mt-1 font-bold`}>{label}</p>
  </motion.div>
);

// ============================================================================
// CREATOR SECTION (Web only)
// ============================================================================
const CreatorSection = ({ theme }: { theme: any }) => (
  <section className={`py-24 px-6 ${theme.card}/30 backdrop-blur-xl border-t ${theme.border}`}>
    <div className="max-w-4xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <Badge className={`mb-4 px-4 py-1.5 ${theme.accentBg} text-white border-0 font-bold uppercase tracking-widest`}>
          Created By
        </Badge>
        <h2 className={`text-3xl md:text-4xl font-black ${theme.text} mb-4 tracking-tight`}>
          Meet the Architect
        </h2>
        <p className={`text-lg ${theme.muted} max-w-2xl mx-auto`}>
          EduBridge was crafted with passion to revolutionize how students learn. Built by a developer who believes education should be adaptive, engaging, and accessible to all.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center mb-12"
      >
        <div className="relative mb-6">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full blur opacity-50 animate-pulse" />
          <div className={`relative w-32 h-32 rounded-full ${theme.card} border-4 ${theme.border} flex items-center justify-center overflow-hidden`}>
            <div className={`w-full h-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center`}>
              <span className="text-4xl font-black text-white">P</span>
            </div>
          </div>
        </div>
        <h3 className={`text-2xl font-bold ${theme.text} mb-1`}>Priyanshu</h3>
        <p className={`${theme.muted} font-medium mb-4`}>AI Enthusiast & ML Engineer</p>
        
        <div className="flex gap-4">
          {[
            { icon: Github, href: 'https://github.com/SuPReme-0', label: 'GitHub' },
            { icon: Linkedin, href: 'https://www.linkedin.com/in/priyanshu-roy-25b91a31a/', label: 'LinkedIn' },
          ].map(({ icon: Icon, href, label }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-3 rounded-xl ${theme.card} border ${theme.border} hover:${theme.accentLight} transition-all group`}
              aria-label={label}
            >
              <Icon className={`w-5 h-5 ${theme.muted} group-hover:${theme.accent} transition-colors`} />
            </a>
          ))}
        </div>
      </motion.div>

      {/* Download Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.4 }}
        className={`${theme.card} ${theme.border} rounded-3xl p-8 backdrop-blur-xl shadow-lg`}
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <Smartphone className={`w-6 h-6 ${theme.accent}`} />
          <h3 className={`text-xl font-bold ${theme.text}`}>Download the App</h3>
        </div>
        <p className={`${theme.muted} mb-6`}>
          Get the native Android app for the best offline experience and push notifications.
        </p>
        <a
          href="/apk/edubridge-v1.1.0.apk"
          download
          className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all`}
        >
          <Download className="w-5 h-5" />
          Download APK (v1.1.0)
          <ExternalLink className="w-4 h-4" />
        </a>
        <p className={`text-xs ${theme.muted} mt-4`}>
          Android 8.0+ • 3MB • Free
        </p>
      </motion.div>
    </div>
  </section>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================
function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, updateProfile } = useStore();

  // State
  const [isBooting, setIsBooting] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [activeTheme, setActiveTheme] = useState(THEMES['minimalist']);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showUserContinue, setShowUserContinue] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // 1. Get raw scroll (Native performance, perfect for mobile WebViews)
  const { scrollY } = useScroll();

  // 2. Header glassmorphism: Keep this short so the navigation 
  // background becomes solid quickly as content slides under it.// 1. Header glassmorphism (unchanged)
  const headerOpacity = useTransform(scrollY, [0, 50], [0, 1]);
  
  // 2. Hero Parallax: Stretched to 800px.
  // It now glides down 200px slowly over 800px of scrolling, 
  // keeping it in the physical viewport much longer on mobile.
  const heroY = useTransform(scrollY, [0, 800], [0, 200]);
  
  // 3. The "Ghost Fade" Fix:
  // We stretch the fade range to 800px.
  // Instead of fading to 0, it fades to 0.1 (10% opacity). 
  // This ensures that when you scroll back up, you immediately see the faintly faded 
  // text waiting for you, rather than staring at a blank space.
  const heroOpacity = useTransform(scrollY, [0, 800], [1, 0.1]);

  // ============================================================================
  // CLIENT-SIDE CHECK & AUTH (Fresh load always)
  // ============================================================================
  useEffect(() => {
    // Force fresh state on every full load
    setIsClient(true);
    
    const checkAuthAndLoadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setIsLoggedIn(true);
          setShowUserContinue(true);

          const res = await fetch('/api/profile/me');
          if (res.ok) {
            const data = await res.json();
            setProfile(data.profile);
            if (data.profile?.currentVibe && THEMES[data.profile.currentVibe]) {
              setActiveTheme(THEMES[data.profile.currentVibe]);
            }
          }
        }
      } catch (e) {
        console.error("Auth check failed", e);
      }
    };

    checkAuthAndLoadProfile();
  }, []); // Run once on mount

  // ============================================================================
  // BOOT SEQUENCE (Enhanced with round logo)
  // ============================================================================
  useEffect(() => {
    if (!isClient) return;
    document.body.style.overflow = isBooting ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isBooting, isClient]);

  // Handlers
  const handleContinue = () => router.push('/dashboard');
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setShowUserContinue(false);
    // Force reload to reset all state
    window.location.href = '/';
  };

  const t = activeTheme;

  // ============================================================================
  // BOOT SCREEN (Futuristic with round logo focus)
  // Replaced rings with glittering jitter and rays of light
  // ============================================================================
  if (isBooting) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden">
        {/* Deep space gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A0A0F] via-[#050510] to-black" />
        
        {/* Twinkling stars */}
        {[...Array(100)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "easeInOut",
            }}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              boxShadow: `0 0 ${Math.random() * 4 + 2}px rgba(255,255,255,0.8)`,
            }}
          />
        ))}

        {/* Black hole gravitational lensing effect */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-r from-purple-900/20 via-cyan-900/20 to-transparent blur-3xl"
        />

        {/* Spiraling particles towards center */}
        {[...Array(30)].map((_, i) => {
          const angle = (i / 30) * Math.PI * 2;
          const radius = 300 + Math.random() * 200;
          return (
            <motion.div
              key={`spiral-${i}`}
              initial={{
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                opacity: 0.8,
                scale: 1,
              }}
              animate={{
                x: [Math.cos(angle) * radius, 0],
                y: [Math.sin(angle) * radius, 0],
                opacity: [0.8, 0],
                scale: [1, 0.1],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeIn",
              }}
              className="absolute w-1 h-1 rounded-full bg-cyan-400"
              style={{
                boxShadow: '0 0 10px #06b6d4',
              }}
            />
          );
        })}

        {/* Central void core with logo */}
        <div className="relative z-10 mb-12">
          {/* Logo with intense glow and jitter effect */}
          <motion.div
            
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ scale: { duration: 1.5, type: 'spring', stiffness: 100 } }}
  className="relative w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden shadow-2xl"
  style={{
              boxShadow: '0 0 50px #06b6d4, 0 0 100px #8b5cf6',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-purple-500/30 animate-pulse" />
            <Image
              src="/logo.png"
              alt="EduBridge"
              width={200}
              height={200}
              priority
              className="w-full h-full object-cover scale-110"
            />
          </motion.div>
        </div>

        {/* Glitching title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          className="text-5xl md:text-7xl font-black text-white/90 tracking-tighter mb-3 z-10 relative"
        >
          <span className="relative inline-block">
            <span className="relative z-10">EduBridge</span>
            <motion.span
              animate={{ x: [-3, 3, -3] }}
              transition={{ duration: 0.15, repeat: Infinity }}
              className="absolute inset-0 text-cyan-400/60 blur-sm"
            >
              EduBridge
            </motion.span>
            <motion.span
              animate={{ x: [3, -3, 3] }}
              transition={{ duration: 0.1, repeat: Infinity, delay: 0.05 }}
              className="absolute inset-0 text-purple-400/60 blur-sm"
            >
              EduBridge
            </motion.span>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.7 }}
          className="text-cyan-300/70 text-xs font-mono tracking-[0.4em] uppercase mb-16 z-10"
        >
          Neural Learning Matrix v2.1
        </motion.p>

        {/* Launch button */}
        <motion.button
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.9 }}
          onClick={() => { setIsBooting(false); setShowContent(true); }}
          className="relative z-30 group"
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -inset-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-70 group-hover:opacity-90"
          />
          <div className="relative px-12 py-5 bg-black/70 backdrop-blur-2xl rounded-full border border-cyan-400/50 flex items-center gap-4 text-white font-bold uppercase tracking-widest text-sm hover:bg-black/80 transition">
            <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
            Initialize System
            <ChevronRight className="w-4 h-4 text-cyan-300 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>

        {/* Loading text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-12 flex items-center gap-3 text-cyan-400/60 text-xs font-mono"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Entering the void...</span>
        </motion.div>
      </div>
    );
  }

  // ============================================================================
  // RETURNING USER PAGE (Enhanced with animations)
  // ============================================================================
  if (showUserContinue && isLoggedIn && profile) {
    const displayName = profile?.fullName || profile?.user?.email?.split('@')[0] || 'Scholar';
    const initials = displayName.substring(0, 2).toUpperCase();
    const isWeb = !isApp;

    return (
      <div className={`min-h-screen ${t.bg} flex flex-col items-center justify-center px-4 relative overflow-hidden transition-colors duration-1000`}>
        {/* Platform-specific background */}
        {isWeb ? (
          <>
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `linear-gradient(${t.text} 1px, transparent 1px), linear-gradient(90deg, ${t.text} 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }} />
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  y: [0, -40, 0],
                  x: [0, 20, 0],
                  opacity: [0.1, 0.4, 0.1]
                }}
                transition={{ duration: 6 + i, repeat: Infinity, delay: i * 0.4 }}
                className="absolute w-1.5 h-1.5 bg-cyan-400/30 rounded-full"
                style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
              />
            ))}
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-5`} />
        )}

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.8 }}
          className="text-center relative z-10 w-full max-w-md"
        >
          {/* Animated border glow */}
          {isWeb && (
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-[2.5rem] blur-md opacity-75 animate-pulse" />
          )}

          <Card className={`relative ${t.card} ${isWeb ? 'border-0 backdrop-blur-2xl shadow-2xl' : `border ${t.border} shadow-lg`} rounded-[2.5rem] overflow-hidden`}>
            {/* Header gradient */}
            <div className={`h-32 bg-gradient-to-br ${t.gradient} relative ${isWeb ? 'opacity-90' : 'opacity-80'}`}>
              {isWeb && <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />}
            </div>

            <CardContent className="px-8 pb-10 relative">
              {/* Avatar with animated ring */}
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="relative w-28 h-28 -mt-14 mx-auto mb-6"
              >
                {isWeb && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                  />
                )}
                <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shadow-2xl border-4 ${t.border}`}>
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-[1.25rem]" />
                  ) : (
                    <span className="text-3xl font-black text-white">{initials}</span>
                  )}
                </div>
              </motion.div>

              {/* Welcome text with glitch */}
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`text-3xl font-black ${t.text} mb-1 relative`}
              >
                <span className="relative inline-block">
                  Welcome Back
                  {isWeb && <span className="absolute -inset-1 text-cyan-400/50 blur-sm animate-pulse">Welcome Back</span>}
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className={`${t.accent} font-bold text-sm mb-8 tracking-widest`}
              >
                {displayName}
              </motion.p>

              {/* Stats grid */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={`grid ${isApp ? 'grid-cols-3' : 'grid-cols-3'} gap-3 mb-8`}
              >
                {[
                  { label: 'Streak', value: profile?.currentStreak || 0, icon: Zap },
                  { label: 'XP', value: profile?.totalPoints || 0, icon: Brain },
                  { label: 'Tests', value: profile?.testsCompleted || 0, icon: Target },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl p-3 border ${t.border} ${isWeb ? 'bg-black/20 backdrop-blur-sm' : ''} relative group`}
                  >
                    {isWeb && (
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition rounded-2xl" />
                    )}
                    <stat.icon className={`w-4 h-4 ${t.accent} mx-auto mb-1`} />
                    <p className={`text-xl font-black ${t.text}`}>{stat.value}</p>
                    <p className={`text-[10px] font-bold ${t.muted} uppercase`}>{stat.label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <Button
                  onClick={handleContinue}
                  className={`w-full h-14 rounded-xl bg-gradient-to-r ${t.gradient} text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-lg relative group overflow-hidden`}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isApp ? 'Continue Learning' : 'Enter Matrix'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  {isWeb && <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition" />}
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className={`w-full h-12 rounded-xl text-red-400 hover:text-red-300 ${isWeb ? 'hover:bg-red-500/10' : ''} font-bold ${isWeb ? 'backdrop-blur-sm' : ''} transition-all`}
                >
                  <LogOut className="w-4 h-4 mr-2" /> {isApp ? 'Sign Out' : 'Disconnect'}
                </Button>
              </motion.div>

              {/* App badge */}
              {isApp && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="mt-6 pt-6 border-t border-slate-200/10"
                >
                  <Badge className={`${t.accentLight} ${t.accent} border-0 font-bold`}>
                    <Smartphone className="w-3 h-3 mr-1" />
                    Native App Mode
                  </Badge>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ============================================================================
  // MAIN LANDING PAGE (Dual Interface: Web vs App)
  // ============================================================================
  const isWeb = !isApp;

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} font-sans selection:bg-indigo-500/30 overflow-x-hidden relative`}>
      {/* Background layers */}
      <div className={`fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${t.gradient} pointer-events-none opacity-5`} />
      <div className="fixed inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(${t.text} 1px, transparent 1px), linear-gradient(90deg, ${t.text} 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />
      {!t.isLight && isWeb && (
        <>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px]" />
        </>
      )}

      {/* Header */}
      <motion.header
        style={{ opacity: headerOpacity }}
        className={`fixed top-0 left-0 right-0 z-40 px-6 py-4 flex items-center justify-between backdrop-blur-xl ${t.card}/80 border-b ${t.border}`}
      >
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="w-full h-full object-cover" />
          </div>
          <span className={`font-black text-xl tracking-tight ${t.text}`}>EduBridge</span>
        </Link>
        
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login?mode=login" className="hidden sm:block">
            <Button variant="ghost" className={`${t.text} hover:${t.accentLight} hover:${t.accent} font-bold`}>
              Sign In
            </Button>
          </Link>
          <Link href="/login?mode=register">
            <Button className={`h-11 px-6 rounded-xl bg-gradient-to-r ${t.gradient} text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all`}>
              Start Free
            </Button>
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`md:hidden p-2 rounded-xl ${t.card} border ${t.border}`}
        >
          {isMenuOpen ? <X className={`w-5 h-5 ${t.text}`} /> : <Menu className={`w-5 h-5 ${t.text}`} />}
        </button>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && isWeb && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-4 right-4 z-30 ${t.card} ${t.border} rounded-2xl p-6 shadow-2xl backdrop-blur-xl`}
          >
            <div className="space-y-4">
              <Link href="/login?mode=login" className="block">
                <Button variant="ghost" className={`w-full justify-start ${t.text} hover:${t.accentLight}`}>
                  <LogIn className="w-4 h-4 mr-2" /> Sign In
                </Button>
              </Link>
              <Link href="/login?mode=register" className="block">
                <Button className={`w-full bg-gradient-to-r ${t.gradient} text-white`}>
                  <UserPlus className="w-4 h-4 mr-2" /> Create Account
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <AnimatePresence>
        {showContent && (
          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="relative z-10"
          >
            {/* Hero Section */}
            <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-12 relative">
              <motion.div
                style={{ y: heroY, opacity: heroOpacity }}
                className="text-center max-w-5xl mx-auto relative z-10"
              >
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full ${t.card} border ${t.border} shadow-lg mb-8 backdrop-blur-md`}
                >
                  <Sparkles className={`w-4 h-4 ${t.accent}`} />
                  <span className={`text-[11px] font-black ${t.text} tracking-widest uppercase`}>
                    {isApp ? 'Native Learning Engine' : 'Next-Gen Learning Engine'}
                  </span>
                </motion.div>

                {/* Headline */}
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className={`text-5xl md:text-7xl lg:text-[5rem] font-black ${t.text} tracking-tighter leading-[1.1] mb-8`}
                >
                  Study Smarter,{' '}
                  <span className={`text-transparent bg-clip-text bg-gradient-to-r ${t.gradient} animate-pulse`}>
                    Not Harder
                  </span>
                </motion.h1>

                {/* Subheadline */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className={`text-lg md:text-2xl ${t.muted} mb-12 leading-relaxed max-w-3xl mx-auto font-medium`}
                >
                  {isApp
                    ? 'Your personalized AI tutor. Upload syllabus, get interactive lessons, master any subject.'
                    : 'Upload your syllabus. EduBridge instantly generates a personalized, interactive learning matrix with AI tutors, dynamic stories, and adaptive mastery tracking.'
                  }
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-lg mx-auto mb-16 relative"
                >
                  <div className={`absolute -inset-1 bg-gradient-to-r ${t.gradient} rounded-2xl blur opacity-30 animate-pulse`} />
                  <Link href="/login?mode=register" className="flex-1 relative">
                    <Button className={`w-full h-16 text-lg rounded-2xl bg-gradient-to-r ${t.gradient} text-white font-black shadow-xl hover:scale-105 transition-all`}>
                      {isApp ? 'Get Started' : 'Initialize Matrix'} <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  {isWeb && (
                    <Link href="#how-it-works" className="flex-1 relative">
                      <Button variant="outline" className={`w-full h-16 text-lg rounded-2xl border-2 ${t.border} ${t.card} ${t.text} hover:${t.accentLight} font-bold shadow-sm transition-all`}>
                        <Play className="w-5 h-5 mr-2" /> View Demo
                      </Button>
                    </Link>
                  )}
                </motion.div>

                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
                >
                  <StatCard icon={Users} value="1k+" label="Scholars" theme={t} isApp={isApp} />
                  <StatCard icon={Layers} value="10k+" label="Modules" theme={t} isApp={isApp} />
                  <StatCard icon={Zap} value="2x" label="Faster" theme={t} isApp={isApp} />
                  <StatCard icon={Star} value="4/5" label="Rating" theme={t} isApp={isApp} />
                </motion.div>
              </motion.div>
            </section>

            {/* How It Works Section (Web only) */}
            {isWeb && (
              <section id="how-it-works" className={`py-32 px-6 ${t.card}/40 backdrop-blur-xl border-t border-b ${t.border}`}>
                <div className="max-w-7xl mx-auto">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-20"
                  >
                    <Badge className={`mb-4 px-4 py-1.5 ${t.accentBg} text-white border-0 font-bold uppercase tracking-widest`}>The Protocol</Badge>
                    <h2 className={`text-4xl md:text-5xl font-black ${t.text} mb-6 tracking-tight`}>Three Steps to Mastery</h2>
                    <p className={`text-xl ${t.muted} max-w-2xl mx-auto`}>Transform any raw syllabus into a gamified, personalized adventure.</p>
                  </motion.div>

                  <div className="grid md:grid-cols-3 gap-8">
                    <FeatureCard
                      icon={FileText}
                      title="1. Inject Syllabus"
                      desc="Upload any PDF or paste raw text. Our AI extracts core subjects and chapters instantly."
                      color="from-indigo-500 to-blue-600"
                      delay={0.1}
                      theme={t}
                      isApp={isApp}
                    />
                    <FeatureCard
                      icon={Cpu}
                      title="2. Neural Generation"
                      desc="The engine builds interactive stories, quizzes, and visual aids based on your hobbies and pacing."
                      color="from-purple-500 to-pink-600"
                      delay={0.2}
                      theme={t}
                      isApp={isApp}
                    />
                    <FeatureCard
                      icon={Target}
                      title="3. Achieve Mastery"
                      desc="Study seamlessly, level up your profile, and clarify doubts 24/7 with the contextual AI Tutor."
                      color="from-emerald-500 to-teal-600"
                      delay={0.3}
                      theme={t}
                      isApp={isApp}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Features Section */}
            <section className={`py-32 px-6 ${t.bg}`}>
              <div className="max-w-7xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-center mb-20"
                >
                  <Badge className={`mb-4 px-4 py-1.5 ${t.accentBg} text-white border-0 font-bold uppercase tracking-widest`}>
                    {isApp ? 'Core Features' : 'Arsenal'}
                  </Badge>
                  <h2 className={`text-4xl md:text-5xl font-black ${t.text} mb-6 tracking-tight`}>
                    {isApp ? 'Powerful Tools' : 'Engineered for Excellence'}
                  </h2>
                </motion.div>

                <div className={`grid ${isApp ? 'grid-cols-1 sm:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'} gap-6`}>
                  {[
                    { icon: Brain, title: 'Adaptive Narratives', desc: 'Math explained through basketball? Physics via sci-fi? The AI adapts to your hobbies.', color: 'from-indigo-500 to-purple-600' },
                    { icon: MessageCircle, title: 'Contextual AI Tutor', desc: 'A tutor that actually knows what chapter you are reading and answers accordingly.', color: 'from-cyan-500 to-blue-600' },
                    { icon: Trophy, title: 'Deep Gamification', desc: 'Maintain neural streaks, unlock achievement badges, and level up your scholar rank.', color: 'from-amber-500 to-orange-600' },
                    { icon: Target, title: 'Dynamic Assessments', desc: 'Auto-generated quizzes with varying difficulties and intelligent grading.', color: 'from-emerald-500 to-teal-600' },
                    { icon: ImageIcon, title: 'Generative Visuals', desc: 'Complex concepts are paired with stunning, AI-generated custom diagrams.', color: 'from-fuchsia-500 to-rose-600' },
                    { icon: Globe, title: 'The Vibe Engine', desc: 'Switch the entire platform\'s aesthetic (Cyberpunk, Zen, etc.) to match your mood.', color: 'from-slate-600 to-slate-800' },
                  ].map((feature, i) => (
                    <FeatureCard
                      key={i}
                      icon={feature.icon}
                      title={feature.title}
                      desc={feature.desc}
                      color={feature.color}
                      delay={i * 0.1}
                      theme={t}
                      isApp={isApp}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* Creator Section (Web only) */}
            {isWeb && <CreatorSection theme={t} />}

            {/* Final CTA */}
            <section className={`py-32 px-6 ${t.card}/50 backdrop-blur-xl border-t ${t.border} relative overflow-hidden`}>
              <div className={`absolute inset-0 bg-gradient-to-t ${t.gradient} opacity-5`} />
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="max-w-4xl mx-auto text-center relative z-10"
              >
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center mx-auto mb-8 shadow-2xl`}>
                  <Rocket className="w-12 h-12 text-white" />
                </div>
                <h2 className={`text-4xl md:text-6xl font-black ${t.text} mb-8 tracking-tighter`}>
                  {isApp ? 'Start Learning Now' : 'Ready to upgrade your brain?'}
                </h2>
                <p className={`text-xl ${t.muted} mb-12 font-medium`}>
                  {isApp
                    ? 'Join thousands of students mastering subjects with AI-powered personalized learning.'
                    : 'Join the platform that is redefining how students absorb, retain, and master complex information.'
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-5 justify-center">
                  <Link href="/login?mode=register">
                    <Button className={`w-full sm:w-auto h-16 px-10 text-lg rounded-2xl bg-gradient-to-r ${t.gradient} text-white font-black shadow-xl hover:scale-105 transition-all`}>
                      {isApp ? 'Create Account' : 'Create Free Account'} <UserPlus className="w-6 h-6 ml-3" />
                    </Button>
                  </Link>
                  {isWeb && (
                    <a
                      href="/apk/edubridge-v1.1.0.apk"
                      download
                      className={`w-full sm:w-auto h-16 px-10 text-lg rounded-2xl border-2 ${t.border} ${t.card} ${t.text} hover:${t.accentLight} font-bold shadow-sm transition-all flex items-center justify-center gap-2`}
                    >
                      <Download className="w-5 h-5" />
                      Download App
                    </a>
                  )}
                </div>
              </motion.div>
            </section>

            {/* Footer */}
            <footer className={`py-12 px-6 ${t.bg} border-t ${t.border}`}>
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-cyan-500">
                      <Image src="/logo.png" alt="Logo" width={40} height={40} className="w-full h-full object-cover" />
                    </div>
                    <span className={`font-black text-lg tracking-tight ${t.text}`}>EduBridge</span>
                  </div>
                  <div className={`flex flex-wrap justify-center gap-6 font-medium text-sm ${t.muted}`}>
                    <Link href="/privacy" className={`hover:${t.accent} transition-colors`}>Privacy</Link>
                    <Link href="/terms" className={`hover:${t.accent} transition-colors`}>Terms</Link>
                    <Link href="/contact" className={`hover:${t.accent} transition-colors`}>Support</Link>
                    {isWeb && <Link href="#creator" className={`hover:${t.accent} transition-colors`}>Creator</Link>}
                  </div>
                </div>
                <div className={`text-center text-sm font-medium ${t.muted} pt-8 border-t ${t.border}`}>
                  <p>© {new Date().getFullYear()} EduBridge AI. All rights reserved.</p>
                  {isWeb && <p className="mt-1">Built with ❤️ by Priyanshu</p>}
                </div>
              </div>
            </footer>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// PAGE EXPORT WITH SUSPENSE BOUNDARY
// ============================================================================
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>}>
      <HomePage />
    </Suspense>
  );
}