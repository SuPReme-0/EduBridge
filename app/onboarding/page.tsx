// app/onboarding/page.tsx
'use client';
import { THEME_CONFIG, VIBES, type ThemeConfig } from '@/lib/themes';
import { useState, useEffect, useCallback, Suspense, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
BrainCircuit, Sparkles, BookOpen, Rocket, Zap,
ChevronRight, ChevronLeft, Target, UserCircle,
GraduationCap, School, Gamepad2, Palette, Code,
Globe, Calculator, Beaker, Music, Trophy, Library,
CheckCircle2, Search, Loader2, Bot, Upload, FileText,
Activity, Film, Heart, Camera, Plane, Coffee, TreePine,
Dumbbell, Paintbrush, Mic, Bike, Utensils, Stars,
Compass, FlaskConical, Atom, Landmark, Gavel, Stethoscope,
Building2, Briefcase, Monitor, Smartphone, Network,
Database, Cloud, Shield, Lock, Eye, Ear, Hand,
Footprints, Smile, Moon, Sun, CloudRain, Wind,
ArrowRight, X, Plus, Minus, AlertCircle, Info,
CircuitBoard, TrendingUp, Brain, MessageCircle, PenTool, Shirt,
Waves, Leaf, Users, Cog, ArrowLeft, RefreshCw,
Anchor, Dices, Club, Mountain, Tent, Bird, Star,
Circle, Square, Triangle, Puzzle, Cake, SlidersHorizontal,
AlertTriangle, Save, Edit3, Home
} from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================
const GENDERS = ['Male', 'Female', 'Non-Binary', 'Prefer not to say'];
const EDUCATION_PATHS = [
  {
    id: 'school',
    label: 'School',
    icon: School,
    levels: Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), label: `Grade ${i + 1}` })),
    boards: ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'Other'],
  },
  {
    id: 'diploma',
    label: 'Diploma',
    icon: GraduationCap,
    levels: [
      { id: 'diploma-1', label: '1st Year' },
      { id: 'diploma-2', label: '2nd Year' },
      { id: 'diploma-3', label: '3rd Year' },
    ],
    boards: ['Polytechnic', 'ITI', 'Industrial Training', 'Other'],
  },
  {
    id: 'bachelor',
    label: "Bachelor's",
    icon: Building2,
    levels: [
      { id: 'bachelor-1', label: '1st Year' },
      { id: 'bachelor-2', label: '2nd Year' },
      { id: 'bachelor-3', label: '3rd Year' },
      { id: 'bachelor-4', label: '4th Year' },
    ],
    boards: ['Engineering', 'Medical', 'Arts', 'Science', 'Commerce', 'Law', 'Management', 'Other'],
  },
  {
    id: 'master',
    label: "Master's",
    icon: Landmark,
    levels: [
      { id: 'master-1', label: '1st Year' },
      { id: 'master-2', label: '2nd Year' },
    ],
    boards: ['Engineering', 'Medical', 'Arts', 'Science', 'Commerce', 'Law', 'Management', 'Research', 'Other'],
  },
];
const INTERESTS = [
  { id: 'math', label: 'Mathematics', icon: Calculator, category: 'academic', color: 'text-blue-500' },
  { id: 'physics', label: 'Physics', icon: Atom, category: 'academic', color: 'text-purple-500' },
  { id: 'chemistry', label: 'Chemistry', icon: FlaskConical, category: 'academic', color: 'text-green-500' },
  { id: 'biology', label: 'Biology', icon: Beaker, category: 'academic', color: 'text-emerald-500' },
  { id: 'coding', label: 'Coding', icon: Code, category: 'academic', color: 'text-indigo-500' },
  { id: 'ai-ml', label: 'AI & ML', icon: BrainCircuit, category: 'academic', color: 'text-violet-500' },
  { id: 'robotics', label: 'Robotics', icon: Zap, category: 'academic', color: 'text-cyan-500' },
  { id: 'electronics', label: 'Electronics', icon: CircuitBoard, category: 'academic', color: 'text-slate-500' },
  { id: 'history', label: 'History', icon: Globe, category: 'academic', color: 'text-amber-500' },
  { id: 'geography', label: 'Geography', icon: Compass, category: 'academic', color: 'text-teal-500' },
  { id: 'economics', label: 'Economics', icon: TrendingUp, category: 'academic', color: 'text-rose-500' },
  { id: 'psychology', label: 'Psychology', icon: Brain, category: 'academic', color: 'text-pink-500' },
  { id: 'literature', label: 'Literature', icon: BookOpen, category: 'academic', color: 'text-orange-500' },
  { id: 'languages', label: 'Languages', icon: MessageCircle, category: 'academic', color: 'text-sky-500' },
  { id: 'astronomy', label: 'Astronomy', icon: Stars, category: 'academic', color: 'text-purple-600' },
  { id: 'environment', label: 'Environment', icon: Leaf, category: 'academic', color: 'text-green-600' },
  { id: 'philosophy', label: 'Philosophy', icon: Brain, category: 'academic', color: 'text-indigo-400' },
  { id: 'archeology', label: 'Archeology', icon: Compass, category: 'academic', color: 'text-amber-700' },
  { id: 'marine-bio', label: 'Marine Biology', icon: Waves, category: 'academic', color: 'text-cyan-600' },
  { id: 'forensics', label: 'Forensics', icon: Shield, category: 'academic', color: 'text-slate-600' },
];
const HOBBIES = [
  { id: 'drawing', label: 'Drawing', icon: Paintbrush, category: 'creative', color: 'text-pink-500' },
  { id: 'painting', label: 'Painting', icon: Palette, category: 'creative', color: 'text-purple-500' },
  { id: 'photography', label: 'Photography', icon: Camera, category: 'creative', color: 'text-blue-500' },
  { id: 'music', label: 'Music', icon: Music, category: 'creative', color: 'text-red-500' },
  { id: 'singing', label: 'Singing', icon: Mic, category: 'creative', color: 'text-rose-500' },
  { id: 'dancing', label: 'Dancing', icon: Activity, category: 'creative', color: 'text-orange-500' },
  { id: 'writing', label: 'Writing', icon: PenTool, category: 'creative', color: 'text-indigo-500' },
  { id: 'acting', label: 'Acting', icon: Film, category: 'creative', color: 'text-amber-500' },
  { id: 'crafts', label: 'Crafts', icon: PenTool, category: 'creative', color: 'text-fuchsia-500' },
  { id: 'origami', label: 'Origami', icon: Square, category: 'creative', color: 'text-cyan-500' },
  { id: 'pottery', label: 'Pottery', icon: Circle, category: 'creative', color: 'text-orange-600' },
  { id: 'jewelry', label: 'Jewelry Making', icon: Star, category: 'creative', color: 'text-yellow-600' },
  { id: 'cricket', label: 'Cricket', icon: Trophy, category: 'sports', color: 'text-blue-600' },
  { id: 'football', label: 'Football', icon: Trophy, category: 'sports', color: 'text-green-600' },
  { id: 'basketball', label: 'Basketball', icon: Trophy, category: 'sports', color: 'text-orange-600' },
  { id: 'tennis', label: 'Tennis', icon: Trophy, category: 'sports', color: 'text-yellow-600' },
  { id: 'swimming', label: 'Swimming', icon: Waves, category: 'sports', color: 'text-cyan-600' },
  { id: 'gym', label: 'Gym', icon: Dumbbell, category: 'sports', color: 'text-red-600' },
  { id: 'yoga', label: 'Yoga', icon: Leaf, category: 'sports', color: 'text-emerald-600' },
  { id: 'cycling', label: 'Cycling', icon: Bike, category: 'sports', color: 'text-slate-600' },
  { id: 'running', label: 'Running', icon: Footprints, category: 'sports', color: 'text-rose-600' },
  { id: 'martial-arts', label: 'Martial Arts', icon: Shield, category: 'sports', color: 'text-violet-600' },
  { id: 'skateboarding', label: 'Skateboarding', icon: Zap, category: 'sports', color: 'text-indigo-600' },
  { id: 'badminton', label: 'Badminton', icon: Trophy, category: 'sports', color: 'text-lime-600' },
  { id: 'table-tennis', label: 'Table Tennis', icon: Trophy, category: 'sports', color: 'text-amber-600' },
  { id: 'golf', label: 'Golf', icon: Target, category: 'sports', color: 'text-green-600' },
  { id: 'hockey', label: 'Hockey', icon: Trophy, category: 'sports', color: 'text-blue-700' },
  { id: 'hiking', label: 'Hiking', icon: Mountain, category: 'outdoor', color: 'text-green-700' },
  { id: 'camping', label: 'Camping', icon: Tent, category: 'outdoor', color: 'text-emerald-700' },
  { id: 'fishing', label: 'Fishing', icon: Anchor, category: 'outdoor', color: 'text-cyan-700' },
  { id: 'bird-watching', label: 'Bird Watching', icon: Bird, category: 'outdoor', color: 'text-sky-700' },
  { id: 'stargazing', label: 'Stargazing', icon: Moon, category: 'outdoor', color: 'text-violet-700' },
  { id: 'gardening', label: 'Gardening', icon: TreePine, category: 'outdoor', color: 'text-green-600' },
  { id: 'beach', label: 'Beach', icon: Waves, category: 'outdoor', color: 'text-blue-500' },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2, category: 'gaming', color: 'text-purple-500' },
  { id: 'esports', label: 'Esports', icon: Trophy, category: 'gaming', color: 'text-cyan-500' },
  { id: 'streaming', label: 'Streaming', icon: Monitor, category: 'gaming', color: 'text-red-500' },
  { id: 'anime', label: 'Anime', icon: Stars, category: 'gaming', color: 'text-pink-500' },
  { id: 'movies', label: 'Movies', icon: Film, category: 'gaming', color: 'text-amber-500' },
  { id: 'board-games', label: 'Board Games', icon: Dices, category: 'gaming', color: 'text-orange-600' },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle, category: 'gaming', color: 'text-slate-600' },
  { id: 'card-games', label: 'Card Games', icon: Club, category: 'gaming', color: 'text-red-600' },
  { id: 'reading', label: 'Reading', icon: BookOpen, category: 'lifestyle', color: 'text-amber-600' },
  { id: 'cooking', label: 'Cooking', icon: Utensils, category: 'lifestyle', color: 'text-orange-600' },
  { id: 'baking', label: 'Baking', icon: Cake, category: 'lifestyle', color: 'text-pink-600' },
  { id: 'travel', label: 'Travel', icon: Plane, category: 'lifestyle', color: 'text-sky-600' },
  { id: 'volunteering', label: 'Volunteering', icon: Heart, category: 'lifestyle', color: 'text-rose-600' },
  { id: 'socializing', label: 'Socializing', icon: Users, category: 'lifestyle', color: 'text-blue-600' },
  { id: 'coffee', label: 'Coffee', icon: Coffee, category: 'lifestyle', color: 'text-amber-700' },
  { id: 'meditation', label: 'Meditation', icon: Smile, category: 'wellness', color: 'text-teal-600' },
  { id: 'journaling', label: 'Journaling', icon: PenTool, category: 'wellness', color: 'text-indigo-600' },
  { id: 'collecting', label: 'Collecting', icon: Star, category: 'hobby', color: 'text-amber-600' },
  { id: 'diy', label: 'DIY Projects', icon: Cog, category: 'hobby', color: 'text-orange-600' },
];
const SUBJECTS = [
  { id: 'math', label: 'Mathematics', icon: Calculator, color: 'text-blue-500' },
  { id: 'physics', label: 'Physics', icon: Atom, color: 'text-purple-500' },
  { id: 'chemistry', label: 'Chemistry', icon: FlaskConical, color: 'text-green-500' },
  { id: 'biology', label: 'Biology', icon: Beaker, color: 'text-emerald-500' },
  { id: 'cs', label: 'Computer Science', icon: Code, color: 'text-indigo-500' },
  { id: 'english', label: 'English', icon: BookOpen, color: 'text-rose-500' },
  { id: 'history', label: 'History', icon: Globe, color: 'text-amber-500' },
  { id: 'geography', label: 'Geography', icon: Compass, color: 'text-teal-500' },
  { id: 'economics', label: 'Economics', icon: TrendingUp, color: 'text-cyan-500' },
  { id: 'accounts', label: 'Accountancy', icon: Calculator, color: 'text-slate-500' },
  { id: 'business', label: 'Business Studies', icon: Briefcase, color: 'text-orange-500' },
  { id: 'psychology', label: 'Psychology', icon: Brain, color: 'text-pink-500' },
  { id: 'sociology', label: 'Sociology', icon: Users, color: 'text-violet-500' },
  { id: 'political-science', label: 'Political Science', icon: Landmark, color: 'text-red-500' },
  { id: 'law', label: 'Law', icon: Gavel, color: 'text-zinc-500' },
  { id: 'medicine', label: 'Medicine', icon: Stethoscope, color: 'text-red-600' },
  { id: 'engineering', label: 'Engineering', icon: Cog, color: 'text-blue-600' },
  { id: 'architecture', label: 'Architecture', icon: Building2, color: 'text-stone-500' },
  { id: 'design', label: 'Design', icon: Palette, color: 'text-fuchsia-500' },
  { id: 'arts', label: 'Fine Arts', icon: Paintbrush, color: 'text-yellow-500' },
];
const TEMPOS = [
  { id: 'EASY', label: 'Relaxed', desc: 'Story-driven, gentle pace', icon: BookOpen, color: 'text-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  { id: 'NORMAL', label: 'Balanced', desc: 'Standard curriculum pace', icon: BrainCircuit, color: 'text-indigo-500', border: 'border-indigo-200', bg: 'bg-indigo-50' },
  { id: 'EXTREME', label: 'Accelerated', desc: 'High-density, fast challenges', icon: Zap, color: 'text-rose-500', border: 'border-rose-200', bg: 'bg-rose-50' },
];

interface Book {
  id: string;
  title: string;
  author: string;
  subject: string;
  thumbnail?: string;
  chapters?: string[];
}

interface ExtractedSyllabus {
  subjects: string[];
  chapters: { subject: string; topics: string[] }[];
}

// ============================================================================
// SUB-COMPONENTS (Memoized for performance)
// ============================================================================
const InterestCard = ({ item, isSelected, onToggle, theme }: {
  item: typeof INTERESTS[0] | typeof HOBBIES[0];
  isSelected: boolean;
  onToggle: () => void;
  theme: ThemeConfig;
}) => {
  const Icon = item.icon;
  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={`relative p-5 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-3 min-h-[130px] shadow-lg
        ${isSelected
          ? `border-indigo-500 ${theme.accentLight} shadow-xl`
          : `${theme.border} ${theme.card} hover:border-slate-300 hover:shadow-md`
        }`}
    >
      {isSelected && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3">
          <div className={`w-6 h-6 rounded-full ${theme.accentBg} flex items-center justify-center`}>
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        </motion.div>
      )}
      <div className={`p-4 rounded-2xl ${isSelected ? theme.accentLight : theme.inputBg}`}>
        <Icon className={`w-7 h-7 ${isSelected ? theme.accent : item.color}`} />
      </div>
      <span className={`text-sm font-bold text-center ${isSelected ? theme.text : theme.muted}`}>
        {item.label}
      </span>
      <Badge variant="secondary" className={`text-[10px] uppercase tracking-wider ${isSelected ? `${theme.accentLight} ${theme.accent}` : 'bg-slate-100 text-slate-500'}`}>
        {item.category}
      </Badge>
    </motion.button>
  );
};

