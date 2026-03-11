// app/lesson/chapter/[id]/page.tsx
'use client';
import { THEME_CONFIG, type ThemeConfig } from '@/lib/themes';
import { use, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue, useMotionTemplate, useAnimation } from 'motion/react';
import {
  ArrowLeft, Loader2, Sparkles, Brain, CheckCircle2, XCircle, ChevronRight, BookOpen,
  Hexagon, Network, Bookmark, BookmarkCheck, Volume2, VolumeX, PenLine, Star, Trophy,
  Zap, Clock, Eye, Share2, MoreVertical, ThumbsUp, ThumbsDown, MessageCircle, Lightbulb,
  ChevronDown, ChevronUp, RotateCcw, Maximize2, Minimize2, Heart, Flame, Target, Award,
  TrendingUp, Calendar, Play, Pause, SkipForward, SkipBack, Layers, FileText,
  Image as ImageIcon, Code2, Type, ListChecks, AlertCircle, Wifi, WifiOff, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useStore } from '@/store/useStore';

// ============================================================================
// TYPES (Sync with Orchestrator Output)
// ============================================================================
type ContentBlock = {
  id: string;
  type: 'story' | 'fact' | 'image' | 'quiz' | 'video' | 'code' | 'definition' | 'summary';
  content?: string;
  title?: string;
  estimatedReadTime?: number;
  quizData?: {
    id: string;
    prompt: string;
    options: string[];
    correctAnswer: string | string[];
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    points: number;
    hint?: string;
  };
  codeData?: { language: string; code: string; output?: string };
  videoData?: { url: string; thumbnail: string; duration: string };
  definitionData?: { term: string; definition: string; example?: string };
  imageData?: { url: string; caption?: string; source?: string };
  metadata?: { readTime?: number; difficulty?: string; tags?: string[] };
};

type ChapterData = {
  id: string;
  title: string;
  subject: { name: string };
  mixedContent: ContentBlock[];
  status: 'READY' | 'GENERATING' | 'ERROR' | 'COMPLETED';
  dynamicVibe?: string;
  createdAt: string;
  estimatedDuration: number;
};

type UserNote = { id: string; blockId: string; content: string; createdAt: string; color: string };
type Bookmark = { id: string; blockId: string; label?: string; createdAt: string };
type QuizState = { selected: string | string[]; isCorrect: boolean; timestamp: number; timeTaken: number };

// ============================================================================
// COLOR UTILS - Convert Tailwind classes to CSS values
// ============================================================================
const getColorValue = (colorClass: string | undefined, isLight: boolean): string => {
  if (!colorClass) return isLight ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.25)';
  
  const colorMap: Record<string, string> = {
    'bg-indigo-300/20': 'rgba(129, 140, 248, 0.2)',
    'bg-indigo-500/10': 'rgba(99, 102, 241, 0.1)',
    'bg-indigo-500': '#6366f1',
    'bg-cyan-400/30': 'rgba(34, 211, 238, 0.3)',
    'bg-cyan-500': '#06b6d4',
    'bg-emerald-500/10': 'rgba(16, 185, 129, 0.1)',
    'bg-emerald-500': '#10b981',
    'bg-rose-500/10': 'rgba(244, 63, 94, 0.1)',
    'bg-rose-500': '#f43f5e',
    'bg-violet-500': '#8b5cf6',
    'bg-amber-500': '#f59e0b',
    'bg-slate-900': '#0f172a',
    'bg-slate-950': '#020617',
  };
  
  if (colorClass.startsWith('bg-')) {
    return colorMap[colorClass] || (isLight ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.25)');
  }
  
  return colorClass;
};

// ============================================================================
// PARTICLE FIELD - Futuristic animated background
// ============================================================================
const ParticleField = ({ theme, count = 20 }: { theme: ThemeConfig; count?: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePos = useMotionValue({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mousePos.set({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [mousePos]);

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <InteractiveParticle key={i} index={i} theme={theme} mousePos={mousePos} />
      ))}
    </div>
  );
};

const InteractiveParticle = ({ index, theme, mousePos }: {
  index: number; theme: ThemeConfig; mousePos: ReturnType<typeof useMotionValue<{ x: number; y: number }>>;
}) => {
  const [initialX] = useState(() => Math.random() * 100);
  const [initialY] = useState(() => Math.random() * 100);
  const [initialSize] = useState(() => 2 + Math.random() * 4);
  const [initialOpacity] = useState(() => 0.3 + Math.random() * 0.5);

  const x = useMotionValue(initialX);
  const y = useMotionValue(initialY);
  const size = useMotionValue(initialSize);
  const opacity = useMotionValue(initialOpacity);

  // Mouse attraction effect
  useEffect(() => {
    const unsubscribe = mousePos.onChange(({ x: mx, y: my }) => {
      const dx = mx - x.get() * 10;
      const dy = my - y.get() * 10;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 150) {
        const force = (150 - distance) / 150;
        const currentX = x.get();
        const currentY = y.get();
        x.set(currentX + (dx / distance) * force * 0.3);
        y.set(currentY + (dy / distance) * force * 0.3);
      }
    });
    return unsubscribe;
  }, [mousePos, x, y]);

  // Gentle drift animation
  useEffect(() => {
    const interval = setInterval(() => {
      const currentX = x.get();
      const currentY = y.get();
      x.set(Math.max(5, Math.min(95, currentX + (Math.random() - 0.5) * 0.8)));
      y.set(Math.max(5, Math.min(95, currentY + (Math.random() - 0.5) * 0.8)));
    }, 100 + index * 20);
    return () => clearInterval(interval);
  }, [index, x, y]);

  const bgColor = getColorValue(theme.blob1 || theme.accentLight, theme.isLight);

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        opacity: opacity,
        backgroundColor: bgColor,
        borderRadius: '50%',
        filter: 'blur(1px)',
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
};

// ============================================================================
// HOLOGRAPHIC CARD (Theme-aware 3D effect)
// ============================================================================
const HolographicCard = ({ children, theme, className = '' }: {
  children: React.ReactNode; theme: ThemeConfig; className?: string;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-100, 100], [5, -5]);
  const rotateY = useTransform(mouseX, [-100, 100], [-5, 5]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => { mouseX.set(0); mouseY.set(0); };

  const glowColor = getColorValue((theme as any).glowColor, theme.isLight);

  return (
    <motion.div
      ref={cardRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000, transformStyle: 'preserve-3d' }}
      className={`relative ${className}`}
    >
      <div 
        className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(125deg, transparent 0%, ${glowColor} 30%, transparent 50%, ${glowColor} 70%, transparent 100%)`,
          backgroundSize: '200% 200%',
          animation: 'hologram-shine 3s linear infinite',
        }} 
      />
      <div 
        className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,${theme.isLight ? 0.02 : 0.08}) 1px, rgba(0,0,0,${theme.isLight ? 0.02 : 0.08}) 2px)`,
        }} 
      />
      {children}
    </motion.div>
  );
};

