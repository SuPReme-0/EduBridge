'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase/client';
import { THEME_CONFIG as THEMES } from '@/lib/themes'; // <-- external theme config
import {
  BookOpen, Sparkles, Brain, ArrowRight,
  Zap, Target, Layers, Cpu, Network, CheckCircle2,
  ChevronRight, Shield, Star, Play,
  Users, Trophy, Clock, TrendingUp,
  MessageCircle, Globe, LogIn, UserPlus, LogOut,
  FileText, Image as ImageIcon, Rocket,
  Hexagon, Atom, Cctv, Fingerprint // extra futuristic icons
} from 'lucide-react';

// ============================================================================
// FLOATING PARTICLE COMPONENT (enhanced for boot screen)
// ============================================================================
const FloatingParticle = ({ delay, duration, size, color, x = 'random' }: {
  delay: number;
  duration: number;
  size: number;
  color: string;
  x?: number | 'random';
}) => {
  const left = x === 'random' ? `${Math.random() * 100}%` : `${x}%`;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, y: 0 }}
      animate={{
        opacity: [0, 0.4, 0],
        scale: [0, 1.5, 0.8],
        y: [0, -200, -400],
        rotate: [0, 180, 360]
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 2 + 1,
        ease: "easeInOut"
      }}
      className={`absolute rounded-full ${color} blur-[1px]`}
      style={{
        width: size,
        height: size,
        left,
        top: `${Math.random() * 100}%`
      }}
    />
  );
};

