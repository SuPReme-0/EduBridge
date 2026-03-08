import { Inngest } from 'inngest';

// Define event schemas with proper TypeScript types
export const inngest = new Inngest({
  id: 'EduBridge',
  events: [
    {
      name: 'curriculum.generate',
      schema: {
        data: {
          userId: 'string',
          curriculumId: 'string',
          referenceBooks: 'string[]',
        },
      },
    },
    {
      name: 'chapter.generate',
      schema: {
        data: {
          userId: 'string',
          chapterId: 'string',
          referenceBooks: 'string[]',
          subjectName: 'string',
          chapterTitle: 'string',
        },
      },
    },
    {
      name: 'chapter.regenerate',
      schema: {
        data: {
          userId: 'string',
          chapterId: 'string',
        },
      },
    },
  ],
});