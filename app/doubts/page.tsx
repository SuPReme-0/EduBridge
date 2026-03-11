'use client';

import React from 'react';
import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send, Image as ImageIcon, X, Sparkles, Bot, User,
  Loader2, RotateCcw, Copy, Check, ThumbsUp, ThumbsDown,
  Lightbulb, BookOpen, Zap, ChevronRight, StopCircle,
  Maximize2, Minimize2, Paperclip, AlertCircle, ArrowLeft, Brain, Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { THEME_CONFIG } from '@/lib/themes';

// ============================================================================
// TYPES
// ============================================================================

type ExtendedMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp: Date;
  isLiked?: boolean;
  isDisliked?: boolean;
  chapterWarning?: boolean;
};

type SuggestedPrompt = {
  id: string;
  text: string;
  icon: React.ElementType;
  category: 'concept' | 'practice' | 'clarify' | 'expand' | 'chapter';
};

type ChapterInfo = {
  id: string;
  title: string;
  subject: string;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'IN_PROGRESS' | 'NOT_STARTED';
  progress: number;
  isCompleted: boolean;
  warning?: boolean;
};

type DoubtsApiResponse = {
  success: boolean;
  answer: string;
  modelUsed: string;
  chapterInfo?: {
    title: string;
    subject: string;
    progress: number;
    status: string;
    warning: boolean;
  };
  suggestedTopics: string[];
};

const CATEGORY_COLORS: Record<string, string> = {
  concept: 'bg-violet-500/10 text-violet-600 border-violet-500/30 hover:bg-violet-500/20',
  practice: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30 hover:bg-cyan-500/20',
  clarify: 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20',
  expand: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20',
  chapter: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/20',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const safeDecode = (str: string | null | undefined): string | null => {
  if (!str) return null;
  try { return decodeURIComponent(str); } catch { return str; }
};

// ============================================================================
// MESSAGE BUBBLE COMPONENT
// ============================================================================

