// store/useStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ✅ FIXED: Match Prisma Tempo enum exactly
export type LearningTempo = 'EASY' | 'NORMAL' | 'EXTREME';

export type UserProfile = {
  id: string;
  userId: string;
  email: string;
  
  // Demographics - Match Prisma Profile model
  fullName?: string | null;
  age?: number | null;
  gender?: string | null;
  school?: string | null;
  educationPath: string;
  classLevel: number;
  board?: string | null;
  
  // Personalization
  learningTempo: LearningTempo;
  currentVibe: string;
  interests: string[];
  hobbies: string[];
  
  // Avatar
  avatarUrl?: string | null;
  
  // ✅ ADDED: Gamification Stats (from Prisma Profile)
  totalStudyMinutes: number;
  currentStreak: number;
  longestStreak: number;
  totalPoints: number;
  testsCompleted: number;
  averageMastery: number;
  lastActiveAt?: string | null;
  
  // Legacy fields (keep for backwards compatibility)
  books?: string[];
  aiCurriculum?: boolean;
};

export interface UITheme {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  layoutStyle: 'playful' | 'minimal' | 'technical' | 'dramatic';
}

export interface LessonContentBlock {
  type: 'text' | 'image' | 'quiz' | 'code' | 'definition' | 'fact' | 'story';
  content?: string;
  prompt?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  blocks?: LessonContentBlock[];
  completed: boolean;
  score?: number;
}

export interface Chapter {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  completed: boolean;
}

export interface Journey {
  chapters: Chapter[];
  dailyTweak?: string;
  uiTheme: UITheme;
  lastUpdated: string;
}

interface AppState {
  user: UserProfile | null;
  journey: Journey | null;
  isLoggedIn: boolean;
  login: (user: UserProfile) => void;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setJourney: (journey: Journey) => void;
  updateLessonProgress: (chapterId: string, lessonId: string, score: number) => void;
  resetProgress: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      journey: null,
      isLoggedIn: false,
      
      login: (user) => set({ user, isLoggedIn: true }),
      
      logout: () => set({ user: null, journey: null, isLoggedIn: false }),
      
      updateProfile: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      
      setJourney: (journey) => set({ journey }),
      
      updateLessonProgress: (chapterId, lessonId, score) =>
        set((state) => {
          if (!state.journey) return state;
          
          const newChapters = state.journey.chapters.map((chapter) => {
            if (chapter.id === chapterId) {
              const newLessons = chapter.lessons.map((lesson) => {
                if (lesson.id === lessonId) {
                  return { ...lesson, completed: true, score };
                }
                return lesson;
              });
              
              const allCompleted = newLessons.every((l) => l.completed);
              return { ...chapter, lessons: newLessons, completed: allCompleted };
            }
            return chapter;
          });

          return {
            journey: {
              ...state.journey,
              chapters: newChapters,
            },
          };
        }),
      
      resetProgress: () =>
        set((state) => {
          if (!state.journey) return state;
          
          const resetChapters = state.journey.chapters.map((chapter) => ({
            ...chapter,
            completed: false,
            lessons: chapter.lessons.map((lesson) => ({
              ...lesson,
              completed: false,
              score: undefined,
            })),
          }));

          return {
            journey: {
              ...state.journey,
              chapters: resetChapters,
            },
          };
        }),
    }),
    {
      name: 'learning-journey-storage',
      // ✅ ADDED: Partialize to avoid hydration mismatches
      partialize: (state) => ({
        user: state.user,
        journey: state.journey,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
);