# 🚀 EduBridge

**EduBridge** is a next-generation AI education platform that replaces static, passive learning with **Active Generative Pedagogy**. It takes any dry curriculum and transforms it into a highly personalized, interactive, and gamified narrative adventure tailored to the student's age, hobbies, and learning tempo.

![EduBridge Architecture](https://placehold.co/1024x400/1e1e2e/06b6d4?text=EduBridge+Active+Generative+Pedagogy)

## ✨ Core Features

* **🧠 The Entropy Engine:** Uses Google Gemini 2.5 Pro to weave standard educational facts into high-stakes narrative tropes (e.g., Cyberpunk, Steampunk) while incorporating the student's real-life hobbies. No two chapters are ever the same.
* **⚡ Lightning-Fast "Doubts API":** A real-time AI tutor powered by Groq LPUs. It features "Subconscious Context Injection," meaning the AI instantly knows exactly what paragraph the student is reading and their current mastery level without being told.
* **🎨 Dynamic Holographic UI:** Built with Framer Motion, the Next.js frontend physically repaints its visual theme (Vibe) to match the narrative of the current chapter.
* **📱 Offline Mode:** Chapters are aggressively cached to `localStorage`, allowing students to continue reading and taking quizzes even in Airplane Mode.
* **🦾 Avaani Integration (Optional):** A hardware-embodied Python interface capable of real-time Voice-to-Voice tutoring with visual awareness.

## 🛠️ Tech Stack

* **Frontend:** Next.js 15 (App Router), React, Tailwind CSS, Framer Motion
* **Backend:** Next.js Serverless Edge Routes, Inngest (Background Jobs)
* **Database:** PostgreSQL (hosted on Supabase), Prisma ORM
* **Caching & Rate Limiting:** Upstash Redis
* **AI Models:** * Google Gemini 2.5 Pro (Deep Reasoning & Generation)
  * Google Gemini 2.5 Flash (Fast Evaluation & Scaffolding)
  * Groq Llama 3.3 70B & 3.2 Vision (Real-time Chat via Vercel AI SDK)

## 🚦 Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm/pnpm/yarn installed. You will also need accounts for Supabase, Groq, Google AI Studio, and Upstash.

### 1. Clone the repository
\`\`\`bash
git clone https://github.com/your-username/edubridge.git
cd edubridge
\`\`\`

### 2. Install dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Environment Variables
Create a `.env.local` file in the root directory and add your API keys:

\`\`\`env
# Supabase & Database
DATABASE_URL="your-supabase-connection-string"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AI Providers
GEMINI_API_KEY="your-google-gemini-key"
GROQ_API_KEY="your-groq-key"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Inngest (For local dev, leave blank or use local URL)
INNGEST_EVENT_KEY="local"
\`\`\`

### 4. Setup the Database
Push the Prisma schema to your Supabase database:
\`\`\`bash
npx prisma generate
npx prisma db push
\`\`\`

### 5. Run the Development Server
You need to run Next.js and the Inngest Dev Server simultaneously:

**Terminal 1 (Next.js):**
\`\`\`bash
npm run dev
\`\`\`

**Terminal 2 (Inngest):**
\`\`\`bash
npx inngest-cli@latest dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## 🛡️ Architecture & Security
EduBridge uses **Ephemeral Memory** for its Chat UI, meaning student data is processed in volatile memory by Groq LPUs and is never used to train foundational models. All curriculums and progress states are cryptographically locked to the user via Supabase Row Level Security (RLS).