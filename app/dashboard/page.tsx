// app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase/client';
import { THEME_CONFIG, VIBES } from '@/lib/themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Menu, X, Library, BookOpen, Clock, Flame, Target,
  Trophy, Award, Settings, LogOut, RefreshCw, MessageCircleQuestion,
  ChevronRight, CheckCircle2, Lock, Activity, BrainCircuit, Zap, 
  Star, Crown, Gem, Medal, AlertCircle, Loader2, BookMarked, 
  PlayCircle, Upload, Database, Timer, Sparkles, LayoutDashboard, 
  Bell, FileText, CheckCircle, RotateCcw, User, ArrowRight, Terminal,
  Share2, AlertTriangle
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

type GenerationStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'ARCHIVED';

type ChapterProgress = {
  masteryLevel: number;
  timeSpentSeconds: number;
  completedAt: string | null;
  score?: number | null;
};

type Chapter = {
  id: string;
  chapterNumber: number;
  title: string;
  status: GenerationStatus;
  estimatedMinutes: number;
  difficultyLevel: number;
  tags: string[];
  progress?: ChapterProgress[];
};

type Subject = {
  id: string;
  name: string;
  status: GenerationStatus;
  chapters: Chapter[];
};

type Curriculum = {
  id: string;
  title: string;
  status: GenerationStatus;
  subjects: Subject[];
  createdAt: string;
};

type ProfileData = {
  id: string;
  userId: string;
  fullName: string | null;
  classLevel: number;
  board: string | null;
  currentVibe: string;
  interests: string[];
  avatarUrl: string | null;
  totalStudyMinutes: number;
  currentStreak: number;
  totalPoints: number;
  testsCompleted: number;
  averageMastery: number;
  lastActiveAt: string | null;
  user: { email: string; curriculums?: Curriculum[] };
};

type Achievement = {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number;
  total: number;
  category: string;
};

type Assessment = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  subject: string;
  type: 'quiz' | 'test' | 'practice';
  status: 'locked' | 'available' | 'completed';
  score: number;
  maxScore: number;
  timeLimit: number;
  completedAt?: string;
  canRetake: boolean;
};

type Stat = {
  id: string;
  title: string;
  value: string | number;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
};

// ============================================================================
// CATEGORY COLORS
// ============================================================================

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string; icon: any }> = {
  learning: { text: 'text-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: BookOpen },
  streak: { text: 'text-orange-600', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: Flame },
  mastery: { text: 'text-violet-600', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: Target },
  social: { text: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Share2 },
};

const NAV_ITEMS = [
  { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
  { id: 'lessons', label: 'Matrix Curriculum', icon: Database },
  { id: 'assessments', label: 'Assessment Protocol', icon: Target },
  { id: 'achievements', label: 'Trophy Vault', icon: Trophy },
];

// ============================================================================
// SKELETON LOADER COMPONENTS
// ============================================================================

const SubjectSkeleton = () => (
  <Card className="rounded-3xl border border-slate-200/30 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm animate-pulse">
    <div className="p-6 border-b border-slate-200/30">
      <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-xl mb-2" />
      <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
    </div>
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
      ))}
    </div>
  </Card>
);

const AssessmentSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <Card key={i} className="rounded-3xl border border-slate-200/30 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm animate-pulse h-64" />
    ))}
  </div>
);

// ============================================================================
// ANIMATED GREETING COMPONENT (STRICT-MODE PROOF)
// ============================================================================

