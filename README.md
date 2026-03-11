<div align="center">

# 🚀 EduBridge

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Space+Grotesk&weight=700&size=28&pause=1000&color=06B6D4&center=true&vCenter=true&width=800&lines=Active+Generative+Pedagogy;Transform+Any+Curriculum+Into+an+Adventure;Real-Time+Contextual+AI+Tutor;Hyper-Personalized+Learning+Matrix)](https://git.io/typing-svg)

**Study Smarter. Not Harder. Download Knowledge.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Android](https://img.shields.io/badge/Android-Native-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/SuPReme-0/EduBridge/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

### 🌟 [Access the Live Matrix (Web App)](https://edubridge-eight.vercel.app) | 📱 [Download Android APK](https://github.com/SuPReme-0/EduBridge/releases)

<br />

<img src="https://placehold.co/1024x500/05050A/06b6d4?text=EduBridge+Neural+Learning+Interface" alt="EduBridge UI Dashboard" width="100%" style="border-radius: 15px; box-shadow: 0 0 20px rgba(6,182,212,0.3);" />

</div>

---

## ⚡ What is EduBridge?

EduBridge is a next-generation AI education platform that replaces static, passive learning with **Active Generative Pedagogy**. It takes any dry curriculum and transforms it into a highly personalized, interactive, and gamified narrative adventure tailored to the student's age, hobbies, and learning tempo.

## ✨ Core Features

* **🧠 The Entropy Engine:** Uses Google Gemini 2.5 Pro to weave standard educational facts into high-stakes narrative tropes (e.g., Cyberpunk, Steampunk) while incorporating the student's real-life hobbies. No two chapters are ever the same.
* **💬 Lightning-Fast "Doubts API":** A real-time AI tutor powered by Groq LPUs. It features **Subconscious Context Injection**, meaning the AI instantly knows exactly what paragraph you are reading and your current mastery level without you typing a word.
* **🎨 Dynamic Holographic UI:** Built with Framer Motion, the Next.js frontend physically repaints its visual theme (Vibe) to match the narrative of the current chapter.
* **📱 Offline Mode:** Chapters are aggressively cached to `localStorage`, allowing students to continue reading and taking interactive quizzes even in Airplane Mode.
* **🤖 Native Android App:** A lightning-fast Android wrapper built with Capacitor, available for download directly from GitHub Releases.
* **🦾 Avaani Integration (Optional):** A hardware-embodied Python interface capable of real-time Voice-to-Voice tutoring with visual awareness.

---

## 🛠️ The Tech Stack

### Frontend
* **Framework:** Next.js 15 (App Router), React 19
* **Styling & Animation:** Tailwind CSS, Framer Motion, Lucide Icons
* **Mobile:** Capacitor 6 (Android), Gradle

### Backend & Infrastructure
* **Compute:** Next.js Serverless Edge Routes
* **Background Jobs:** Inngest (Reliable event-driven orchestration)
* **Database & Auth:** PostgreSQL hosted on Supabase, Prisma ORM
* **Caching & Rate Limiting:** Upstash Redis

### AI Intelligence Models
* **Generation & Reasoning:** Google Gemini 2.5 Pro & Gemini 2.5 Flash
* **Real-time Chat:** Groq Llama 3.3 70B & 3.2 Vision (via Vercel AI SDK)

---

## 🚦 Getting Started (Local Development)

### Prerequisites
Make sure you have Node.js (v18+) and `npm`/`pnpm`/`yarn` installed. You will also need accounts for Supabase, Groq, Google AI Studio, and Upstash.

### 1. Clone the repository
```bash
git clone [https://github.com/SuPReme-0/EduBridge.git](https://github.com/SuPReme-0/EduBridge.git)
cd EduBridge
2. Install dependencies
Bash
npm install
3. Environment Variables
Create a .env.local file in the root directory and add your keys:

Code snippet
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

# Inngest (For local dev, use local URL)
INNGEST_EVENT_KEY="local"
INNGEST_SIGNING_KEY="local"
4. Setup the Database
Push the Prisma schema to your Supabase database:

Bash
npx prisma generate
npx prisma db push
5. Run the Development Server
You need to run Next.js and the Inngest Dev Server simultaneously.

Terminal 1 (Next.js):

Bash
npm run dev
Terminal 2 (Inngest):

Bash
npx inngest-cli@latest dev
Open http://localhost:3000 with your browser to enter the matrix.

🏗️ Building for Production
Deploying the Web App (Vercel)
Push your code to GitHub.

Import the repository into Vercel.

Add all environment variables from .env.local in the Vercel dashboard.

Deploy! Your app will be live at https://edubridge-eight.vercel.app.

Crucial: Update your Supabase Auth settings to use the live URL as the Site URL and add https://edubridge-eight.vercel.app/** as a redirect URL.

Building the Android App
To generate a signed APK for the Android native app:

Build the Next.js web app for export:

Bash
npm run build
Sync the web assets with Capacitor:

Bash
npx cap sync android
Open the Android project in Android Studio:

Bash
npx cap open android
In Android Studio, use Build → Generate Signed Bundle / APK and follow the wizard. The signed APK will be located at android/app/build/outputs/apk/release/app-release.apk.

🛡️ Architecture & Security
EduBridge is built with user privacy and system resilience as core tenets:

Ephemeral Memory: The Chat UI processes student data in volatile memory via Groq LPUs. Data is never used to train foundational models.

Data Isolation: All curriculums, test scores, and progress states are cryptographically locked to the user via Supabase Row Level Security (RLS) policies.

Rate-Limit Protections: Strict IP and User-based rate limiting via Upstash Redis prevents API abuse and Thundering Herd failures.

🤝 Contributing
Contributions, issues, and feature requests are highly welcome!
Feel free to check the issues page.

📄 License
This project is licensed under the MIT License – see the LICENSE file for details.

<div align="center">
<p>Built with ❤️ by Priyanshu for the future of education.</p>
</div>