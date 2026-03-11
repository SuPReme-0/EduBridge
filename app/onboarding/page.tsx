// app/onboarding/page.tsx
'use client';
import { THEME_CONFIG, type ThemeConfig } from '@/lib/themes';
import { useState, useEffect, useCallback, Suspense, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
  AlertTriangle, Save, Edit3, Home, Layers, Focus,
  Languages, Laugh, Frown, Meh, SmilePlus,
} from 'lucide-react';

// ============================================================================
// CONSTANTS – Expanded interests and hobbies (2x more)
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
  // Original
  { id: 'math', label: 'Math', icon: Calculator, category: 'academic', color: 'text-blue-500' },
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
  // Additional
  { id: 'philosophy', label: 'Philosophy', icon: Brain, category: 'academic', color: 'text-purple-700' },
  { id: 'sociology', label: 'Sociology', icon: Users, category: 'academic', color: 'text-orange-600' },
  { id: 'political-science', label: 'Political Science', icon: Landmark, category: 'academic', color: 'text-amber-700' },
  { id: 'anthropology', label: 'Anthropology', icon: Compass, category: 'academic', color: 'text-emerald-700' },
  { id: 'linguistics', label: 'Linguistics', icon: Languages, category: 'academic', color: 'text-sky-700' },
  { id: 'art-history', label: 'Art History', icon: Palette, category: 'academic', color: 'text-pink-700' },
  { id: 'music-theory', label: 'Music Theory', icon: Music, category: 'academic', color: 'text-red-600' },
  { id: 'theatre', label: 'Theatre', icon: Film, category: 'academic', color: 'text-yellow-600' },
  { id: 'film-studies', label: 'Film Studies', icon: Film, category: 'academic', color: 'text-indigo-600' },
  { id: 'communications', label: 'Communications', icon: MessageCircle, category: 'academic', color: 'text-blue-600' },
  { id: 'journalism', label: 'Journalism', icon: PenTool, category: 'academic', color: 'text-amber-600' },
  { id: 'law', label: 'Law', icon: Gavel, category: 'academic', color: 'text-slate-700' },
  { id: 'criminology', label: 'Criminology', icon: Eye, category: 'academic', color: 'text-gray-700' },
  { id: 'public-health', label: 'Public Health', icon: Heart, category: 'academic', color: 'text-rose-600' },
  { id: 'nutrition', label: 'Nutrition', icon: Utensils, category: 'academic', color: 'text-orange-600' },
];

const HOBBIES = [
  // Original
  { id: 'drawing', label: 'Drawing', icon: Paintbrush, category: 'creative', color: 'text-pink-500' },
  { id: 'painting', label: 'Painting', icon: Palette, category: 'creative', color: 'text-purple-500' },
  { id: 'photography', label: 'Photography', icon: Camera, category: 'creative', color: 'text-blue-500' },
  { id: 'music', label: 'Music', icon: Music, category: 'creative', color: 'text-red-500' },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2, category: 'gaming', color: 'text-purple-500' },
  { id: 'reading', label: 'Reading', icon: BookOpen, category: 'lifestyle', color: 'text-amber-600' },
  { id: 'cooking', label: 'Cooking', icon: Utensils, category: 'lifestyle', color: 'text-orange-600' },
  { id: 'travel', label: 'Travel', icon: Plane, category: 'lifestyle', color: 'text-sky-600' },
  { id: 'sports', label: 'Sports', icon: Trophy, category: 'sports', color: 'text-green-600' },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell, category: 'sports', color: 'text-red-600' },
  { id: 'yoga', label: 'Yoga', icon: Leaf, category: 'sports', color: 'text-emerald-600' },
  { id: 'cycling', label: 'Cycling', icon: Bike, category: 'sports', color: 'text-slate-600' },
  { id: 'hiking', label: 'Hiking', icon: Mountain, category: 'outdoor', color: 'text-green-700' },
  { id: 'camping', label: 'Camping', icon: Tent, category: 'outdoor', color: 'text-emerald-700' },
  { id: 'fishing', label: 'Fishing', icon: Anchor, category: 'outdoor', color: 'text-cyan-700' },
  { id: 'gardening', label: 'Gardening', icon: TreePine, category: 'outdoor', color: 'text-green-600' },
  // Additional
  { id: 'chess', label: 'Chess', icon: Brain, category: 'games', color: 'text-gray-700' },
  { id: 'writing', label: 'Writing', icon: PenTool, category: 'creative', color: 'text-amber-600' },
  { id: 'meditation', label: 'Meditation', icon: Focus, category: 'wellness', color: 'text-indigo-500' },
  { id: 'volunteering', label: 'Volunteering', icon: Heart, category: 'social', color: 'text-rose-600' },
  { id: 'dance', label: 'Dance', icon: Music, category: 'creative', color: 'text-pink-600' },
  { id: 'martial-arts', label: 'Martial Arts', icon: Zap, category: 'sports', color: 'text-amber-700' },
  { id: 'pottery', label: 'Pottery', icon: Circle, category: 'creative', color: 'text-orange-600' },
  { id: 'birdwatching', label: 'Birdwatching', icon: Bird, category: 'outdoor', color: 'text-blue-600' },
  { id: 'knitting', label: 'Knitting', icon: Circle, category: 'creative', color: 'text-purple-600' },
  { id: 'calligraphy', label: 'Calligraphy', icon: PenTool, category: 'creative', color: 'text-amber-700' },
  { id: 'origami', label: 'Origami', icon: Square, category: 'creative', color: 'text-green-600' },
  { id: 'sculpting', label: 'Sculpting', icon: Circle, category: 'creative', color: 'text-slate-600' },
  { id: 'woodworking', label: 'Woodworking', icon: Cog, category: 'crafts', color: 'text-amber-800' },
  { id: 'metalworking', label: 'Metalworking', icon: Cog, category: 'crafts', color: 'text-gray-600' },
  { id: 'leathercraft', label: 'Leathercraft', icon: Cog, category: 'crafts', color: 'text-amber-700' },
  { id: 'jewelry-making', label: 'Jewelry Making', icon: Star, category: 'crafts', color: 'text-yellow-600' },
  { id: 'baking', label: 'Baking', icon: Cake, category: 'lifestyle', color: 'text-pink-600' },
  { id: 'mixology', label: 'Mixology', icon: Coffee, category: 'lifestyle', color: 'text-amber-600' },
  { id: 'wine-tasting', label: 'Wine Tasting', icon: Coffee, category: 'lifestyle', color: 'text-purple-600' },
  { id: 'astrology', label: 'Astrology', icon: Stars, category: 'mystical', color: 'text-indigo-500' },
  { id: 'tarot', label: 'Tarot', icon: Circle, category: 'mystical', color: 'text-purple-600' },
  { id: 'magic', label: 'Magic Tricks', icon: Sparkles, category: 'performance', color: 'text-yellow-600' },
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
];

