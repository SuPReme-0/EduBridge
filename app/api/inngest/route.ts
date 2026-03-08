import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { generateCurriculumJob, generateChapterJob } from "@/inngest/functions";

// Inngest automatically binds itself to these HTTP methods
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateCurriculumJob, 
    generateChapterJob
  ],
});