const MessageBubble = ({
  message, onCopy, onFeedback, copiedId, theme,
}: {
  message: ExtendedMessage; onCopy: (content: string, id: string) => void;
  onFeedback: (id: string, type: 'like' | 'dislike') => void; copiedId: string | null; theme: any;
}) => {
  const formatTime = (date: Date) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${message.role === 'user' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-cyan-500 to-blue-600'}`}>
        {message.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
      </div>

      <div className={`flex flex-col max-w-[85%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
        {message.chapterWarning && message.role === 'assistant' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={`mb-3 p-4 rounded-xl border bg-amber-500/10 border-amber-500/30 flex items-start gap-3 ${theme.text}`}>
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-600 mb-1">Chapter Not Completed</p>
              <p className="text-sm text-amber-700">This content references a chapter you haven't finished yet. We recommend studying the chapter first for better understanding.</p>
            </div>
          </motion.div>
        )}

        <Card className={`border-0 shadow-xl ${message.role === 'user' ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white' : `${theme.card} ${theme.text} border ${theme.border}`}`}>
          <CardContent className="p-5 space-y-3">
            {message.image && (
              <div className="rounded-xl overflow-hidden border border-white/20 shadow-lg">
                <img src={message.image} alt="Uploaded" className="max-h-48 object-cover" />
              </div>
            )}
            {message.role === 'assistant' ? (
              <div className={`prose prose-sm max-w-none ${theme.isLight ? 'prose-slate' : 'prose-invert'}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                  p: ({ children }) => <p className="leading-relaxed mb-2">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>,
                  strong: ({ children }) => <strong className={theme.accent}>{children}</strong>,
                  code: ({ inline, children }: any) => inline ? <code className="bg-slate-800 px-2 py-0.5 rounded text-cyan-300 text-sm">{children}</code> : <code className="block bg-slate-950 p-3 rounded-lg my-2 overflow-x-auto text-sm">{children}</code>,
                }}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            )}
          </CardContent>
        </Card>

        <div className={`flex items-center gap-2 mt-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <span className={`text-xs ${theme.muted}`}>{formatTime(message.timestamp)}</span>
          {message.role === 'assistant' && (
            <>
              <Button variant="ghost" size="sm" className={`h-7 px-2 ${theme.muted} hover:${theme.accent} hover:${theme.card}`} onClick={() => onCopy(message.content, message.id)}>
                {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </Button>
              <Button variant="ghost" size="sm" className={`h-7 px-2 hover:${theme.card} ${message.isLiked ? 'text-emerald-500' : theme.muted} hover:text-emerald-500`} onClick={() => onFeedback(message.id, 'like')}>
                <ThumbsUp className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="sm" className={`h-7 px-2 hover:${theme.card} ${message.isDisliked ? 'text-red-500' : theme.muted} hover:text-red-500`} onClick={() => onFeedback(message.id, 'dislike')}>
                <ThumbsDown className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// SUGGESTED PROMPT CHIP
// ============================================================================

const SuggestedPromptChip = ({ prompt, onClick, theme }: { prompt: SuggestedPrompt; onClick: () => void; theme: any; }) => {
  const Icon = prompt.icon;
  return (
    <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }} onClick={onClick} className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${CATEGORY_COLORS[prompt.category]} ${theme.border}`}>
      <Icon className="w-3 h-3 mr-2 inline-block" /> {prompt.text}
    </motion.button>
  );
};

// ============================================================================
// CHAPTER STATUS BADGE
// ============================================================================

const ChapterStatusBadge = ({ chapter, theme }: { chapter: ChapterInfo | null; theme: any }) => {
  if (!chapter) return null;
  const statusConfig = {
    COMPLETED: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: Check },
    PENDING: { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: Clock },
    GENERATING: { color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: Loader2 },
    FAILED: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: X },
  };
  const config = statusConfig[chapter.status as keyof typeof statusConfig] || statusConfig.PENDING;
  const StatusIcon = config.icon;

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} ${config.border} border`}>
      <StatusIcon className={`w-4 h-4 ${config.color} ${chapter.status === 'GENERATING' ? 'animate-spin' : ''}`} />
      <span className={`text-xs font-bold ${config.color}`}>{chapter.isCompleted ? 'Completed' : `${chapter.progress}% Complete`}</span>
    </motion.div>
  );
};

// ============================================================================
// CHAT CONTENT COMPONENT (Custom fetch, no useChat)
// ============================================================================

function DoubtsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [chapterId, setChapterId] = useState<string | null>(null);
  const [chapterInfo, setChapterInfo] = useState<ChapterInfo | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [extendedMessages, setExtendedMessages] = useState<ExtendedMessage[]>([]);
  const [latestWarning, setLatestWarning] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false); // replaces isStreaming

  const [activeTheme, setActiveTheme] = useState(THEME_CONFIG['minimalist']);
  const [suggestedPrompts, setSuggestedPrompts] = useState<SuggestedPrompt[]>([
    { id: '1', text: 'Explain the main concept', icon: Lightbulb, category: 'concept' },
    { id: '2', text: 'Give me a practice problem', icon: Zap, category: 'practice' },
    { id: '3', text: 'I did not understand this part', icon: BookOpen, category: 'clarify' },
    { id: '4', text: 'Tell me a real-world example', icon: Sparkles, category: 'expand' },
  ]);

  // ----------------------------------------------------------------------------
  // Mount & Theme
  // ----------------------------------------------------------------------------
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const savedVibe = localStorage.getItem('edubridge_theme');
      if (savedVibe && THEME_CONFIG[savedVibe]) {
        setActiveTheme(THEME_CONFIG[savedVibe]);
      }
    }
  }, []);

  // ----------------------------------------------------------------------------
  // Fetch Chapter Info from URL
  // ----------------------------------------------------------------------------
  useEffect(() => {
    const fetchChapterInfo = async () => {
      const chapter = searchParams.get('chapter');
      if (chapter) {
        setChapterId(chapter);
        try {
          const res = await fetch(`/api/chapter/${chapter}`);
          const data = await res.json();
          if (res.ok && data.chapter) {
            const progress = data.chapter.userProgress;
            const isCompleted = data.chapter.status === 'COMPLETED' || progress?.completedAt !== null;
            setChapterInfo({
              id: chapter,
              title: data.chapter.title,
              subject: data.chapter.subject?.name || 'General',
              status: data.chapter.status,
              progress: isCompleted ? 100 : progress?.masteryLevel ? Math.round(progress.masteryLevel) : 0,
              isCompleted,
            });
            if (data.profile?.currentVibe && THEME_CONFIG[data.profile.currentVibe]) {
              setActiveTheme(THEME_CONFIG[data.profile.currentVibe]);
            }
          }
        } catch (e) {
          console.error('Failed to fetch chapter info:', e);
        }
      }
    };
    fetchChapterInfo();
  }, [searchParams]);

  // ----------------------------------------------------------------------------
  // Auto-scroll
  // ----------------------------------------------------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [extendedMessages, isLoading]);

  // ----------------------------------------------------------------------------
  // Auto-resize textarea
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // ----------------------------------------------------------------------------
  // Send Message (Custom Fetch)
  // ----------------------------------------------------------------------------
  const sendMessage = useCallback(async (text: string, image?: string | null) => {
    if (!text.trim() && !image) return;

    // Create user message
    const userMessage: ExtendedMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim() || "Please analyze this image and explain it to me.",
      image: image || undefined,
      timestamp: new Date(),
    };

    // Add to UI immediately
    setExtendedMessages(prev => [...prev, userMessage]);
    setShowWelcome(false);
    setIsLoading(true);

    // Clear input and image
    setInputValue('');
    if (image) {
      removeImage();
    }

    try {
      const res = await fetch('/api/doubts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          chapterId: chapterId || '',
          imageData: image || '',
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data: DoubtsApiResponse = await res.json();

      // Add assistant message
      const assistantMessage: ExtendedMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        chapterWarning: data.chapterInfo?.warning,
      };
      setExtendedMessages(prev => [...prev, assistantMessage]);

      // Update chapter info if provided
      if (data.chapterInfo) {
        setChapterInfo(prev => ({
          id: prev?.id || '',
          title: data.chapterInfo?.title || prev?.title || '',
          subject: data.chapterInfo?.subject || prev?.subject || '',
          progress: data.chapterInfo?.progress ?? prev?.progress ?? 0,
          status: (data.chapterInfo?.status as any) || prev?.status || 'PENDING',
          isCompleted: prev?.isCompleted || false,
          warning: data.chapterInfo?.warning,
        }));
        setLatestWarning(data.chapterInfo.warning);
      }

      // Update suggested topics
      if (data.suggestedTopics && data.suggestedTopics.length > 0) {
        setSuggestedPrompts(data.suggestedTopics.map((t: string, i: number) => ({
          id: `suggested-${i}`,
          text: t,
          icon: [Lightbulb, BookOpen, Zap, Sparkles, Brain][i % 5],
          category: ['concept', 'clarify', 'practice', 'expand', 'chapter'][i % 5] as any,
        })));
      }

    } catch (error) {
      console.error('Send message error:', error);
      setExtendedMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [chapterId]);

  // ----------------------------------------------------------------------------
  // Image handling
  // ----------------------------------------------------------------------------
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      setSelectedImageName(file.name);
    };
    reader.readAsDataURL(file);
  }, []);

  const removeImage = useCallback(() => {
    setSelectedImage(null);
    setSelectedImageName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ----------------------------------------------------------------------------
  // Handlers for prompts, submit, etc.
  // ----------------------------------------------------------------------------
  const handleSuggestedPrompt = useCallback((prompt: string) => {
    sendMessage(prompt, selectedImage);
  }, [sendMessage, selectedImage]);

  const startChatting = useCallback(() => {
    setShowWelcome(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const handleCopyMessage = useCallback((content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleFeedback = useCallback(async (messageId: string, type: 'like' | 'dislike') => {
    setExtendedMessages(prev => prev.map(msg =>
      msg.id === messageId ? {
        ...msg,
        isLiked: type === 'like' ? !msg.isLiked : false,
        isDisliked: type === 'dislike' ? !msg.isDisliked : false
      } : msg
    ));

    try {
      await fetch('/api/doubts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, type })
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  }, []);

  const clearChat = useCallback(() => {
    setExtendedMessages([]);
    setShowWelcome(true);
    setInputValue('');
    setIsLoading(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue, selectedImage);
  }, [inputValue, selectedImage, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() || selectedImage) {
        handleSubmit(e as any);
      }
    }
  }, [inputValue, selectedImage, handleSubmit]);

  const t = activeTheme;

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Loader2 className="w-10 h-10 text-indigo-600 opacity-80" />
        </motion.div>
        <p className="mt-4 text-sm text-slate-500 font-medium tracking-wide">Loading...</p>
      </div>
    );
  }

  if (showWelcome && extendedMessages.length === 0) {
    // Welcome screen (unchanged)
    return (
      <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col items-center justify-center p-4 relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(${t.text.replace('text-', 'text-')} 1px, transparent 1px), linear-gradient(90deg, ${t.text.replace('text-', 'text-')} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        {!t.isLight && (
          <>
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px]" />
          </>
        )}

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl w-full text-center relative z-10">
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }} className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${t.gradient} flex items-center justify-center mx-auto mb-6 shadow-2xl`}>
            <Bot className="w-12 h-12 text-white" />
          </motion.div>

          <h1 className={`text-4xl md:text-5xl font-black ${t.text} mb-4 tracking-tight`}>AI Study Assistant</h1>
          <p className={`text-lg ${t.muted} mb-8 max-w-lg mx-auto`}>Your personal tutor, available 24/7. Ask questions about your chapters, upload diagrams, or get help with problems.</p>

          {chapterInfo && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className={`${t.card} backdrop-blur-xl rounded-2xl p-4 mb-8 border ${t.border} shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${t.accentLight}`}><BookOpen className={`w-5 h-5 ${t.accent}`} /></div>
                <div className="text-left flex-1">
                  <p className={`text-xs ${t.muted} uppercase tracking-wider font-bold`}>Current Chapter</p>
                  <p className={`font-semibold ${t.text}`}>{chapterInfo.title}</p>
                  <p className={`text-sm ${t.muted}`}>{chapterInfo.subject}</p>
                </div>
                <ChapterStatusBadge chapter={chapterInfo} theme={t} />
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {suggestedPrompts.map((prompt) => <SuggestedPromptChip key={prompt.id} prompt={prompt} onClick={() => handleSuggestedPrompt(prompt.text)} theme={t} />)}
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button variant="outline" className={`${t.card} ${t.text} ${t.border} hover:${t.accentLight} rounded-xl`} onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="w-4 h-4 mr-2" /> Upload Image
            </Button>
            <Button className={`bg-gradient-to-r ${t.gradient} text-white rounded-xl shadow-lg hover:-translate-y-0.5 transition-all`} onClick={startChatting}>
              Start Chatting <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
        </motion.div>
      </div>
    );
  }

  // Chat UI
  return (
    <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col relative overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(${t.text.replace('text-', 'text-')} 1px, transparent 1px), linear-gradient(90deg, ${t.text.replace('text-', 'text-')} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      {!t.isLight && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/10 rounded-full blur-[120px]" />}

      <header className={`sticky top-0 z-40 ${t.card}/90 backdrop-blur-xl border-b ${t.border} shadow-sm`}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className={`${t.muted} hover:${t.accent} hover:${t.accentLight} rounded-xl`}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shadow-lg`}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={`font-bold ${t.text}`}>AI Tutor</h1>
                {chapterInfo && <p className={`text-xs ${t.muted}`}>{chapterInfo.subject} • {chapterInfo.title}</p>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {chapterInfo && <ChapterStatusBadge chapter={chapterInfo} theme={t} />}
            <Button variant="ghost" size="sm" onClick={clearChat} className={`${t.muted} hover:text-red-500 hover:${t.accentLight} rounded-xl`} title="Clear Chat">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleFullscreen} className={`${t.muted} hover:${t.accent} hover:${t.accentLight} rounded-xl`} title="Fullscreen">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <AnimatePresence>
            {extendedMessages.map((message) => (
              <MessageBubble key={message.id} message={message} onCopy={handleCopyMessage} onFeedback={handleFeedback} copiedId={copiedId} theme={t} />
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center shadow-lg`}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <Card className={`${t.card} ${t.border}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex gap-1">
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className={`w-2 h-2 rounded-full ${t.accentBg}`} />
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className={`w-2 h-2 rounded-full ${t.accentBg}`} />
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className={`w-2 h-2 rounded-full ${t.accentBg}`} />
                  </div>
                  <span className={`text-sm ${t.muted}`}>AI is thinking...</span>
                </CardContent>
              </Card>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className={`sticky bottom-0 ${t.card}/90 backdrop-blur-xl border-t ${t.border} p-4`}>
        <div className="max-w-5xl mx-auto">
          <AnimatePresence>
            {selectedImage && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-3 flex items-center gap-3">
                <div className="relative group">
                  <img src={selectedImage} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-slate-700 shadow-lg" />
                  <button onClick={removeImage} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${t.text}`}>{selectedImageName}</p>
                  <p className={`text-xs ${t.muted}`}>Ready to send</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <div className="flex-1 relative">
              <div className={`flex items-end gap-2 ${t.card} ${t.border} border rounded-2xl p-2 shadow-xl`}>
                <Button type="button" variant="ghost" size="sm" className={`h-10 w-10 rounded-xl ${t.muted} hover:${t.accent} hover:${t.accentLight} transition-colors`} onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-5 h-5" />
                </Button>
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your chapter..."
                  className={`flex-1 bg-transparent ${t.text} placeholder:${t.muted} resize-none outline-none py-3 px-2 max-h-[200px] min-h-[44px]`}
                  rows={1}
                />
                {isLoading ? (
                  <Button type="button" size="sm" variant="ghost" disabled className={`h-10 w-10 rounded-xl bg-red-500/20 text-red-500 cursor-not-allowed`}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </Button>
                ) : (
                  <Button type="submit" size="sm" disabled={!inputValue.trim() && !selectedImage} className={`h-10 w-10 rounded-xl bg-gradient-to-r ${t.gradient} text-white hover:shadow-lg disabled:opacity-50 transition-all`}>
                    <Send className="w-5 h-5" />
                  </Button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>
          </form>

          {extendedMessages.length < 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex flex-wrap gap-2">
              {suggestedPrompts.slice(0, 3).map((prompt) => (
                <SuggestedPromptChip key={prompt.id} prompt={prompt} onClick={() => handleSuggestedPrompt(prompt.text)} theme={t} />
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function DoubtsPage() {
  return (
    <ErrorBoundary fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-slate-600 mb-4">Please refresh the page and try again.</p>
        <Button onClick={() => window.location.reload()} className="bg-indigo-600 text-white">
          Refresh Page
        </Button>
      </div>
    }>
      <Suspense fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
            <Loader2 className="w-10 h-10 text-indigo-600 opacity-80" />
          </motion.div>
          <p className="mt-4 text-sm text-slate-500 font-medium tracking-wide">Loading chat...</p>
        </div>
      }>
        <DoubtsContent />
      </Suspense>
    </ErrorBoundary>
  );
}