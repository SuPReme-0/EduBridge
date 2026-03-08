'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, CheckCircle, XCircle, Loader2, Trophy, Cpu, Activity, Zap,
  Image as ImageIcon, Type, ListChecks, Clock, Lightbulb, SkipForward,
  ChevronLeft, ChevronRight, Star, Target, Brain, Sparkles, AlertCircle,
  RotateCcw, Share2, Bookmark, Heart, ThumbsUp, ThumbsDown, Maximize2,
  Award, Medal, Crown, Gem
} from 'lucide-react';

// ============================================================================
// TYPES (Matching API Schema)
// ============================================================================

type QuestionType = 'single_mcq' | 'multiple_mcq' | 'image_based' | 'true_false' | 'short_answer' | 'long_answer';

type QuizQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctAnswer: string | string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  imageUrl?: string;
  hint?: string;
  timeLimit?: number;
  keywords?: string[];
  rubric?: {
    points: number;
    criteria: string[];
  };
};

type QuestionState = {
  selectedOptions: string[];
  submitted: boolean;
  isCorrect: boolean | null;
  timeSpent: number;
  usedHint: boolean;
  textAnswer?: string;
};

// ============================================================================
// THEME CONFIG (MATCHING DASHBOARD EXACTLY)
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
  progressBar: string;
  buttonHover: string;
}> = {
  'minimalist': {
    bg: 'bg-[#F8FAFC]',
    card: 'bg-white/95 backdrop-blur-sm',
    border: 'border-slate-200',
    accent: 'text-indigo-600',
    accentBg: 'bg-indigo-600',
    gradient: 'from-indigo-600 to-blue-600',
    text: 'text-slate-800',
    muted: 'text-slate-500',
    isLight: true,
    progressBar: 'bg-indigo-500',
    buttonHover: 'hover:bg-indigo-700',
  },
  'library-sage': {
    bg: 'bg-[#FDFBF7]',
    card: 'bg-[#F5F2EA]/95 backdrop-blur-sm',
    border: 'border-[#E2D9C8]',
    accent: 'text-[#8B5E34]',
    accentBg: 'bg-[#8B5E34]',
    gradient: 'from-[#8B5E34] to-[#6B4423]',
    text: 'text-[#2D2420]',
    muted: 'text-[#8B7355]',
    isLight: true,
    progressBar: 'bg-[#8B5E34]',
    buttonHover: 'hover:bg-[#6B4423]',
  },
  'zen-garden': {
    bg: 'bg-[#F0FDF4]',
    card: 'bg-white/95 backdrop-blur-sm',
    border: 'border-emerald-200',
    accent: 'text-emerald-600',
    accentBg: 'bg-emerald-600',
    gradient: 'from-emerald-500 to-teal-600',
    text: 'text-slate-800',
    muted: 'text-slate-500',
    isLight: true,
    progressBar: 'bg-emerald-500',
    buttonHover: 'hover:bg-emerald-700',
  },
  'cyberpunk': {
    bg: 'bg-[#05050A]',
    card: 'bg-[#0A0A12]/90 backdrop-blur-sm',
    border: 'border-cyan-500/20',
    accent: 'text-cyan-400',
    accentBg: 'bg-cyan-500',
    gradient: 'from-cyan-500 to-blue-600',
    text: 'text-slate-100',
    muted: 'text-slate-400',
    isLight: false,
    progressBar: 'bg-cyan-400',
    buttonHover: 'hover:bg-cyan-600',
  },
  'space-odyssey': {
    bg: 'bg-[#020205]',
    card: 'bg-[#0B0B1A]/90 backdrop-blur-sm',
    border: 'border-violet-500/20',
    accent: 'text-violet-400',
    accentBg: 'bg-violet-500',
    gradient: 'from-violet-500 to-fuchsia-600',
    text: 'text-slate-100',
    muted: 'text-slate-400',
    isLight: false,
    progressBar: 'bg-violet-400',
    buttonHover: 'hover:bg-violet-600',
  },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  hard: 'bg-red-500/10 text-red-600 border-red-500/30',
};

const QUESTION_TYPE_ICONS: Record<QuestionType, any> = {
  single_mcq: Type,
  multiple_mcq: ListChecks,
  image_based: ImageIcon,
  true_false: CheckCircle,
  short_answer: Brain,
  long_answer: Brain,
};