const TEMPOS = [
  { id: 'EASY', label: 'Relaxed', desc: 'Story-driven, gentle pace', icon: BookOpen, color: 'text-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50', effect: 'blur-sm' },
  { id: 'NORMAL', label: 'Balanced', desc: 'Standard curriculum pace', icon: BrainCircuit, color: 'text-indigo-500', border: 'border-indigo-200', bg: 'bg-indigo-50', effect: '' },
  { id: 'EXTREME', label: 'Accelerated', desc: 'High-density, fast challenges', icon: Zap, color: 'text-rose-500', border: 'border-rose-200', bg: 'bg-rose-50', effect: 'brightness-110 contrast-110' },
];

interface Book {
  id: string;
  title: string;
  author: string;
  subject: string;
  thumbnail?: string;
  chapters?: string[];
}

interface BookRecommendation {
  subject: string;
  books: Book[];
}

interface ExtractedSyllabus {
  subjects: string[];
  chapters: { subject: string; topics: string[] }[];
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================
const InterestChip = ({ item, isSelected, onToggle, theme }: {
  item: typeof INTERESTS[0] | typeof HOBBIES[0];
  isSelected: boolean;
  onToggle: () => void;
  theme: ThemeConfig;
}) => {
  const Icon = item.icon;
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={`flex-shrink-0 px-4 py-2.5 rounded-full border-2 transition-all duration-300 flex items-center gap-2
        ${isSelected
          ? `border-indigo-500 ${theme.accentLight} shadow-lg`
          : `${theme.border} ${theme.card} hover:border-slate-300`
        }`}
    >
      <Icon className={`w-4 h-4 ${isSelected ? theme.accent : item.color}`} />
      <span className={`text-xs font-bold ${isSelected ? theme.text : theme.muted}`}>
        {item.label}
      </span>
      {isSelected && <CheckCircle2 className={`w-3 h-3 ${theme.accent}`} />}
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
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onToggle}
      className={`p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2
        ${isSelected
          ? `border-indigo-500 ${theme.accentLight} shadow-lg`
          : `${theme.border} ${theme.card} hover:border-slate-300`
        }`}
    >
      <div className={`p-3 rounded-xl ${isSelected ? theme.accentLight : theme.inputBg}`}>
        <Icon className={`w-6 h-6 ${subject.color}`} />
      </div>
      <span className={`text-xs font-bold text-center ${isSelected ? theme.text : theme.muted}`}>
        {subject.label}
      </span>
    </motion.button>
  );
};