// ============================================================================
// CONFETTI (Enhanced celebration)
// ============================================================================
const Confetti = ({ active, theme }: { active: boolean; theme: ThemeConfig }) => {
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
  }, []);

  if (!active || !isMounted) return null;
  
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(80)].map((_, i) => {
        const randomX = Math.random() * dimensions.width;
        const randomY = dimensions.height + 100;
        const randomScale = Math.random() * 1 + 0.5;
        const randomRotate = Math.random() * 720;
        const randomDuration = Math.random() * 2 + 2;
        const randomDelay = Math.random() * 0.5;
        
        // More varied colors
        const colors = [
          theme.accentBg, 'bg-yellow-400', 'bg-green-400', 'bg-pink-400', 'bg-cyan-400'
        ];
        
        return (
          <motion.div
            key={i}
            initial={{ y: -20, x: randomX, rotate: 0, scale: 0 }}
            animate={{ y: randomY, rotate: randomRotate, scale: randomScale }}
            transition={{ duration: randomDuration, delay: randomDelay, ease: "easeOut" }}
            className={`absolute w-3 h-3 rounded-sm ${colors[i % colors.length]}`}
            style={{ filter: 'blur(0.5px)' }}
          />
        );
      })}
    </div>
  );
};

// ============================================================================
// FLOATING ACTION BUTTON (Enhanced)
// ============================================================================
const FloatingActionButton = ({ icon: Icon, onClick, label, theme, active = false, badge }: {
  icon: any; onClick: () => void; label: string; theme: ThemeConfig; active?: boolean; badge?: number;
}) => (
  <motion.button
    whileHover={{ scale: 1.1, y: -2 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`relative group flex items-center justify-center w-12 h-12 rounded-2xl backdrop-blur-md border transition-all duration-300 shadow-xl
      ${active 
        ? `${theme.accentBg} text-white border-${theme.accent} shadow-${theme.accent}/50` 
        : `${theme.card} ${theme.border} hover:${theme.accentLight}`}
    `}
  >
    <Icon className={`w-5 h-5 ${active ? 'text-white' : theme.muted}`} />
    {badge && badge > 0 && (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900"
      >
        {badge > 9 ? '9+' : badge}
      </motion.span>
    )}
    <span className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 ${theme.card} border ${theme.border} rounded-xl text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl backdrop-blur-md pointer-events-none z-50`}>
      {label}
    </span>
  </motion.button>
);

// ============================================================================
// READING PROGRESS BAR
// ============================================================================
const ReadingProgress = ({ progress, theme }: { progress: number; theme: ThemeConfig }) => {
  const springProgress = useSpring(progress, { stiffness: 100, damping: 30 });
  const progressBarColor = theme.progressBar || (theme.isLight ? '#6366f1' : '#818cf8');
  
  return (
    <div className="fixed top-0 left-0 right-0 h-1.5 z-50 bg-slate-200/20 backdrop-blur-sm">
      <motion.div
        style={{ width: springProgress, backgroundColor: progressBarColor }}
        className="h-full transition-colors shadow-[0_0_10px_rgba(99,102,241,0.5)]"
      />
    </div>
  );
};

// ============================================================================
// STREAK BADGE
// ============================================================================
const StreakBadge = ({ streak, theme }: { streak: number; theme: ThemeConfig }) => {
  if (streak < 2) return null;
  return (
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full ${theme.accentLight} border ${theme.borderAccent || theme.border} shadow-lg backdrop-blur-sm`}
    >
      <Flame className={`w-5 h-5 ${theme.accent} animate-pulse`} />
      <span className={`text-xs font-bold ${theme.accent}`}>{streak} day streak!</span>
    </motion.div>
  );
};

// ============================================================================
// BLOCK TYPE ICON (Enhanced)
// ============================================================================
const BlockTypeIcon = ({ type, theme }: { type: string; theme: ThemeConfig }) => {
  const icons: Record<string, any> = {
    story: BookOpen, fact: Sparkles, image: ImageIcon, quiz: Brain,
    video: Play, code: Code2, definition: Type, summary: ListChecks,
  };
  const Icon = icons[type] || BookOpen;
  return (
    <motion.div
      whileHover={{ scale: 1.1, rotate: 5 }}
      className={`w-10 h-10 rounded-xl ${theme.accentLight} ${theme.accent} flex items-center justify-center border ${theme.border} shadow-lg`}
    >
      <Icon className="w-5 h-5" />
    </motion.div>
  );
};