// ============================================================================
// CONFETTI COMPONENT
// ============================================================================

const ConfettiEffect = ({ active, theme }: { active: boolean; theme: any }) => {
  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <motion.div
          key={i}
          initial={{
            y: -20,
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            rotate: 0,
            scale: 0,
          }}
          animate={{
            y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 100,
            rotate: Math.random() * 720,
            scale: Math.random() * 1 + 0.5,
          }}
          transition={{
            duration: Math.random() * 2 + 2,
            delay: Math.random() * 0.5,
            ease: 'linear',
          }}
          className={`absolute w-3 h-3 rounded-sm ${
            i % 3 === 0 ? theme.accentBg : i % 3 === 1 ? 'bg-yellow-400' : 'bg-emerald-400'
          }`}
        />
      ))}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ChapterAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, updateProfile } = useStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterSubject, setChapterSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [activeTheme, setActiveTheme] = useState(THEME_CONFIG['minimalist']);

  // Navigation State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({});

  // Timer State
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Score State
  const [totalScore, setTotalScore] = useState(0);
  const [maxPossibleScore, setMaxPossibleScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // UI State
  const [showHint, setShowHint] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  // ============================================================================
  // FETCH & GENERATE QUESTIONS
  // ============================================================================

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const loadAssessment = async () => {
      try {
        // Fetch chapter data
        const res = await fetch(`/api/chapter/${id}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        setChapterTitle(data.chapter.title);
        setChapterSubject(data.chapter.subject?.name || 'General');

        // Load theme from profile
        const dynamicVibe = data.profile?.currentVibe || 'minimalist';
        if (THEME_CONFIG[dynamicVibe]) {
          setActiveTheme(THEME_CONFIG[dynamicVibe]);
        }

        // Extract existing quiz blocks from chapter
        const extractedQuizzes = data.chapter.mixedContent
          ?.filter((block: any) => block.type === 'quiz' && block.quizData)
          .map((block: any) => ({
            ...block.quizData,
            type: block.quizData.type || 'single_mcq',
            difficulty: block.quizData.difficulty || 'medium',
            points: block.quizData.points || 10,
            timeLimit: block.quizData.timeLimit || 60,
          })) || [];

        if (extractedQuizzes.length >= 3) {
          setQuestions(extractedQuizzes);
          initializeQuestionStates(extractedQuizzes);
        } else {
          // Generate new questions via API
          setGeneratingQuestions(true);
          await generateQuestionsWithLLM(data.chapter);
        }
      } catch (e: any) {
        console.error('Failed to load assessment:', e);
        // Fallback questions
        const fallbackQuestions = createFallbackQuestions();
        setQuestions(fallbackQuestions);
        initializeQuestionStates(fallbackQuestions);
      } finally {
        setLoading(false);
        setGeneratingQuestions(false);
      }
    };

    loadAssessment();
  }, [user, id, router]);

  // ============================================================================
  // LLM QUESTION GENERATION
  // ============================================================================

  const generateQuestionsWithLLM = async (chapter: any) => {
    try {
      const res = await fetch('/api/assessment/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: id,
          chapterTitle: chapter.title,
          chapterContent: chapter.mixedContent,
          subject: chapter.subject?.name,
          difficulty: 'mixed',
          questionCount: 5,
          questionTypes: ['single_mcq', 'multiple_mcq', 'true_false', 'short_answer'],
        }),
      });

      const data = await res.json();

      if (data.questions && data.questions.length > 0) {
        const processedQuestions = data.questions.map((q: any, idx: number) => ({
          ...q,
          id: q.id || `gen-${idx}`,
          type: q.type || 'single_mcq',
          difficulty: q.difficulty || 'medium',
          points: q.points || 10,
          timeLimit: q.timeLimit || 60,
        }));
        setQuestions(processedQuestions);
        initializeQuestionStates(processedQuestions);
      } else {
        throw new Error('No questions generated');
      }
    } catch (e: any) {
      console.error('LLM generation failed, using fallback:', e);
      const fallbackQuestions = createFallbackQuestions();
      setQuestions(fallbackQuestions);
      initializeQuestionStates(fallbackQuestions);
    }
  };

  const createFallbackQuestions = (): QuizQuestion[] => [
    {
      id: 'fallback-1',
      type: 'single_mcq',
      prompt: 'What is the primary concept covered in this chapter?',
      options: ['Core Principle A', 'Supporting Theory B', 'Related Concept C', 'Advanced Application D'],
      correctAnswer: 'Core Principle A',
      explanation: 'The core principle forms the foundation of understanding in this topic.',
      difficulty: 'easy',
      points: 10,
      timeLimit: 60,
    },
    {
      id: 'fallback-2',
      type: 'multiple_mcq',
      prompt: 'Select ALL correct statements about this topic:',
      options: ['Statement 1 is accurate', 'Statement 2 needs verification', 'Statement 3 is correct', 'Statement 4 is misleading'],
      correctAnswer: ['Statement 1 is accurate', 'Statement 3 is correct'],
      explanation: 'Multiple concepts work together in this domain.',
      difficulty: 'medium',
      points: 20,
      timeLimit: 90,
    },
    {
      id: 'fallback-3',
      type: 'true_false',
      prompt: 'True or False: This principle applies universally across all scenarios.',
      options: ['True', 'False'],
      correctAnswer: 'False',
      explanation: 'Context matters when applying theoretical concepts.',
      difficulty: 'easy',
      points: 10,
      timeLimit: 30,
    },
    {
      id: 'fallback-4',
      type: 'short_answer',
      prompt: 'Explain the key takeaway from this chapter in your own words.',
      options: [],
      correctAnswer: '',
      explanation: 'Understanding and articulating concepts demonstrates mastery.',
      difficulty: 'medium',
      points: 15,
      timeLimit: 120,
      keywords: ['key', 'concept', 'understanding'],
    },
    {
      id: 'fallback-5',
      type: 'single_mcq',
      prompt: 'What would be the expected outcome if this variable increases?',
      options: ['Proportional increase', 'Inverse relationship', 'No change', 'Exponential growth'],
      correctAnswer: 'Proportional increase',
      explanation: 'Understanding relationships between variables is key.',
      difficulty: 'hard',
      points: 25,
      timeLimit: 120,
    },
  ];

  const initializeQuestionStates = (qs: QuizQuestion[]) => {
    const states: Record<string, QuestionState> = {};
    let maxScore = 0;
    qs.forEach((q) => {
      states[q.id] = {
        selectedOptions: [],
        submitted: false,
        isCorrect: null,
        timeSpent: 0,
        usedHint: false,
        textAnswer: '',
      };
      maxScore += q.points;
    });
    setQuestionStates(states);
    setMaxPossibleScore(maxScore);
  };

  // ============================================================================
  // TIMER LOGIC
  // ============================================================================

  useEffect(() => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ || quizFinished || questionStates[currentQ.id]?.submitted) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeRemaining(null);
      return;
    }

    setTimeRemaining(currentQ.timeLimit || 60);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentQuestionIndex, questions, quizFinished]);

  // ============================================================================
  // ANSWER HANDLING
  // ============================================================================

  const handleOptionSelect = useCallback(
    (option: string, isMultipleSelect: boolean) => {
      if (questionStates[questions[currentQuestionIndex]?.id]?.submitted) return;

      if (isMultipleSelect) {
        setSelectedOptions((prev) =>
          prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
        );
      } else {
        setSelectedOptions([option]);
      }
    },
    [currentQuestionIndex, questions, questionStates]
  );

  const handleAutoSubmit = useCallback(() => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ || questionStates[currentQ.id]?.submitted) return;
    handleSubmitAnswer(true);
  }, [currentQuestionIndex, questions, questionStates]);

  const handleSubmitAnswer = useCallback(
    (isAutoSubmit = false) => {
      const currentQ = questions[currentQuestionIndex];
      if (!currentQ) return;

      // For text-based questions
      if (['short_answer', 'long_answer'].includes(currentQ.type)) {
        if (!textAnswer.trim()) return;
        setQuestionStates((prev) => ({
          ...prev,
          [currentQ.id]: {
            ...prev[currentQ.id],
            submitted: true,
            isCorrect: null, // Will be graded by AI
            timeSpent: (currentQ.timeLimit || 60) - (timeRemaining || 0),
            textAnswer: textAnswer.trim(),
          },
        }));
        return;
      }

      // For MCQ questions
      if (selectedOptions.length === 0) return;

      const isCorrect = checkAnswer(currentQ, selectedOptions);
      const pointsEarned = isCorrect ? currentQ.points : 0;
      const timeBonus = isCorrect && timeRemaining ? Math.floor(timeRemaining / 10) : 0;
      const finalPoints = pointsEarned + timeBonus;

      setQuestionStates((prev) => ({
        ...prev,
        [currentQ.id]: {
          ...prev[currentQ.id],
          selectedOptions: [...selectedOptions],
          submitted: true,
          isCorrect,
          timeSpent: (currentQ.timeLimit || 60) - (timeRemaining || 0),
        },
      }));

      if (isCorrect) {
        setTotalScore((prev) => prev + finalPoints);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    },
    [currentQuestionIndex, questions, selectedOptions, timeRemaining, textAnswer]
  );

  const checkAnswer = (question: QuizQuestion, selected: string[]): boolean => {
    if (Array.isArray(question.correctAnswer)) {
      const sortedSelected = [...selected].sort();
      const sortedCorrect = [...question.correctAnswer].sort();
      return JSON.stringify(sortedSelected) === JSON.stringify(sortedCorrect);
    }
    return selected[0] === question.correctAnswer;
  };

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setDirection(1);
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOptions([]);
      setTextAnswer('');
      setShowHint(false);
    } else {
      setShowConfirmSubmit(true);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setDirection(-1);
      setCurrentQuestionIndex((prev) => prev - 1);
      const prevQ = questions[currentQuestionIndex - 1];
      if (prevQ && questionStates[prevQ.id]) {
        setSelectedOptions(questionStates[prevQ.id].selectedOptions);
        setTextAnswer(questionStates[prevQ.id].textAnswer || '');
      } else {
        setSelectedOptions([]);
        setTextAnswer('');
      }
      setShowHint(false);
    }
  };

  const handleUseHint = () => {
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ || !currentQ.hint || questionStates[currentQ.id]?.usedHint) return;

    setShowHint(true);
    setQuestionStates((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        usedHint: true,
      },
    }));

    // Penalty for using hint
    setTotalScore((prev) => Math.max(0, prev - Math.floor(currentQ.points * 0.2)));
  };

  // ============================================================================
  // FINAL SUBMISSION
  // ============================================================================

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setShowConfirmSubmit(false);

    try {
      const percentage = Math.round((totalScore / maxPossibleScore) * 100);

      await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterId: id,
          score: totalScore,
          maxScore: maxPossibleScore,
          percentage,
          questionResults: questions.map((q) => ({
            questionId: q.id,
            isCorrect: questionStates[q.id]?.isCorrect,
            timeSpent: questionStates[q.id]?.timeSpent,
            usedHint: questionStates[q.id]?.usedHint,
            textAnswer: questionStates[q.id]?.textAnswer,
          })),
          timeSpentSeconds: questions.reduce(
            (acc, q) => acc + (questionStates[q.id]?.timeSpent || 0),
            0
          ),
        }),
      });

      // Update streak if score is good
      if (percentage >= 80) {
        await fetch('/api/profile/streak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true }),
        });
      }

      setQuizFinished(true);

      // Celebration confetti
      if (percentage >= 80) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    } catch (e: any) {
      console.error('Failed to submit assessment:', e);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const currentQ = questions[currentQuestionIndex];
  const currentState = currentQ ? questionStates[currentQ.id] : null;
  const isMultipleSelect = currentQ?.type === 'multiple_mcq';
  const isTextQuestion = ['short_answer', 'long_answer'].includes(currentQ?.type || '');
  const QuestionTypeIcon = currentQ ? QUESTION_TYPE_ICONS[currentQ.type] : Type;
  const t = activeTheme;

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col items-center justify-center px-4 relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(${t.text.replace('text-', 'text-')} 1px, transparent 1px), linear-gradient(90deg, ${t.text.replace('text-', 'text-')} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex flex-col items-center justify-center py-32 ${t.card} backdrop-blur-xl rounded-3xl shadow-2xl border ${t.border} px-12`}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="relative w-24 h-24 mb-6"
          >
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
            <div className={`relative w-full h-full ${t.bg} border ${t.border} rounded-full flex items-center justify-center shadow-lg`}>
              <Cpu className={`w-10 h-10 ${t.accent}`} />
            </div>
          </motion.div>
          <p className={`text-lg font-bold tracking-widest uppercase ${t.accent} mb-2`}>Initializing Assessment Matrix</p>
          <p className={`text-sm ${t.muted}`}>Loading chapter parameters...</p>
        </motion.div>
      </div>
    );
  }

  // ============================================================================
  // GENERATING QUESTIONS STATE
  // ============================================================================

  if (generatingQuestions) {
    return (
      <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col items-center justify-center px-4 relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(${t.text.replace('text-', 'text-')} 1px, transparent 1px), linear-gradient(90deg, ${t.text.replace('text-', 'text-')} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex flex-col items-center justify-center py-32 ${t.card} backdrop-blur-xl rounded-3xl shadow-2xl border ${t.border} px-12 max-w-lg`}
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [1, 0.8, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="relative w-20 h-20 mb-6 flex items-center justify-center"
          >
            <Brain className={`w-12 h-12 ${t.accent}`} />
            <div className={`absolute inset-0 ${t.accentBg}/20 rounded-full animate-pulse`}></div>
          </motion.div>
          <p className={`text-lg font-bold tracking-widest uppercase ${t.accent} mb-2`}>AI Generating Questions</p>
          <p className={`text-sm ${t.muted} text-center mb-6`}>Creating personalized assessment based on chapter content...</p>
          <Progress value={60} className={`w-full h-2 ${t.bg} [&>div]:${t.progressBar}`} />
        </motion.div>
      </div>
    );
  }

  // ============================================================================
  // QUIZ FINISHED STATE
  // ============================================================================

  if (quizFinished) {
    const percentage = Math.round((totalScore / maxPossibleScore) * 100);
    const isExcellent = percentage >= 90;
    const isGood = percentage >= 70;

    const getLevelBadge = () => {
      if (percentage >= 90) return { icon: Crown, color: 'text-yellow-500', label: 'Master' };
      if (percentage >= 70) return { icon: Gem, color: 'text-violet-500', label: 'Expert' };
      if (percentage >= 50) return { icon: Medal, color: 'text-blue-500', label: 'Proficient' };
      return { icon: Award, color: 'text-slate-500', label: 'Learner' };
    };

    const levelBadge = getLevelBadge();
    const LevelIcon = levelBadge.icon;

    return (
      <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col items-center py-12 px-4 relative overflow-hidden`}>
        <ConfettiEffect active={showConfetti} theme={t} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(${t.text.replace('text-', 'text-')} 1px, transparent 1px), linear-gradient(90deg, ${t.text.replace('text-', 'text-')} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100 }}
          className="w-full max-w-2xl relative z-10"
        >
          <Card className={`${t.card} backdrop-blur-xl rounded-[2rem] shadow-2xl border ${t.border} overflow-hidden`}>
            <div className={`h-3 w-full bg-gradient-to-r ${isExcellent ? 'from-emerald-500 to-teal-500' : isGood ? t.gradient : 'from-red-500 to-rose-500'}`} />
            <CardContent className="pt-12 pb-8 px-12 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${t.bg} border-4 shadow-2xl ${
                  isExcellent
                    ? 'border-yellow-500 shadow-[0_0_60px_rgba(234,179,8,0.3)]'
                    : isGood
                    ? `border-indigo-500 shadow-[0_0_60px_rgba(99,102,241,0.3)]`
                    : `border-slate-400 shadow-[0_0_60px_rgba(148,163,184,0.2)]`
                }`}
              >
                <LevelIcon className={`w-16 h-16 ${levelBadge.color}`} />
              </motion.div>
              <h2 className={`text-4xl font-black ${t.text} mb-2 tracking-tight`}>
                {isExcellent ? '🏆 Mastery Achieved!' : isGood ? '✅ Assessment Complete' : '📚 Review Recommended'}
              </h2>
              <p className={`text-xl ${t.muted} mb-8`}>
                You scored <span className={`font-black text-3xl text-transparent bg-clip-text bg-gradient-to-r ${t.gradient}`}>{totalScore}</span> out of {maxPossibleScore} points
              </p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className={`${t.bg} rounded-2xl p-4 border ${t.border}`}>
                  <p className={`text-3xl font-black ${t.accent}`}>{percentage}%</p>
                  <p className={`text-xs ${t.muted} uppercase tracking-wider mt-1`}>Accuracy</p>
                </div>
                <div className={`${t.bg} rounded-2xl p-4 border ${t.border}`}>
                  <p className={`text-3xl font-black ${t.accent}`}>{questions.filter((q) => questionStates[q.id]?.isCorrect).length}/{questions.length}</p>
                  <p className={`text-xs ${t.muted} uppercase tracking-wider mt-1`}>Correct</p>
                </div>
                <div className={`${t.bg} rounded-2xl p-4 border ${t.border}`}>
                  <p className={`text-3xl font-black ${t.accent}`}>{questions.reduce((acc, q) => acc + (questionStates[q.id]?.timeSpent || 0), 0)}s</p>
                  <p className={`text-xs ${t.muted} uppercase tracking-wider mt-1`}>Time</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mb-8">
                {[1, 2, 3].map((star) => (
                  <motion.div
                    key={star}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.5 + star * 0.1, type: 'spring' }}
                  >
                    <Star className={`w-8 h-8 ${star <= Math.ceil(percentage / 33.33) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-400'}`} />
                  </motion.div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="px-12 pb-12 flex flex-col gap-4">
              <Link href="/dashboard" className="w-full">
                <Button
                  size="lg"
                  className={`w-full h-14 text-lg rounded-xl font-black shadow-lg hover:-translate-y-1 transition-all bg-gradient-to-r ${t.gradient} text-white`}
                >
                  Return to Dashboard <Zap className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <div className="flex gap-4 w-full">
                <Button
                  variant="outline"
                  className={`flex-1 h-12 rounded-xl ${t.border} ${t.muted} hover:${t.bg}`}
                  onClick={() => window.location.reload()}
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Retry
                </Button>
                <Button
                  variant="outline"
                  className={`flex-1 h-12 rounded-xl ${t.border} ${t.muted} hover:${t.bg}`}
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ============================================================================
  // ACTIVE QUESTION STATE
  // ============================================================================

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col items-center py-8 px-4 relative overflow-hidden`}>
      <ConfettiEffect active={showConfetti} theme={t} />
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(${t.text.replace('text-', 'text-')} 1px, transparent 1px), linear-gradient(90deg, ${t.text.replace('text-', 'text-')} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      <div className="w-full max-w-3xl relative z-10">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/lesson/chapter/${id}`}
            className={`flex items-center ${t.muted} hover:${t.accent} transition-colors font-medium group`}
          >
            <motion.div whileHover={{ x: -4 }} transition={{ type: 'spring', stiffness: 300 }}>
              <ArrowLeft className="w-5 h-5 mr-2 group-hover:text-indigo-600" />
            </motion.div>
            <span className="hidden sm:inline">Back to Chapter</span>
          </Link>
          <div className="flex items-center gap-3">
            {timeRemaining !== null && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
                  timeRemaining <= 10
                    ? 'bg-red-500/10 border-red-500/30 text-red-500'
                    : `${t.bg} ${t.border} ${t.muted}`
                }`}
              >
                <Clock className={`w-4 h-4 ${timeRemaining <= 10 ? 'animate-pulse' : ''}`} />
                <span className="font-mono font-bold">{timeRemaining}s</span>
              </motion.div>
            )}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${t.accentBg}/10 border ${t.border} ${t.accent}`}>
              <Trophy className="w-4 h-4" />
              <span className="font-bold">{totalScore} pts</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${t.muted} uppercase tracking-wider font-bold`}>Progress</span>
            <span className={`text-xs font-bold ${t.accent}`}>{currentQuestionIndex + 1} / {questions.length}</span>
          </div>
          <div className={`h-2 ${t.bg} rounded-full overflow-hidden border ${t.border}`}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full bg-gradient-to-r ${t.gradient} shadow-lg`}
            />
          </div>
        </div>

        {/* Question Card */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentQ.id}
            custom={direction}
            initial={{ x: direction > 0 ? 100 : -100, opacity: 0, scale: 0.95 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: direction < 0 ? 100 : -100, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <Card className={`${t.card} backdrop-blur-xl rounded-[2rem] shadow-2xl border ${t.border} overflow-hidden`}>
              <div className={`h-1 bg-gradient-to-r ${t.gradient}`} />
              <CardHeader className="pt-8 px-8 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${t.bg} border ${t.border}`}>
                      <QuestionTypeIcon className={`w-5 h-5 ${t.accent}`} />
                    </div>
                    <Badge className={`${DIFFICULTY_COLORS[currentQ.difficulty]} border font-bold`}>
                      {currentQ.difficulty.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={`${t.border} ${t.muted}`}>
                      <Zap className="w-3 h-3 mr-1" /> {currentQ.points} pts
                    </Badge>
                  </div>
                  {currentQ.hint && !questionStates[currentQ.id]?.usedHint && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUseHint}
                      className={`${t.muted} hover:text-amber-500 hover:bg-amber-500/10`}
                    >
                      <Lightbulb className="w-4 h-4 mr-1" /> Hint
                    </Button>
                  )}
                </div>
                <CardTitle className={`text-xl md:text-2xl font-bold ${t.text} leading-snug tracking-tight`}>
                  {currentQ.prompt}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-6 space-y-6">
                {/* Image for image-based questions */}
                {currentQ.imageUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-2xl overflow-hidden border ${t.border} shadow-lg`}
                  >
                    <img src={currentQ.imageUrl} alt="Question visual" className="w-full h-48 md:h-64 object-cover" />
                  </motion.div>
                )}

                {/* Hint Display */}
                <AnimatePresence>
                  {showHint && currentQ.hint && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={`p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3`}>
                        <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-amber-500 mb-1">Hint (-20% points)</p>
                          <p className={`text-sm ${t.text}`}>{currentQ.hint}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Text Answer Input */}
                {isTextQuestion ? (
                  <div className="space-y-3">
                    <textarea
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className={`w-full min-h-[150px] p-4 rounded-2xl border ${t.border} ${t.bg} ${t.text} resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                      disabled={currentState?.submitted}
                    />
                    <div className={`text-xs ${t.muted}`}>
                      {textAnswer.length} characters • Aim for {currentQ.type === 'short_answer' ? '2-3 sentences' : '1-2 paragraphs'}
                    </div>
                  </div>
                ) : (
                  /* Options for MCQ questions */
                  <div className="space-y-3">
                    {currentQ.options?.map((option, index) => {
                      const isSelected = selectedOptions.includes(option);
                      const isSubmitted = currentState?.submitted;
                      const isCorrectAnswer =
                        option === currentQ.correctAnswer ||
                        (Array.isArray(currentQ.correctAnswer) && currentQ.correctAnswer.includes(option));
                      let buttonClass = `w-full justify-start h-auto py-5 px-6 text-left text-[1rem] rounded-2xl border-2 transition-all font-medium `;
                      if (isSubmitted) {
                        if (isCorrectAnswer) {
                          buttonClass += 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 shadow-lg';
                        } else if (isSelected) {
                          buttonClass += 'bg-red-500/10 border-red-500/30 text-red-600 shadow-lg';
                        } else {
                          buttonClass += `${t.bg} ${t.border} ${t.muted} opacity-50`;
                        }
                      } else {
                        if (isSelected) {
                          buttonClass += `${t.accentBg}/10 ${t.border} ${t.accent} shadow-lg`;
                        } else {
                          buttonClass += `${t.bg} ${t.border} ${t.text} hover:border-indigo-400 hover:bg-indigo-50`;
                        }
                      }
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Button
                            variant="outline"
                            className={buttonClass}
                            onClick={() => handleOptionSelect(option, isMultipleSelect)}
                            disabled={isSubmitted}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                {isMultipleSelect ? (
                                  <div
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                                      isSelected ? `border-indigo-500 ${t.accentBg}` : `border-slate-400`
                                    }`}
                                  >
                                    {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                  </div>
                                ) : (
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      isSelected ? `border-indigo-500 ${t.accentBg}` : `border-slate-400`
                                    }`}
                                  >
                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                  </div>
                                )}
                                <span className="whitespace-normal leading-relaxed">{option}</span>
                              </div>
                              {isSubmitted && isCorrectAnswer && <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 ml-4" />}
                              {isSubmitted && isSelected && !isCorrectAnswer && <XCircle className="w-6 h-6 text-red-500 shrink-0 ml-4" />}
                            </div>
                          </Button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Explanation */}
                <AnimatePresence>
                  {currentState?.submitted && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: 10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      className="overflow-hidden"
                    >
                      <div
                        className={`p-5 rounded-2xl border ${
                          currentState.isCorrect
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-slate-500/10 border-slate-500/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {currentState.isCorrect ? (
                            <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className={`text-sm font-bold mb-1 ${currentState.isCorrect ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {currentState.isCorrect ? '✓ Correct!' : '⚠ Review:'}
                            </p>
                            <p className={`text-sm leading-relaxed ${t.text}`}>{currentQ.explanation}</p>
                            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-200/50">
                              <span className={`text-xs ${t.muted}`}>Was this helpful?</span>
                              <Button variant="ghost" size="sm" className={`h-8 ${t.muted} hover:text-emerald-500`}>
                                <ThumbsUp className="w-3 h-3 mr-1" /> Yes
                              </Button>
                              <Button variant="ghost" size="sm" className={`h-8 ${t.muted} hover:text-red-500`}>
                                <ThumbsDown className="w-3 h-3 mr-1" /> No
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
              <CardFooter className={`px-8 py-6 ${t.bg}/50 border-t ${t.border} flex items-center justify-between gap-4`}>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevQuestion}
                    disabled={currentQuestionIndex === 0}
                    className={`${t.muted} hover:${t.text} disabled:opacity-30`}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (currentQuestionIndex < questions.length - 1) {
                        setDirection(1);
                        setCurrentQuestionIndex((prev) => prev + 1);
                        setSelectedOptions([]);
                        setTextAnswer('');
                        setShowHint(false);
                      }
                    }}
                    disabled={currentQuestionIndex >= questions.length - 1 || currentState?.submitted}
                    className={`${t.muted} hover:text-amber-500 disabled:opacity-30`}
                  >
                    Skip <SkipForward className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                {!currentState?.submitted ? (
                  <Button
                    className={`h-12 px-8 rounded-xl font-bold shadow-lg transition-all bg-gradient-to-r ${t.gradient} text-white disabled:opacity-50`}
                    onClick={() => handleSubmitAnswer(false)}
                    disabled={
                      (isTextQuestion && !textAnswer.trim()) ||
                      (!isTextQuestion && selectedOptions.length === 0) ||
                      (isMultipleSelect && selectedOptions.length < 2)
                    }
                  >
                    Submit Answer <Zap className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    className={`h-12 px-8 rounded-xl font-bold shadow-lg transition-all bg-gradient-to-r ${t.gradient} text-white`}
                    onClick={handleNextQuestion}
                  >
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Assessment'}{' '}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Question Navigator Dots */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {questions.map((q, idx) => {
            const state = questionStates[q.id];
            return (
              <button
                key={q.id}
                onClick={() => {
                  if (state?.submitted) {
                    setDirection(idx > currentQuestionIndex ? 1 : -1);
                    setCurrentQuestionIndex(idx);
                    setSelectedOptions(state.selectedOptions);
                    setTextAnswer(state.textAnswer || '');
                  }
                }}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === currentQuestionIndex
                    ? `bg-indigo-500 scale-125 shadow-lg`
                    : state?.submitted
                    ? state.isCorrect
                      ? 'bg-emerald-500'
                      : 'bg-red-500'
                    : `bg-slate-300 hover:bg-slate-400`
                } ${!state?.submitted && idx !== currentQuestionIndex ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                disabled={!state?.submitted && idx !== currentQuestionIndex}
              />
            );
          })}
        </div>
      </div>

      {/* Confirm Submit Dialog */}
      <AnimatePresence>
        {showConfirmSubmit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowConfirmSubmit(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`${t.card} border ${t.border} rounded-3xl p-8 max-w-md w-full shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <Target className={`w-16 h-16 ${t.accent} mx-auto mb-4`} />
                <h3 className={`text-2xl font-bold ${t.text} mb-2`}>Submit Assessment?</h3>
                <p className={`${t.muted}`}>
                  Current Score: <span className={`font-bold ${t.accent}`}>{totalScore}/{maxPossibleScore}</span>
                </p>
                <p className={`text-xs ${t.muted} mt-2`}>
                  {questions.filter((q) => !questionStates[q.id]?.submitted).length} questions unanswered
                </p>
              </div>
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className={`flex-1 h-12 rounded-xl ${t.border} ${t.muted} hover:${t.bg}`}
                  onClick={() => setShowConfirmSubmit(false)}
                >
                  Continue
                </Button>
                <Button
                  className={`flex-1 h-12 rounded-xl font-bold bg-gradient-to-r ${t.gradient} text-white`}
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Final'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}