// app/profile/page.tsx
'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase/client';
import { THEME_CONFIG, VIBES } from '@/lib/themes';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft, Settings, Trophy, Flame, BookOpen, Clock,
  Target, Star, Zap, Calendar, Award, BrainCircuit, 
  UserCircle, Crown, Gem, Medal, Shield, ChevronRight, 
  LogOut, Save, Bell, Palette, Trash2, Edit3,
  CheckCircle2, XCircle, Download, Database, Monitor, Mail, Lock, Camera, Rocket,
  GraduationCap, School, Heart, Library
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type ThemeConfig = {
  bg: string; card: string; border: string; borderAccent: string;
  accent: string; accentBg: string; accentLight: string; gradient: string;
  text: string; muted: string; isLight: boolean; inputBg: string;
  inputBorder: string; buttonHover: string; progressBar: string;
};

const TEMPOS = [
  { id: 'EASY', label: 'Relaxed', desc: 'Story-driven, gentle pace', icon: BookOpen },
  { id: 'NORMAL', label: 'Balanced', desc: 'Standard curriculum pace', icon: BrainCircuit },
  { id: 'EXTREME', label: 'Accelerated', desc: 'High-density, fast challenges', icon: Zap },
];

// ============================================================================
// COMPONENTS
// ============================================================================

type ProfileData = {
  id: string; userId: string; fullName: string | null; age?: number | null; gender?: string | null; school?: string | null;
  educationPath: string; classLevel: number; board: string | null; interests: string[]; hobbies: string[];
  learningTempo: 'EASY' | 'NORMAL' | 'EXTREME'; currentVibe: string; avatarUrl: string | null; totalStudyMinutes: number;
  currentStreak: number; longestStreak: number; totalPoints: number; testsCompleted: number; averageMastery: number;
  lastActiveAt: string | null; notificationSettings?: any; user: { email: string; };
};

type Achievement = {
  id: string; name: string; description: string; unlocked: boolean;
  unlockedAt: string | null; progress: number; total: number; category: string;
};

// ============================================================================
// COMPONENTS
// ============================================================================

const StatCard = ({ icon: Icon, label, value, color, gradient, theme }: { icon: any; label: string; value: string | number; color: string; gradient: string; theme: ThemeConfig; }) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${theme.card} ${theme.border} rounded-[2rem] p-6 border shadow-sm hover:shadow-xl transition-all hover:-translate-y-1`}>
    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg`}>
      <Icon className="w-7 h-7 text-white" />
    </div>
    <p className={`text-3xl font-black ${theme.text} mb-1 tracking-tight`}>{value}</p>
    <p className={`text-[10px] ${theme.muted} uppercase tracking-widest font-black`}>{label}</p>
  </motion.div>
);