// ============================================================================
// FEATURE CARD COMPONENT (with glow on hover)
// ============================================================================
const FeatureCard = ({ icon: Icon, title, desc, color, delay, theme }: {
  icon: any;
  title: string;
  desc: string;
  color: string;
  delay: number;
  theme: any;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ delay, duration: 0.6, type: 'spring', stiffness: 100 }}
    whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.2 } }}
    className="relative group"
  >
    <div className={`absolute -inset-0.5 bg-gradient-to-r ${color} rounded-3xl blur opacity-0 group-hover:opacity-20 transition duration-500`} />
    <Card className={`relative ${theme.card} ${theme.border} backdrop-blur-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all h-full`}>
      <CardContent className="p-8 h-full flex flex-col">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-6 shadow-lg group-hover:rotate-6 transition-transform`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h3 className={`font-bold text-xl ${theme.text} mb-3`}>{title}</h3>
        <p className={`text-sm ${theme.muted} leading-relaxed flex-1`}>{desc}</p>
      </CardContent>
    </Card>
  </motion.div>
);

// ============================================================================
// STAT CARD COMPONENT (used on hero)
// ============================================================================
const StatCard = ({ icon: Icon, value, label, theme }: {
  icon: any;
  value: string;
  label: string;
  theme: any;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    whileHover={{ scale: 1.05 }}
    className={`${theme.card} ${theme.border} rounded-3xl p-6 text-center backdrop-blur-xl shadow-lg transition-transform`}
  >
    <div className={`w-12 h-12 rounded-xl ${theme.accentLight} flex items-center justify-center mx-auto mb-4`}>
      <Icon className={`w-6 h-6 ${theme.accent}`} />
    </div>
    <p className={`text-3xl font-black ${theme.text} tracking-tight`}>{value}</p>
    <p className={`text-xs ${theme.muted} uppercase tracking-widest mt-1 font-bold`}>{label}</p>
  </motion.div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function HomePage() {
  const router = useRouter();
  const { user, updateProfile } = useStore();

  // State
  const [isBooting, setIsBooting] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [activeTheme, setActiveTheme] = useState(THEMES['minimalist']);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showUserContinue, setShowUserContinue] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Scroll animations
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 100], [0, 1]);
  const heroY = useTransform(scrollY, [0, 300], [0, 100]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  // ============================================================================
  // CLIENT-SIDE CHECK & AUTH
  // ============================================================================
  useEffect(() => {
    setIsClient(true);

    const checkAuthAndLoadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsLoggedIn(true);
        setShowUserContinue(true);

        try {
          const res = await fetch('/api/profile/me');
          if (res.ok) {
            const data = await res.json();
            setProfile(data.profile);
            if (data.profile?.currentVibe && THEMES[data.profile.currentVibe]) {
              setActiveTheme(THEMES[data.profile.currentVibe]);
            }
          }
        } catch (e) {
          console.error("Failed to load profile", e);
        }
      }
    };

    checkAuthAndLoadProfile();
  }, []);

  // ============================================================================
  // BOOT SEQUENCE (enhanced with logo focus)
  // ============================================================================
  useEffect(() => {
    if (!isClient) return;
    document.body.style.overflow = isBooting ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isBooting, isClient]);

  // Handlers
  const handleContinue = () => router.push('/dashboard');
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setShowUserContinue(false);
    window.location.reload();
  };

  const t = activeTheme;

  // ============================================================================
  // BOOT SCREEN (futuristic, logo‑centric)
  // ============================================================================
  if (isBooting) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0F] flex flex-col items-center justify-center overflow-hidden">
        {/* Particle field */}
        {[...Array(20)].map((_, i) => (
          <FloatingParticle
            key={i}
            delay={i * 0.2}
            duration={6 + Math.random() * 4}
            size={Math.random() * 8 + 2}
            color="bg-cyan-400/30"
          />
        ))}

        {/* Central glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/20 via-blue-500/20 to-purple-500/20 rounded-full blur-[100px]"
        />

        {/* Logo container with rotating rings */}
        <div className="relative z-10 mb-8">
          {/* Outer rotating ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
            style={{ width: '200px', height: '200px', left: '-20px', top: '-20px' }}
          />
          {/* Inner pulsing ring */}
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full border border-cyan-400/50"
            style={{ width: '180px', height: '180px', left: '-10px', top: '-10px' }}
          />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, type: 'spring' }}
            className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden shadow-2xl shadow-cyan-500/30"
          >
            <Image
              src="/logo.png"
              alt="EduBridge"
              width={320}
              height={320}
              priority
              className="w-full h-full object-contain"
            />
          </motion.div>
        </div>

        {/* Title with glitch effect */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-5xl md:text-6xl font-black text-white/90 tracking-tight mb-2 drop-shadow-lg z-10 relative"
        >
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            EduBridge
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-cyan-300/60 text-xs font-mono tracking-[0.3em] uppercase mb-12 z-10"
        >
          Neural Matrix v2.0
        </motion.p>

        {/* Launch button with neon pulse */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          onClick={() => { setIsBooting(false); setShowContent(true); }}
          className="relative z-30 group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full blur-md opacity-70 group-hover:opacity-100 transition duration-300" />
          <div className="relative px-10 py-4 bg-black/50 backdrop-blur-xl rounded-full border border-cyan-500/50 flex items-center gap-3 text-white font-bold uppercase tracking-widest text-sm">
            Initialize System
            <ChevronRight className="w-4 h-4 text-cyan-300 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>
      </div>
    );
  }

  // ============================================================================
  // RETURNING USER PAGE (futuristic upgrade)
  // ============================================================================
  if (showUserContinue && isLoggedIn && profile) {
    const displayName = profile?.fullName || profile?.user?.email?.split('@')[0] || 'Scholar';
    const initials = displayName.substring(0, 2).toUpperCase();

    return (
      <div className={`min-h-screen ${t.bg} flex flex-col items-center justify-center px-4 relative overflow-hidden transition-colors duration-1000`}>
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(${t.text} 1px, transparent 1px), linear-gradient(90deg, ${t.text} 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} />

        {/* Floating particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -30, 0],
              x: [0, 15, 0],
              opacity: [0.2, 0.5, 0.2]
            }}
            transition={{ duration: 5 + i, repeat: Infinity, delay: i * 0.3 }}
            className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
          />
        ))}

        {/* Main card with neon border */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", bounce: 0.4 }}
          className="text-center relative z-10 w-full max-w-md"
        >
          {/* Animated border glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-[2.5rem] blur-md opacity-75 animate-pulse" />

          <Card className={`relative ${t.card} border-0 backdrop-blur-2xl shadow-2xl rounded-[2.5rem] overflow-hidden`}>
            {/* Header gradient */}
            <div className={`h-32 bg-gradient-to-br ${t.gradient} relative opacity-90`}>
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
            </div>

            <CardContent className="px-8 pb-10 relative">
              {/* Avatar with rotating ring */}
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="relative w-28 h-28 -mt-14 mx-auto mb-6"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                />
                <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shadow-2xl border-4 ${t.border}`}>
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-[1.25rem]" />
                  ) : (
                    <span className="text-3xl font-black text-white">{initials}</span>
                  )}
                </div>
              </motion.div>

              {/* Glitch text */}
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`text-3xl font-black ${t.text} mb-1 relative`}
              >
                <span className="relative inline-block">
                  Welcome Back
                  <span className="absolute -inset-1 text-cyan-400/50 blur-sm animate-pulse">Welcome Back</span>
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

              {/* Stats with neon accents */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-3 gap-3 mb-8"
              >
                {[
                  { label: 'Streak', value: profile?.currentStreak || 0, icon: Zap },
                  { label: 'XP', value: profile?.totalPoints || 0, icon: Brain },
                  { label: 'Tests', value: profile?.testsCompleted || 0, icon: Target },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl p-3 border ${t.border} bg-black/20 backdrop-blur-sm relative group`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition rounded-2xl" />
                    <stat.icon className={`w-4 h-4 ${t.accent} mx-auto mb-1`} />
                    <p className={`text-xl font-black ${t.text}`}>{stat.value}</p>
                    <p className={`text-[10px] font-bold ${t.muted} uppercase`}>{stat.label}</p>
                  </div>
                ))}
              </motion.div>

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="space-y-3"
              >
                <Button
                  onClick={handleContinue}
                  className={`w-full h-14 rounded-xl bg-gradient-to-r ${t.gradient} text-white font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-lg relative group`}
                >
                  <span className="relative z-10">Enter Matrix</span>
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className={`w-full h-12 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 font-bold backdrop-blur-sm`}
                >
                  <LogOut className="w-4 h-4 mr-2" /> Disconnect
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ============================================================================
  // MAIN LANDING PAGE (First‑time / Logged Out) – with theme integration
  // ============================================================================
  return (
    <div className={`min-h-screen ${t.bg} ${t.text} font-sans selection:bg-indigo-500/30 overflow-x-hidden relative`}>
      {/* Background patterns */}
      <div className={`fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${t.gradient} pointer-events-none opacity-5`} />
      <div className="fixed inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(${t.text} 1px, transparent 1px), linear-gradient(90deg, ${t.text} 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />
      {!t.isLight && (
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
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-cyan-500">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className={`font-black text-xl tracking-tight ${t.text}`}>EduBridge</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login?mode=login" className="hidden sm:block">
            <Button variant="ghost" className={`${t.text} hover:${t.accentLight} hover:${t.accent} font-bold`}>
              Sign In
            </Button>
          </Link>
          <Link href="/login?mode=register">
            <Button className={`h-11 px-6 rounded-xl bg-gradient-to-r ${t.gradient} text-white font-bold shadow-lg hover:shadow-xl transition-all`}>
              Start Free
            </Button>
          </Link>
        </div>
      </motion.header>

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
                  <span className={`text-[11px] font-black ${t.text} tracking-widest uppercase`}>Next-Gen Learning Engine</span>
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
                  Upload your syllabus. EduBridge instantly generates a personalized, interactive learning matrix with AI tutors, dynamic stories, and adaptive mastery tracking.
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
                      Initialize Matrix <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="#how-it-works" className="flex-1 relative">
                    <Button variant="outline" className={`w-full h-16 text-lg rounded-2xl border-2 ${t.border} ${t.card} ${t.text} hover:${t.accentLight} font-bold shadow-sm transition-all`}>
                      <Play className="w-5 h-5 mr-2" /> View Demo
                    </Button>
                  </Link>
                </motion.div>

                {/* Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
                >
                  <StatCard icon={Users} value="10k+" label="Scholars" theme={t} />
                  <StatCard icon={Layers} value="1M+" label="Modules Generated" theme={t} />
                  <StatCard icon={Zap} value="2x" label="Faster Learning" theme={t} />
                  <StatCard icon={Star} value="4.9/5" label="Student Rating" theme={t} />
                </motion.div>
              </motion.div>
            </section>

            {/* How It Works Section */}
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
                  />
                  <FeatureCard
                    icon={Cpu}
                    title="2. Neural Generation"
                    desc="The engine builds interactive stories, quizzes, and visual aids based on your hobbies and pacing."
                    color="from-purple-500 to-pink-600"
                    delay={0.2}
                    theme={t}
                  />
                  <FeatureCard
                    icon={Target}
                    title="3. Achieve Mastery"
                    desc="Study seamlessly, level up your profile, and clarify doubts 24/7 with the contextual AI Tutor."
                    color="from-emerald-500 to-teal-600"
                    delay={0.3}
                    theme={t}
                  />
                </div>
              </div>
            </section>

            {/* Features Section */}
            <section className={`py-32 px-6 ${t.bg}`}>
              <div className="max-w-7xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-center mb-20"
                >
                  <Badge className={`mb-4 px-4 py-1.5 ${t.accentBg} text-white border-0 font-bold uppercase tracking-widest`}>Arsenal</Badge>
                  <h2 className={`text-4xl md:text-5xl font-black ${t.text} mb-6 tracking-tight`}>Engineered for Excellence</h2>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { icon: Brain, title: 'Adaptive Narratives', desc: 'Math explained through basketball? Physics via sci-fi? The AI adapts to your hobbies.', color: 'from-indigo-500 to-purple-600' },
                    { icon: MessageCircle, title: 'Contextual AI Tutor', desc: 'A tutor that actually knows what chapter you are reading and answers accordingly.', color: 'from-cyan-500 to-blue-600' },
                    { icon: Trophy, title: 'Deep Gamification', desc: 'Maintain neural streaks, unlock achievement badges, and level up your scholar rank.', color: 'from-amber-500 to-orange-600' },
                    { icon: Target, title: 'Dynamic Assessments', desc: 'Auto-generated quizzes with varying difficulties and intelligent grading.', color: 'from-emerald-500 to-teal-600' },
                    { icon: ImageIcon, title: 'Generative Visuals', desc: 'Complex concepts are paired with stunning, AI-generated custom diagrams.', color: 'from-fuchsia-500 to-rose-600' },
                    { icon: Globe, title: 'The Vibe Engine', desc: 'Switch the entire platform’s aesthetic (Cyberpunk, Zen, etc.) to match your mood.', color: 'from-slate-600 to-slate-800' },
                  ].map((feature, i) => (
                    <FeatureCard
                      key={i}
                      icon={feature.icon}
                      title={feature.title}
                      desc={feature.desc}
                      color={feature.color}
                      delay={i * 0.1}
                      theme={t}
                    />
                  ))}
                </div>
              </div>
            </section>

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
                  Ready to upgrade your brain?
                </h2>
                <p className={`text-xl ${t.muted} mb-12 font-medium`}>
                  Join the platform that is redefining how students absorb, retain, and master complex information.
                </p>
                <div className="flex flex-col sm:flex-row gap-5 justify-center">
                  <Link href="/login?mode=register">
                    <Button className={`w-full sm:w-auto h-16 px-10 text-lg rounded-2xl bg-gradient-to-r ${t.gradient} text-white font-black shadow-xl hover:scale-105 transition-all`}>
                      Create Free Account <UserPlus className="w-6 h-6 ml-3" />
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </section>

            {/* Footer */}
            <footer className={`py-12 px-6 ${t.bg} border-t ${t.border}`}>
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-cyan-500">
                      <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className={`font-black text-lg tracking-tight ${t.text}`}>EduBridge</span>
                  </div>
                  <div className={`flex flex-wrap justify-center gap-6 font-medium text-sm ${t.muted}`}>
                    <Link href="/privacy" className={`hover:${t.accent} transition-colors`}>Privacy Policy</Link>
                    <Link href="/terms" className={`hover:${t.accent} transition-colors`}>Terms of Service</Link>
                    <Link href="/contact" className={`hover:${t.accent} transition-colors`}>Contact Support</Link>
                  </div>
                </div>
                <div className={`text-center text-sm font-medium ${t.muted} pt-8 border-t ${t.border}`}>
                  <p>© {new Date().getFullYear()} EduBridge AI. All rights reserved. Architected for the future.</p>
                </div>
              </div>
            </footer>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}