// ============================================================================
// IMMERSIVE BUILD MODE (Generation Transition - Sync with Orchestrator)
// ============================================================================
const ImmersiveBuildMode = ({ theme, progress, statusMessage }: {
  theme: ThemeConfig; progress: number; statusMessage: string;
}) => {
  const glowColor1 = getColorValue(theme.blob1 || theme.accentLight, theme.isLight);
  const glowColor2 = getColorValue(theme.blob2 || theme.accentLight, theme.isLight);
  const borderColor = theme.borderAccent || theme.border;
  
  return (
    <div className={`fixed inset-0 z-50 ${theme.bg} flex flex-col items-center justify-center overflow-hidden`}>
      <ParticleField theme={theme} count={40} />
      
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] mix-blend-screen"
        style={{ backgroundColor: glowColor1 }}
      />
      <motion.div
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.1, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, delay: 2 }}
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] mix-blend-screen"
        style={{ backgroundColor: glowColor2 }}
      />
      
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            className="absolute rounded-full border border-cyan-500/40"
            style={{ width: `${150 + i * 150}px`, height: `${150 + i * 150}px` }}
          />
        ))}
      </div>
      
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 mb-8"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className={`w-28 h-28 rounded-2xl border-2 border-dashed ${borderColor} flex items-center justify-center backdrop-blur-sm bg-white/5`}
        >
          <Hexagon className={`w-14 h-14 ${theme.accent}`} />
        </motion.div>
        <motion.div
          className="absolute -inset-8 rounded-full blur-3xl opacity-40"
          style={{ backgroundColor: glowColor1 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </motion.div>
      
      <motion.div className="text-center relative z-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`text-3xl md:text-4xl font-black ${theme.text} tracking-tight mb-2`}
        >
          Crafting Your Lesson
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`${theme.accent} text-sm font-bold tracking-[0.3em] uppercase mb-6`}
        >
          {statusMessage}
        </motion.p>
      </motion.div>
      
      <div className="relative z-10 w-80 mb-6">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full relative`}
          >
            <motion.div
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-y-0 w-20 bg-white/30 rounded-full blur-sm"
            />
          </motion.div>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className={`text-center ${theme.muted} font-mono text-xs tracking-wider mt-3`}
        >
          {Math.round(progress)}% Complete
        </motion.p>
      </div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-16 flex items-center gap-8 text-white/40 text-xs font-mono tracking-wider"
      >
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-lg shadow-green-500/50" />
          <span>AI ACTIVE</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shadow-lg shadow-cyan-500/50" />
          <span>GENERATING</span>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// OFFLINE INDICATOR
// ============================================================================
const OfflineIndicator = ({ isOffline, theme }: { isOffline: boolean; theme: ThemeConfig }) => {
  if (!isOffline) return null;
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2.5 rounded-full ${theme.card} border ${theme.border} shadow-xl backdrop-blur-md`}
    >
      <WifiOff className={`w-4 h-4 ${theme.muted}`} />
      <span className={`text-xs font-medium ${theme.text}`}>Offline Mode • Content cached</span>
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function ChapterReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { updateProfile, user } = useStore();

  const blockRefs = useRef<Record<string, HTMLDivElement>>({});
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const quizStartTimes = useRef<Record<string, number>>({}); // FIX: per-quiz start time

  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(THEME_CONFIG['minimalist']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationMessage, setGenerationMessage] = useState('Initializing neural pathways...');
  const [isOffline, setIsOffline] = useState(false);
  const [usingCache, setUsingCache] = useState(false);

  const [quizState, setQuizState] = useState<Record<string, QuizState>>({});
  const [totalPoints, setTotalPoints] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [readingTime, setReadingTime] = useState(0);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingBlockId, setSpeakingBlockId] = useState<string | null>(null);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [activeNoteBlock, setActiveNoteBlock] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showBookmarksDialog, setShowBookmarksDialog] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [likedBlocks, setLikedBlocks] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [showBlockActions, setShowBlockActions] = useState<string | null>(null);

  // FIX #3: Hydration-safe useScroll
  const { scrollYProgress } = useScroll();
  const scrollProgress = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const [progressValue, setProgressValue] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsubscribe = scrollProgress.on('change', (latest) => setProgressValue(latest));
    return () => unsubscribe();
  }, [scrollProgress]);

  // ============================================================================
  // OFFLINE DETECTION & CACHE MANAGEMENT
  // ============================================================================
  useEffect(() => {
    const updateOnlineStatus = () => {
      const offline = !navigator.onLine;
      setIsOffline(offline);
      if (!offline && usingCache) {
        fetchChapterData(true);
      }
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [usingCache]);

  const getCacheKey = useCallback((chapterId: string) => `edubridge:chapter:${chapterId}`, []);
  const getProgressKey = useCallback((chapterId: string) => `edubridge:progress:${chapterId}`, []);
  const getNotesKey = useCallback((chapterId: string) => `edubridge:notes:${chapterId}`, []);
  const getBookmarksKey = useCallback((chapterId: string) => `edubridge:bookmarks:${chapterId}`, []);

  const saveToCache = useCallback((key: string, data: any) => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
      }
    } catch (e) {
      console.warn('Failed to save to cache:', e);
    }
  }, []);

  const loadFromCache = useCallback((key: string) => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(key);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            return data;
          }
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('Failed to load from cache:', e);
    }
    return null;
  }, []);

  // ============================================================================
  // SMART POLLING ENGINE
  // ============================================================================
  const startPolling = useCallback(async () => {
    let pollCount = 0;
    const maxPolls = 60;
    
    const poll = async () => {
      if (pollCount >= maxPolls) {
        setError('Generation timed out. Please try again.');
        setLoading(false);
        return;
      }
      pollCount++;
      
      try {
        const res = await fetch(`/api/chapter/${id}/status`);
        const data = await res.json();
        
        if (data.status === 'READY' && data.chapter) {
          setGenerationProgress(100);
          setGenerationMessage('Finalizing experience...');
          await new Promise(resolve => setTimeout(resolve, 800));
          setChapter(data.chapter);
          setProfileData(data.profile);
          if (data.chapter.dynamicVibe && THEME_CONFIG[data.chapter.dynamicVibe]) {
            setActiveTheme(THEME_CONFIG[data.chapter.dynamicVibe]);
          }
          setIsGenerating(false);
          setLoading(false);
          saveToCache(getCacheKey(id), { chapter: data.chapter, profile: data.profile });
          return;
        }
        
        if (data.status === 'GENERATING') {
          const progress = Math.min(95, pollCount * 1.5);
          setGenerationProgress(progress);
          const messages = [
            'Analyzing curriculum structure...',
            'Weaving narrative framework...',
            'Generating adaptive content...',
            'Crafting interactive elements...',
            'Optimizing learning pathways...',
            'Finalizing experience...'
          ];
          setGenerationMessage(messages[Math.min(Math.floor(pollCount / 10), messages.length - 1)]);
        }
        
        if (data.status === 'ERROR') {
          setError(data.error || 'Generation failed');
          setLoading(false);
          return;
        }
        
        pollingRef.current = setTimeout(poll, 3000);
      } catch (err) {
        console.error('Polling error:', err);
        pollingRef.current = setTimeout(poll, 3000);
      }
    };
    poll();
  }, [id, getCacheKey, saveToCache]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  // ============================================================================
  // FETCH CHAPTER DATA
  // ============================================================================
  const fetchChapterData = useCallback(async (forceNetwork = false) => {
    if (!id) return;
    
    if (!forceNetwork && !navigator.onLine) {
      const cached = loadFromCache(getCacheKey(id));
      if (cached?.chapter) {
        setChapter(cached.chapter);
        setProfileData(cached.profile);
        if (cached.chapter.dynamicVibe && THEME_CONFIG[cached.chapter.dynamicVibe]) {
          setActiveTheme(THEME_CONFIG[cached.chapter.dynamicVibe]);
        }
        setUsingCache(true);
        setLoading(false);
        return;
      }
    }
    
    try {
      const res = await fetch(`/api/chapter/${id}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      if (data.chapter?.status === 'GENERATING') {
        setIsGenerating(true);
        setGenerationProgress(10);
        setGenerationMessage('Initializing generation...');
        startPolling();
        return;
      }
      
      setChapter(data.chapter);
      setProfileData(data.profile);
      
      const dynamicVibe = data.profile?.currentVibe || data.chapter?.dynamicVibe || 'minimalist';
      if (THEME_CONFIG[dynamicVibe]) {
        setActiveTheme(THEME_CONFIG[dynamicVibe]);
      }
      
      saveToCache(getCacheKey(id), { chapter: data.chapter, profile: data.profile });
      setUsingCache(false);
      
      const savedNotes = loadFromCache(getNotesKey(id));
      const savedBookmarks = loadFromCache(getBookmarksKey(id));
      const savedProgress = loadFromCache(getProgressKey(id));
      
      if (savedNotes) setNotes(savedNotes);
      if (savedBookmarks) setBookmarks(savedBookmarks);
      if (savedProgress) {
        setQuizState(savedProgress.quizState || {});
        setCompletedBlocks(new Set(savedProgress.completedBlocks || []));
        setTotalPoints(savedProgress.totalPoints || 0);
        setCorrectAnswers(savedProgress.correctAnswers || 0);
        setReadingTime(savedProgress.readingTime || 0);
      }
    } catch (err: any) {
      const cached = loadFromCache(getCacheKey(id));
      if (cached?.chapter) {
        setChapter(cached.chapter);
        setProfileData(cached.profile);
        if (cached.chapter.dynamicVibe && THEME_CONFIG[cached.chapter.dynamicVibe]) {
          setActiveTheme(THEME_CONFIG[cached.chapter.dynamicVibe]);
        }
        setUsingCache(true);
        setError('');
      } else {
        setError(err.message || 'Failed to load chapter');
      }
    } finally {
      if (!isGenerating) setLoading(false);
    }
  }, [id, getCacheKey, getNotesKey, getBookmarksKey, getProgressKey, loadFromCache, saveToCache, startPolling, isGenerating]);

  useEffect(() => {
    if (id) fetchChapterData();
  }, [id, fetchChapterData]);

  useEffect(() => {
    const timer = setInterval(() => setReadingTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const progressDataRef = useRef({
    completedBlocks: Array.from(completedBlocks),
    currentBlockIndex,
    readingTime,
    quizState,
    totalPoints,
    correctAnswers
  });

  useEffect(() => {
    progressDataRef.current = {
      completedBlocks: Array.from(completedBlocks),
      currentBlockIndex,
      readingTime,
      quizState,
      totalPoints,
      correctAnswers
    };
    if (chapter && typeof localStorage !== 'undefined') {
      saveToCache(getProgressKey(id), progressDataRef.current);
    }
  }, [completedBlocks, currentBlockIndex, readingTime, quizState, totalPoints, correctAnswers, chapter, id, getProgressKey, saveToCache]);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      const currentData = progressDataRef.current;
      if (currentData.completedBlocks.length > 0 && navigator.onLine) {
        fetch(`/api/chapter/${id}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            readingTime: currentData.readingTime,
            completedBlocks: currentData.completedBlocks,
            currentBlockIndex: currentData.currentBlockIndex,
          }),
        }).catch(console.error);
      }
    }, 30000);
    return () => clearInterval(syncInterval);
  }, [id]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isOffline) return;
      const currentData = progressDataRef.current;
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({
          readingTime: currentData.readingTime,
          completedBlocks: currentData.completedBlocks,
          currentBlockIndex: currentData.currentBlockIndex
        })], { type: 'application/json' });
        navigator.sendBeacon(`/api/chapter/${id}/progress`, blob);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [id]);

  useEffect(() => {
    if (notes.length > 0) saveToCache(getNotesKey(id), notes);
  }, [notes, id, getNotesKey, saveToCache]);

  useEffect(() => {
    if (bookmarks.length > 0) saveToCache(getBookmarksKey(id), bookmarks);
  }, [bookmarks, id, getBookmarksKey, saveToCache]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    const handleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        const scrollPosition = window.scrollY + window.innerHeight / 2;
        chapter?.mixedContent?.forEach((block: ContentBlock, index: number) => {
          const element = blockRefs.current[block.id];
          if (element) {
            const { offsetTop, offsetHeight } = element;
            if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
              setCurrentBlockIndex(index);
            }
          }
        });
        timeoutId = null;
      }, 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [chapter]);

  const toggleSpeech = useCallback((blockId: string, content: string) => {
    if (typeof window === 'undefined') return;
    if (isSpeaking && speakingBlockId === blockId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingBlockId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const plainText = (content || '').replace(/[#_*\[\]`~>-]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => { setIsSpeaking(false); setSpeakingBlockId(null); };
    utterance.onerror = () => { setIsSpeaking(false); setSpeakingBlockId(null); };
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setSpeakingBlockId(blockId);
  }, [isSpeaking, speakingBlockId]);

  useEffect(() => {
    return () => { if (typeof window !== 'undefined') window.speechSynthesis.cancel(); };
  }, []);

  // ✅ Define blocks early using useMemo (after chapter is loaded, but before conditional returns)
  const blocks = useMemo(() => {
    return chapter?.mixedContent ? (Array.isArray(chapter.mixedContent) ? chapter.mixedContent : []) : [];
  }, [chapter]);

  // ============================================================================
  // QUIZ START TIME TRACKING (now uses `blocks` safely)
  // ============================================================================
  useEffect(() => {
    if (!blocks.length) return;

    const quizElements = blocks
      .filter(b => b.type === 'quiz' && b.quizData)
      .map(b => ({ id: b.quizData!.id, element: blockRefs.current[b.id] }))
      .filter(item => item.element);

    if (quizElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const quiz = quizElements.find(q => q.element === entry.target);
            if (quiz && !quizStartTimes.current[quiz.id]) {
              quizStartTimes.current[quiz.id] = Date.now();
              observer.unobserve(entry.target); // stop observing after first appearance
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    quizElements.forEach(({ element }) => observer.observe(element));
    return () => observer.disconnect();
  }, [blocks]);

  const handleQuizAnswer = useCallback((quizId: string, selectedOption: string | string[], correctAnswer: string | string[], points: number) => {
    if (quizState[quizId]) return;
    const startTime = quizStartTimes.current[quizId] || sessionStartTime;
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const isCorrect = Array.isArray(correctAnswer)
      ? Array.isArray(selectedOption) && [...selectedOption].sort().join(',') === [...correctAnswer].sort().join(',')
      : selectedOption === correctAnswer;
    
    setQuizState(prev => ({ ...prev, [quizId]: { selected: selectedOption, isCorrect, timestamp: Date.now(), timeTaken } }));
    
    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
      setTotalPoints(prev => prev + points);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
    
    const block = chapter?.mixedContent?.find((b: ContentBlock) => b.quizData?.id === quizId);
    if (block) setCompletedBlocks(prev => new Set([...prev, block.id]));
  }, [quizState, chapter, sessionStartTime]);

  const saveNote = useCallback((blockId: string) => {
    if (!noteContent.trim()) return;
    const newNote: UserNote = {
      id: Date.now().toString(), blockId, content: noteContent.trim(),
      createdAt: new Date().toISOString(),
      color: ['yellow', 'green', 'blue', 'pink'][Math.floor(Math.random() * 4)]
    };
    setNotes(prev => [...prev, newNote]);
    setNoteContent('');
    setActiveNoteBlock(null);
  }, [noteContent]);

  const toggleBookmark = useCallback((blockId: string) => {
    const exists = bookmarks.find(b => b.blockId === blockId);
    if (exists) {
      setBookmarks(prev => prev.filter(b => b.blockId !== blockId));
    } else {
      setBookmarks(prev => [...prev, { id: Date.now().toString(), blockId, createdAt: new Date().toISOString() }]);
    }
  }, [bookmarks]);

  const toggleLike = useCallback((blockId: string) => {
    setLikedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blockId)) newSet.delete(blockId);
      else newSet.add(blockId);
      return newSet;
    });
  }, []);

  const scrollToBlock = useCallback((blockId: string) => {
    const element = blockRefs.current[blockId];
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const scrollToNext = useCallback(() => {
    const nextIndex = currentBlockIndex + 1;
    if (chapter?.mixedContent?.[nextIndex]) scrollToBlock(chapter.mixedContent[nextIndex].id);
  }, [currentBlockIndex, chapter, scrollToBlock]);

  const scrollToPrev = useCallback(() => {
    const prevIndex = currentBlockIndex - 1;
    if (prevIndex >= 0 && chapter?.mixedContent?.[prevIndex]) scrollToBlock(chapter.mixedContent[prevIndex].id);
  }, [currentBlockIndex, chapter, scrollToBlock]);

  const toggleFullscreen = useCallback(() => {
    if (typeof document !== 'undefined') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  }, []);

  const completeChapter = useCallback(() => {
    if (navigator.onLine) {
      fetch(`/api/chapter/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalPoints, correctAnswers, readingTime,
          completedBlocks: Array.from(completedBlocks),
          quizResults: quizState
        })
      }).catch(console.error);
    }
    router.push(`/assessment/chapter/${id}`);
  }, [id, totalPoints, correctAnswers, readingTime, completedBlocks, quizState, router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const estimatedTotalTime = chapter?.mixedContent?.reduce((acc: number, block: ContentBlock) => acc + (block.estimatedReadTime || 2), 0) || 30;
  const remainingTime = Math.max(0, estimatedTotalTime * 60 - readingTime);


  // ============================================================================
  // LOADING & ERROR STATES
  // ============================================================================
  if (isGenerating) {
    return <ImmersiveBuildMode theme={activeTheme} progress={generationProgress} statusMessage={generationMessage} />;
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${activeTheme.bg} flex flex-col items-center justify-center ${activeTheme.text} touch-none`}>
        <ParticleField theme={activeTheme} count={30} />
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          <Hexagon className={`w-20 h-20 ${activeTheme.accent} mb-6`} />
        </motion.div>
        <p className="font-mono tracking-widest uppercase text-sm animate-pulse">Establishing Neural Link...</p>
        <Progress value={progressValue} className={`w-48 mt-4 h-1 ${activeTheme.card}`} />
        <p className={`mt-2 text-xs ${activeTheme.muted}`}>Loading chapter content...</p>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className={`min-h-screen ${activeTheme.bg} flex flex-col items-center justify-center p-4 text-center`}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <XCircle className={`w-20 h-20 mb-4 ${activeTheme.muted}`} />
        </motion.div>
        <h2 className={`text-3xl font-bold ${activeTheme.text} mb-2`}>Connection Interrupted</h2>
        <p className={`${activeTheme.muted} mb-8 max-w-md`}>{error || 'Chapter data unavailable.'}</p>
        <div className="flex gap-4">
          {usingCache && (
            <Button
              onClick={() => fetchChapterData(true)}
              className={`${activeTheme.card} ${activeTheme.text} border ${activeTheme.border} hover:scale-105 transition-transform`}
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Retry Online
            </Button>
          )}
          <Button
            onClick={() => router.push('/dashboard')}
            className={`${activeTheme.accentBg} text-white hover:scale-105 transition-transform`}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const t = activeTheme;
  const completionPercentage = blocks.length > 0 ? (completedBlocks.size / blocks.length) * 100 : 0;
  const quizBlocks = blocks.filter(b => b.type === 'quiz');
  const quizzesCompleted = Object.keys(quizState).length;
  const quizzesCorrect = Object.values(quizState).filter(q => q.isCorrect).length;

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <div className={`min-h-screen ${t.bg} ${t.text} font-sans pb-32 relative overflow-x-hidden transition-colors duration-1000 ease-in-out`}>
      <Confetti active={showConfetti} theme={t} />
      <ReadingProgress progress={progressValue} theme={t} />
      <OfflineIndicator isOffline={isOffline} theme={t} />
      
      <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${t.gradient} pointer-events-none transition-colors duration-1000 opacity-5`} />
      
      {!t.isLight && (
        <>
          <motion.div
            animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-20 left-10 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-30"
            style={{ backgroundColor: getColorValue(t.blob1 || t.accentLight, t.isLight) }}
          />
          <motion.div
            animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-30"
            style={{ backgroundColor: getColorValue(t.blob2 || t.accentLight, t.isLight) }}
          />
        </>
      )}
      
      {!t.isLight && (
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      )}
      
      <header className={`sticky top-0 z-40 ${t.card}/90 backdrop-blur-xl border-b ${t.border} shadow-sm transition-colors duration-1000`}>
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className={`${t.muted} hover:${t.accent} hover:${t.accentLight} transition-all rounded-full px-4 hover:scale-105`}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <StreakBadge streak={profileData?.currentStreak || 0} theme={t} />
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${t.accentLight} border ${t.border} shadow-sm`}
                >
                  <Zap className={`w-4 h-4 ${t.accent}`} />
                  <span className={`text-sm font-bold ${t.accent}`}>{totalPoints} pts</span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${t.card} border ${t.border} shadow-sm`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className={`text-sm font-bold ${t.text}`}>{quizzesCorrect}/{quizzesCompleted}</span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${t.card} border ${t.border} shadow-sm`}
                >
                  <Clock className={`w-4 h-4 ${t.muted}`} />
                  <span className={`text-sm font-bold ${t.text}`}>{formatTime(readingTime)}</span>
                </motion.div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`${t.muted} hover:${t.accent} rounded-full w-10 h-10 p-0 hover:scale-110 transition-transform`}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={`${t.card} border ${t.border} backdrop-blur-xl`}>
                  <DropdownMenuItem onClick={toggleFullscreen} className="cursor-pointer gap-2">
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className={t.border} />
                  <DropdownMenuItem onClick={() => setShowNotesDialog(true)} className="cursor-pointer gap-2">
                    <PenLine className="w-4 h-4" />
                    View Notes ({notes.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBookmarksDialog(true)} className="cursor-pointer gap-2">
                    <Bookmark className="w-4 h-4" />
                    Bookmarks ({bookmarks.length})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className={t.border} />
                  <DropdownMenuItem onClick={() => router.push('/dashboard')} className="cursor-pointer gap-2 text-red-500">
                    <ArrowLeft className="w-4 h-4" />
                    Exit Chapter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="pb-4 flex items-center justify-between">
            <div>
              <p className={`text-xs ${t.accent} font-black tracking-widest uppercase`}>{chapter.subject?.name}</p>
              <h1 className={`font-bold text-lg ${t.text}`}>{chapter.title}</h1>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs ${t.muted}`}>Progress</span>
                <span className={`text-xs font-bold ${t.accent}`}>{Math.round(completionPercentage)}%</span>
              </div>
              <Progress value={completionPercentage} className={`w-32 h-2 [&>div]:${t.progressBar || 'bg-indigo-500'}`} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-8 pt-8 md:pt-12 space-y-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-center pb-10 border-b ${t.border}`}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className={`w-24 h-24 ${t.accentLight} ${t.accent} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border ${t.border}`}
          >
            <BookOpen className="w-12 h-12" />
          </motion.div>
          <h1 className={`text-4xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6 ${t.text}`}>{chapter.title}</h1>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge variant="secondary" className={`${t.accentLight} ${t.accent} border ${t.border} px-4 py-2`}>
              <Network className="w-3 h-3 mr-2" /> AI Structured
            </Badge>
            <Badge variant="secondary" className={`${t.card} ${t.text} border ${t.border} px-4 py-2`}>
              <Clock className="w-3 h-3 mr-2" /> ~{Math.ceil(estimatedTotalTime)} mins
            </Badge>
            <Badge variant="secondary" className={`${t.card} ${t.text} border ${t.border} px-4 py-2`}>
              <Layers className="w-3 h-3 mr-2" /> {blocks.length} blocks
            </Badge>
            {quizBlocks.length > 0 && (
              <Badge variant="secondary" className={`${t.card} ${t.text} border ${t.border} px-4 py-2`}>
                <Brain className="w-3 h-3 mr-2" /> {quizBlocks.length} quizzes
              </Badge>
            )}
          </div>
          <div className={`mt-6 flex items-center justify-center gap-6 text-sm ${t.muted}`}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Elapsed: {formatTime(readingTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Remaining: ~{Math.ceil(remainingTime / 60)} mins</span>
            </div>
          </div>
        </motion.div>

        {blocks.length === 0 && (
          <div className={`text-center ${t.muted} py-10 flex flex-col items-center`}>
            <Loader2 className={`w-12 h-12 mb-4 animate-spin ${t.accent}`} />
            <p>The AI is currently structuring this module...</p>
            <p className="text-xs mt-2">This typically takes 1-2 minutes</p>
          </div>
        )}

        {blocks.map((block, idx) => {
          const isCompleted = completedBlocks.has(block.id);
          const hasNote = notes.some(n => n.blockId === block.id);
          const hasBookmark = bookmarks.some(b => b.blockId === block.id);
          const isLiked = likedBlocks.has(block.id);
          const isCurrentBlock = currentBlockIndex === idx;
          const blockNumber = idx + 1;

          if (block.type === 'story' && block.content) {
            return (
              <motion.div
                key={block.id}
                ref={(el) => { if (el) blockRefs.current[block.id] = el; }}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-50px" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className={`relative group ${isCurrentBlock ? 'ring-2 ring-offset-4 ring-offset-transparent' : ''} ${t.borderAccent}`}
                onMouseEnter={() => setShowBlockActions(block.id)}
                onMouseLeave={() => setShowBlockActions(null)}
              >
                <div className={`absolute -right-16 top-0 flex flex-col gap-3 transition-all duration-300 ${showBlockActions === block.id ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                  {['story', 'fact', 'summary'].includes(block.type) && (
                    <FloatingActionButton
                      icon={isSpeaking && speakingBlockId === block.id ? VolumeX : Volume2}
                      onClick={() => toggleSpeech(block.id, block.content || '')}
                      label="Read Aloud"
                      theme={t}
                      active={isSpeaking && speakingBlockId === block.id}
                    />
                  )}
                  <FloatingActionButton
                    icon={hasBookmark ? BookmarkCheck : Bookmark}
                    onClick={() => toggleBookmark(block.id)}
                    label="Bookmark"
                    theme={t}
                    active={hasBookmark}
                  />
                  <FloatingActionButton
                    icon={PenLine}
                    onClick={() => { setActiveNoteBlock(block.id); setNoteContent(''); }}
                    label="Add Note"
                    theme={t}
                    badge={notes.filter(n => n.blockId === block.id).length}
                  />
                  <FloatingActionButton
                    icon={Heart}
                    onClick={() => toggleLike(block.id)}
                    label="Like"
                    theme={t}
                    active={isLiked}
                  />
                </div>
                
                <div className="flex items-center gap-3 mb-4">
                  <BlockTypeIcon type="story" theme={t} />
                  <div>
                    <h3 className={`text-lg font-bold ${t.text}`}>{block.title || 'Story'}</h3>
                    <p className={`text-xs ${t.muted}`}>Block {blockNumber} of {blocks.length} • ~{block.estimatedReadTime || 3} min read</p>
                  </div>
                  {isCompleted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto"
                    >
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Done
                      </Badge>
                    </motion.div>
                  )}
                </div>
                
                <HolographicCard theme={t}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    className={`${t.card} border ${t.border} rounded-3xl p-6 md:p-10 shadow-sm transition-all`}
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    <p className={`text-[1.1rem] md:text-[1.2rem] leading-[1.9] font-medium ${t.isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {block.content}
                    </p>
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100/10">
                      <div className="flex items-center gap-2">
                        {hasNote && (
                          <Badge className={`${t.accentLight} ${t.accent} border ${t.border}`}>
                            <PenLine className="w-3 h-3 mr-1" /> {notes.filter(n => n.blockId === block.id).length} notes
                          </Badge>
                        )}
                        {block.metadata?.tags && (
                          <div className="flex gap-1">
                            {block.metadata.tags.slice(0, 3).map((tag, i) => (
                              <Badge key={i} variant="outline" className={`${t.card} ${t.text} border ${t.border} text-xs`}>
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </HolographicCard>
                
                <AnimatePresence>
                  {activeNoteBlock === block.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 overflow-hidden"
                    >
                      <Card className={`${t.card} border ${t.border} shadow-lg`}>
                        <CardContent className="p-4 space-y-3">
                          <Textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="Write your note here..."
                            className={`min-h-[100px] ${t.bg} ${t.text} border ${t.border} rounded-xl`}
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setActiveNoteBlock(null)}>
                              Cancel
                            </Button>
                            <Button size="sm" className={`${t.accentBg} text-white`} onClick={() => saveNote(block.id)}>
                              Save Note
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          }

          if (block.type === 'fact' && block.content) {
            return (
              <motion.div
                key={block.id}
                ref={(el) => { if (el) blockRefs.current[block.id] = el; }}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, margin: "-50px" }}
                transition={{ duration: 0.6, type: "spring" }}
                className="relative group"
                onMouseEnter={() => setShowBlockActions(block.id)}
                onMouseLeave={() => setShowBlockActions(null)}
              >
                <div className={`absolute -right-16 top-0 flex flex-col gap-3 transition-all duration-300 ${showBlockActions === block.id ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                  {['story', 'fact', 'summary'].includes(block.type) && (
                    <FloatingActionButton
                      icon={isSpeaking && speakingBlockId === block.id ? VolumeX : Volume2}
                      onClick={() => toggleSpeech(block.id, block.content || '')}
                      label="Read Aloud"
                      theme={t}
                      active={isSpeaking && speakingBlockId === block.id}
                    />
                  )}
                  <FloatingActionButton
                    icon={hasBookmark ? BookmarkCheck : Bookmark}
                    onClick={() => toggleBookmark(block.id)}
                    label="Bookmark"
                    theme={t}
                    active={hasBookmark}
                  />
                  <FloatingActionButton
                    icon={PenLine}
                    onClick={() => { setActiveNoteBlock(block.id); setNoteContent(''); }}
                    label="Add Note"
                    theme={t}
                    badge={notes.filter(n => n.blockId === block.id).length}
                  />
                  <FloatingActionButton
                    icon={Heart}
                    onClick={() => toggleLike(block.id)}
                    label="Like"
                    theme={t}
                    active={isLiked}
                  />
                </div>
                
                <div className={`absolute -left-4 top-0 bottom-0 w-1 ${t.accentBg} rounded-full shadow-lg`} />
                <motion.div
                  whileHover={{ x: 5 }}
                  transition={{ duration: 0.2 }}
                  className={`${t.accentLight} border-l-4 ${t.borderAccent || t.border} p-6 md:p-8 rounded-r-3xl shadow-sm relative overflow-hidden group/card`}
                >
                  <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover/card:opacity-20 transition-opacity ${t.accent}`}>
                    <Brain className="w-24 h-24 -mt-8 -mr-8" />
                  </div>
                  <div className="flex items-start gap-4 relative z-10">
                    <div className={`${t.card} border ${t.border} p-3 rounded-2xl shadow-inner shrink-0`}>
                      <Sparkles className={`w-6 h-6 ${t.accent}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold text-lg md:text-xl leading-relaxed ${t.isLight ? 'text-slate-900' : 'text-white'}`}>
                        {block.content}
                      </p>
                      {block.metadata?.tags && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {block.metadata.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className={`${t.card} ${t.text} border ${t.border} text-xs`}>
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          }

          if (block.type === 'image' && (block.content || block.imageData?.url)) {
            return (
              <motion.div
                key={block.id}
                ref={(el) => { if (el) blockRefs.current[block.id] = el; }}
                initial={{ opacity: 0, scale: 1.05 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: false, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative group"
              >
                <div className={`rounded-[2rem] overflow-hidden border ${t.border} relative group/card shadow-2xl`}>
                  <img
                    src={block.content || block.imageData?.url}
                    alt={block.title || 'AI Generated Concept'}
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover/card:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-end p-6">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white font-bold tracking-widest uppercase bg-black/40 border border-white/20 backdrop-blur-md px-4 py-2 rounded-xl">
                        AI Visual Matrix
                      </span>
                      <Button size="sm" variant="secondary" className="bg-white/20 backdrop-blur-md text-white border-0">
                        <Maximize2 className="w-4 h-4 mr-1" /> Expand
                      </Button>
                    </div>
                  </div>
                  {block.title && (
                    <div className="absolute top-4 left-4">
                      <Badge className={`${t.accentBg} text-white border-0 shadow-lg`}>{block.title}</Badge>
                    </div>
                  )}
                  {(block.imageData?.caption || block.imageData?.source) && (
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-xs text-white/80 backdrop-blur-md bg-black/40 px-3 py-2 rounded-lg inline-block">
                        {block.imageData?.caption}{block.imageData?.source && ` • Source: ${block.imageData.source}`}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          }

          if (block.type === 'quiz' && block.quizData) {
            const q = block.quizData;
            const state = quizState[q.id];
            
            return (
              <motion.div
                key={block.id}
                ref={(el) => { if (el) blockRefs.current[block.id] = el; }}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-50px" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="relative"
              >
                <HolographicCard theme={t}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    className={`${t.card} border ${t.border} shadow-2xl rounded-[2.5rem] overflow-hidden backdrop-blur-xl`}
                  >
                    <div className={`p-6 md:p-8 border-b ${t.border} bg-black/5 flex items-start justify-between gap-4`}>
                      <div className="flex items-start gap-4">
                        <div className={`${t.bg} border ${t.border} p-3 rounded-2xl shadow-inner shrink-0`}>
                          <Brain className={`w-6 h-6 ${t.accent}`} />
                        </div>
                        <div>
                          <h3 className={`font-bold text-lg md:text-xl leading-snug ${t.text}`}>{q.prompt}</h3>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="secondary" className={`text-xs ${
                              q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                              q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {q.difficulty.toUpperCase()}
                            </Badge>
                            <span className={`text-xs ${t.muted}`}>{q.points} points</span>
                            {state && <span className={`text-xs ${t.muted}`}>• {state.timeTaken}s</span>}
                          </div>
                        </div>
                      </div>
                      {state && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`px-4 py-2 rounded-full ${state.isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'} font-bold text-sm shadow-lg`}
                        >
                          {state.isCorrect ? `+${q.points}` : '0'} pts
                        </motion.div>
                      )}
                    </div>
                    
                    <div className="p-6 md:p-8 space-y-3">
                      {q.options.map((opt, i) => {
                        const isSelected = Array.isArray(state?.selected) ? state.selected.includes(opt) : state?.selected === opt;
                        const isCorrectAnswer = Array.isArray(q.correctAnswer) ? q.correctAnswer.includes(opt) : opt === q.correctAnswer;
                        
                        let buttonClass = `${t.bg} border ${t.border.split('-')[1]} ${t.text} hover:${t.borderAccent || t.border} hover:${t.accentLight}`;
                        if (state) {
                          if (isCorrectAnswer) buttonClass = "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400";
                          else if (isSelected && !isCorrectAnswer) buttonClass = "bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400";
                          else buttonClass = `${t.bg} border-transparent opacity-40`;
                        }
                        
                        return (
                          <motion.button
                            key={i}
                            disabled={!!state}
                            onClick={() => handleQuizAnswer(q.id, opt, q.correctAnswer, q.points)}
                            whileHover={!state ? { scale: 1.02, y: -2 } : {}}
                            whileTap={!state ? { scale: 0.98 } : {}}
                            className={`w-full text-left p-4 md:p-5 rounded-2xl border-2 transition-all duration-300 flex justify-between items-center font-bold text-[15px] ${buttonClass}`}
                          >
                            <span className="leading-relaxed">{opt}</span>
                            {state && isCorrectAnswer && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <CheckCircle2 className="w-6 h-6 shrink-0 ml-4 text-emerald-500" />
                              </motion.div>
                            )}
                            {state && isSelected && !isCorrectAnswer && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <XCircle className="w-6 h-6 shrink-0 ml-4 text-rose-500" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                      
                      {!state && q.hint && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowHint(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                          className={`${t.muted} hover:${t.accent} transition-colors`}
                        >
                          <Lightbulb className="w-4 h-4 mr-2" /> Need a hint?
                        </Button>
                      )}
                      
                      <AnimatePresence>
                        {showHint[q.id] && q.hint && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`p-4 rounded-xl ${t.accentLight} border ${t.borderAccent || t.border} overflow-hidden`}
                          >
                            <p className={`text-sm ${t.text}`}>
                              <strong className={t.accent}>Hint:</strong> {q.hint}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <AnimatePresence>
                        {state && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="pt-6 overflow-hidden"
                          >
                            <div className={`p-6 rounded-2xl border ${state.isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-500/10 border-slate-500/30'}`}>
                              <p className={`text-sm md:text-base leading-relaxed ${t.text}`}>
                                <strong className={`mr-2 ${state.isCorrect ? 'text-emerald-500' : t.accent}`}>
                                  {state.isCorrect ? '✓ Correct!' : '✗ Review:'}
                                </strong>
                                {q.explanation}
                              </p>
                              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-200/10">
                                <span className={`text-xs ${t.muted}`}>Was this helpful?</span>
                                <Button variant="ghost" size="sm" className="h-8">
                                  <ThumbsUp className="w-4 h-4 mr-1" /> Yes
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8">
                                  <ThumbsDown className="w-4 h-4 mr-1" /> No
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                </HolographicCard>
              </motion.div>
            );
          }

          if (block.type === 'code' && block.codeData) {
            return (
              <motion.div
                key={block.id}
                ref={(el) => { if (el) blockRefs.current[block.id] = el; }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-50px" }}
                transition={{ duration: 0.6 }}
              >
                <HolographicCard theme={t}>
                  <div className={`${t.card} border ${t.border} rounded-3xl overflow-hidden shadow-lg`}>
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${t.border} ${t.bg}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <span className={`text-xs font-mono ${t.muted} ml-3`}>{block.codeData.language}</span>
                      </div>
                      <Button variant="ghost" size="sm" className={`h-8 ${t.muted} hover:${t.accent}`}>
                        <Share2 className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>
                    <pre className={`p-6 overflow-x-auto ${t.isLight ? 'bg-slate-900 text-slate-100' : 'bg-slate-950 text-slate-100'}`}>
                      <code className="text-sm font-mono">{block.codeData.code}</code>
                    </pre>
                    {block.codeData.output && (
                      <div className={`px-4 py-3 border-t ${t.border} ${t.bg}`}>
                        <p className={`text-xs font-mono ${t.muted}`}>Output:</p>
                        <p className={`text-sm font-mono ${t.accent}`}>{block.codeData.output}</p>
                      </div>
                    )}
                  </div>
                </HolographicCard>
              </motion.div>
            );
          }

          if (block.type === 'definition' && block.definitionData) {
            return (
              <motion.div
                key={block.id}
                ref={(el) => { if (el) blockRefs.current[block.id] = el; }}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: false, margin: "-50px" }}
                transition={{ duration: 0.5 }}
              >
                <HolographicCard theme={t}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.2 }}
                    className={`${t.card} border ${t.border} rounded-3xl p-6 md:p-8 shadow-sm`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`${t.accentLight} ${t.accent} p-3 rounded-2xl shrink-0`}>
                        <Type className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-2xl font-black ${t.text} mb-2`}>{block.definitionData.term}</h3>
                        <p className={`text-lg leading-relaxed ${t.isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                          {block.definitionData.definition}
                        </p>
                        {block.definitionData.example && (
                          <div className={`mt-4 p-4 rounded-xl ${t.bg} border ${t.border}`}>
                            <p className={`text-sm ${t.muted} mb-1`}>Example:</p>
                            <p className={`text-sm italic ${t.text}`}>{block.definitionData.example}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </HolographicCard>
              </motion.div>
            );
          }

          if (block.type === 'summary' && block.content) {
            return (
              <motion.div
                key={block.id}
                ref={(el) => { if (el) blockRefs.current[block.id] = el; }}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: "-50px" }}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                <div className={`absolute -right-16 top-0 flex flex-col gap-3 transition-all duration-300 ${showBlockActions === block.id ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                  {['story', 'fact', 'summary'].includes(block.type) && (
                    <FloatingActionButton
                      icon={isSpeaking && speakingBlockId === block.id ? VolumeX : Volume2}
                      onClick={() => toggleSpeech(block.id, block.content || '')}
                      label="Read Aloud"
                      theme={t}
                      active={isSpeaking && speakingBlockId === block.id}
                    />
                  )}
                  <FloatingActionButton
                    icon={hasBookmark ? BookmarkCheck : Bookmark}
                    onClick={() => toggleBookmark(block.id)}
                    label="Bookmark"
                    theme={t}
                    active={hasBookmark}
                  />
                  <FloatingActionButton
                    icon={PenLine}
                    onClick={() => { setActiveNoteBlock(block.id); setNoteContent(''); }}
                    label="Add Note"
                    theme={t}
                    badge={notes.filter(n => n.blockId === block.id).length}
                  />
                  <FloatingActionButton
                    icon={Heart}
                    onClick={() => toggleLike(block.id)}
                    label="Like"
                    theme={t}
                    active={isLiked}
                  />
                </div>
                
                <div className={`${t.accentLight} border ${t.borderAccent || t.border} rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden`}>
                  <div className="flex items-center gap-3 mb-4">
                    <ListChecks className={`w-6 h-6 ${t.accent}`} />
                    <h3 className={`text-xl font-bold ${t.text}`}>Key Takeaways</h3>
                  </div>
                  <div className={`space-y-3 ${t.text}`}>
                    {block.content.split('\n').map((line, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <CheckCircle2 className={`w-5 h-5 ${t.accent} shrink-0 mt-0.5`} />
                        <p className="leading-relaxed">{line.replace(/^[-•*]\s*/, '')}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          }

          return null;
        })}

        {blocks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className={`sticky bottom-24 z-30 flex items-center justify-center gap-4 py-4`}
          >
            <Button
              variant="outline"
              onClick={scrollToPrev}
              disabled={currentBlockIndex === 0}
              className={`${t.card} ${t.text} border ${t.border} rounded-full px-6 disabled:opacity-50 hover:scale-105 transition-transform shadow-lg`}
            >
              <SkipBack className="w-5 h-5 mr-2" /> Previous
            </Button>
            <Button
              variant="outline"
              onClick={scrollToNext}
              disabled={currentBlockIndex >= blocks.length - 1}
              className={`${t.card} ${t.text} border ${t.border} rounded-full px-6 disabled:opacity-50 hover:scale-105 transition-transform shadow-lg`}
            >
              Next <SkipForward className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}

        {blocks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className={`pt-16 pb-12 flex flex-col items-center border-t ${t.border} mt-10`}
          >
            <div className="text-center mb-8">
              <p className={`${t.muted} font-bold tracking-widest uppercase text-xs mb-2`}>Module Assimilation Complete</p>
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${t.accentLight} border ${t.borderAccent || t.border} shadow-lg`}
                >
                  <Zap className={`w-5 h-5 ${t.accent}`} />
                  <span className={`font-bold ${t.accent}`}>{totalPoints} pts earned</span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${t.card} border ${t.border} shadow-lg`}
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className={`font-bold ${t.text}`}>{quizzesCorrect}/{quizzesCompleted} correct</span>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full ${t.card} border ${t.border} shadow-lg`}
                >
                  <Clock className={`w-5 h-5 ${t.muted}`} />
                  <span className={`font-bold ${t.text}`}>{formatTime(readingTime)}</span>
                </motion.div>
              </div>
            </div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={completeChapter}
                className={`h-16 px-12 ${t.accentBg} text-white font-bold text-lg rounded-full transition-all transform hover:-translate-y-1 border border-white/20 shadow-xl`}
              >
                Begin Mastery Assessment <ChevronRight className="w-6 h-6 ml-2" />
              </Button>
            </motion.div>
            <p className={`mt-4 text-xs ${t.muted}`}>Your progress has been saved automatically</p>
          </motion.div>
        )}
      </main>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-full bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl md:hidden">
        <FloatingActionButton
          icon={Bookmark}
          onClick={() => setShowBookmarksDialog(true)}
          label="Bookmarks"
          theme={t}
          badge={bookmarks.length}
        />
        <FloatingActionButton
          icon={PenLine}
          onClick={() => setShowNotesDialog(true)}
          label="Notes"
          theme={t}
          badge={notes.length}
        />
        <FloatingActionButton
          icon={Volume2}
          onClick={() => setIsSpeaking(!isSpeaking)}
          label="Read Aloud"
          theme={t}
          active={isSpeaking}
        />
      </div>

      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className={`${t.card} border ${t.border} max-w-2xl`}>
          <DialogHeader>
            <DialogTitle className={t.text}>Your Notes</DialogTitle>
            <DialogDescription className={t.muted}>
              {notes.length} note{notes.length !== 1 ? 's' : ''} saved for this chapter
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {notes.length === 0 ? (
              <p className={`text-center ${t.muted} py-8`}>No notes yet. Start taking notes as you read!</p>
            ) : (
              notes.map(note => (
                <Card key={note.id} className={`${t.bg} border ${t.border}`}>
                  <CardContent className="p-4">
                    <p className={`text-sm ${t.text}`}>{note.content}</p>
                    <p className={`text-xs ${t.muted} mt-2`}>{new Date(note.createdAt).toLocaleDateString()}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotesDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBookmarksDialog} onOpenChange={setShowBookmarksDialog}>
        <DialogContent className={`${t.card} border ${t.border} max-w-2xl`}>
          <DialogHeader>
            <DialogTitle className={t.text}>Your Bookmarks</DialogTitle>
            <DialogDescription className={t.muted}>
              {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''} saved for this chapter
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {bookmarks.length === 0 ? (
              <p className={`text-center ${t.muted} py-8`}>No bookmarks yet. Bookmark important sections!</p>
            ) : (
              bookmarks.map(bookmark => {
                const block = blocks.find(b => b.id === bookmark.blockId);
                return (
                  <Card
                    key={bookmark.id}
                    className={`${t.bg} border ${t.border} cursor-pointer hover:${t.accentLight} transition-colors`}
                    onClick={() => { scrollToBlock(bookmark.blockId); setShowBookmarksDialog(false); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-semibold ${t.text}`}>
                            {block?.title || `Block ${blocks.findIndex(b => b.id === bookmark.blockId) + 1}`}
                          </p>
                          <p className={`text-xs ${t.muted}`}>{block?.type}</p>
                        </div>
                        <ChevronRight className={`w-5 h-5 ${t.muted}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBookmarksDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={`fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-2 px-4 py-2 rounded-full ${t.card} border ${t.border} shadow-lg backdrop-blur-md`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFontSize(Math.max(14, fontSize - 2))}
          className={`w-8 h-8 p-0 ${t.muted} hover:${t.accent}`}
        >
          <Minimize2 className="w-4 h-4" />
        </Button>
        <span className={`text-xs ${t.muted} w-12 text-center font-mono`}>{fontSize}px</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFontSize(Math.min(24, fontSize + 2))}
          className={`w-8 h-8 p-0 ${t.muted} hover:${t.accent}`}
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      <style jsx global>{`
        @keyframes hologram-shine {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}