const BookCard = ({ book, isSelected, onToggle, theme, disabled }: {
  book: Book;
  isSelected: boolean;
  onToggle: () => void;
  theme: ThemeConfig;
  disabled?: boolean;
}) => {
  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.02 } : {}}
      onClick={!disabled ? onToggle : undefined}
      className={`p-4 rounded-2xl border-2 transition-all flex gap-3
        ${isSelected
          ? `border-indigo-500 ${theme.accentLight} shadow-lg`
          : `${theme.border} ${theme.card} hover:border-slate-300`
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`w-14 h-18 rounded-lg overflow-hidden shrink-0 border flex items-center justify-center
        ${isSelected ? theme.borderAccent : theme.border}`}>
        {book.thumbnail ? (
          <img src={book.thumbnail} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <BookOpen className={`w-5 h-5 ${isSelected ? theme.accent : theme.muted}`} />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <h4 className={`font-bold text-sm leading-tight mb-1 line-clamp-2 ${isSelected ? theme.text : theme.muted}`}>
          {book.title}
        </h4>
        <p className={`text-[10px] ${theme.muted} mb-1 truncate`}>{book.author}</p>
        <Badge variant="secondary" className="text-[9px] h-4">{book.subject}</Badge>
      </div>
      {isSelected && <CheckCircle2 className={`w-4 h-4 ${theme.accent} shrink-0`} />}
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
  const [fullName, setFullName] = useState('');

  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(() => {
    if (typeof window !== 'undefined') {
      const savedVibe = localStorage.getItem('edubridge_theme');
      if (savedVibe && THEME_CONFIG[savedVibe]) return THEME_CONFIG[savedVibe];
    }
    return THEME_CONFIG['minimalist'];
  });

  const [originalStep1Data, setOriginalStep1Data] = useState({
    educationPath: '',
    classLevel: '',
    board: '',
  });

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

  // Syllabus State
  const [syllabusMethod, setSyllabusMethod] = useState<'upload' | 'select'>('upload');
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [syllabusText, setSyllabusText] = useState('');
  const [extractedSyllabus, setExtractedSyllabus] = useState<ExtractedSyllabus | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Book Selection State
  const [bookMethod, setBookMethod] = useState<'system' | 'manual'>('system');
  const [recommendedBooks, setRecommendedBooks] = useState<BookRecommendation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<Book[]>([]);

  // Manual search filters
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout>(null);
  const currentPath = EDUCATION_PATHS.find(p => p.id === educationPath);

  // ============================================================================
  // Reset board/classLevel when educationPath changes
  // ============================================================================
  useEffect(() => {
    const path = EDUCATION_PATHS.find(p => p.id === educationPath);
    if (path) {
      // Reset board to empty or first board? We'll set to empty string so user must select.
      setBoard('');
      // Reset classLevel to the first level's id
      if (path.levels.length > 0) {
        setClassLevel(path.levels[0].id);
      }
    }
  }, [educationPath]);

  // ============================================================================
  // LOAD PROFILE DATA
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
          setFullName(p.fullName || '');
          if (p.currentVibe && THEME_CONFIG[p.currentVibe as keyof typeof THEME_CONFIG]) {
            setActiveTheme(THEME_CONFIG[p.currentVibe as keyof typeof THEME_CONFIG]);
            localStorage.setItem('edubridge_theme', p.currentVibe);
          }
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
            setOriginalStep1Data({
              educationPath: p.educationPath || 'school',
              classLevel: p.classLevel?.toString() || '10',
              board: p.board || '',
            });
          }
        }
      } catch (e) {
        console.error('Failed to load profile data:', e);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };
    loadProfileData();
    return () => { isMounted = false; };
  }, []);

  // ============================================================================
  // DETECT STEP 1 CHANGES
  // ============================================================================
  useEffect(() => {
    if (!loadingProfile && step > 3) {
      const hasChanged = (
        educationPath !== originalStep1Data.educationPath ||
        classLevel !== originalStep1Data.classLevel ||
        board !== originalStep1Data.board
      );
      if (hasChanged) {
        setExtractedSyllabus(null);
        setSelectedSubjects([]);
        setSelectedBooks([]);
        setSyllabusText('');
        setSyllabusFile(null);
        setStep(4);
        setError('Your education details changed. Please update your syllabus and subjects.');
      }
    }
  }, [educationPath, classLevel, board, originalStep1Data, loadingProfile, step]);

  // ============================================================================
  // DEBOUNCED AUTO-SAVE
  // ============================================================================
  const saveProgress = useCallback(async () => {
    if (loadingProfile) return;
    try {
      await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: age ? parseInt(age) : undefined,
          gender,
          school,
          educationPath,
          classLevel: parseInt(classLevel) || 10,
          board,
          interests: selectedInterests,
          hobbies: selectedHobbies,
          learningTempo: tempo,
        }),
      });
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  }, [age, gender, school, educationPath, classLevel, board, selectedInterests, selectedHobbies, tempo, activeTheme, loadingProfile]);

  useEffect(() => {
    if (!loadingProfile) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(saveProgress, 800);
    }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [saveProgress, loadingProfile]);

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

  const getMaxBooksPerSubject = useCallback((subject: string) => {
    if (!extractedSyllabus) return 5;
    const chapterCount = extractedSyllabus.chapters.filter(ch => ch.subject === subject).length;
    if (chapterCount === 0) return 3;
    return Math.min(8, Math.max(2, Math.ceil(chapterCount / 3)));
  }, [extractedSyllabus]);

  const toggleBookSelection = (book: Book) => {
    setError('');
    setSelectedBooks(prev => {
      const exists = prev.find(b => b.id === book.id);
      if (exists) return prev.filter(b => b.id !== book.id);

      const subject = book.subject || 'General Reference';
      const currentCount = prev.filter(b => (b.subject || 'General Reference') === subject).length;
      const maxAllowed = getMaxBooksPerSubject(subject);

      if (currentCount >= maxAllowed) {
        setError(`You can only select up to ${maxAllowed} book(s) for "${subject}".`);
        return prev;
      }

      if (prev.length >= 15) {
        setError('You can select at most 15 books in total.');
        return prev;
      }

      return [...prev, book];
    });
  };

  const handleNext = async () => {
    await saveProgress();
    setDirection(1);
    if (step === 4) {
      if (syllabusMethod === 'upload' && (syllabusFile || syllabusText)) {
        setAnalyzingSyllabus(true);
        setError('');
        try {
          let response;
          let data;
          if (syllabusFile) {
            const formData = new FormData();
            formData.append('syllabus', syllabusFile);
            formData.append('classLevel', classLevel);
            formData.append('educationPath', educationPath);
            response = await fetch('/api/curriculum/parse-syllabus', { method: 'POST', body: formData });
          } else {
            response = await fetch('/api/curriculum/parse-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ syllabusText, classLevel, educationPath }),
            });
          }
          data = await response.json();
          console.log('📦 API response:', data);
          if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
          if (!data.success) throw new Error(data.error || 'API returned unsuccessful');
          const extractedData = data.extracted || data.data?.extracted || data.result;
          if (!extractedData) throw new Error('Invalid API response: missing syllabus data');
          setExtractedSyllabus(extractedData);
          setSelectedSubjects(extractedData.subjects || []);
          setAnalyzingSyllabus(false);
          requestAnimationFrame(() => requestAnimationFrame(() => setStep(5)));
        } catch (err: any) {
          console.error('❌ Syllabus parsing failed:', err);
          setError(err.message || 'Failed to parse syllabus. Please try manual selection.');
          setAnalyzingSyllabus(false);
        }
      } else if (syllabusMethod === 'select' && selectedSubjects.length > 0) {
        setStep(6);
      } else {
        setError('Please select at least one subject or upload a syllabus.');
      }
    } else {
      if (step === 1) {
        setOriginalStep1Data({ educationPath, classLevel, board });
      }
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
    setError('');
  };

  // ============================================================================
  // BOOK RECOMMENDATIONS
  // ============================================================================
  const fetchSystemRecommendedBooks = useCallback(async () => {
    if (!selectedSubjects.length && !extractedSyllabus) return;
    setIsSearching(true);
    try {
      const res = await fetch('/api/books/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          educationPath,
          classLevel,
          board,
          school,
          subjects: selectedSubjects,
          chapters: extractedSyllabus?.chapters?.map(c => c.topics).flat() || [],
        }),
      });
      const data = await res.json();
      if (data.recommendations) {
        const recommendations = data.recommendations.map((rec: any) => ({
          subject: rec.subject,
          books: rec.books.map((book: any, idx: number) => ({
            ...book,
            id: book.id || `ai-${rec.subject}-${idx}-${Date.now()}-${Math.random()}`,
            subject: book.subject || rec.subject || 'General Reference',
          })),
        }));
        setRecommendedBooks(recommendations);
      } else {
        setRecommendedBooks([]);
      }
    } catch (err) {
      console.error('System book recommendation failed:', err);
      setError('Failed to load book recommendations. You can search manually.');
    } finally {
      setIsSearching(false);
    }
  }, [educationPath, classLevel, board, school, selectedSubjects, extractedSyllabus]);

  // Level display for filters
const levelDisplay = useMemo(() => {
  if (educationPath === 'school') {
    const grade = parseInt(classLevel, 10);
    return `Grade ${isNaN(grade) ? classLevel : grade}`;
  }
  // For higher education, show just the path name
  if (educationPath === 'diploma') return 'Diploma';
  if (educationPath === 'bachelor') return 'Bachelor';
  if (educationPath === 'master') return 'Master';
  return classLevel;
}, [educationPath, classLevel]);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev =>
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Helper to infer subject from book data (improved)
  const inferSubject = useCallback((item: any, query: string): string => {
    // Try categories (Google Books)
    if (item.volumeInfo?.categories?.[0]) {
      const cat = item.volumeInfo.categories[0];
      // Map to one of our SUBJECTS labels if possible
      for (const sub of SUBJECTS) {
        if (cat.toLowerCase().includes(sub.label.toLowerCase())) {
          return sub.label;
        }
      }
      return cat; // fallback to original category
    }
    // Try Open Library subject
    if (item.subject?.[0]) {
      const subj = item.subject[0];
      for (const sub of SUBJECTS) {
        if (subj.toLowerCase().includes(sub.label.toLowerCase())) {
          return sub.label;
        }
      }
      return subj;
    }
    // Try title
    const title = item.volumeInfo?.title || item.title || '';
    const lowerTitle = title.toLowerCase();
    for (const sub of SUBJECTS) {
      if (lowerTitle.includes(sub.label.toLowerCase())) {
        return sub.label;
      }
    }
    // If query is a single word, use that as subject
    if (query.trim().split(' ').length === 1) {
      return query.trim().charAt(0).toUpperCase() + query.trim().slice(1).toLowerCase();
    }
    return 'General Reference';
  }, []);

  const fetchOpenLibraryBooks = useCallback(async (query: string) => {
    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open Library error: ${res.status}`);
      const data = await res.json();
      if (data.docs && Array.isArray(data.docs)) {
        return data.docs.map((doc: any) => ({
          id: doc.key.replace('/works/', 'OL-') || `ol-${Date.now()}-${Math.random()}`,
          title: doc.title,
          author: doc.author_name?.[0] || 'Unknown Author',
          subject: inferSubject(doc, query),
          thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
          chapters: [],
        }));
      }
      return [];
    } catch (e) {
      console.error('Open Library search failed:', e);
      throw e;
    }
  }, [inferSubject]);

  const fetchManualBooks = useCallback(async () => {
    if (searchQuery.length < 2 && activeFilters.length === 0) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setError('');

    try {
      // Build query: search term + optionally add subject term
      let queryParts = [];
      if (searchQuery.trim()) {
        let term = searchQuery.trim();
        // If term matches a subject, add "textbook" to improve relevance
        const matchedSubject = SUBJECTS.find(s =>
          s.label.toLowerCase().includes(term.toLowerCase()) ||
          term.toLowerCase().includes(s.label.toLowerCase())
        );
        if (matchedSubject) {
          queryParts.push(`${matchedSubject.label} textbook`);
        } else {
          queryParts.push(term);
        }
      }
      if (activeFilters.includes('board') && board) queryParts.push(board);
      if (activeFilters.includes('school') && school) queryParts.push(school);
      if (activeFilters.includes('level') && levelDisplay) queryParts.push(levelDisplay);

      const query = queryParts.join(' ');
      if (!query) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      let books: Book[] = [];

      // Try Google Books
      try {
        const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=40`;
        const res = await fetch(googleUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.items) {
            books = data.items.map((item: any) => ({
              id: item.id,
              title: item.volumeInfo.title,
              author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown Author',
              subject: inferSubject(item, searchQuery),
              thumbnail: item.volumeInfo.imageLinks?.smallThumbnail || null,
              chapters: [],
            }));
          }
        }
      } catch (e) {
        console.log('Google Books error:', e);
      }

      // If no results, try Open Library
      if (books.length === 0) {
        try {
          const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=40`;
          const res = await fetch(olUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.docs) {
              books = data.docs.map((doc: any) => ({
                id: doc.key.replace('/works/', 'OL-') || `ol-${Date.now()}-${Math.random()}`,
                title: doc.title,
                author: doc.author_name?.[0] || 'Unknown Author',
                subject: inferSubject(doc, searchQuery),
                thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
                chapters: [],
              }));
            }
          }
        } catch (e) {
          console.log('Open Library error:', e);
        }
      }

      setSearchResults(books);
      if (books.length === 0) {
        setError('No books found. Try different keywords or adjust filters.');
      }
    } catch (e) {
      console.error('❌ Book search failed:', e);
      setError('Failed to search books. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, activeFilters, board, school, levelDisplay, inferSubject]);

  useEffect(() => {
    if (bookMethod === 'manual') {
      const timeoutId = setTimeout(fetchManualBooks, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, activeFilters, bookMethod, fetchManualBooks]);

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
      // Ensure extractedSyllabus is null if not available
      extractedSyllabus: extractedSyllabus ?? null,
      // Send empty array when no books selected, NOT ['AI_DEFAULT']
      referenceBooks: selectedBooks.length > 0
        ? selectedBooks.map(b => ({ title: b.title, author: b.author, id: b.id }))
        : [],
      interests: selectedInterests,
      hobbies: selectedHobbies,
    };
    const res = await fetch('/api/curriculum/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate curriculum');
    }
    updateProfile({
      interests: selectedInterests,
      hobbies: selectedHobbies,
      learningTempo: tempo,
    });
    localStorage.setItem('edubridge_theme', 'minimalist');
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

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 100 : -100, opacity: 0, scale: 0.95 }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ zIndex: 0, x: dir < 0 ? 100 : -100, opacity: 0, scale: 0.95 }),
  };

  const t = activeTheme;

  if (loadingProfile) {
    return (
      <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col items-center justify-center`}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Loader2 className={`w-12 h-12 ${t.accent}`} />
        </motion.div>
        <p className={`mt-4 text-sm ${t.muted} font-medium`}>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden transition-colors duration-300`}>
      <div className={`fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${t.gradient} opacity-10 pointer-events-none`} />
      <div className="w-full max-w-4xl relative z-10 flex flex-col min-h-[700px]">
        {/* Progress header */}
        <div className="mb-6 flex flex-col items-center">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 ${t.accent} font-bold tracking-widest uppercase text-xs mb-4`}>
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
                  ${i <= step ? `bg-gradient-to-r ${t.gradient} shadow-lg` : `${t.inputBg} ${t.inputBorder} border`}`}
              />
            ))}
          </div>
        </div>

        {/* Main Card */}
        <Card className={`${t.card} ${t.border} shadow-2xl flex flex-col flex-1 relative overflow-hidden rounded-3xl backdrop-blur-xl transition-colors duration-300`}>
          <AnimatePresence mode="wait" custom={direction}>
            {/* ===== STEP 1: Personal Info ===== */}
            {step === 1 && (
              <motion.div key="step1" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8">
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
                    {/* Full Name - Read Only */}
                    <div className="space-y-2">
                      <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted} flex items-center gap-2`}>
                        <UserCircle className="w-4 h-4" /> Full Name
                      </Label>
                      <Input value={fullName} disabled className={`h-12 ${t.inputBg} ${t.inputBorder} ${t.text} opacity-75 cursor-not-allowed rounded-xl`} />
                      <p className={`text-xs ${t.muted} mt-1`}>Your name cannot be changed here.</p>
                    </div>

                    {/* Age & Gender */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted} flex items-center gap-2`}>
                          Age {age && <span className="text-xs font-normal">(already set)</span>}
                        </Label>
                        <Input type="number" placeholder="16" value={age} onChange={(e) => setAge(e.target.value)}
                          disabled={!!age} className={`h-12 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl ${age ? 'opacity-75 cursor-not-allowed' : ''}`} />
                        {age && <p className={`text-xs ${t.muted} mt-1`}>Age already provided – contact support to change.</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted} flex items-center gap-2`}>
                          Gender {gender && <span className="text-xs font-normal">(already set)</span>}
                        </Label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={!!gender}
                          className={`w-full h-12 px-4 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl outline-none appearance-none cursor-pointer ${gender ? 'opacity-75 cursor-not-allowed' : ''}`}>
                          <option value="" disabled>Select...</option>
                          {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        {gender && <p className={`text-xs ${t.muted} mt-1`}>Gender already provided – contact support to change.</p>}
                      </div>
                    </div>

                    {/* School Name */}
                    <div className="space-y-2">
                      <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted} flex items-center gap-2`}>
                        <School className="w-4 h-4" /> Institution Name
                      </Label>
                      <Input placeholder="e.g. Delhi Public School" value={school} onChange={(e) => setSchool(e.target.value)}
                        className={`h-12 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl`} />
                    </div>

                    {/* Education Path */}
                    <div className="space-y-2">
                      <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Education Path</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {EDUCATION_PATHS.map(path => (
                          <button key={path.id} onClick={() => setEducationPath(path.id as any)}
                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1
                              ${educationPath === path.id ? `border-indigo-500 ${t.accentLight}` : `${t.border} ${t.card}`}`}>
                            <path.icon className={`w-5 h-5 ${educationPath === path.id ? t.accent : t.muted}`} />
                            <span className={`text-[10px] font-bold ${educationPath === path.id ? t.accent : t.muted}`}>{path.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Class Level & Board */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Class/Grade</Label>
                        <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)}
                          className={`w-full h-12 px-4 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl outline-none`}>
                          {currentPath?.levels.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Board/University</Label>
                        <select value={board} onChange={(e) => setBoard(e.target.value)}
                          className={`w-full h-12 px-4 ${t.inputBg} ${t.inputBorder} ${t.text} focus:border-indigo-500 rounded-xl outline-none`}>
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
              <motion.div key="step2" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-3 rounded-2xl ${t.accentLight}`}>
                    <Heart className={`w-7 h-7 ${t.accent}`} />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-black ${t.text}`}>Interests & Hobbies</h2>
                    <p className={`text-sm ${t.muted}`}>Select your interests and hobbies</p>
                  </div>
                </div>
                <ScrollArea className="flex-1 mt-6 pr-4">
                  <div className="space-y-8">
                    {/* Academic Interests */}
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-widest ${t.accent} mb-4 flex items-center gap-2`}>
                        <Brain className="w-4 h-4" /> Academic Interests
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {INTERESTS.map((item) => (
                          <InterestChip key={item.id} item={item} isSelected={selectedInterests.includes(item.id)}
                            onToggle={() => toggleInterest(item.id)} theme={t} />
                        ))}
                      </div>
                    </div>
                    {/* Hobbies */}
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-widest ${t.accent} mb-4 flex items-center gap-2`}>
                        <Sparkles className="w-4 h-4" /> Hobbies & Activities
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {HOBBIES.map((item) => (
                          <InterestChip key={item.id} item={item} isSelected={selectedHobbies.includes(item.id)}
                            onToggle={() => toggleHobby(item.id)} theme={t} />
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </motion.div>
            )}

            {/* ===== STEP 3: Learning Preferences ===== */}
            {step === 3 && (
              <motion.div key="step3" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-3 rounded-2xl ${t.accentLight}`}>
                    <BrainCircuit className={`w-7 h-7 ${t.accent}`} />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-black ${t.text}`}>Learning Preferences</h2>
                    <p className={`text-sm ${t.muted}`}>Choose your focus mode and pace</p>
                  </div>
                </div>
                <ScrollArea className="flex-1 mt-6 pr-4">
                  <div className="space-y-8">
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-widest ${t.accent} mb-4 flex items-center gap-2`}>
                        <Focus className="w-4 h-4" /> Focus Mode
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {TEMPOS.map(opt => {
                          const isSelected = tempo === opt.id;
                          return (
                            <motion.button key={opt.id} whileHover={{ scale: 1.03, y: -4 }} whileTap={{ scale: 0.98 }}
                              onClick={() => setTempo(opt.id as any)}
                              className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden backdrop-blur-sm bg-white/5 dark:bg-black/20
                                ${isSelected ? `border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/50 shadow-2xl` : `border-slate-200/30 dark:border-slate-700/30 hover:border-indigo-300/50`}`}>
                              <div className={`absolute inset-0 -z-10 bg-gradient-to-br opacity-30 transition-opacity duration-500 ${isSelected ? 'opacity-60' : 'opacity-0'}`} />
                              <div className="relative z-10 flex flex-col items-center text-center">
                                <div className={`relative mb-4 p-3 rounded-xl transition-all duration-300 ${isSelected ? 'scale-110' : ''}`}>
                                  <opt.icon className={`w-8 h-8 ${isSelected ? t.accent : t.muted} transition-colors duration-300`} />
                                  {isSelected && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                      className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                      <Sparkles className="w-3 h-3 text-white" />
                                    </motion.div>
                                  )}
                                </div>
                                <h4 className={`text-lg font-bold mb-1 ${isSelected ? t.text : t.muted}`}>{opt.label}</h4>
                                <p className={`text-xs ${t.muted} leading-relaxed`}>{opt.desc}</p>
                              </div>
                              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border-2 border-indigo-400/30 blur-sm" />
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </motion.div>
            )}

            {/* ===== STEP 4: Syllabus Input ===== */}
            {step === 4 && (
              <motion.div key="step4" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8 relative">
                <AnimatePresence>
                  {analyzingSyllabus && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={`absolute inset-0 z-20 ${t.card}/95 backdrop-blur-md flex flex-col items-center justify-center rounded-3xl`}>
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
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setSyllabusMethod('upload')}
                    className={`p-5 rounded-2xl border-2 transition-all ${syllabusMethod === 'upload' ? `border-indigo-500 ${t.accentLight} shadow-lg` : `${t.border} ${t.card}`}`}>
                    <Upload className={`w-6 h-6 mb-2 ${syllabusMethod === 'upload' ? t.accent : t.muted}`} />
                    <h3 className={`font-bold ${syllabusMethod === 'upload' ? t.accent : t.text}`}>Upload PDF/Text</h3>
                    <p className={`text-xs ${t.muted} mt-1`}>We'll parse it automatically</p>
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setSyllabusMethod('select')}
                    className={`p-5 rounded-2xl border-2 transition-all ${syllabusMethod === 'select' ? `border-indigo-500 ${t.accentLight} shadow-lg` : `${t.border} ${t.card}`}`}>
                    <CheckCircle2 className={`w-6 h-6 mb-2 ${syllabusMethod === 'select' ? t.accent : t.muted}`} />
                    <h3 className={`font-bold ${syllabusMethod === 'select' ? t.accent : t.text}`}>Manual Selection</h3>
                    <p className={`text-xs ${t.muted} mt-1`}>Pick subjects yourself</p>
                  </motion.button>
                </div>

                <ScrollArea className="flex-1 pr-4">
                  {syllabusMethod === 'upload' ? (
                    <div className="space-y-4">
                      <div className={`border-2 border-dashed ${t.border} rounded-2xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer`}
                        onClick={() => document.getElementById('file-upload')?.click()}>
                        <input id="file-upload" type="file" accept=".pdf,.txt,.jpg,.png" className="hidden"
                          onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)} />
                        <Upload className={`w-10 h-10 ${t.muted} mx-auto mb-3`} />
                        <p className={`font-bold ${t.text} mb-1`}>{syllabusFile ? syllabusFile.name : 'Click to upload or drag and drop'}</p>
                        <p className={`text-xs ${t.muted}`}>PDF, TXT, JPG, PNG (max 10MB)</p>
                      </div>
                      <div className="space-y-2">
                        <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Or paste syllabus text</Label>
                        <Textarea placeholder="Paste your syllabus content here..." value={syllabusText}
                          onChange={(e) => setSyllabusText(e.target.value)}
                          className={`min-h-[200px] ${t.inputBg} ${t.inputBorder} ${t.text} rounded-xl`} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className={`font-bold ${t.text} flex items-center gap-2`}>
                        <Layers className="w-5 h-5" /> Select your subjects:
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {SUBJECTS.map(sub => (
                          <SubjectCard key={sub.id} subject={sub} isSelected={selectedSubjects.includes(sub.id)}
                            onToggle={() => toggleSubject(sub.id)} theme={t} />
                        ))}
                      </div>
                    </div>
                  )}
                </ScrollArea>

                {error && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ===== STEP 5: Syllabus Review ===== */}
            {step === 5 && (
              <motion.div key="step5" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }} className="flex-1 flex flex-col p-8">
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
                    extractedSyllabus.chapters && extractedSyllabus.chapters.length > 0 ? (
                      (() => {
                        const grouped: Record<string, typeof extractedSyllabus.chapters> = {};
                        extractedSyllabus.chapters.forEach(ch => {
                          if (!grouped[ch.subject]) grouped[ch.subject] = [];
                          grouped[ch.subject].push(ch);
                        });
                        const subjectNames = Object.keys(grouped).sort();
                        const chapterLabel = educationPath === 'school' ? 'Chapter' : 'Module';
                        return subjectNames.map((subject, sIdx) => (
                          <Card key={subject} className={`${t.card} ${t.border} mb-6`}>
                            <CardContent className="p-5">
                              <div className="flex items-center gap-3 mb-4">
                                <div className={`w-8 h-8 rounded-full ${t.accentLight} flex items-center justify-center`}>
                                  <span className={`text-sm font-bold ${t.accent}`}>{sIdx + 1}</span>
                                </div>
                                <h3 className={`text-lg font-bold ${t.text}`}>{subject}</h3>
                              </div>
                              <div className="space-y-4 ml-4">
                                {grouped[subject].map((chapter, cIdx) => (
                                  <div key={cIdx} className="border-l-2 border-slate-200 pl-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <BookOpen className={`w-4 h-4 ${t.accent}`} />
                                      <h4 className={`font-medium text-sm ${t.text}`}>{chapterLabel} {cIdx + 1}</h4>
                                    </div>
                                    {chapter.topics && chapter.topics.length > 0 ? (
                                      <div className="space-y-1 ml-6">
                                        {chapter.topics.map((topic, tIdx) => (
                                          <div key={tIdx} className={`flex items-start gap-2 text-xs ${t.muted}`}>
                                            <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />
                                            <span>{topic}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className={`text-xs ${t.muted} ml-6 italic`}>No topics listed</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        ));
                      })()
                    ) : (
                      <div className={`text-center py-12 ${t.muted}`}>
                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No chapters extracted</p>
                        <p className="text-sm">The syllabus was parsed but no chapter details were found. You can proceed or try manual selection.</p>
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-2xl ${t.accentLight} border ${t.border}`}>
                        <h4 className={`font-bold ${t.text} mb-3 flex items-center gap-2`}>
                          <CheckCircle2 className="w-5 h-5" /> Selected Subjects
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedSubjects.map(subId => {
                            const sub = SUBJECTS.find(s => s.id === subId);
                            return sub ? (
                              <Badge key={subId} className={`${t.accentLight} ${t.accent} border-0`}>{sub.label}</Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <p className={`text-sm ${t.muted} text-center py-4`}>✓ Subjects confirmed. Next: Choose reference books.</p>
                    </div>
                  )}
                </ScrollArea>
              </motion.div>
            )}

            {/* ===== STEP 6: Book Selection ===== */}
            {step === 6 && (
              <motion.div
                key="step6"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex-1 flex flex-col p-8"
              >
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
                    className={`p-5 rounded-2xl border-2 transition-all relative ${bookMethod === 'system' ? `border-indigo-500 ${t.accentLight} shadow-lg` : `${t.border} ${t.card}`}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Bot className={`w-7 h-7 ${bookMethod === 'system' ? t.accent : t.muted}`} />
                      <h3 className={`font-bold text-lg ${bookMethod === 'system' ? t.text : t.muted}`}>AI Recommended</h3>
                    </div>
                    <p className={`text-sm ${t.muted} text-left`}>AI recommends books based on your profile</p>
                    {bookMethod === 'system' && <CheckCircle2 className={`absolute top-3 right-3 w-6 h-6 ${t.accent}`} />}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setBookMethod('manual'); setSelectedBooks([]); }}
                    className={`p-5 rounded-2xl border-2 transition-all relative ${bookMethod === 'manual' ? `border-teal-500 ${t.accentLight} shadow-lg` : `${t.border} ${t.card}`}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Search className={`w-7 h-7 ${bookMethod === 'manual' ? 'text-teal-600' : t.muted}`} />
                      <h3 className={`font-bold text-lg ${bookMethod === 'manual' ? 'text-teal-800' : t.muted}`}>Manual Search</h3>
                    </div>
                    <p className={`text-sm ${t.muted} text-left`}>Search and select books yourself</p>
                    {bookMethod === 'manual' && <CheckCircle2 className={`absolute top-3 right-3 w-6 h-6 text-teal-600`} />}
                  </motion.button>
                </div>

                <ScrollArea className="flex-1 pr-4">
                  {bookMethod === 'system' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <Label className={`text-xs uppercase tracking-widest font-bold ${t.accent} flex items-center gap-2`}>
                          <Sparkles className="w-4 h-4" /> AI Recommended
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
                      ) : recommendedBooks.length === 0 ? (
                        <div className={`text-center py-12 ${t.muted}`}>
                          <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="mb-4">No specific recommendations found.</p>
                          <Button variant="outline" size="sm" onClick={() => setBookMethod('manual')} className={t.border}>
                            Try Manual Search
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {recommendedBooks.map((rec, idx) => {
                            const subject = rec.subject;
                            const chapterCount = extractedSyllabus?.chapters.filter(ch => ch.subject === subject).length || 0;
                            const maxBooks = Math.min(8, Math.max(2, Math.ceil(chapterCount / 3)));
                            const selectedCount = selectedBooks.filter(b => b.subject === subject).length;

                            return (
                              <div key={`rec-${idx}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className={`text-lg font-bold ${t.text}`}>{subject}</h3>
                                  <Badge className={`${t.accentLight} ${t.accent}`}>
                                    {selectedCount}/{maxBooks} selected
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {rec.books.map((book) => {
                                    const isSelected = selectedBooks.some(b => b.id === book.id);
                                    const canSelect = !isSelected && selectedCount < maxBooks;
                                    return (
                                      <BookCard
                                        key={book.id}
                                        book={book}
                                        isSelected={isSelected}
                                        onToggle={() => toggleBookSelection(book)}
                                        theme={t}
                                        disabled={!canSelect && !isSelected}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected Books Section - always on top */}
                      {selectedBooks.length > 0 && (
                        <div className="mb-6 p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 dark:bg-indigo-950/20">
                          <Label className={`text-xs uppercase tracking-wider font-bold ${t.accent} mb-3 flex items-center gap-2`}>
                            <CheckCircle2 className="w-4 h-4" />
                            Selected Books ({selectedBooks.length})
                          </Label>
                          <div className="space-y-4">
                            {Array.from(new Set(selectedBooks.map(b => b.subject || 'General Reference'))).map(subject => {
                              const subjectBooks = selectedBooks.filter(b => (b.subject || 'General Reference') === subject);
                              const chapterCount = extractedSyllabus?.chapters.filter(ch => ch.subject === subject).length || 0;
                              const maxBooks = Math.min(8, Math.max(2, Math.ceil(chapterCount / 3)));
                              return (
                                <div key={subject}>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className={`font-bold text-sm ${t.text}`}>{subject}</h4>
                                    <Badge className={`${t.accentLight} ${t.accent}`}>
                                      {subjectBooks.length}/{maxBooks}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {subjectBooks.map(book => (
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
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Filter Chips (derived from step 1) */}
                      {/* Filter Chips (derived from step 1) */}
{(board || (educationPath !== 'school' ? levelDisplay : '')) && (
  <div className="flex flex-wrap gap-2 items-center">
    <Label className={`text-xs uppercase tracking-wider font-bold ${t.muted}`}>Filters:</Label>
    {board && (
      <button
        onClick={() => toggleFilter('board')}
        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
          activeFilters.includes('board')
            ? 'bg-indigo-500 text-white border-indigo-500'
            : `${t.inputBg} ${t.inputBorder} ${t.muted} hover:${t.accentLight}`
        }`}
      >
        {board}
      </button>
    )}
    {educationPath !== 'school' && (
      <button
        onClick={() => toggleFilter('level')}
        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
          activeFilters.includes('level')
            ? 'bg-indigo-500 text-white border-indigo-500'
            : `${t.inputBg} ${t.inputBorder} ${t.muted} hover:${t.accentLight}`
        }`}
      >
        {levelDisplay}
      </button>
    )}
    {/* Always show Clear All button when any filter exists */}
    <button
      onClick={clearAllFilters}
      className="px-3 py-1.5 rounded-full text-xs font-bold border bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
    >
      Clear All
    </button>
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
                          ) : searchResults.length === 0 ? (
                            <div className={`col-span-2 text-center py-8 ${t.muted} text-sm`}>
                              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              No books found. Try different keywords or adjust filters.
                            </div>
                          ) : (
                            searchResults.map(book => {
                              const subject = book.subject || 'General Reference';
                              const chapterCount = extractedSyllabus?.chapters.filter(ch => ch.subject === subject).length || 0;
                              const maxBooks = Math.min(8, Math.max(2, Math.ceil(chapterCount / 3)));
                              const selectedCount = selectedBooks.filter(b => b.subject === subject).length;
                              const isSelected = selectedBooks.some(b => b.id === book.id);
                              const canSelect = !isSelected && selectedCount < maxBooks;

                              return (
                                <BookCard
                                  key={`search-${book.id}`}
                                  book={book}
                                  isSelected={isSelected}
                                  onToggle={() => toggleBookSelection(book)}
                                  theme={t}
                                  disabled={!canSelect && !isSelected}
                                />
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Navigation */}
          <div className={`mt-auto pt-6 border-t ${t.border} flex justify-between items-center p-8 ${t.isLight ? 'bg-gradient-to-t from-slate-50/80' : 'bg-gradient-to-t from-slate-900/50'} to-transparent`}>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleBack} disabled={step === 1 || loading || analyzingSyllabus}
                className={`${t.muted} hover:${t.text} hover:${t.accentLight} rounded-xl px-5 font-bold ${step === 1 ? 'invisible' : ''}`}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button variant="outline" onClick={handleSaveAndExit} disabled={loading || analyzingSyllabus}
                className={`rounded-xl px-5 font-bold ${t.border} ${t.text} hover:${t.accentLight}`}>
                <Save className="w-4 h-4 mr-1" /> Return
              </Button>
            </div>
            {step < 6 ? (
              <Button onClick={handleNext}
                disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid) || (step === 4 && !isStep4Valid) || analyzingSyllabus}
                className={`${t.accentBg} text-white rounded-xl px-8 shadow-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:scale-105 transition-all`}>
                {analyzingSyllabus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <>Proceed <ChevronRight className="w-4 h-4 ml-1" /></>}
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={loading || !isStep6Valid}
                className={`bg-gradient-to-r ${t.gradient} text-white rounded-xl px-10 shadow-lg font-bold text-base h-12`}>
                {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Initializing...</> : <><Rocket className="w-5 h-5 mr-2" /> {isEditMode ? 'Save Changes' : 'Compile & Launch'}</>}
              </Button>
            )}
          </div>
        </Card>

        <div className="mt-4 text-center">
          <p className={`text-xs ${t.muted}`}>Your progress is saved automatically • Step {step} of 6</p>
        </div>
      </div>
    </div>
  );
}

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