```markdown
# 🚀 EduBridge

**EduBridge** is a next‑generation AI education platform that replaces static, passive learning with **Active Generative Pedagogy**. It takes any dry curriculum and transforms it into a highly personalized, interactive, and gamified narrative adventure tailored to the student's age, hobbies, and learning tempo.

![EduBridge Architecture](https://placehold.co/1024x400/1e1e2e/06b6d4?text=EduBridge+Active+Generative+Pedagogy)

## ✨ Core Features

* **🧠 The Entropy Engine:** Uses Google Gemini 2.5 Pro to weave standard educational facts into high‑stakes narrative tropes (e.g., Cyberpunk, Steampunk) while incorporating the student's real‑life hobbies. No two chapters are ever the same.
* **⚡ Lightning‑Fast "Doubts API":** A real‑time AI tutor powered by Groq LPUs. It features "Subconscious Context Injection," meaning the AI instantly knows exactly what paragraph the student is reading and their current mastery level without being told.
* **🎨 Dynamic Holographic UI:** Built with Framer Motion, the Next.js frontend physically repaints its visual theme (Vibe) to match the narrative of the current chapter.
* **📱 Offline Mode:** Chapters are aggressively cached to `localStorage`, allowing students to continue reading and taking quizzes even in Airplane Mode.
* **🤖 Android App:** A native Android wrapper built with Capacitor, available for download directly from the website or GitHub Releases.
* **🦾 Avaani Integration (Optional):** A hardware‑embodied Python interface capable of real‑time Voice‑to‑Voice tutoring with visual awareness.

## 🛠️ Tech Stack

* **Frontend:** Next.js 15 (App Router), React, Tailwind CSS, Framer Motion
* **Backend:** Next.js Serverless Edge Routes, Inngest (Background Jobs)
* **Database:** PostgreSQL (hosted on Supabase), Prisma ORM
* **Caching & Rate Limiting:** Upstash Redis
* **AI Models:** 
  * Google Gemini 2.5 Pro (Deep Reasoning & Generation)
  * Google Gemini 2.5 Flash (Fast Evaluation & Scaffolding)
  * Groq Llama 3.3 70B & 3.2 Vision (Real‑time Chat via Vercel AI SDK)
* **Mobile:** Capacitor 6 (Android), Gradle

## 🚦 Getting Started

### Prerequisites
Make sure you have Node.js (v18+) and npm/pnpm/yarn installed. You will also need accounts for Supabase, Groq, Google AI Studio, and Upstash.

### 1. Clone the repository
```bash
git clone https://github.com/SuPReme-0/EduBridge.git
cd EduBridge
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory and add your API keys:

```env
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
INNGEST_SIGNING_KEY="local"   # optional for dev
```

### 4. Setup the Database
Push the Prisma schema to your Supabase database:
```bash
npx prisma generate
npx prisma db push
```

### 5. Run the Development Server
You need to run Next.js and the Inngest Dev Server simultaneously:

**Terminal 1 (Next.js):**
```bash
npm run dev
```

**Terminal 2 (Inngest):**
```bash
npx inngest-cli@latest dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## 🏗️ Building for Production

### Web (Vercel)
Simply push to your GitHub repository and connect it to Vercel. The project is pre‑configured for automatic deployment.

### Android App
To generate a signed APK for the Android app:

1. Build the Next.js app:
   ```bash
   npm run build
   ```
2. Sync with Capacitor:
   ```bash
   npx cap sync android
   ```
3. Open the Android project in Android Studio:
   ```bash
   npx cap open android
   ```
4. In Android Studio, use **Build → Generate Signed Bundle / APK** and follow the wizard to create a signed APK.
5. The signed APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

You can also build from the command line after configuring signing keys in `android/app/build.gradle`.

## 🚀 Deployment on Vercel

1. Push your code to GitHub.
2. Import the repository into Vercel.
3. Add all environment variables from `.env.local` in the Vercel dashboard.
4. Deploy – your app will be live at `https://edubridge-eight.vercel.app` (or your custom domain).

After deployment, update your Supabase Auth settings to use the live URL as the **Site URL** and add `https://your-app.vercel.app/**` as a redirect URL.

## 🔐 Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full PostgreSQL connection string from Supabase (with `pgbouncer=true`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (used client‑side). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key (public). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service‑role key (secret, never exposed). |
| `GEMINI_API_KEY` | Google Gemini API key. |
| `GROQ_API_KEY` | Groq API key. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token. |
| `INNGEST_EVENT_KEY` | Inngest event key (for production, get from Inngest dashboard). |
| `INNGEST_SIGNING_KEY` | Inngest signing key (for production). |

## 📱 Download the Android App

You can download the latest signed APK from the [Releases](https://github.com/SuPReme-0/EduBridge/releases) page. After installing, the app will open `https://edubridge-eight.vercel.app` in a native WebView.

## 🛡️ Architecture & Security

EduBridge uses **Ephemeral Memory** for its Chat UI, meaning student data is processed in volatile memory by Groq LPUs and is never used to train foundational models. All curriculums and progress states are cryptographically locked to the user via Supabase Row Level Security (RLS).

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.
```