const AnimatedGreeting = ({ name, theme, lastActive }: { name: string, theme: any, lastActive: string | null }) => {
  const [phase, setPhase] = useState<'booting' | 'typing'>('booting');
  const [text, setText] = useState('');
  
  useEffect(() => {
    const bootTimer = setTimeout(() => setPhase('typing'), 1200);
    return () => clearTimeout(bootTimer);
  }, []);

  useEffect(() => {
    if (phase !== 'typing') return;

    let baseGreeting = '';
    const hour = new Date().getHours();
    
    if (lastActive) {
      const hoursSinceLastActive = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastActive > 48) {
        baseGreeting = `Neural link re-established. Welcome back, ${name}.`;
      } else {
        baseGreeting = hour < 12 ? `Morning protocol initiated, ${name}.` : hour < 18 ? `Afternoon sync complete, ${name}.` : `Evening matrix active, ${name}.`;
      }
    } else {
      baseGreeting = `Welcome to the neural matrix, ${name}.`;
    }

    let i = 0;
    setText('');
    
    const typingTimer = setInterval(() => {
      i++;
      setText(baseGreeting.substring(0, i));
      if (i >= baseGreeting.length) clearInterval(typingTimer);
    }, 35);
    
    return () => clearInterval(typingTimer);
  }, [name, lastActive, phase]);

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${theme.card} border ${theme.border} shadow-sm backdrop-blur-md mb-4`}>
        <div className={`w-2 h-2 rounded-full ${theme.accentBg} animate-pulse shadow-[0_0_8px_currentColor]`} />
        <span className={`font-mono text-xs font-bold tracking-widest ${theme.accent} uppercase flex items-center gap-2`}>
          <Terminal className="w-3 h-3" /> System Status: Optimal
        </span>
      </div>
      <h1 className={`text-4xl md:text-5xl font-black ${theme.text} tracking-tight min-h-[60px] md:min-h-[80px]`}>
        {phase === 'booting' ? (
          <span className="text-slate-400 font-mono text-2xl animate-pulse">{'>'} Handshake protocol...</span>
        ) : (
          <>{text}<span className={`animate-pulse ${theme.accent}`}>_</span></>
        )}
      </h1>
    </motion.div>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateProfile, logout } = useStore();
  
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 50], [1, 0.9]);
  const headerBlur = useTransform(scrollY, [0, 50], ['blur(0px)', 'blur(16px)']);
  const headerY = useTransform(scrollY, [0, 50], [0, -10]);

  // State
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [generatedAssessments, setGeneratedAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState(searchParams.get('view') || 'overview');
  const [refreshing, setRefreshing] = useState(false);
  
  // Notifications State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>('default');
  const notifRef = useRef<HTMLDivElement>(null);

  // Sync View with URL silently
  useEffect(() => {
    if (activeView !== searchParams.get('view')) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', activeView);
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeView, searchParams]);

  // Notifications logic
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Your browser or app does not support native notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    
    if (permission === 'granted') {
      new Notification('EduBridge Uplink Established', {
        body: 'You will now receive neural matrix updates and study reminders directly.',
        icon: '/logo.png'
      });
    }
  };

  // Fetch Data
  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError('');

      const [profileRes, achievementsRes] = await Promise.all([
        fetch('/api/profile/me', { cache: 'no-store' }),
        fetch('/api/profile/achievements', { cache: 'no-store' }),
      ]);

      if (profileRes.status === 401) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      if (!profileRes.ok) throw new Error('Failed to load profile data.');
      
      const profileData = await profileRes.json();
      const achievementsData = await achievementsRes.json();

      const p = profileData.profile as ProfileData;
      setProfile(p);
      setCurriculums(p.user?.curriculums || []);
      setAchievements(achievementsData.achievements || []);
      updateProfile(p);

      // Generate Assessments map
      const assessments: Assessment[] = [];
      p.user?.curriculums?.forEach((curr: Curriculum) => {
        curr.subjects.forEach((sub: Subject) => {
          sub.chapters.forEach((chapter: Chapter, index: number) => {
            const isCompleted = chapter.progress?.some((prog: ChapterProgress) => prog.completedAt !== null) ?? false;
            const isLocked = index > 0 && !(sub.chapters[index - 1].progress?.some((prog: ChapterProgress) => prog.completedAt !== null) ?? false);
            
            assessments.push({
              id: `assess-${chapter.id}`,
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              subject: sub.name,
              status: isCompleted ? 'completed' : isLocked || chapter.status === 'PENDING' ? 'locked' : 'available',
              score: chapter.progress?.[0]?.score ?? 0,
              maxScore: 100,
              completedAt: chapter.progress?.[0]?.completedAt ?? undefined,
              canRetake: isCompleted,
              type: 'quiz',
              timeLimit: 15,
            });
          });
        });
      });
      setGeneratedAssessments(assessments);

    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, updateProfile]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  // Loading Splash Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} className="relative z-10 mb-6">
          <div className="w-16 h-16 border-t-2 border-r-2 border-cyan-400 rounded-full"></div>
          <div className="absolute inset-2 border-b-2 border-l-2 border-indigo-500 rounded-full"></div>
        </motion.div>
        <p className="text-cyan-400 font-mono text-sm tracking-[0.3em] uppercase animate-pulse relative z-10">Syncing Matrix...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center justify-center p-4">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Connection Error</h2>
        <p className="text-slate-400 text-center max-w-md mb-8">{error || 'Unable to load profile data.'}</p>
        <Button onClick={fetchData} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  // Derived Data
  const themeName = profile.currentVibe || 'minimalist';
  const theme = THEME_CONFIG[themeName] || THEME_CONFIG['minimalist'];
  const displayName = profile.fullName || profile.user?.email?.split('@')[0] || 'Scholar';
  const initials = displayName.substring(0, 2).toUpperCase();
  const level = Math.floor((profile.totalPoints || 0) / 1000) + 1;
  const hasNoCurriculum = curriculums.length === 0;

  const getLevelBadge = (lvl: number) => {
    if (lvl >= 50) return { icon: Crown, color: 'text-yellow-500', label: 'Grandmaster' };
    if (lvl >= 30) return { icon: Gem, color: 'text-violet-500', label: 'Senior Scholar' };
    if (lvl >= 10) return { icon: Medal, color: 'text-blue-500', label: 'Adept' };
    return { icon: Star, color: 'text-emerald-500', label: 'Initiate' };
  };
  const levelBadge = getLevelBadge(level);

  // "Up Next" Logic
  let nextChapterInfo: { chapter: Chapter, subjectName: string } | null = null;
  if (curriculums.length > 0) {
    for (const subject of curriculums[0].subjects) {
      const pendingChapter = subject.chapters.find(ch => 
        ch.status === 'COMPLETED' && !(ch.progress?.some(p => p.completedAt !== null) ?? false)
      );
      if (pendingChapter) {
        nextChapterInfo = { chapter: pendingChapter, subjectName: subject.name };
        break;
      }
    }
  }

  // ============================================================================
  // RENDER: OVERVIEW
  // ============================================================================
  const renderOverview = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      
      <AnimatedGreeting name={displayName} theme={theme} lastActive={profile.lastActiveAt} />

      {/* Holographic Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className={`rounded-3xl border-0 overflow-hidden bg-gradient-to-br ${theme.gradient} text-white shadow-2xl relative group h-full`}>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay" />
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            <CardContent className="p-8 relative z-10 flex flex-col justify-center h-full">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-3">Clearance Level</p>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  <Crown className="w-10 h-10 text-yellow-300 drop-shadow-md" />
                </div>
                <div>
                  <p className="text-4xl font-black drop-shadow-sm">Level {level}</p>
                  <p className="text-sm font-medium text-white/90 tracking-wide mt-1">{profile.totalPoints} Total XP</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className={`rounded-3xl ${theme.card} border border-orange-500/20 shadow-lg hover:shadow-orange-500/10 transition-all h-full relative overflow-hidden group`}>
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-8 flex items-center justify-between h-full relative z-10">
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest ${theme.muted} mb-2`}>Neural Streak</p>
                <p className={`text-4xl font-black ${theme.text}`}>{profile.currentStreak} <span className="text-lg font-bold text-orange-500">Days</span></p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/30 shadow-[inset_0_0_20px_rgba(249,115,22,0.1)] group-hover:scale-110 transition-transform">
                <Flame className="w-8 h-8 text-orange-500 drop-shadow-[0_0_12px_rgba(249,115,22,0.6)]" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className={`rounded-3xl ${theme.card} border border-emerald-500/20 shadow-lg hover:shadow-emerald-500/10 transition-all h-full relative overflow-hidden group`}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-8 flex items-center justify-between h-full relative z-10">
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest ${theme.muted} mb-2`}>Assessment Avg</p>
                <p className={`text-4xl font-black ${theme.text}`}>{profile.averageMastery}<span className="text-2xl text-emerald-500">%</span></p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] group-hover:scale-110 transition-transform">
                <Target className="w-8 h-8 text-emerald-500 drop-shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Action Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Mission Control (Takes up 2/3) */}
        <div className="xl:col-span-2 space-y-4">
          <h3 className={`text-sm font-bold uppercase tracking-widest ${theme.muted} pl-2 flex items-center gap-2`}>
            <Zap className="w-4 h-4" /> Active Directive
          </h3>
          
          {hasNoCurriculum ? (
            <Card className={`rounded-3xl ${theme.card} ${theme.border} border border-dashed p-12 text-center group cursor-pointer hover:border-indigo-500 transition-colors shadow-sm`}>
              <div className={`w-24 h-24 rounded-full ${theme.accentLight} flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform`}>
                <Database className={`w-12 h-12 ${theme.accent}`} />
              </div>
              <h2 className={`text-2xl font-bold ${theme.text} mb-3`}>Data Matrix Empty</h2>
              <p className={`${theme.muted} max-w-md mx-auto mb-8 text-sm`}>Establish a connection by uploading your syllabus. The AI will immediately construct your personalized learning pathway.</p>
              <Link href="/onboarding">
                <Button className={`h-14 px-10 rounded-2xl bg-gradient-to-r ${theme.gradient} text-white font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all`}>
                  <Upload className="w-5 h-5 mr-3" /> Inject Syllabus
                </Button>
              </Link>
            </Card>
          ) : nextChapterInfo ? (
            <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
              <Card className={`rounded-3xl ${theme.card} border-2 border-indigo-500/30 shadow-xl overflow-hidden relative group`}>
                <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${theme.gradient}`} />
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] group-hover:bg-indigo-500/10 transition-colors" />
                <CardContent className="p-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1">
                    <Badge className={`mb-3 ${theme.accentLight} ${theme.accent} border-0 px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold shadow-sm`}>
                      <Star className="w-3 h-3 mr-1 inline-block" /> Priority Node • {nextChapterInfo.subjectName}
                    </Badge>
                    <h3 className={`text-2xl md:text-3xl font-black ${theme.text} mb-3 leading-tight`}>
                      CH {nextChapterInfo.chapter.chapterNumber}: {nextChapterInfo.chapter.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Clock className="w-4 h-4" /> Est. {nextChapterInfo.chapter.estimatedMinutes} Min
                      </span>
                    </div>
                  </div>
                  <Link href={`/lesson/chapter/${nextChapterInfo.chapter.id}`}>
                    <Button className={`w-full md:w-auto h-16 px-8 rounded-2xl bg-gradient-to-r ${theme.gradient} text-white font-bold text-lg shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] hover:-translate-y-1 transition-all group-hover:scale-105`}>
                      <PlayCircle className="w-6 h-6 mr-2" /> Initialize
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card className={`rounded-3xl ${theme.card} border-2 border-emerald-500/30 p-12 text-center shadow-lg bg-emerald-500/5`}>
              <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <CheckCircle className={`w-12 h-12 text-emerald-500`} />
              </div>
              <h3 className={`text-2xl font-black ${theme.text} mb-2`}>Matrix Conquered</h3>
              <p className={`${theme.muted} max-w-sm mx-auto`}>You have achieved 100% mastery over all currently injected curriculums. Awaiting new data.</p>
            </Card>
          )}
        </div>

        {/* Support System (Takes up 1/3) */}
        <div className="space-y-4">
          <h3 className={`text-sm font-bold uppercase tracking-widest ${theme.muted} pl-2 flex items-center gap-2`}>
            <Activity className="w-4 h-4" /> Support Node
          </h3>
          <Link href="/doubts" className="block h-full">
            <Card className={`rounded-3xl border border-white/10 bg-gradient-to-b from-slate-800 to-black text-white hover:scale-[1.02] transition-transform cursor-pointer relative overflow-hidden shadow-2xl h-[calc(100%-2rem)] min-h-[250px]`}>
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-indigo-500/40 blur-[70px] rounded-full" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-500/30 blur-[60px] rounded-full" />
              
              <CardContent className="p-8 relative z-10 flex flex-col items-center justify-center h-full text-center">
                <div className="p-4 bg-white/5 rounded-3xl backdrop-blur-xl border border-white/10 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                  <BrainCircuit className="w-12 h-12 text-indigo-300" />
                </div>
                <h3 className="text-2xl font-black mb-2 tracking-tight">AI Oracle Link</h3>
                <p className="text-sm text-slate-300 mb-8 font-medium px-4">Encountered an anomaly? Connect to the neural engine for instant clarity and concept breakdown.</p>
                <div className="flex items-center text-white font-bold text-xs uppercase tracking-widest bg-indigo-500/20 px-6 py-3 rounded-xl border border-indigo-500/30 backdrop-blur-sm hover:bg-indigo-500/40 transition-colors w-full justify-center">
                  Establish Uplink <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </motion.div>
  );

  // ============================================================================
  // RENDER: CURRICULUM (with empty state)
  // ============================================================================
  const renderCurriculum = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200/50">
        <div>
          <h2 className={`text-3xl font-black ${theme.text} tracking-tight`}>Curriculum Matrix</h2>
          <p className={`text-sm ${theme.muted} mt-1`}>Your complete personalized learning pathway.</p>
        </div>
        {curriculums.length > 0 && (
          <Button variant="outline" size="sm" onClick={fetchData} className="rounded-xl">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>
      
      {hasNoCurriculum ? (
        <Card className={`rounded-3xl ${theme.card} ${theme.border} border border-dashed p-16 text-center`}>
          <div className={`w-28 h-28 rounded-full ${theme.accentLight} flex items-center justify-center mx-auto mb-6`}>
            <Database className={`w-14 h-14 ${theme.accent}`} />
          </div>
          <h3 className={`text-2xl font-black ${theme.text} mb-3`}>No Curriculum Found</h3>
          <p className={`${theme.muted} max-w-md mx-auto mb-8`}>Your learning matrix is empty. Upload your syllabus to begin your personalized journey.</p>
          <Link href="/onboarding">
            <Button className={`h-14 px-10 rounded-2xl bg-gradient-to-r ${theme.gradient} text-white font-bold text-lg shadow-lg hover:shadow-xl`}>
              <Upload className="w-5 h-5 mr-3" /> Upload Syllabus
            </Button>
          </Link>
        </Card>
      ) : refreshing ? (
        <SubjectSkeleton />
      ) : (
        curriculums.map((curr) => (
          <div key={curr.id} className="space-y-8">
            {curr.subjects.map((sub) => {
              const completed = sub.chapters.filter(ch => ch.progress?.some(p => p.completedAt)).length;
              const progress = sub.chapters.length > 0 ? (completed / sub.chapters.length) * 100 : 0;
              
              return (
                <Card key={sub.id} className={`rounded-3xl ${theme.card} ${theme.border} border overflow-hidden shadow-xl`}>
                  {/* Subject Header */}
                  <div className={`p-6 border-b ${theme.border} ${theme.isLight ? 'bg-slate-50/50' : 'bg-black/20'} flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden`}>
                    <div className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${theme.gradient}`} />
                    <div className="pl-4">
                      <h3 className={`text-2xl font-black ${theme.text} flex items-center gap-3 tracking-tight`}>
                        <BookOpen className={`w-6 h-6 ${theme.accent}`} /> {sub.name}
                      </h3>
                      <p className={`text-sm font-medium mt-1 ${theme.muted}`}>{completed} of {sub.chapters.length} Modules Conquered</p>
                    </div>
                    <div className="w-full md:w-72 bg-white/50 dark:bg-black/20 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-sm">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                        <span className={theme.muted}>Subject Mastery</span>
                        <span className={theme.accent}>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className={`h-2 ${theme.isLight ? 'bg-slate-200' : 'bg-slate-800'} [&>div]:${theme.accentBg} shadow-inner`} />
                    </div>
                  </div>
                  
                  {/* Chapters Grid */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {sub.chapters.map((ch, idx) => {
                      const isCompleted = ch.progress?.some(p => p.completedAt !== null) ?? false;
                      const isLocked = ch.status === 'PENDING' || (idx > 0 && !(sub.chapters[idx - 1].progress?.some(p => p.completedAt !== null) ?? false));
                      
                      return (
                        <Link href={isLocked ? '#' : `/lesson/chapter/${ch.id}`} key={ch.id}>
                          <div className={`p-6 rounded-2xl border transition-all h-full flex flex-col relative overflow-hidden group ${
                            isCompleted ? `bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5` : 
                            isLocked ? `${theme.isLight ? 'bg-slate-50' : 'bg-slate-900/50'} border-transparent opacity-60 cursor-not-allowed` : 
                            `${theme.card} ${theme.border} hover:border-${theme.accent.split('-')[1]}-400 hover:shadow-xl cursor-pointer`
                          }`}>
                            {!isLocked && !isCompleted && (
                              <div className={`absolute top-0 right-0 w-32 h-32 ${theme.accentLight} blur-[50px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity`} />
                            )}
                            
                            <div className="flex justify-between items-start mb-5 relative z-10">
                              <Badge variant="outline" className={`font-mono text-xs border border-current/20 px-2 py-1 ${isCompleted ? 'bg-emerald-100 text-emerald-700' : isLocked ? 'text-slate-400' : `${theme.accentLight} ${theme.accent}`}`}>
                                CH {ch.chapterNumber}
                              </Badge>
                              {isCompleted ? (
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                </div>
                              ) : isLocked ? (
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                  <Lock className={`w-4 h-4 text-slate-500`} />
                                </div>
                              ) : (
                                <div className={`w-8 h-8 rounded-full ${theme.accentLight} flex items-center justify-center border border-current/10 group-hover:scale-110 transition-transform`}>
                                  <PlayCircle className={`w-4 h-4 ${theme.accent}`} />
                                </div>
                              )}
                            </div>
                            
                            <h4 className={`font-bold text-lg mb-3 ${theme.text} line-clamp-2 relative z-10 leading-snug group-hover:${theme.accent} transition-colors`}>
                              {ch.title}
                            </h4>
                            
                            <div className="mt-auto flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 relative z-10 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
                              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {ch.estimatedMinutes} Min</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        ))
      )}
    </motion.div>
  );

  // ============================================================================
  // RENDER: ASSESSMENTS (with retake and proper states)
  // ============================================================================
  const renderAssessments = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200/50">
        <div>
          <h2 className={`text-3xl font-black ${theme.text} tracking-tight`}>Assessment Protocol</h2>
          <p className={`text-sm ${theme.muted} mt-1`}>Evaluate your neural synchronization across all modules.</p>
        </div>
        {generatedAssessments.length > 0 && (
          <Button variant="outline" size="sm" onClick={fetchData} className="rounded-xl">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      </div>

      {hasNoCurriculum ? (
        <Card className={`rounded-3xl ${theme.card} ${theme.border} border border-dashed p-16 text-center`}>
          <div className={`w-28 h-28 rounded-full ${theme.accentLight} flex items-center justify-center mx-auto mb-6`}>
            <Target className={`w-14 h-14 ${theme.accent}`} />
          </div>
          <h3 className={`text-2xl font-black ${theme.text} mb-3`}>No Assessments Available</h3>
          <p className={`${theme.muted} max-w-md mx-auto mb-8`}>Complete chapters to unlock assessments and track your mastery.</p>
          <Link href="/onboarding">
            <Button className={`h-14 px-10 rounded-2xl bg-gradient-to-r ${theme.gradient} text-white font-bold text-lg shadow-lg hover:shadow-xl`}>
              <Upload className="w-5 h-5 mr-3" /> Upload Syllabus First
            </Button>
          </Link>
        </Card>
      ) : refreshing ? (
        <AssessmentSkeleton />
      ) : generatedAssessments.length === 0 ? (
        <Card className={`rounded-3xl ${theme.card} ${theme.border} p-12 text-center`}>
          <CheckCircle className={`w-16 h-16 ${theme.accent} mx-auto mb-4`} />
          <h3 className={`text-2xl font-black ${theme.text} mb-2`}>All Assessments Conquered</h3>
          <p className={`${theme.muted} max-w-md mx-auto`}>You have completed every available assessment. New chapters will unlock more challenges.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {generatedAssessments.map((assessment) => {
            const isCompleted = assessment.status === 'completed';
            const isLocked = assessment.status === 'locked';

            return (
              <Card key={`assessment-${assessment.id}`} className={`rounded-3xl ${theme.card} ${theme.border} border overflow-hidden relative group ${isLocked ? 'opacity-60 grayscale-[0.3]' : 'hover:shadow-2xl transition-all hover:-translate-y-1'}`}>
                {!isLocked && !isCompleted && (
                  <div className={`absolute -right-10 -bottom-10 w-40 h-40 ${theme.accentBg} opacity-10 blur-[50px] rounded-full group-hover:opacity-20 transition-opacity`} />
                )}
                
                <CardContent className="p-8 relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <Badge className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest border border-current/20 ${isCompleted ? 'bg-emerald-500/10 text-emerald-600' : isLocked ? 'bg-slate-500/10 text-slate-500' : `${theme.accentLight} ${theme.accent}`}`}>
                      {assessment.subject}
                    </Badge>
                    {isCompleted ? (
                      <div className="p-2 bg-emerald-100 rounded-xl border border-emerald-200 shadow-sm">
                        <Trophy className="w-5 h-5 text-emerald-600" />
                      </div>
                    ) : isLocked ? (
                      <div className="p-2 bg-slate-100 rounded-xl">
                        <Lock className="w-5 h-5 text-slate-400" />
                      </div>
                    ) : (
                      <div className={`p-2 ${theme.accentLight} rounded-xl border border-current/10 shadow-sm`}>
                        <Target className={`w-5 h-5 ${theme.accent} animate-pulse`} />
                      </div>
                    )}
                  </div>
                  
                  <h3 className={`font-black text-xl ${theme.text} mb-2 leading-tight line-clamp-2`}>{assessment.chapterTitle}</h3>
                  <p className={`text-xs font-bold uppercase tracking-widest ${theme.muted} mb-8`}>Module Evaluation</p>
                  
                  {isCompleted ? (
                    <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/20 shadow-inner flex justify-between items-center">
                      <div>
                        <p className={`text-[10px] uppercase tracking-widest text-emerald-600/70 font-bold mb-1`}>Score Achieved</p>
                        <p className="text-4xl font-black text-emerald-600 drop-shadow-sm">{assessment.score}<span className="text-xl">%</span></p>
                      </div>
                      <Link href={`/assessment/${assessment.chapterId}`}>
                        <Button size="icon" className={`w-12 h-12 rounded-xl bg-white text-emerald-600 hover:bg-emerald-50 hover:scale-105 border border-emerald-200 shadow-md transition-all`}>
                          <RotateCcw className="w-5 h-5" />
                        </Button>
                      </Link>
                    </div>
                  ) : isLocked ? (
                    <div className="pt-6 border-t border-slate-200/50 flex flex-col items-center justify-center text-center">
                      <Lock className="w-6 h-6 text-slate-300 mb-2" />
                      <p className={`text-xs font-bold uppercase tracking-widest text-slate-400`}>
                        Clear previous module to unlock
                      </p>
                    </div>
                  ) : (
                    <div className="pt-6 border-t border-slate-200/50">
                      <Link href={`/assessment/${assessment.chapterId}`}>
                        <Button className={`w-full h-14 rounded-2xl bg-gradient-to-r ${theme.gradient} text-white font-black tracking-widest uppercase text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all`}>
                          <Zap className="w-4 h-4 mr-2" /> Initialize Test
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </motion.div>
  );

  // ============================================================================
  // RENDER: ACHIEVEMENTS
  // ============================================================================
  const renderAchievements = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200/50">
        <div>
          <h2 className={`text-3xl font-black ${theme.text} tracking-tight`}>Trophy Vault</h2>
          <p className={`text-sm ${theme.muted} mt-1`}>Records of your academic excellence.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="rounded-xl">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {achievements.map((achievement) => (
          <Card key={achievement.id} className={`rounded-3xl border transition-all overflow-hidden text-center p-8 relative group ${achievement.unlocked ? `${theme.card} ${theme.border} shadow-xl hover:-translate-y-2 hover:shadow-2xl` : `bg-slate-500/5 border-transparent opacity-60 grayscale`}`}>
            
            {achievement.unlocked && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay" />
            )}

            <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-6 relative ${achievement.unlocked ? `bg-gradient-to-br ${theme.gradient} shadow-[0_0_30px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] transition-shadow` : 'bg-slate-200'}`}>
              <Medal className={`w-12 h-12 ${achievement.unlocked ? 'text-white drop-shadow-md' : 'text-slate-400'}`} />
              {achievement.unlocked && (
                <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-[spin_10s_linear_infinite]" />
              )}
            </div>
            
            <h3 className={`font-black text-lg ${theme.text} mb-2 leading-tight`}>{achievement.name}</h3>
            <p className={`text-xs font-medium ${theme.muted} mb-8 leading-relaxed line-clamp-3`}>{achievement.description}</p>
            
            <div className="space-y-3 mt-auto w-full">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className={theme.muted}>Progress</span>
                <span className={achievement.unlocked ? theme.accent : theme.muted}>{achievement.progress}/{achievement.total}</span>
              </div>
              <div className="h-2 bg-slate-200/50 rounded-full overflow-hidden shadow-inner p-0.5 border border-slate-300/30">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(achievement.progress / achievement.total) * 100}%` }}
                  className={`h-full rounded-full ${achievement.unlocked ? `bg-gradient-to-r ${theme.gradient} shadow-sm` : 'bg-slate-400'}`}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} font-sans relative overflow-x-hidden transition-colors duration-500 selection:bg-indigo-500/30`}>
      
      {/* Dynamic Ambient Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(${theme.text.replace('text-', 'text-')} 1px, transparent 1px), linear-gradient(90deg, ${theme.text.replace('text-', 'text-')} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.05, 0.08, 0.05] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} className={`absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br ${theme.gradient} rounded-full blur-[150px]`} />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.03, 0.06, 0.03] }} transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }} className={`absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-gradient-to-br ${theme.gradient} rounded-full blur-[180px]`} />
      </div>

      {/* HEADER */}
      <motion.header style={{ opacity: headerOpacity, filter: headerBlur, y: headerY }} className={`fixed top-0 w-full z-40 ${theme.card}/70 backdrop-blur-3xl border-b ${theme.border} shadow-sm transition-all duration-300`}>
        <div className="max-w-screen-2xl mx-auto px-4 h-20 flex items-center justify-between">
          
          {/* Left: Menu & Logo */}
          <div className="flex items-center gap-5">
            <button onClick={() => setIsSidebarOpen(true)} className={`p-3 rounded-2xl ${theme.isLight ? 'bg-white/50' : 'bg-black/20'} border ${theme.border} shadow-sm hover:${theme.accentLight} hover:scale-105 active:scale-95 transition-all group`}>
              <Menu className={`w-5 h-5 ${theme.text} group-hover:${theme.accent} transition-colors`} />
            </button>
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] flex items-center justify-center border-2 border-white/20 group-hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] transition-all">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
              <h1 className={`text-2xl font-black tracking-tight ${theme.text} hidden sm:block group-hover:${theme.accent} transition-colors`}>EduBridge</h1>
            </Link>
          </div>

          {/* Right: Notifications & Profile */}
          <div className="flex items-center gap-5 relative">
            
            {/* Functional Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`p-3 rounded-full transition-all relative border border-transparent hover:${theme.border} ${isNotifOpen ? `${theme.accentLight} ${theme.accent}` : `${theme.muted} hover:bg-slate-500/5 hover:${theme.text}`}`}
              >
                <Bell className="w-5 h-5" />
                {notifPermission !== 'granted' && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute right-0 top-14 w-80 ${theme.card} border ${theme.border} shadow-2xl rounded-3xl p-5 z-50 backdrop-blur-3xl`}
                  >
                    <h3 className={`font-black ${theme.text} mb-4 flex items-center justify-between text-lg`}>
                      System Alerts
                      {notifPermission === 'granted' && <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] uppercase tracking-widest font-bold">Active</Badge>}
                    </h3>
                    
                    {notifPermission !== 'granted' ? (
                      <div className="bg-slate-500/5 rounded-2xl p-6 text-center border border-slate-500/10">
                        <div className="w-12 h-12 bg-slate-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Bell className={`w-6 h-6 ${theme.muted}`} />
                        </div>
                        <p className={`text-sm font-bold ${theme.text} mb-2`}>Enable Notifications</p>
                        <p className={`text-xs ${theme.muted} mb-5 leading-relaxed`}>Never miss a neural matrix update, study reminder, or achievement unlock.</p>
                        <Button onClick={enableNotifications} className={`w-full rounded-xl bg-gradient-to-r ${theme.gradient} text-white shadow-md font-bold text-xs h-10 hover:shadow-lg`}>
                          Allow Notifications
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className={`flex gap-4 p-4 rounded-2xl ${theme.accentLight} border border-indigo-500/20`}>
                          <div className={`w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0`}>
                            <Sparkles className={`w-5 h-5 ${theme.accent}`} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${theme.text} mb-1`}>Neural Link Active</p>
                            <p className={`text-xs ${theme.muted} leading-relaxed`}>Push notifications are successfully configured for this device.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Direct Profile Button */}
            <button 
              onClick={() => router.push('/profile')}
              className={`flex items-center gap-4 pl-5 border-l border-slate-300/30 cursor-pointer group text-left outline-none rounded-r-full p-1 hover:bg-slate-500/5 transition-all`}
            >
              <div className="hidden md:block">
                <p className={`text-sm font-black ${theme.text} group-hover:${theme.accent} transition-colors tracking-tight`}>
                  {displayName}
                </p>
                <p className={`text-[10px] uppercase tracking-widest font-bold ${theme.accent} mt-0.5 opacity-80 group-hover:opacity-100`}>
                  {levelBadge.label}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full overflow-hidden border-[3px] ${theme.border} group-hover:border-indigo-400 transition-all bg-slate-100 flex items-center justify-center shadow-md group-hover:shadow-lg`}>
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-slate-600">{initials}</span>
                )}
              </div>
            </button>

          </div>
        </div>
      </motion.header>

      {/* SIDEBAR DRAWER NAVIGATION */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className={`fixed top-0 left-0 h-full w-[320px] z-50 ${theme.card} backdrop-blur-3xl border-r ${theme.border} shadow-[20px_0_50px_rgba(0,0,0,0.1)] flex flex-col`}>
              
              <div className={`p-8 border-b border-white/10 flex justify-between items-center bg-gradient-to-br ${theme.gradient} text-white shadow-inner relative overflow-hidden`}>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-lg">
                    <Activity className="w-7 h-7 text-white drop-shadow-md" />
                  </div>
                  <div>
                    <h2 className={`font-black tracking-widest text-sm uppercase drop-shadow-sm`}>Control Node</h2>
                    <p className="text-[10px] font-medium text-white/70 uppercase tracking-widest mt-1">System Navigation</p>
                  </div>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className={`p-2 rounded-full hover:bg-white/20 text-white transition-colors relative z-10`}>
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex flex-col p-6 gap-3 flex-1 overflow-y-auto">
                <p className={`text-[10px] font-black uppercase tracking-widest ${theme.muted} pl-2 pt-2 pb-1`}>Main Matrix</p>
                {NAV_ITEMS.map((item) => (
                  <button 
                    key={item.id} 
                    onClick={() => { setActiveView(item.id); setIsSidebarOpen(false); }}
                    className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm w-full
                      ${activeView === item.id ? `bg-gradient-to-r ${theme.gradient} text-white shadow-xl scale-[1.02] border-0` : `${theme.text} hover:${theme.accentLight} hover:scale-[1.01] border border-transparent hover:${theme.border}`}`
                    }
                  >
                    <item.icon className={`w-5 h-5 ${activeView === item.id ? 'text-white' : theme.muted}`} />
                    {item.label}
                  </button>
                ))}
                
                <p className={`text-[10px] font-black uppercase tracking-widest ${theme.muted} pl-2 pt-6 pb-1`}>Support Systems</p>
                <Link href="/doubts" onClick={() => setIsSidebarOpen(false)}>
                  <button className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm w-full ${theme.text} hover:${theme.accentLight} border border-transparent hover:${theme.border}`}>
                    <BrainCircuit className="w-5 h-5 text-indigo-500" /> AI Oracle Link
                  </button>
                </Link>
                <Link href="/profile" onClick={() => setIsSidebarOpen(false)}>
                  <button className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all font-bold text-sm w-full ${theme.text} hover:${theme.accentLight} border border-transparent hover:${theme.border}`}>
                    <Settings className="w-5 h-5 text-slate-500" /> Settings & Identity
                  </button>
                </Link>
              </div>

              <div className={`p-6 border-t ${theme.border}`}>
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-500/10 font-bold h-14 rounded-2xl text-sm tracking-wide">
                  <LogOut className="w-5 h-5 mr-3" /> Sever Connection
                </Button>
              </div>
              
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-screen-2xl mx-auto px-4 md:px-8 pt-32 pb-32 relative z-10 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeView === 'overview' && renderOverview()}
            {activeView === 'lessons' && renderCurriculum()}
            {activeView === 'assessments' && renderAssessments()}
            {activeView === 'achievements' && renderAchievements()}
          </motion.div>
        </AnimatePresence>
      </main>

    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#05050A] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-6 relative z-10" />
        <p className="text-cyan-400 font-mono text-sm tracking-[0.3em] uppercase animate-pulse relative z-10">Establishing Neural Link...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}