const SubjectCard = ({ subject, isSelected, onToggle, theme }: {
  subject: typeof SUBJECTS[0];
  isSelected: boolean;
  onToggle: () => void;
  theme: ThemeConfig;
}) => {
  const Icon = subject.icon;
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onToggle}
      className={`p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2
        ${isSelected
          ? `border-indigo-500 ${theme.accentLight} shadow-md`
          : `${theme.border} ${theme.card} hover:border-slate-300`
        }`}
    >
      <Icon className={`w-7 h-7 ${subject.color}`} />
      <span className={`text-xs font-semibold ${isSelected ? theme.text : theme.muted}`}>
        {subject.label}
      </span>
    </motion.button>
  );
};

const BookCard = ({ book, isSelected, onToggle, showChapters, theme }: {
  book: Book;
  isSelected: boolean;
  onToggle: () => void;
  showChapters?: boolean;
  theme: ThemeConfig;
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={onToggle}
      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex gap-3
        ${isSelected
          ? `border-indigo-500 ${theme.accentLight} shadow-md`
          : `${theme.border} ${theme.card} hover:border-slate-300`
        }`}
    >
      <div className={`w-16 h-20 rounded-lg overflow-hidden shrink-0 border flex items-center justify-center
        ${isSelected ? theme.borderAccent : theme.border}`}>
        {book.thumbnail ? (
          <img src={book.thumbnail} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <BookOpen className={`w-6 h-6 ${isSelected ? theme.accent : theme.muted}`} />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <h4 className={`font-bold text-sm leading-tight mb-1 line-clamp-2 ${isSelected ? theme.text : theme.muted}`}>
          {book.title}
        </h4>
        <p className={`text-[11px] ${theme.muted} mb-1 truncate`}>{book.author}</p>
        <Badge variant="secondary" className="text-[10px] h-5">{book.subject}</Badge>
        {showChapters && book.chapters && book.chapters.length > 0 && (
          <p className={`text-[10px] ${theme.muted} mt-1`}>{book.chapters.length} chapters</p>
        )}
      </div>
      {isSelected && <CheckCircle2 className={`w-5 h-5 ${theme.accent} shrink-0`} />}
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, updateProfile } = useStore();

  // URL Parameters
  const isEditMode = searchParams.get('edit') === 'true';
  const initialStep = parseInt(searchParams.get('step') || '1');
  const fromProfile = searchParams.get('fromProfile') === 'true';

  // State
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [step, setStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analyzingSyllabus, setAnalyzingSyllabus] = useState(false);
  const [error, setError] = useState('');

  // Theme State - with fallback safety
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(() => {
    if (typeof window !== 'undefined') {
      const savedVibe = localStorage.getItem('edubridge_theme');
      if (savedVibe && THEME_CONFIG[savedVibe]) return THEME_CONFIG[savedVibe];
    }
    return THEME_CONFIG['minimalist'];
  });
  const [showDataInvalidationWarning, setShowDataInvalidationWarning] = useState(false);

  // Form State
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [school, setSchool] = useState('');
  const [educationPath, setEducationPath] = useState<'school' | 'diploma' | 'bachelor' | 'master'>('school');
  const [classLevel, setClassLevel] = useState<string>('10');
  const [board, setBoard] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [tempo, setTempo] = useState<'EASY' | 'NORMAL' | 'EXTREME'>('NORMAL');
  const [vibe, setVibe] = useState<string>('minimalist');

  // Syllabus State
  const [syllabusMethod, setSyllabusMethod] = useState<'upload' | 'select'>('upload');
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [syllabusText, setSyllabusText] = useState('');
  const [extractedSyllabus, setExtractedSyllabus] = useState<ExtractedSyllabus | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Book Selection State
  const [bookMethod, setBookMethod] = useState<'system' | 'manual'>('system');
  const [recommendedBooks, setRecommendedBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Book[]>([]);

  // ✅ NEW: For AI‑recommended books grouped by subject
  const [recommendedBySubject, setRecommendedBySubject] = useState<{ subject: string; books: Book[] }[]>([]);

  // ✅ NEW: For manual search filters (class & board toggles)
  const [filterClassEnabled, setFilterClassEnabled] = useState(false);
  const [filterBoardEnabled, setFilterBoardEnabled] = useState(false);

  // Manual search filter subjects (from selectedSubjects)
  const [filterSubjects, setFilterSubjects] = useState<string[]>([]);

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);
  const currentPath = EDUCATION_PATHS.find(p => p.id === educationPath);

  // ============================================================================
  // LOAD PROFILE DATA (Single, unified fetch without deadlocks)
  // ============================================================================
  useEffect(() => {
    let isMounted = true;
    const loadProfileData = async () => {
      try {
        const res = await fetch('/api/profile/me');
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        const p = data.profile;
        if (p && isMounted) {
          // 1. Always set theme if it exists
          if (p.currentVibe && THEME_CONFIG[p.currentVibe as keyof typeof THEME_CONFIG]) {
            setActiveTheme(THEME_CONFIG[p.currentVibe as keyof typeof THEME_CONFIG]);
            localStorage.setItem('edubridge_theme', p.currentVibe);
          }
          // 2. ALWAYS populate form fields if the DB has data!
          if (p.educationPath || p.classLevel) {
            setAge(p.age?.toString() || '');
            setGender(p.gender || '');
            setSchool(p.school || '');
            setEducationPath(p.educationPath || 'school');
            setClassLevel(p.classLevel?.toString() || '10');
            setBoard(p.board || '');
            setSelectedInterests(p.interests || []);
            setSelectedHobbies(p.hobbies || []);
            setTempo(p.learningTempo || 'NORMAL');
            setVibe(p.currentVibe || 'minimalist');
          }
        }
      } catch (e) {
        console.error('Failed to load profile data:', e);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };
    loadProfileData();
    return () => {
      isMounted = false;
    };
  }, []); // Run ONCE on mount

  // Initialize filterSubjects when entering step 6 in manual mode
  useEffect(() => {
    if (step === 6 && bookMethod === 'manual') {
      setFilterSubjects(selectedSubjects);
    }
  }, [step, bookMethod, selectedSubjects]);

  // ============================================================================
  // DEBOUNCED AUTO-SAVE (Protected against overwriting)
  // ============================================================================
  const saveProgress = useCallback(async () => {
    if (loadingProfile) return;
    try {
      await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: parseInt(age) || undefined,
          gender,
          school,
          educationPath,
          classLevel: parseInt(classLevel) || 10,
          board,
          interests: selectedInterests,
          hobbies: selectedHobbies,
          learningTempo: tempo,
          currentVibe: vibe,
        }),
      });
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }, [age, gender, school, educationPath, classLevel, board, selectedInterests, selectedHobbies, tempo, vibe, loadingProfile]);

  useEffect(() => {
    if (!loadingProfile) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveProgress();
      }, 800);
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [saveProgress, loadingProfile]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // ============================================================================
  // SMART INVALIDATION WARNING
  // ============================================================================
  const handleClassOrBoardChange = (newClassLevel: string, newBoard: string) => {
    const hasCurriculum = localStorage.getItem('hasCurriculum') === 'true';
    if (hasCurriculum && (newClassLevel !== classLevel || newBoard !== board)) {
      setShowDataInvalidationWarning(true);
    }
    setClassLevel(newClassLevel);
    setBoard(newBoard);
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const toggleInterest = (id: string) => {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleHobby = (id: string) => {
    setSelectedHobbies(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleBookSelection = (book: Book) => {
    setSelectedBooks(prev => {
      const exists = prev.find(b => b.id === book.id);
      if (exists) return prev.filter(b => b.id !== book.id);
      if (prev.length >= 5) return prev;
      return [...prev, book];
    });
  };

  const toggleFilterSubject = (subjectId: string) => {
    setFilterSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleNext = async () => {
    await saveProgress();
    setDirection(1);
    if (step === 4) {
      if (syllabusMethod === 'upload' && (syllabusFile || syllabusText)) {
        setAnalyzingSyllabus(true);
        setError('');
        try {
          let data;
          if (syllabusFile) {
            const formData = new FormData();
            formData.append('syllabus', syllabusFile);
            const res = await fetch('/api/curriculum/parse-syllabus', {
              method: 'POST',
              body: formData,
            });
            data = await res.json();
          } else {
            const res = await fetch('/api/curriculum/parse-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ syllabusText }),
            });
            data = await res.json();
          }
          if (data.success && data.extracted) {
            setExtractedSyllabus(data.extracted);
            setSelectedSubjects(data.extracted.subjects);
            setStep(5);
          } else {
            throw new Error(data.error || 'Failed to parse syllabus');
          }
        } catch (err: any) {
          console.error('Syllabus parsing failed:', err);
          setError(err.message || 'Failed to parse syllabus. Please try manual selection.');
        } finally {
          setAnalyzingSyllabus(false);
        }
      } else if (syllabusMethod === 'select' && selectedSubjects.length > 0) {
        setStep(6);
      } else {
        setError('Please select at least one subject or upload a syllabus.');
      }
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
    setError('');
  };

  // ============================================================================
  // ✅ UPDATED: BOOK RECOMMENDATIONS - System (AI) Mode with Subject Grouping
  // ============================================================================
  const fetchSystemRecommendedBooks = useCallback(async () => {
    if (!selectedSubjects.length && !extractedSyllabus) return;

    setIsSearching(true);
    setError('');
    try {
      const res = await fetch('/api/books/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          educationPath,
          classLevel,
          board,
          subjects: selectedSubjects,
          chapters: extractedSyllabus?.chapters?.flatMap(c => c.topics) || [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch recommendations');

      if (data.recommendations && Array.isArray(data.recommendations)) {
        // Transform API response into our recommendedBySubject structure
        const grouped = data.recommendations.map((rec: any) => ({
          subject: rec.subject,
          books: rec.books.map((b: any) => ({
            id: b.id || crypto.randomUUID(), // ensure unique ID
            title: b.title,
            author: b.author || 'Unknown',
            subject: rec.subject, // store subject for filtering/display
            thumbnail: null,
            chapters: [],
          })),
        }));
        setRecommendedBySubject(grouped);
      } else {
        setRecommendedBySubject([]);
      }
    } catch (err: any) {
      console.error('System book recommendation failed:', err);
      setError(err.message || 'Failed to load book recommendations. Try manual search.');
    } finally {
      setIsSearching(false);
    }
  }, [educationPath, classLevel, board, selectedSubjects, extractedSyllabus]);

  // ============================================================================
  // ✅ UPDATED: BOOK RECOMMENDATIONS - Manual Mode with Class/Board Filters
  // ============================================================================
  const fetchManualBooks = useCallback(async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      let query = searchQuery;
      if (filterClassEnabled && classLevel) {
        query += ` grade ${classLevel}`;
      }
      if (filterBoardEnabled && board) {
        query += ` ${board}`;
      }

      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.items) {
        const books: Book[] = data.items.map((item: any) => ({
          id: item.id,
          title: item.volumeInfo.title,
          author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown Author',
          subject: item.volumeInfo.categories ? item.volumeInfo.categories[0] : 'Textbook',
          thumbnail: item.volumeInfo.imageLinks?.smallThumbnail || null,
          chapters: [],
        }));
        setSearchResults(books);
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      console.error('Manual book search failed:', e);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, filterClassEnabled, filterBoardEnabled, classLevel, board]);

  // Filtered results based on selected filter subjects
  const filteredManualBooks = useMemo(() => {
    if (!searchResults.length) return [];
    if (filterSubjects.length === 0) return searchResults;
    return searchResults.filter(book => {
      return filterSubjects.some(subId => {
        const sub = SUBJECTS.find(s => s.id === subId);
        return sub && book.subject.toLowerCase().includes(sub.label.toLowerCase());
      });
    });
  }, [searchResults, filterSubjects]);

  useEffect(() => {
    if (bookMethod === 'manual') {
      const timeoutId = setTimeout(fetchManualBooks, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, bookMethod, fetchManualBooks]);

  useEffect(() => {
    if (step === 6 && bookMethod === 'system') {
      if (selectedSubjects.length > 0 || extractedSyllabus) {
        fetchSystemRecommendedBooks();
      }
    }
  }, [step, bookMethod, fetchSystemRecommendedBooks, selectedSubjects, extractedSyllabus]);

  // ============================================================================
  // EXIT & COMPLETE HANDLERS
  // ============================================================================
  const handleSaveAndExit = async () => {
    await saveProgress();
    router.push(fromProfile ? '/profile' : '/dashboard');
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      await saveProgress();
      const payload = {
        educationPath,
        classLevel,
        board,
        subjects: selectedSubjects,
        extractedSyllabus,
        referenceBooks: selectedBooks.length > 0
          ? selectedBooks.map(b => ({ title: b.title, author: b.author, id: b.id }))
          : ['AI_DEFAULT'],
        interests: selectedInterests,
        hobbies: selectedHobbies,
        learningTempo: tempo,
        currentVibe: vibe,
      };
      await fetch('/api/curriculum/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      updateProfile({
        interests: selectedInterests,
        hobbies: selectedHobbies,
        learningTempo: tempo,
        currentVibe: vibe,
      });
      localStorage.setItem('edubridge_theme', vibe);
      localStorage.setItem('hasCurriculum', 'true');
      router.push(fromProfile ? '/profile?tab=curriculum' : '/dashboard');
    } catch (err: any) {
      console.error('Curriculum generation failed:', err);
      setError(err.message || 'System connection lost. Please try again.');
      setLoading(false);
    }
  };

  // ============================================================================
  // VALIDATION
  // ============================================================================
  const isStep1Valid = useMemo(() =>
    age && gender && school.length > 2 && board && classLevel,
    [age, gender, school, board, classLevel]
  );

  const isStep2Valid = useMemo(() =>
    selectedInterests.length > 0 || selectedHobbies.length > 0,
    [selectedInterests, selectedHobbies]
  );

  const isStep4Valid = useMemo(() =>
    syllabusMethod === 'select'
      ? selectedSubjects.length > 0
      : (syllabusFile || syllabusText.length > 20),
    [syllabusMethod, selectedSubjects, syllabusFile, syllabusText]
  );

  const isStep6Valid = useMemo(() =>
    bookMethod === 'system' || selectedBooks.length > 0,
    [bookMethod, selectedBooks]
  );

  // ============================================================================
  // ANIMATION VARIANTS
  // ============================================================================
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95
    }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95
    })
  };

  const t = activeTheme;

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden transition-colors duration-300`}>
      {/* Background Layers */}
      <div className={`fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${t.gradient} opacity-10 pointer-events-none transition-opacity duration-300`} />
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `linear-gradient(${t.text.replace('text-', 'border-')} 1px, transparent 1px), linear-gradient(90deg, ${t.text.replace('text-', 'border-')} 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      {/* Main Container */}
      <div className="w-full max-w-4xl relative z-10 flex flex-col min-h-[700px]">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 ${t.accent} font-bold tracking-widest uppercase text-xs mb-4`}
          >
            <Sparkles className="w-4 h-4" />
            {isEditMode ? 'Edit Profile' : 'Setup Phase'} {step}/6
          </motion.div>
          <div className="flex gap-2 w-full max-w-lg">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <motion.div
                key={i}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`h-2 flex-1 rounded-full transition-all duration-500 origin-left
                  ${i <= step
                    ? `bg-gradient-to-r ${t.gradient} shadow-lg`
                    : `${t.inputBg} ${t.inputBorder} border`
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Main Card */}
        <Card className={`${t.card} ${t.border} shadow-2xl flex flex-col flex-1 relative overflow-hidden rounded-3xl backdrop-blur-xl transition-colors duration-300`}>
          <AnimatePresence mode="wait" custom={direction}>
            {/* ===== STEP 1: Personal Info ===== */}
            {step === 1 && (
              <motion.div key="step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-3 rounded-2xl ${t.accentLight}`}>
                    <UserCircle className={`w-7 h-7 ${t.accent}`} />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-black ${t.text}`}>Personal Information</h2>
                    <p className={`text-sm ${t.muted}`}>Tell us about yourself</p>
                  </div>
                </div>
                <ScrollArea className="flex-1 mt-6 pr-4">
                  <div className="space-y-6">
                    {/* Age & Gender */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Age</Label>
                        <Input type="number" placeholder="16" value={age} onChange={(e) => setAge(e.target.value)} className={`h-12 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl`} />
                      </div>
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Gender</Label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)} className={`w-full h-12 px-4 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl outline-none appearance-none cursor-pointer`}>
                          <option value="" disabled>Select...</option>
                          {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* School Name */}
                    <div className="space-y-2">
                      <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted} flex items-center gap-2`}>
                        <School className="w-4 h-4" /> Institution Name
                      </Label>
                      <Input placeholder="e.g. Delhi Public School" value={school} onChange={(e) => setSchool(e.target.value)} className={`h-12 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl`} />
                    </div>
                    {/* Education Path, Class Level, Board */}
                    <div className="space-y-2">
                      <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Education Path</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {EDUCATION_PATHS.map(path => (
                          <button
                            key={path.id}
                            onClick={() => setEducationPath(path.id as any)}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${educationPath === path.id ? `border-indigo-500 ${t.accentLight}` : `${t.border} ${t.card}`}`}
                          >
                            <path.icon className={`w-5 h-5 ${educationPath === path.id ? t.accent : t.muted}`} />
                            <span className={`text-[10px] font-bold ${educationPath === path.id ? t.accent : t.muted}`}>{path.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Class/Grade</Label>
                        <select value={classLevel} onChange={(e) => handleClassOrBoardChange(e.target.value, board)} className={`w-full h-12 px-4 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl outline-none`}>
                          {currentPath?.levels.map(l => (
                            <option key={l.id} value={l.id}>{l.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Board/University</Label>
                        <select value={board} onChange={(e) => handleClassOrBoardChange(classLevel, e.target.value)} className={`w-full h-12 px-4 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl outline-none`}>
                          <option value="" disabled>Select...</option>
                          {currentPath?.boards.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </motion.div>
            )}

            {/* ===== STEP 2: Interests & Hobbies ===== */}
            {step === 2 && (
              <motion.div key="step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-3 rounded-2xl ${t.accentLight}`}>
                    <Heart className={`w-7 h-7 ${t.accent}`} />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-black ${t.text}`}>Interests & Hobbies</h2>
                    <p className={`text-sm ${t.muted}`}>Select what you love (pick multiple)</p>
                  </div>
                </div>
                <ScrollArea className="flex-1 mt-6 pr-4">
                  <div className="space-y-8">
                    {/* Academic Interests */}
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-widest ${t.accent} mb-4`}>
                        Academic Interests
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {INTERESTS.map((item) => (
                          <InterestCard
                            key={item.id}
                            item={item}
                            isSelected={selectedInterests.includes(item.id)}
                            onToggle={() => toggleInterest(item.id)}
                            theme={t}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Hobbies */}
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-widest ${t.accent} mb-4`}>
                        Hobbies & Creative Pursuits
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {HOBBIES.map((item) => (
                          <InterestCard
                            key={item.id}
                            item={item}
                            isSelected={selectedHobbies.includes(item.id)}
                            onToggle={() => toggleHobby(item.id)}
                            theme={t}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </motion.div>
            )}

            {/* ===== STEP 3: Learning Preferences ===== */}
            {step === 3 && (
              <motion.div key="step3" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-3 rounded-2xl ${t.accentLight}`}>
                    <BrainCircuit className={`w-7 h-7 ${t.accent}`} />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-black ${t.text}`}>Learning Preferences</h2>
                    <p className={`text-sm ${t.muted}`}>Customize your AI curriculum pace and visual style</p>
                  </div>
                </div>
                <ScrollArea className="flex-1 mt-6 pr-4">
                  <div className="space-y-8">
                    {/* Tempo */}
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-widest ${t.accent} mb-4`}>
                        Learning Tempo
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {TEMPOS.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setTempo(opt.id as any)}
                            className={`p-5 rounded-2xl border-2 transition-all text-left ${tempo === opt.id ? `border-indigo-500 ${t.accentLight}` : `${t.border} ${t.card}`}`}
                          >
                            <opt.icon className={`w-6 h-6 ${tempo === opt.id ? t.accent : t.muted} mb-2`} />
                            <p className={`font-bold ${tempo === opt.id ? t.accent : t.text}`}>{opt.label}</p>
                            <p className={`text-xs ${t.muted} mt-1`}>{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Theme */}
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-widest ${t.accent} mb-4`}>
                        Visual Vibe
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {VIBES.map(v => (
                          <button
                            key={v.id}
                            onClick={() => setVibe(v.id)}
                            className={`relative overflow-hidden h-14 rounded-xl border transition-all ${vibe === v.id ? `border-indigo-500 ring-2 ring-indigo-500/50` : `${t.inputBorder} ${t.inputBg}`}`}
                          >
                            <div className={`absolute inset-0 bg-gradient-to-br ${v.gradient} ${vibe === v.id ? 'opacity-100' : 'opacity-30'}`} />
                            {vibe === v.id && <CheckCircle2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-white drop-shadow-md" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </motion.div>
            )}

            {/* ===== STEP 4: Syllabus Input ===== */}
            {step === 4 && (
              <motion.div key="step4" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8 relative">
                <AnimatePresence>
                  {analyzingSyllabus && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 z-20 ${t.card}/95 backdrop-blur-md flex flex-col items-center justify-center rounded-3xl`}>
                      <Loader2 className={`w-14 h-14 ${t.accent} animate-spin mb-4`} />
                      <p className={`text-lg font-bold ${t.text}`}>Analyzing Syllabus...</p>
                      <p className={`text-sm ${t.muted} mt-2`}>Extracting subjects and chapters using AI</p>
                      <Progress value={60} className={`w-48 h-2 mt-4 ${t.inputBg} [&>div]:${t.progressBar}`} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-3 rounded-2xl ${t.accentLight}`}>
                    <FileText className={`w-7 h-7 ${t.accent}`} />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-black ${t.text}`}>Syllabus Input</h2>
                    <p className={`text-sm ${t.muted}`}>Upload your syllabus or select subjects manually</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 mb-6">
                  <button
                    onClick={() => setSyllabusMethod('upload')}
                    className={`p-5 rounded-2xl border-2 transition-all ${syllabusMethod === 'upload' ? `border-indigo-500 ${t.accentLight}` : `${t.border} ${t.card}`}`}
                  >
                    <Upload className={`w-6 h-6 mb-2 ${syllabusMethod === 'upload' ? t.accent : t.muted}`} />
                    <h3 className={`font-bold ${syllabusMethod === 'upload' ? t.accent : t.text}`}>Upload PDF/Text</h3>
                    <p className={`text-xs ${t.muted} mt-1`}>We'll parse it automatically</p>
                  </button>
                  <button
                    onClick={() => setSyllabusMethod('select')}
                    className={`p-5 rounded-2xl border-2 transition-all ${syllabusMethod === 'select' ? `border-indigo-500 ${t.accentLight}` : `${t.border} ${t.card}`}`}
                  >
                    <CheckCircle2 className={`w-6 h-6 mb-2 ${syllabusMethod === 'select' ? t.accent : t.muted}`} />
                    <h3 className={`font-bold ${syllabusMethod === 'select' ? t.accent : t.text}`}>Manual Selection</h3>
                    <p className={`text-xs ${t.muted} mt-1`}>Pick subjects yourself</p>
                  </button>
                </div>
                <ScrollArea className="flex-1 pr-4">
                  {syllabusMethod === 'upload' ? (
                    <div className="space-y-4">
                      {/* File Upload */}
                      <div className={`border-2 border-dashed ${t.border} rounded-2xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer`} onClick={() => document.getElementById('file-upload')?.click()}>
                        <input id="file-upload" type="file" accept=".pdf,.txt,.jpg,.png" className="hidden" onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)} />
                        <Upload className={`w-10 h-10 ${t.muted} mx-auto mb-3`} />
                        <p className={`font-bold ${t.text} mb-1`}>{syllabusFile ? syllabusFile.name : 'Click to upload or drag and drop'}</p>
                        <p className={`text-xs ${t.muted}`}>PDF, TXT, JPG, PNG (max 10MB)</p>
                      </div>
                      {/* Or paste text */}
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Or paste syllabus text</Label>
                        <Textarea
                          placeholder="Paste your syllabus content here..."
                          value={syllabusText}
                          onChange={(e) => setSyllabusText(e.target.value)}
                          className={`min-h-[200px] ${t.inputBg} ${t.inputBorder} ${t.text} rounded-xl`}
                        />
                      </div>
                    </div>
                  ) : (
                    // Manual subject selection
                    <div className="space-y-4">
                      <h3 className={`font-bold ${t.text}`}>Select your subjects:</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {SUBJECTS.map(sub => (
                          <SubjectCard
                            key={sub.id}
                            subject={sub}
                            isSelected={selectedSubjects.includes(sub.id)}
                            onToggle={() => toggleSubject(sub.id)}
                            theme={t}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </ScrollArea>
                {error && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ===== STEP 5: Syllabus Review ===== */}
            {step === 5 && (
              <motion.div key="step5" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-3 rounded-2xl ${t.accentLight}`}>
                    {syllabusMethod === 'upload' && extractedSyllabus ? (
                      <CheckCircle2 className={`w-7 h-7 text-emerald-600`} />
                    ) : (
                      <Target className={`w-7 h-7 ${t.accent}`} />
                    )}
                  </div>
                  <div>
                    <h2 className={`text-2xl font-black ${t.text}`}>
                      {syllabusMethod === 'upload' && extractedSyllabus ? 'Syllabus Review' : 'Subjects Selected'}
                    </h2>
                    <p className={`text-sm ${t.muted}`}>
                      {syllabusMethod === 'upload' && extractedSyllabus
                        ? 'Verify extracted structure'
                        : `You've selected ${selectedSubjects.length} subject(s). Proceed to books.`}
                    </p>
                  </div>
                </div>
                <ScrollArea className="flex-1 mt-6 pr-4">
                  {syllabusMethod === 'upload' && extractedSyllabus ? (
                    <div className="space-y-6">
                      {extractedSyllabus.chapters.map((chapter, idx) => (
                        <Card key={idx} className={`${t.card} ${t.border}`}>
                          <CardContent className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`w-8 h-8 rounded-full ${t.accentLight} flex items-center justify-center`}>
                                <span className={`text-sm font-bold ${t.accent}`}>{idx + 1}</span>
                              </div>
                              <h3 className={`font-bold ${t.text}`}>{chapter.subject}</h3>
                            </div>
                            <div className="space-y-2">
                              {chapter.topics.map((topic, tIdx) => (
                                <div key={tIdx} className={`flex items-center gap-2 text-sm ${t.muted}`}>
                                  <ChevronRight className="w-4 h-4" />
                                  {topic}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-2xl ${t.accentLight} border ${t.border}`}>
                        <h4 className={`font-bold ${t.text} mb-3`}>Selected Subjects</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedSubjects.map(subId => {
                            const sub = SUBJECTS.find(s => s.id === subId);
                            return sub ? (
                              <Badge key={subId} className={`${t.accentLight} ${t.accent} border-0`}>
                                {sub.label}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <p className={`text-sm ${t.muted} text-center py-4`}>
                        ✓ Subjects confirmed. Next: Choose reference books.
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </motion.div>
            )}

            {/* ===== STEP 6: Book Selection - ✅ ENHANCED WITH SUBJECT SEGMENTATION ===== */}
            {step === 6 && (
              <motion.div key="step6" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-3 rounded-2xl ${t.accentLight}`}>
                    <Library className={`w-7 h-7 ${t.accent}`} />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-black ${t.text}`}>Reference Books</h2>
                    <p className={`text-sm ${t.muted}`}>Choose your learning resources</p>
                  </div>
                </div>

                {/* Method Selection */}
                <div className="grid grid-cols-2 gap-4 mt-6 mb-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setBookMethod('system'); setSelectedBooks([]); }}
                    className={`p-5 rounded-2xl border-2 transition-all relative
                      ${bookMethod === 'system'
                        ? `border-indigo-500 ${t.accentLight} shadow-lg`
                        : `${t.border} ${t.card} hover:border-slate-300`
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Bot className={`w-7 h-7 ${bookMethod === 'system' ? t.accent : t.muted}`} />
                      <h3 className={`font-bold text-lg ${bookMethod === 'system' ? t.text : t.muted}`}>AI Recommended</h3>
                    </div>
                    <p className={`text-sm ${t.muted} text-left`}>AI recommends books based on your profile, subjects & syllabus</p>
                    {bookMethod === 'system' && <CheckCircle2 className={`absolute top-3 right-3 w-6 h-6 ${t.accent}`} />}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setBookMethod('manual'); setSelectedBooks([]); }}
                    className={`p-5 rounded-2xl border-2 transition-all relative
                      ${bookMethod === 'manual'
                        ? `border-teal-500 ${t.accentLight} shadow-lg`
                        : `${t.border} ${t.card} hover:border-slate-300`
                      }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Search className={`w-7 h-7 ${bookMethod === 'manual' ? 'text-teal-600' : t.muted}`} />
                      <h3 className={`font-bold text-lg ${bookMethod === 'manual' ? 'text-teal-800' : t.muted}`}>Manual Search</h3>
                    </div>
                    <p className={`text-sm ${t.muted} text-left`}>Search and select books yourself with filters</p>
                    {bookMethod === 'manual' && <CheckCircle2 className={`absolute top-3 right-3 w-6 h-6 text-teal-600`} />}
                  </motion.button>
                </div>

                <ScrollArea className="flex-1 pr-4">
                  {bookMethod === 'system' ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between mb-4">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.accent} flex items-center gap-2`}>
                          <Sparkles className="w-4 h-4" />
                          AI Recommended for {currentPath?.label} {classLevel}
                        </Label>
                        {isSearching && (
                          <div className={`flex items-center gap-2 text-sm ${t.muted}`}>
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                          </div>
                        )}
                      </div>

                      {isSearching ? (
                        <div className={`text-center py-12 ${t.muted}`}>
                          <Loader2 className={`w-12 h-12 ${t.accent} animate-spin mx-auto mb-4`} />
                          <p>Finding the best books for your curriculum...</p>
                        </div>
                      ) : recommendedBySubject.length === 0 ? (
                        <div className={`text-center py-12 ${t.muted}`}>
                          <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="mb-4">No specific recommendations found.</p>
                          <Button variant="outline" size="sm" onClick={() => setBookMethod('manual')} className={t.border}>
                            Try Manual Search
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {recommendedBySubject.map((group) => (
                            <div key={group.subject}>
                              <h3 className={`text-sm font-black uppercase tracking-widest ${t.accent} mb-3 flex items-center gap-2`}>
                                <BookOpen className="w-4 h-4" /> {group.subject}
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {group.books.map((book) => (
                                  <BookCard
                                    key={book.id}
                                    book={book}
                                    isSelected={selectedBooks.some((b) => b.id === book.id)}
                                    onToggle={() => toggleBookSelection(book)}
                                    showChapters
                                    theme={t}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Filter Pills: Subject */}
                      {selectedSubjects.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {selectedSubjects.map(subId => {
      const sub = SUBJECTS.find(s => s.id === subId);
      return sub ? (
        <button
          key={subId}
          onClick={() => toggleFilterSubject(subId)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            filterSubjects.includes(subId)
              ? `bg-indigo-500 text-white border-indigo-500`
              : `${t.inputBg} ${t.inputBorder} ${t.muted} hover:${t.accentLight}`
          }`}
        >
          {sub.label}
        </button>
      ) : null;
    })}
  </div>
)}

                      {/* Filter Pills: Class & Board */}
                      {(classLevel || board) && (
                        <div className="space-y-2">
                          <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Grade & Board Filters</Label>
                          <div className="flex flex-wrap gap-2">
                            {classLevel && (
                              <button
                                onClick={() => setFilterClassEnabled(!filterClassEnabled)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                  filterClassEnabled
                                    ? `bg-teal-500 text-white border-teal-500`
                                    : `${t.inputBg} ${t.inputBorder} ${t.muted} hover:${t.accentLight}`
                                }`}
                              >
                                Grade {classLevel} {filterClassEnabled && <X className="w-3 h-3 ml-1 inline" />}
                              </button>
                            )}
                            {board && (
                              <button
                                onClick={() => setFilterBoardEnabled(!filterBoardEnabled)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                  filterBoardEnabled
                                    ? `bg-teal-500 text-white border-teal-500`
                                    : `${t.inputBg} ${t.inputBorder} ${t.muted} hover:${t.accentLight}`
                                }`}
                              >
                                {board} {filterBoardEnabled && <X className="w-3 h-3 ml-1 inline" />}
                              </button>
                            )}
                            {(filterClassEnabled || filterBoardEnabled) && (
                              <button
                                onClick={() => { setFilterClassEnabled(false); setFilterBoardEnabled(false); }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${t.inputBg} ${t.inputBorder} ${t.muted} hover:bg-slate-200`}
                              >
                                Clear All
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Search Input */}
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Search Books</Label>
                        <div className="relative">
                          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${t.muted}`} />
                          <Input
                            placeholder="Search by title, author, or topic..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`h-12 pl-12 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-teal-500 rounded-xl`}
                          />
                          {isSearching && <Loader2 className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-500 animate-spin`} />}
                        </div>
                      </div>

                      {/* Results */}
                      {searchQuery.length >= 2 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {isSearching ? (
                            <div className="col-span-2 text-center py-8">
                              <Loader2 className={`w-8 h-8 ${t.accent} animate-spin mx-auto`} />
                            </div>
                          ) : filteredManualBooks.length === 0 ? (
                            <div className={`col-span-2 text-center py-8 ${t.muted} text-sm`}>
                              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              {searchResults.length > 0
                                ? 'No books match the selected subject filters.'
                                : 'No books found. Try different keywords.'}
                            </div>
                          ) : (
                            filteredManualBooks.map(book => (
                              <BookCard
                                key={`search-${book.id}`}
                                book={book}
                                isSelected={selectedBooks.some(b => b.id === book.id)}
                                onToggle={() => toggleBookSelection(book)}
                                theme={t}
                              />
                            ))
                          )}
                        </div>
                      )}

                      {/* Selected Books */}
                      {selectedBooks.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-200">
                          <Label className={`text-xs uppercase tracking-wider font-bold ${t.accent} mb-3 flex items-center gap-2`}>
                            <CheckCircle2 className="w-4 h-4" />
                            Selected ({selectedBooks.length}/5)
                          </Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedBooks.map(book => (
                              <BookCard
                                key={`selected-${book.id}`}
                                book={book}
                                isSelected={true}
                                onToggle={() => toggleBookSelection(book)}
                                theme={t}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Error Display */}
                {error && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Data Invalidation Warning Modal */}
          <AnimatePresence>
            {showDataInvalidationWarning && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDataInvalidationWarning(false)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={`${t.card} ${t.border} border rounded-3xl p-8 max-w-md w-full shadow-2xl`} onClick={e => e.stopPropagation()}>
                  <div className="text-center mb-6">
                    <AlertTriangle className={`w-16 h-16 ${t.accent} mx-auto mb-4`} />
                    <h3 className={`text-2xl font-bold ${t.text} mb-2`}>Curriculum Update Required</h3>
                    <p className={`${t.muted}`}>You've changed your class or board. Your existing curriculum may no longer be accurate. Would you like to regenerate it?</p>
                  </div>
                  <div className="flex gap-4">
                    <Button variant="outline" className={`flex-1 h-12 rounded-xl ${t.border} ${t.text} hover:${t.accentLight}`} onClick={() => { setShowDataInvalidationWarning(false); setStep(4); }}>Regenerate Curriculum</Button>
                    <Button className={`flex-1 h-12 rounded-xl bg-gradient-to-r ${t.gradient} text-white`} onClick={() => setShowDataInvalidationWarning(false)}>Keep Existing</Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Navigation */}
          <div className={`mt-auto pt-6 border-t ${t.border} flex justify-between items-center p-8 ${t.isLight ? 'bg-gradient-to-t from-slate-50/80' : 'bg-gradient-to-t from-slate-900/50'} to-transparent`}>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleBack} disabled={step === 1 || loading || analyzingSyllabus} className={`${t.muted} hover:${t.text} hover:${t.accentLight} rounded-xl px-5 font-bold ${step === 1 ? 'invisible' : ''}`}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button variant="outline" onClick={handleSaveAndExit} disabled={loading || analyzingSyllabus} className={`rounded-xl px-5 font-bold ${t.border} ${t.text} hover:${t.accentLight}`}>
                <Save className="w-4 h-4 mr-1" /> Return
              </Button>
            </div>
            {step < 6 ? (
              <Button onClick={handleNext} disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid) || (step === 4 && !isStep4Valid) || analyzingSyllabus} className={`${t.accentBg} text-white rounded-xl px-8 shadow-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:scale-105 transition-all`}>
                {analyzingSyllabus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <>Proceed <ChevronRight className="w-4 h-4 ml-1" /></>}
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={loading || !isStep6Valid} className={`bg-gradient-to-r ${t.gradient} text-white rounded-xl px-10 shadow-lg font-bold text-base h-12`}>
                {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Initializing...</> : <><Rocket className="w-5 h-5 mr-2" /> {isEditMode ? 'Save Changes' : 'Compile & Launch'}</>}
              </Button>
            )}
          </div>
        </Card>

        {/* Progress Info */}
        <div className="mt-4 text-center">
          <p className={`text-xs ${t.muted}`}>Your progress is saved automatically • Step {step} of 6</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE COMPONENT WITH SUSPENSE
// ============================================================================
export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Loader2 className="w-10 h-10 text-indigo-600 opacity-80" />
        </motion.div>
        <p className="mt-4 text-sm text-slate-500 font-medium tracking-wide">Initializing Setup...</p>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}