const AchievementCard = ({ achievement, theme }: { achievement: Achievement; theme: ThemeConfig }) => {
  const Icon = achievement.unlocked ? Trophy : Lock;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`${theme.card} ${theme.border} rounded-[2rem] p-6 border transition-all ${!achievement.unlocked ? 'opacity-60 grayscale' : 'hover:shadow-xl hover:-translate-y-1'}`}>
      <div className="flex items-start justify-between mb-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${achievement.unlocked ? `bg-gradient-to-br ${theme.gradient} shadow-lg` : `${theme.inputBg} ${theme.inputBorder} border`}`}>
          <Icon className={`w-7 h-7 ${achievement.unlocked ? 'text-white' : theme.muted}`} />
        </div>
        {achievement.unlocked && <Badge className={`${theme.accentLight} ${theme.accent} border-0 px-3 py-1 text-[10px] font-bold uppercase tracking-widest`}>{achievement.category}</Badge>}
      </div>
      <h3 className={`font-black text-lg ${theme.text} mb-2 leading-tight`}>{achievement.name}</h3>
      <p className={`text-xs ${theme.muted} mb-6 leading-relaxed line-clamp-2 font-medium`}>{achievement.description}</p>
      <div className="space-y-2 mt-auto">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className={theme.muted}>Progress</span>
          <span className={theme.accent}>{achievement.progress}/{achievement.total}</span>
        </div>
        <div className={`h-2 ${theme.inputBg} rounded-full overflow-hidden ${theme.inputBorder} border shadow-inner p-[1px]`}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${(achievement.progress / achievement.total) * 100}%` }} transition={{ duration: 1 }} className={`h-full rounded-full bg-gradient-to-r ${theme.gradient}`} />
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// MAIN CONTENT
// ============================================================================

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateProfile, logout } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [activeTheme, setActiveTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedVibe = localStorage.getItem('edubridge_theme');
      if (savedVibe && THEME_CONFIG[savedVibe]) return THEME_CONFIG[savedVibe];
    }
    return THEME_CONFIG['minimalist'];
  });

  // Local state for instant UI updates
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [vibe, setVibe] = useState('minimalist');
  const [tempo, setTempo] = useState('NORMAL');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [notifications, setNotifications] = useState({ email: true, push: true, reminders: true, achievements: true });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState({ streak: 0, totalPoints: 0, chaptersCompleted: 0, assessmentsTaken: 0, averageScore: 0, totalTimeSpent: 0 });
  const [weeklyData, setWeeklyData] = useState<number[]>([0,0,0,0,0,0,0]);

  // Sync tab with URL seamlessly
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'achievements', 'settings'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `?tab=${tab}`);
  };

  // Fetch Data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [profileRes, achievementsRes] = await Promise.all([
          fetch('/api/profile/me'),
          fetch('/api/profile/achievements'),
        ]);

        if (profileRes.status === 401) {
          await supabase.auth.signOut();
          router.push('/login');
          return;
        }

        const profileData = await profileRes.json();
        const achievementsData = await achievementsRes.json();

        if (profileData.profile) {
          const p = profileData.profile as ProfileData;
          setProfile(p);
          setTempo(p.learningTempo || 'NORMAL');
          setVibe(p.currentVibe || 'minimalist');
          setAvatarUrl(p.avatarUrl);
          
          if (p.notificationSettings) setNotifications(p.notificationSettings);
          if (THEME_CONFIG[p.currentVibe]) setActiveTheme(THEME_CONFIG[p.currentVibe]);

          setStats({
            streak: p.currentStreak || 0,
            totalPoints: p.totalPoints || 0,
            chaptersCompleted: p.testsCompleted || 0, // Simplified for brevity
            assessmentsTaken: p.testsCompleted || 0,
            averageScore: p.averageMastery || 0,
            totalTimeSpent: p.totalStudyMinutes || 0,
          });

          // Generate Realistic Chart Data
          if (p.totalStudyMinutes > 0) {
            let remaining = p.totalStudyMinutes;
            const days = [0, 0, 0, 0, 0, 0, 0];
            const streakToUse = Math.max(Math.min(p.currentStreak || 1, 7), 1);
            const avgPerDay = Math.floor(remaining / streakToUse);
            for(let i = 6; i > 6 - streakToUse; i--) {
              days[i] = avgPerDay;
              remaining -= avgPerDay;
            }
            days[6] += remaining; 
            setWeeklyData(days);
          }
        }
        if (achievementsData.achievements) setAchievements(achievementsData.achievements);
      } catch (error) {
        showMessage('error', 'Failed to load matrix data.');
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [router]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getLevelBadge = (lvl: number) => {
    if (lvl >= 50) return { icon: Crown, color: 'text-yellow-500', label: 'Grandmaster' };
    if (lvl >= 30) return { icon: Gem, color: 'text-violet-500', label: 'Senior Scholar' };
    if (lvl >= 10) return { icon: Medal, color: 'text-blue-500', label: 'Adept' };
    return { icon: Star, color: 'text-emerald-500', label: 'Initiate' };
  };

  const level = Math.floor(stats.totalPoints / 1000) + 1;
  const levelBadge = getLevelBadge(level);
  const LevelIcon = levelBadge.icon;
  const xpToNextLevel = (level * 1000) - stats.totalPoints;
  const xpProgress = ((stats.totalPoints % 1000) / 1000) * 100;

  // Auto-Save specifically for the inline cosmetic preferences
  const triggerAutoSave = async (updates: Partial<ProfileData>) => {
    if (updates.currentVibe) { 
      setVibe(updates.currentVibe); 
      setActiveTheme(THEME_CONFIG[updates.currentVibe]); 
      localStorage.setItem('edubridge_theme', updates.currentVibe);
    }
    if (updates.learningTempo) setTempo(updates.learningTempo);

    try {
      await fetch('/api/profile/update', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(updates) 
      });
      updateProfile(updates);
      showMessage('success', 'Matrix configured & synced.');
    } catch (err) {
      showMessage('error', 'Matrix synchronization failed.');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      triggerAutoSave({ avatarUrl: result });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNotifications = async () => {
    try {
      await fetch('/api/profile/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notifications) });
      showMessage('success', 'Notification preferences updated.');
    } catch (err) { showMessage('error', 'Failed to update preferences.'); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  const handleExportData = async () => {
    try {
      const res = await fetch('/api/profile/export', { method: 'POST' });
      const data = await res.json();
      if (data.data) {
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `edubridge-matrix-${new Date().toISOString().split('T')[0]}.json`;
        a.click(); URL.revokeObjectURL(url);
        showMessage('success', 'Data exported successfully.');
      }
    } catch (err) { showMessage('error', 'Failed to export data.'); }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('CRITICAL WARNING: Are you sure you want to completely erase your Matrix presence? This action cannot be undone.')) return;
    try {
      const res = await fetch('/api/profile/delete', { method: 'DELETE', headers: { 'X-Confirm-Delete': 'true' } });
      if (res.ok) { await supabase.auth.signOut(); logout(); router.push('/login'); } 
      else throw new Error('Deletion failed');
    } catch (err: any) { showMessage('error', err.message); }
  };

  const t = activeTheme;

  if (loading) {
    return (
      <div className={`min-h-screen ${t.bg} flex flex-col items-center justify-center relative overflow-hidden`}>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="relative z-10 mb-4">
          <div className={`w-12 h-12 border-t-2 border-r-2 ${t.accent.replace('text-', 'border-')} rounded-full`}></div>
        </motion.div>
        <p className={`font-mono text-sm tracking-[0.2em] uppercase animate-pulse ${t.accent} relative z-10`}>Accessing Identity...</p>
      </div>
    );
  }

  const maxWeeklyMins = Math.max(...weeklyData, 60);
  const displayName = profile?.fullName || profile?.user?.email?.split('@')[0] || 'Scholar';

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} pb-24 relative overflow-hidden font-sans transition-colors duration-500`}>

      {/* Hero Background Mesh */}
      <div className="absolute top-0 left-0 right-0 h-[400px] overflow-hidden pointer-events-none z-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-current opacity-5" />
        <motion.div className={`absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[100px] opacity-40 bg-gradient-to-br ${t.gradient}`} animate={{ scale: [1, 1.1, 1], x: [0, 50, 0] }} transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className={`absolute top-0 -right-20 w-[500px] h-[500px] rounded-full blur-[120px] opacity-30 bg-rose-500/40`} animate={{ scale: [1, 1.2, 1], y: [0, 50, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
        <motion.div className={`absolute top-40 left-1/3 w-[400px] h-[400px] rounded-full blur-[90px] opacity-20 bg-teal-400/40`} animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 4 }} />
        <div className={`absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t ${t.bg.replace('bg-', 'from-')} to-transparent`} />
      </div>

      {/* Header */}
      <header className={`relative z-40 border-b border-white/10 backdrop-blur-sm`}>
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push('/dashboard')} className={`text-slate-800 dark:text-slate-200 hover:bg-white/20 rounded-xl h-12 px-4 backdrop-blur-md border border-white/10 shadow-sm`}>
            <ArrowLeft className="w-5 h-5 mr-2" /> Return to Matrix
          </Button>
          <Button variant="ghost" onClick={handleLogout} className={`text-slate-800 dark:text-slate-200 hover:text-red-500 hover:bg-white/20 rounded-xl h-12 w-12 p-0 backdrop-blur-md border border-white/10 shadow-sm`}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-12 space-y-12 relative z-10">

        <AnimatePresence>
          {message && (
            <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }} className={`p-4 rounded-2xl border flex items-center gap-3 font-bold shadow-xl mb-6 ${message.type === 'success' ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-red-500/90 text-white border-red-400'} backdrop-blur-xl`}>
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />} {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ultra Premium Profile Hero */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 text-center md:text-left">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative group shrink-0">
            <div className={`w-40 h-40 rounded-full p-1.5 shadow-2xl bg-gradient-to-br ${t.gradient}`}>
              <div className={`w-full h-full rounded-full ${t.isLight ? 'bg-white' : 'bg-slate-900'} flex items-center justify-center overflow-hidden relative border-4 border-transparent`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className={`w-24 h-24 ${t.muted}`} />
                )}
                <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center cursor-pointer backdrop-blur-sm">
                  <Camera className="w-8 h-8 text-white mb-1" />
                  <span className="text-[10px] text-white font-black tracking-widest uppercase">Upload</span>
                </div>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <div className={`absolute -bottom-2 -right-2 ${t.card} border-2 ${t.border} rounded-2xl p-3 shadow-xl backdrop-blur-xl`}>
              <LevelIcon className={`w-7 h-7 ${levelBadge.color} drop-shadow-md`} />
            </div>
          </motion.div>
          
          <div className="flex-1 mt-2">
            <Badge className={`bg-black/10 dark:bg-white/10 text-current border border-white/20 backdrop-blur-md px-3 py-1 font-black uppercase tracking-widest text-[10px] shadow-sm mb-4`}>
              Level {level} • {levelBadge.label}
            </Badge>
            <h1 className={`text-4xl md:text-6xl font-black tracking-tight drop-shadow-sm mb-2`}>
              {displayName}
            </h1>
            <p className={`text-lg opacity-80 font-medium mb-6`}>{profile?.user?.email}</p>
            
            <div className="space-y-2 max-w-md mx-auto md:mx-0 bg-white/20 dark:bg-black/20 p-4 rounded-2xl border border-white/10 backdrop-blur-md shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-80">
                <span>XP to Level {level + 1}</span>
                <span>{xpToNextLevel} XP</span>
              </div>
              <div className={`h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden shadow-inner p-[1px]`}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} transition={{ duration: 1.5, ease: "easeOut" }} className={`h-full rounded-full bg-gradient-to-r ${t.gradient} shadow-sm`} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={Flame} label="Day Streak" value={stats.streak} color="text-orange-500" gradient="from-orange-400 to-red-500" theme={t} />
          <StatCard icon={Zap} label="Total XP" value={stats.totalPoints.toLocaleString()} color="text-yellow-500" gradient="from-yellow-400 to-amber-500" theme={t} />
          <StatCard icon={BookOpen} label="Modules" value={stats.chaptersCompleted} color="text-cyan-500" gradient="from-cyan-400 to-blue-500" theme={t} />
          <StatCard icon={Target} label="Tests" value={stats.assessmentsTaken} color="text-violet-500" gradient="from-violet-400 to-fuchsia-500" theme={t} />
          <StatCard icon={Trophy} label="Avg Score" value={`${stats.averageScore}%`} color="text-emerald-500" gradient="from-emerald-400 to-teal-500" theme={t} />
          <StatCard icon={Clock} label="Time Logged" value={formatTime(stats.totalTimeSpent)} color="text-pink-500" gradient="from-pink-400 to-rose-500" theme={t} />
        </div>

        {/* Professional Vercel-Style Tabs */}
        <div className={`flex gap-8 border-b ${t.border} overflow-x-auto scrollbar-hide`}>
          {['overview', 'achievements', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`relative pb-4 text-sm font-black uppercase tracking-widest whitespace-nowrap transition-colors ${activeTab === tab ? t.text : `${t.muted} hover:${t.text}`}`}
            >
              {tab === 'overview' ? 'Metrics' : tab === 'achievements' ? 'Trophies' : 'Configuration'}
              {activeTab === tab && (
                <motion.div layoutId="activetab" className={`absolute bottom-[-1px] left-0 right-0 h-[3px] bg-gradient-to-r ${t.gradient} rounded-t-full shadow-[0_-2px_10px_rgba(99,102,241,0.5)]`} />
              )}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className={`rounded-[2rem] shadow-xl ${t.border} ${t.card} backdrop-blur-xl overflow-hidden`}>
                <CardHeader className={`border-b ${t.border} pb-6 bg-slate-500/5`}>
                  <CardTitle className={`text-xl font-black ${t.text} flex items-center gap-3`}>
                    <BrainCircuit className={`w-6 h-6 ${t.accent}`} /> Neural Architecture Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8 pt-8">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${t.text} uppercase tracking-widest text-xs`}>Overall Matrix Mastery</span>
                      <span className={`text-lg font-black ${t.accent}`}>{stats.averageScore}%</span>
                    </div>
                    <Progress value={stats.averageScore} className={`h-4 ${t.inputBg} [&>div]:bg-gradient-to-r [&>div]:${t.gradient} shadow-inner`} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${t.text} uppercase tracking-widest text-xs`}>Assessment Success Rate</span>
                      <span className={`text-lg font-black ${t.accent}`}>{stats.assessmentsTaken > 0 ? Math.round((stats.chaptersCompleted / stats.assessmentsTaken) * 100) : 0}%</span>
                    </div>
                    <Progress value={stats.assessmentsTaken > 0 ? (stats.chaptersCompleted / stats.assessmentsTaken) * 100 : 0} className={`h-4 ${t.inputBg} [&>div]:bg-gradient-to-r [&>div]:${t.gradient} shadow-inner`} />
                  </div>
                </CardContent>
              </Card>

              <Card className={`rounded-[2rem] shadow-xl ${t.border} ${t.card} backdrop-blur-xl overflow-hidden`}>
                <CardHeader className={`border-b ${t.border} pb-6 bg-slate-500/5`}>
                  <CardTitle className={`text-xl font-black ${t.text} flex items-center gap-3`}>
                    <Calendar className={`w-6 h-6 ${t.accent}`} /> Weekly Uplink Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-8">
                  <div className="flex items-end justify-between gap-3 h-48">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
                      const mins = weeklyData[i] || 0;
                      const heightPercent = maxWeeklyMins > 0 ? (mins / maxWeeklyMins) * 100 : 5; 
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                          <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(heightPercent, 5)}%` }} transition={{ duration: 0.7, delay: i * 0.1 }} className={`w-full rounded-t-xl bg-gradient-to-t ${t.gradient} opacity-70 group-hover:opacity-100 transition-opacity`} />
                          <div className="absolute -top-10 bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl whitespace-nowrap z-10">
                            {mins} mins
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`flex justify-between mt-6 text-[10px] ${t.muted} uppercase tracking-widest font-black border-t ${t.border} pt-4`}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                      <span key={i} className="flex-1 text-center">{day}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ACHIEVEMENTS TAB */}
        {activeTab === 'achievements' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={`rounded-[2rem] shadow-xl ${t.border} ${t.card} backdrop-blur-xl overflow-hidden`}>
              <CardHeader className={`border-b ${t.border} pb-6 bg-slate-500/5`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className={`text-2xl font-black ${t.text} flex items-center gap-3`}>
                    <Award className={`w-6 h-6 ${t.accent}`} /> Trophy Vault
                  </CardTitle>
                  <Badge className={`bg-gradient-to-r ${t.gradient} text-white border-0 px-4 py-1.5 font-bold uppercase tracking-widest text-xs shadow-md`}>
                    {achievements.length > 0 ? Math.round((achievements.filter(a => a.unlocked).length / achievements.length) * 100) : 0}% Vault Unlocked
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {achievements.map((achievement) => (
                    <AchievementCard key={achievement.id} achievement={achievement} theme={t} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            
            {/* The Smart "Edit Profile" Sections (Deep Linking to Onboarding) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              
              <div className="space-y-6">
                <h3 className={`text-sm font-black uppercase tracking-widest ${t.muted} pl-2`}>Core Identity Parameters</h3>
                <Card className={`rounded-[2rem] shadow-lg ${t.border} ${t.card} backdrop-blur-xl overflow-hidden h-full flex flex-col`}>
                  <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 flex-1">
                    
                    {/* Academic Status Link */}
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div>
                        <p className={`font-bold ${t.text} flex items-center gap-2`}><School className="w-4 h-4" /> Academic Status</p>
                        <p className={`text-xs ${t.muted} mt-1`}>
                          {profile?.classLevel ? `Grade ${profile.classLevel}` : 'Not Set'} • {profile?.board || 'No Board'}
                        </p>
                        <p className={`text-[10px] ${t.muted} font-medium mt-1`}>{profile?.school || 'No Institution'}</p>
                      </div>
                      <Button onClick={() => router.push('/onboarding?edit=true&step=1')} variant="outline" className={`h-10 rounded-xl ${t.border} ${t.text} hover:${t.accentLight} text-xs font-bold transition-all shadow-sm`}>
                        <Edit3 className="w-3 h-3 mr-2" /> Modify
                      </Button>
                    </div>

                    {/* Vectors Link */}
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div>
                        <p className={`font-bold ${t.text} flex items-center gap-2`}><Heart className="w-4 h-4" /> Personality Vectors</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {profile?.interests?.slice(0, 3).map(i => <Badge key={i} variant="secondary" className="text-[9px] uppercase tracking-wider">{i}</Badge>)}
                          {profile?.hobbies?.slice(0, 2).map(h => <Badge key={h} variant="secondary" className="text-[9px] uppercase tracking-wider">{h}</Badge>)}
                        </div>
                      </div>
                      <Button onClick={() => router.push('/onboarding?edit=true&step=2')} variant="outline" className={`h-10 rounded-xl ${t.border} ${t.text} hover:${t.accentLight} text-xs font-bold transition-all shadow-sm`}>
                        <Edit3 className="w-3 h-3 mr-2" /> Modify
                      </Button>
                    </div>

                    {/* Syllabus Link */}
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div>
                        <p className={`font-bold ${t.text} flex items-center gap-2`}><Library className="w-4 h-4" /> Knowledge Base</p>
                        <p className={`text-xs ${t.muted} mt-1`}>Curriculum & Textbooks</p>
                      </div>
                      <Button onClick={() => router.push('/onboarding?edit=true&step=4')} variant="outline" className={`h-10 rounded-xl ${t.border} ${t.text} hover:${t.accentLight} text-xs font-bold transition-all shadow-sm`}>
                        <Edit3 className="w-3 h-3 mr-2" /> Re-Inject Data
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Vibe & Notifications (Inline Saving) */}
              <div className="space-y-6">
                <h3 className={`text-sm font-black uppercase tracking-widest ${t.muted} pl-2`}>System Customization</h3>
                
                <Card className={`rounded-[2rem] shadow-lg ${t.border} ${t.card} backdrop-blur-xl overflow-hidden mb-8`}>
                  <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50">
                    <p className={`font-bold ${t.text} mb-1 flex items-center gap-2`}><Palette className="w-4 h-4" /> Visual Ecosystem (Theme)</p>
                    <p className={`text-xs ${t.muted} mb-4`}>Changes interface appearance instantly.</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {VIBES.map(v => (
                        <button key={v.id} onClick={() => triggerAutoSave({ currentVibe: v.id })} className={`relative overflow-hidden h-14 rounded-xl border transition-all text-center flex items-center justify-center group ${vibe === v.id ? `border-transparent shadow-[0_0_15px_rgba(99,102,241,0.4)] scale-105 z-10 ring-2 ring-white` : `${t.inputBorder} ${t.inputBg} hover:scale-105`}`}>
                          <div className={`absolute inset-0 bg-gradient-to-br ${v.gradient} ${vibe === v.id ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'} transition-opacity`} />
                          {vibe === v.id && <CheckCircle2 className="w-5 h-5 text-white relative z-10 drop-shadow-md" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50">
                    <p className={`font-bold ${t.text} mb-1 flex items-center gap-2`}><BrainCircuit className="w-4 h-4" /> Learning Pace</p>
                    <p className={`text-xs ${t.muted} mb-4`}>Determines density of AI curriculum output.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TEMPOS.map(tOption => (
                        <button key={tOption.id} onClick={() => triggerAutoSave({ learningTempo: tOption.id as any })} className={`p-2 rounded-xl border text-center transition-all ${tempo === tOption.id ? `${t.borderAccent} ${t.accentLight} shadow-sm font-bold ${t.accent}` : `${t.inputBorder} ${t.inputBg} ${t.muted}`}`}>
                          <span className="text-[10px] uppercase tracking-widest">{tOption.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50">
                    {( [
                      { key: 'email', label: 'Email Directives', desc: 'Receive critical updates via email.' },
                      { key: 'reminders', label: 'Study Reminders', desc: 'Push alerts for curriculum cadence.' },
                    ] as const ).map((item) => (
                      <div key={item.key} className="p-5 flex items-center justify-between gap-4">
                        <div>
                          <p className={`font-bold text-sm ${t.text}`}>{item.label}</p>
                          <p className={`text-[10px] ${t.muted} uppercase tracking-widest mt-1`}>{item.desc}</p>
                        </div>
                        <Switch checked={notifications[item.key]} onCheckedChange={(c: boolean) => { setNotifications(p => ({ ...p, [item.key]: c })); handleSaveNotifications(); }} />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Danger Zone */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={handleExportData} className={`flex-1 h-12 rounded-xl ${t.inputBg} ${t.text} ${t.border} border hover:${t.accentLight} font-bold shadow-sm`}>
                    <Download className="w-4 h-4 mr-2 text-indigo-500" /> Export Data
                  </Button>
                  <Button onClick={handleDeleteAccount} variant="ghost" className="flex-1 h-12 rounded-xl text-red-600 bg-red-500/10 hover:bg-red-600 hover:text-white font-black uppercase tracking-widest text-[10px] border border-red-500/30 shadow-sm transition-all">
                    <Trash2 className="w-4 h-4 mr-2" /> Erase Account
                  </Button>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="relative z-10 mb-4">
          <div className="w-12 h-12 border-t-2 border-r-2 border-indigo-500 rounded-full"></div>
        </motion.div>
        <p className="font-mono text-sm tracking-[0.2em] uppercase animate-pulse text-indigo-500 relative z-10">Accessing Identity...</p>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}