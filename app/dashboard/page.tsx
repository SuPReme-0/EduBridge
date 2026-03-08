// app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback, Suspense, useRef, useMemo } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Menu, X, Library, BookOpen, Clock, Flame, Target,
  Trophy, Award, Settings, LogOut, RefreshCw, MessageCircleQuestion,
  ChevronRight, CheckCircle2, Lock, Activity, BrainCircuit, Zap, 
  Star, Crown, Gem, Medal, AlertCircle, Loader2, BookMarked, 
  PlayCircle, Upload, Database, Timer, Sparkles, LayoutDashboard, 
  Bell, FileText, CheckCircle, RotateCcw, User, ArrowRight, Terminal,
  Share2, AlertTriangle, TrendingUp, Calendar, Layers, BarChart4,
  LineChart, PieChart, CircleDashed, CircleDot, Orbit,
  Rocket, Satellite, Telescope, Cpu, Gauge, ZapIcon
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
  longestStreak: number;
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

// ============================================================================
// CONSTANTS
// ============================================================================

const NAV_ITEMS = [
  { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
  { id: 'lessons', label: 'Matrix Curriculum', icon: Database },
  { id: 'assessments', label: 'Assessment Protocol', icon: Target },
  { id: 'achievements', label: 'Trophy Vault', icon: Trophy },
];

// ============================================================================
// SKELETON LOADERS
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

const TimelineSkeleton = () => (
  <Card className="rounded-3xl border border-slate-200/30 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm animate-pulse h-64 p-6">
    <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-xl mb-6" />
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1">
            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
            <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  </Card>
);

// ============================================================================
// ANIMATED GREETING
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
// MAIN COMPONENT
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
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  
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
      
      // 🔥 Filter out archived curricula
      const activeCurriculums = (p.user?.curriculums || []).filter(
        (curr: Curriculum) => curr.status !== 'ARCHIVED'
      );
      setCurriculums(activeCurriculums);
      
      setAchievements(achievementsData.achievements || []);
      updateProfile(p);

      // Generate Assessments map (only from active curriculums)
      const assessments: Assessment[] = [];
      activeCurriculums.forEach((curr: Curriculum) => {
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

      // Set first subject as selected if available
      if (activeCurriculums.length > 0 && activeCurriculums[0].subjects.length > 0) {
        setSelectedSubject(activeCurriculums[0].subjects[0].name);
      }

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

  // Calculate overall curriculum progress
  const totalChapters = curriculums.reduce((acc, curr) => 
    acc + curr.subjects.reduce((sAcc, sub) => sAcc + sub.chapters.length, 0), 0);
  const completedChapters = curriculums.reduce((acc, curr) => 
    acc + curr.subjects.reduce((sAcc, sub) => 
      sAcc + sub.chapters.filter(ch => ch.progress?.some(p => p.completedAt)).length, 0), 0);
  const overallProgress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  const getLevelBadge = (lvl: number) => {
    if (lvl >= 50) return { icon: Crown, color: 'text-yellow-500', label: 'Grandmaster' };
    if (lvl >= 30) return { icon: Gem, color: 'text-violet-500', label: 'Senior Scholar' };
    if (lvl >= 10) return { icon: Medal, color: 'text-blue-500', label: 'Adept' };
    return { icon: Star, color: 'text-emerald-500', label: 'Initiate' };
  };
  const levelBadge = getLevelBadge(level);

  // Get next few chapters (for timeline)
  const upcomingChapters: Array<{ chapter: Chapter; subjectName: string; eta?: string }> = [];
  if (curriculums.length > 0) {
    for (const subject of curriculums[0].subjects) {
      for (const ch of subject.chapters) {
        if (!ch.progress?.some(p => p.completedAt) && ch.status !== 'PENDING') {
          // Simulate ETA based on chapter number (rough estimate)
          const chapterIndex = subject.chapters.findIndex(c => c.id === ch.id);
          const daysToAdd = Math.ceil(chapterIndex * 0.5); // 0.5 day per chapter
          const eta = new Date(Date.now() + daysToAdd * 86400000).toLocaleDateString();
          upcomingChapters.push({ chapter: ch, subjectName: subject.name, eta });
          if (upcomingChapters.length >= 5) break;
        }
      }
      if (upcomingChapters.length >= 5) break;
    }
  }

  // ============================================================================
  // RENDER: OVERVIEW (Command Center)
  // ============================================================================
  const renderOverview = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      
      <AnimatedGreeting name={displayName} theme={theme} lastActive={profile.lastActiveAt} />

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className={`rounded-2xl ${theme.card} border ${theme.border} shadow-lg p-6 backdrop-blur-xl`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${theme.accentLight}`}>
                <Zap className={`w-6 h-6 ${theme.accent}`} />
              </div>
              <Badge className={`${theme.accentLight} ${theme.accent} border-0`}>Lv.{level}</Badge>
            </div>
            <p className={`text-sm ${theme.muted} mb-1`}>Total XP</p>
            <p className={`text-3xl font-black ${theme.text}`}>{profile.totalPoints.toLocaleString()}</p>
            <div className="mt-4 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${theme.accentBg} animate-pulse`} />
              <span className={`text-xs ${theme.muted}`}>+{Math.floor(profile.totalPoints * 0.1)} XP this week</span>
            </div>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className={`rounded-2xl ${theme.card} border ${theme.border} shadow-lg p-6 backdrop-blur-xl`}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-orange-500/10">
                <Flame className="w-6 h-6 text-orange-500" />
              </div>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-0">
                {profile.currentStreak} days
              </Badge>
            </div>
            <p className={`text-sm ${theme.muted} mb-1`}>Current Streak</p>
            <p className={`text-3xl font-black ${theme.text}`}>{profile.currentStreak}</p>
            <div className="mt-4 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className={`text-xs ${theme.muted}`}>Longest: {profile.longestStreak} days</span>
            </div>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className={`rounded-2xl ${theme.card} border ${theme.border} shadow-lg p-6 backdrop-blur-xl`}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <Target className="w-6 h-6 text-emerald-500" />
              </div>
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-0">
                Mastery
              </Badge>
            </div>
            <p className={`text-sm ${theme.muted} mb-1`}>Average Mastery</p>
            <p className={`text-3xl font-black ${theme.text}`}>{profile.averageMastery}%</p>
            <div className="mt-4 flex items-center gap-2">
              <div className={`w-full h-1.5 ${theme.inputBg} rounded-full overflow-hidden`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${profile.averageMastery}%` }}
                  className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full`}
                />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
          <Card className={`rounded-2xl ${theme.card} border ${theme.border} shadow-lg p-6 backdrop-blur-xl`}>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-indigo-500/10">
                <Clock className="w-6 h-6 text-indigo-500" />
              </div>
              <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-500 border-0">
                Total
              </Badge>
            </div>
            <p className={`text-sm ${theme.muted} mb-1`}>Study Time</p>
            <p className={`text-3xl font-black ${theme.text}`}>{Math.floor(profile.totalStudyMinutes / 60)}<span className="text-base font-medium ml-1">hr</span></p>
            <div className="mt-4 flex items-center gap-2">
              <Timer className="w-4 h-4 text-indigo-500" />
              <span className={`text-xs ${theme.muted}`}>{profile.totalStudyMinutes % 60} min today</span>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Main Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2/3) - Progress and Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Curriculum Progress */}
          {hasNoCurriculum ? (
            <Card className={`rounded-3xl ${theme.card} ${theme.border} border border-dashed p-12 text-center`}>
              <div className={`w-24 h-24 rounded-full ${theme.accentLight} flex items-center justify-center mx-auto mb-6`}>
                <Database className={`w-12 h-12 ${theme.accent}`} />
              </div>
              <h2 className={`text-2xl font-bold ${theme.text} mb-3`}>No Active Curriculum</h2>
              <p className={`${theme.muted} max-w-md mx-auto mb-8`}>Your learning matrix is empty. Upload a syllabus to begin your personalized journey.</p>
              <Link href="/onboarding">
                <Button className={`h-12 px-8 rounded-2xl bg-gradient-to-r ${theme.gradient} text-white font-bold text-lg shadow-lg hover:shadow-xl`}>
                  <Upload className="w-5 h-5 mr-2" /> Inject Syllabus
                </Button>
              </Link>
            </Card>
          ) : (
            <>
              <Card className={`rounded-3xl ${theme.card} ${theme.border} shadow-xl overflow-hidden backdrop-blur-xl`}>
                <CardHeader className={`border-b ${theme.border} pb-6`}>
                  <CardTitle className={`text-xl font-black ${theme.text} flex items-center gap-3`}>
                    <Orbit className={`w-6 h-6 ${theme.accent}`} /> Neural Pathway Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-8 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span className={theme.muted}>Overall Completion</span>
                      <span className={theme.accent}>{overallProgress}%</span>
                    </div>
                    <Progress value={overallProgress} className={`h-3 ${theme.inputBg} [&>div]:bg-gradient-to-r [&>div]:${theme.gradient} shadow-inner`} />
                    <p className={`text-xs ${theme.muted} text-right`}>{completedChapters} of {totalChapters} chapters mastered</p>
                  </div>

                  {/* Subject Breakdown */}
                  {curriculums[0]?.subjects.map(sub => {
                    const subCompleted = sub.chapters.filter(ch => ch.progress?.some(p => p.completedAt)).length;
                    const subProgress = sub.chapters.length > 0 ? Math.round((subCompleted / sub.chapters.length) * 100) : 0;
                    return (
                      <div key={sub.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className={theme.text}>{sub.name}</span>
                          <span className={theme.accent}>{subProgress}%</span>
                        </div>
                        <Progress value={subProgress} className={`h-2 ${theme.inputBg} [&>div]:${theme.progressBar}`} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Upcoming Timeline */}
              <Card className={`rounded-3xl ${theme.card} ${theme.border} shadow-xl overflow-hidden backdrop-blur-xl`}>
                <CardHeader className={`border-b ${theme.border} pb-6 flex flex-row items-center justify-between`}>
                  <CardTitle className={`text-xl font-black ${theme.text} flex items-center gap-3`}>
                    <Calendar className={`w-6 h-6 ${theme.accent}`} /> Upcoming Chapters
                  </CardTitle>
                  <Badge className={`${theme.accentLight} ${theme.accent} border-0`}>Next in queue</Badge>
                </CardHeader>
                <CardContent className="pt-8">
                  <div className="space-y-6">
                    {upcomingChapters.slice(0, 3).map((item, idx) => (
                      <motion.div
                        key={item.chapter.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center gap-4 group cursor-pointer"
                        onClick={() => router.push(`/lesson/chapter/${item.chapter.id}`)}
                      >
                        <div className={`relative w-12 h-12 rounded-2xl ${theme.accentLight} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <div className={`absolute -inset-1 bg-gradient-to-r ${theme.gradient} rounded-3xl opacity-0 group-hover:opacity-30 blur-md`} />
                          <BookOpen className={`w-6 h-6 ${theme.accent} relative z-10`} />
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold ${theme.text} group-hover:${theme.accent} transition-colors`}>
                            {item.subjectName}: {item.chapter.title}
                          </p>
                          <p className={`text-xs ${theme.muted} flex items-center gap-1 mt-1`}>
                            <Clock className="w-3 h-3" /> Est. {item.chapter.estimatedMinutes} min
                            {item.eta && <span className="ml-2">• ETA {item.eta}</span>}
                          </p>
                        </div>
                        <ChevronRight className={`w-5 h-5 ${theme.muted} group-hover:${theme.accent} group-hover:translate-x-1 transition-all`} />
                      </motion.div>
                    ))}
                    {upcomingChapters.length === 0 && (
                      <p className={`text-center ${theme.muted} py-8`}>All chapters completed. Great job!</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Right Column (1/3) - Next Chapter & Achievements */}
        <div className="space-y-6">
          {/* Next Chapter Card */}
          {!hasNoCurriculum && upcomingChapters.length > 0 && (
            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className={`rounded-3xl ${theme.card} border-2 border-indigo-500/30 shadow-xl overflow-hidden relative group`}>
                <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${theme.gradient}`} />
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] group-hover:bg-indigo-500/10 transition-colors" />
                <CardContent className="p-8 relative z-10">
                  <Badge className={`mb-3 ${theme.accentLight} ${theme.accent} border-0 px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold shadow-sm`}>
                    <Star className="w-3 h-3 mr-1 inline-block" /> Priority Node
                  </Badge>
                  <h3 className={`text-2xl font-black ${theme.text} mb-2 leading-tight`}>
                    {upcomingChapters[0].subjectName}
                  </h3>
                  <p className={`text-sm ${theme.muted} mb-4 line-clamp-2`}>
                    {upcomingChapters[0].chapter.title}
                  </p>
                  <div className="flex items-center gap-3 mb-6 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Clock className="w-4 h-4" /> {upcomingChapters[0].chapter.estimatedMinutes} Min
                    </span>
                  </div>
                  <Link href={`/lesson/chapter/${upcomingChapters[0].chapter.id}`}>
                    <Button className={`w-full h-12 rounded-2xl bg-gradient-to-r ${theme.gradient} text-white font-bold text-lg shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] hover:-translate-y-1 transition-all group-hover:scale-105`}>
                      <PlayCircle className="w-5 h-5 mr-2" /> Initialize
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Quick Stats Card */}
          <Card className={`rounded-3xl ${theme.card} ${theme.border} shadow-xl overflow-hidden backdrop-blur-xl`}>
            <CardHeader className={`border-b ${theme.border} pb-6`}>
              <CardTitle className={`text-lg font-black ${theme.text} flex items-center gap-3`}>
                <Activity className={`w-5 h-5 ${theme.accent}`} /> Neural Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className={`text-sm ${theme.muted}`}>Tests Completed</span>
                <span className={`font-bold text-xl ${theme.text}`}>{profile.testsCompleted}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${theme.muted}`}>Mastery Average</span>
                <span className={`font-bold text-xl ${theme.text}`}>{profile.averageMastery}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${theme.muted}`}>Total Study Time</span>
                <span className={`font-bold text-xl ${theme.text}`}>{Math.floor(profile.totalStudyMinutes / 60)}h {profile.totalStudyMinutes % 60}m</span>
              </div>
              <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                <Button variant="outline" onClick={() => router.push('/profile')} className={`w-full rounded-xl ${theme.border} ${theme.text} hover:${theme.accentLight} text-sm`}>
                  View Full Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );

  // ============================================================================
  // RENDER: CURRICULUM (with horizontal subject tabs)
  // ============================================================================
  const renderCurriculum = () => {
    if (hasNoCurriculum) {
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
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
        </motion.div>
      );
    }

    // Get all subjects from the first curriculum (or combine multiple)
    const allSubjects = curriculums[0]?.subjects || [];

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-3xl font-black ${theme.text} tracking-tight`}>Matrix Curriculum</h2>
          <Button variant="outline" size="sm" onClick={fetchData} className="rounded-xl">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Horizontal Scrollable Subject Tabs */}
        <div className="overflow-x-auto scrollbar-hide pb-2">
          <div className="flex gap-2 min-w-max">
            {allSubjects.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubject(sub.name)}
                className={`px-6 py-3 rounded-full font-bold text-sm transition-all ${
                  selectedSubject === sub.name
                    ? `bg-gradient-to-r ${theme.gradient} text-white shadow-lg`
                    : `${theme.card} ${theme.border} border hover:${theme.accentLight} hover:border-indigo-400`
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>

        {/* Display selected subject's chapters */}
        {allSubjects.filter(sub => sub.name === selectedSubject).map((sub) => {
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
      </motion.div>
    );
  };

  // ============================================================================
  // RENDER: ASSESSMENTS (with subject tabs)
  // ============================================================================
  const renderAssessments = () => {
    if (hasNoCurriculum) {
      return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
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
        </motion.div>
      );
    }

    // Group assessments by subject
    const assessmentsBySubject = generatedAssessments.reduce((acc, a) => {
      if (!acc[a.subject]) acc[a.subject] = [];
      acc[a.subject].push(a);
      return acc;
    }, {} as Record<string, Assessment[]>);
    const subjectNames = Object.keys(assessmentsBySubject);

    // Ensure selectedSubject is valid
    if (!selectedSubject || !assessmentsBySubject[selectedSubject]) {
      setSelectedSubject(subjectNames[0] || null);
    }

    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-3xl font-black ${theme.text} tracking-tight`}>Assessment Protocol</h2>
          <Button variant="outline" size="sm" onClick={fetchData} className="rounded-xl">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Horizontal Scrollable Subject Tabs */}
        {subjectNames.length > 0 && (
          <div className="overflow-x-auto scrollbar-hide pb-2">
            <div className="flex gap-2 min-w-max">
              {subjectNames.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`px-6 py-3 rounded-full font-bold text-sm transition-all ${
                    selectedSubject === sub
                      ? `bg-gradient-to-r ${theme.gradient} text-white shadow-lg`
                      : `${theme.card} ${theme.border} border hover:${theme.accentLight} hover:border-indigo-400`
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Assessments Grid for selected subject */}
        {selectedSubject && assessmentsBySubject[selectedSubject] && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assessmentsBySubject[selectedSubject].map((assessment) => {
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
              );
            })}
          </div>
        )}

        {selectedSubject && (!assessmentsBySubject[selectedSubject] || assessmentsBySubject[selectedSubject].length === 0) && (
          <Card className={`rounded-3xl ${theme.card} ${theme.border} p-12 text-center`}>
            <CheckCircle className={`w-16 h-16 ${theme.accent} mx-auto mb-4`} />
            <h3 className={`text-2xl font-black ${theme.text} mb-2`}>All Assessments Conquered</h3>
            <p className={`${theme.muted} max-w-md mx-auto`}>You have completed every available assessment for this subject. New chapters will unlock more challenges.</p>
          </Card>
        )}
      </motion.div>
    );
  };

  // ============================================================================
  // RENDER: ACHIEVEMENTS (unchanged)
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

      {/* HEADER (unchanged) */}
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

          {/* Right: Notifications & Profile (unchanged) */}
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

      {/* SIDEBAR DRAWER NAVIGATION (unchanged) */}
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