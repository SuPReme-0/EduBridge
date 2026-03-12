import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  generateCurriculumJob,
  generateChapterBatchJob,   // 👈 this one was missing
  generateChapterJob,
  retryFailedChaptersJob,    // 👈 also good to include
} from "@/inngest/functions"; // adjust the import path if needed

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateCurriculumJob,
    generateChapterBatchJob,
    generateChapterJob,
    retryFailedChaptersJob,
  ],
});