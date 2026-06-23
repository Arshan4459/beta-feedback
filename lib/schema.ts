// Single source of truth for the Beta Student Feedback Form.
// Ported verbatim from the approved HTML prototype (copy, options, branching).
// Adding/removing/reordering questions here flows through the whole form:
// rendering, branching, progress, validation, and submission.

export type QType = "single" | "multi" | "scale" | "text" | "longtext";

export interface Option {
  value: string;
  label: string;
  emoji?: string;
}

/** A condition that must hold for a question to be visible. All conditions on a
 *  question are AND-ed, which lets nested gates (e.g. Learn → "some didn't work")
 *  reference both their section gate and the parent answer. */
export interface VisibleWhen {
  key: string;
  equals: string;
}

export interface Question {
  key: string;
  type: QType;
  label: string;
  /** Required questions block submission when visible and unanswered. */
  required?: boolean;
  /** Disables the voice recorder for this question (admission number only). */
  noRecord?: boolean;
  options?: Option[];
  /** Choice layout: row of chips (default) or a vertical column. */
  layout?: "row" | "col";
  /** Render single-choice chips with a large emoji (😕 🙂 😄). */
  emoji?: boolean;
  placeholder?: string;
  /** Scale captions for the 1–5 ends. */
  capLow?: string;
  capHigh?: string;
  /** Validation message; defaults to "Please pick one." for choices. */
  errorMsg?: string;
  visibleWhen?: VisibleWhen[];
}

export interface Section {
  id: string;
  title: string;
  /** Muted note next to the heading, e.g. ASTRA "(the question helper)". */
  titleNote?: string;
  /** Muted sub-line under the heading. */
  sub?: string;
  questions: Question[];
}

const YES_NO: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const FACES: Option[] = [
  { value: "hard", label: "Hard", emoji: "😕" },
  { value: "okay", label: "Okay", emoji: "🙂" },
  { value: "easy", label: "Easy", emoji: "😄" },
];

const LEARN_ITEMS: Option[] = [
  { value: "videos", label: "Videos" },
  { value: "summary", label: "Summary" },
  { value: "materials", label: "Materials (PDFs)" },
  { value: "activities", label: "2D / 3D Activities" },
];

export const SECTIONS: Section[] = [
  {
    id: "about",
    title: "About you",
    questions: [
      {
        key: "admission_no",
        type: "text",
        label: "Please enter your admission number",
        required: true,
        noRecord: true,
        placeholder: "e.g. 1234567",
        errorMsg: "Please enter your admission number.",
      },
      {
        key: "grade",
        type: "single",
        label: "What grade are you in?",
        required: true,
        noRecord: true,
        options: [
          { value: "6", label: "6th" },
          { value: "7", label: "7th" },
          { value: "8", label: "8th" },
          { value: "9", label: "9th" },
          { value: "10", label: "10th" },
        ],
      },
      {
        key: "device",
        type: "single",
        label: "What did you use the app on?",
        required: true,
        noRecord: true,
        options: [
          { value: "chromebook", label: "School computer / Chromebook" },
          { value: "tablet", label: "Tablet" },
          { value: "phone", label: "Phone" },
          { value: "laptop", label: "My own laptop" },
        ],
      },
    ],
  },

  {
    id: "tests",
    title: "Tests",
    sub: "Answer this part only if you took a test.",
    questions: [
      {
        key: "test_used",
        type: "single",
        label: "Did you take a test in the app?",
        required: true,
        options: YES_NO,
      },
      {
        key: "test_start",
        type: "single",
        emoji: true,
        label: "How easy was it to find and start your test?",
        options: FACES,
        visibleWhen: [{ key: "test_used", equals: "yes" }],
      },
      {
        key: "test_clarity",
        type: "single",
        emoji: true,
        label:
          "While taking the test, how clear was everything on screen (timer, your answers, which questions you'd done)?",
        options: [
          { value: "confusing", label: "Confusing", emoji: "😕" },
          { value: "mostly", label: "Mostly clear", emoji: "🙂" },
          { value: "veryclear", label: "Very clear", emoji: "😄" },
        ],
        visibleWhen: [{ key: "test_used", equals: "yes" }],
      },
      {
        key: "test_trouble",
        type: "multi",
        layout: "col",
        label: "Did any of these give you trouble during the test? (Pick all that happened.)",
        options: [
          { value: "save", label: "Saving an answer / moving to the next question" },
          { value: "review", label: "Marking a question for review" },
          { value: "clear", label: "Clearing or changing an answer" },
          { value: "timer", label: "Seeing how much time was left" },
          { value: "submit", label: "Submitting the test at the end" },
          { value: "none", label: "Nothing — it all worked" },
        ],
        visibleWhen: [{ key: "test_used", equals: "yes" }],
      },
      {
        key: "test_submit",
        type: "single",
        emoji: true,
        label: "How did submitting your test go?",
        options: [
          { value: "problems", label: "Had problems", emoji: "😕" },
          { value: "unsure", label: "Worked, but unsure it went through", emoji: "🙂" },
          { value: "easy", label: "Submitted easily", emoji: "😄" },
        ],
        visibleWhen: [{ key: "test_used", equals: "yes" }],
      },
      {
        key: "test_results",
        type: "single",
        layout: "col",
        label: "After the test, could you see your answers and results in a way that made sense?",
        options: [
          { value: "no", label: "No, I couldn't find them or understand them" },
          { value: "sort", label: "Sort of" },
          { value: "yes", label: "Yes, clearly" },
        ],
        visibleWhen: [{ key: "test_used", equals: "yes" }],
      },
      {
        key: "test_compare",
        type: "scale",
        label: "Compared to the old test section, the new one feels…",
        capLow: "Much worse",
        capHigh: "Much better",
        visibleWhen: [{ key: "test_used", equals: "yes" }],
      },
      {
        key: "test_open",
        type: "longtext",
        label: "If something went wrong or felt annoying during the test, tell us what happened.",
        placeholder: "Optional",
        visibleWhen: [{ key: "test_used", equals: "yes" }],
      },
    ],
  },

  {
    id: "schedule",
    title: "Schedule",
    sub: "Answer this part only if you used the Schedule.",
    questions: [
      {
        key: "sch_used",
        type: "single",
        label: "Did you use the Schedule?",
        required: true,
        options: YES_NO,
      },
      {
        key: "sch_easy",
        type: "single",
        emoji: true,
        label: "How easy was it to open and read your schedule?",
        options: FACES,
        visibleWhen: [{ key: "sch_used", equals: "yes" }],
      },
      {
        key: "sch_find",
        type: "single",
        layout: "col",
        label:
          "Could you see what you needed — this month's plan, recommended topics/videos, and other months?",
        options: [
          { value: "some", label: "I couldn't find some of it" },
          { value: "most", label: "Found most of it" },
          { value: "all", label: "Found everything easily" },
        ],
        visibleWhen: [{ key: "sch_used", equals: "yes" }],
      },
      {
        key: "sch_useful",
        type: "single",
        label: "Did the recommended topics and videos feel useful to you?",
        options: [
          { value: "no", label: "Not really" },
          { value: "little", label: "A little" },
          { value: "yes", label: "Yes, helpful" },
        ],
        visibleWhen: [{ key: "sch_used", equals: "yes" }],
      },
      {
        key: "sch_open",
        type: "longtext",
        label: "Anything about the Schedule you'd change?",
        placeholder: "Optional",
        visibleWhen: [{ key: "sch_used", equals: "yes" }],
      },
    ],
  },

  {
    id: "learn",
    title: "Learn",
    sub: "Videos, summaries, materials, and activities.",
    questions: [
      {
        key: "learn_used",
        type: "single",
        label: "Did you use Learn?",
        required: true,
        options: YES_NO,
      },
      {
        key: "learn_easy",
        type: "single",
        emoji: true,
        label: "How easy was it to find your course, subject, and topic?",
        options: FACES,
        visibleWhen: [{ key: "learn_used", equals: "yes" }],
      },
      {
        key: "learn_opened",
        type: "multi",
        label: "Which of these did you open? (Pick all you tried.)",
        options: LEARN_ITEMS,
        visibleWhen: [{ key: "learn_used", equals: "yes" }],
      },
      {
        key: "learn_work",
        type: "single",
        layout: "col",
        label: "Did everything you opened work the way you expected?",
        options: [
          { value: "some", label: "Some things didn't work" },
          { value: "most", label: "Mostly worked" },
          { value: "all", label: "Everything worked" },
        ],
        visibleWhen: [{ key: "learn_used", equals: "yes" }],
      },
      {
        key: "learn_broke",
        type: "multi",
        label: "Which part didn't work well?",
        options: LEARN_ITEMS,
        // Nested gate: only when Learn was used AND something didn't work.
        visibleWhen: [
          { key: "learn_used", equals: "yes" },
          { key: "learn_work", equals: "some" },
        ],
      },
      {
        key: "learn_value",
        type: "single",
        label: "After using Learn, did it help you understand the topic better?",
        options: [
          { value: "no", label: "Not really" },
          { value: "little", label: "A little" },
          { value: "lot", label: "Yes, a lot" },
        ],
        visibleWhen: [{ key: "learn_used", equals: "yes" }],
      },
      {
        key: "learn_open",
        type: "longtext",
        label: "What helped you learn the most, or what would make Learn better?",
        placeholder: "Optional",
        visibleWhen: [{ key: "learn_used", equals: "yes" }],
      },
      {
        key: "learn_compare",
        type: "scale",
        label: "Compared to the old version, Learn feels…",
        capLow: "Much worse",
        capHigh: "Much better",
        visibleWhen: [{ key: "learn_used", equals: "yes" }],
      },
    ],
  },

  {
    id: "astra",
    title: "ASTRA",
    titleNote: "(the question helper)",
    questions: [
      {
        key: "astra_used",
        type: "single",
        label: "Did you use ASTRA to ask a question?",
        required: true,
        options: YES_NO,
      },
      {
        key: "astra_how",
        type: "multi",
        label: "How did you ask ASTRA your question?",
        options: [
          { value: "typed", label: "Typed it" },
          { value: "photo", label: "Uploaded a photo" },
          { value: "both", label: "Both" },
        ],
        visibleWhen: [{ key: "astra_used", equals: "yes" }],
      },
      {
        key: "astra_easy",
        type: "single",
        emoji: true,
        label: "How easy was it to ask ASTRA and get an answer?",
        options: FACES,
        visibleWhen: [{ key: "astra_used", equals: "yes" }],
      },
      {
        key: "astra_correct",
        type: "single",
        label: "When ASTRA answered your school question, was the answer helpful and correct?",
        options: [
          { value: "no", label: "Not really" },
          { value: "sometimes", label: "Sometimes" },
          { value: "yes", label: "Yes, usually" },
        ],
        visibleWhen: [{ key: "astra_used", equals: "yes" }],
      },
      {
        key: "astra_trust",
        type: "single",
        label: "Did you trust ASTRA's answers enough to use them?",
        options: [
          { value: "no", label: "No" },
          { value: "sometimes", label: "Sometimes" },
          { value: "yes", label: "Yes" },
        ],
        visibleWhen: [{ key: "astra_used", equals: "yes" }],
      },
      {
        key: "astra_offtopic",
        type: "single",
        layout: "col",
        label: "If you asked ASTRA something not about school, what did it do?",
        options: [
          { value: "answered", label: "It still tried to answer" },
          { value: "redirected", label: "It asked me to ask a school question instead" },
          { value: "nottried", label: "I didn't try this" },
        ],
        visibleWhen: [{ key: "astra_used", equals: "yes" }],
      },
      {
        key: "astra_open",
        type: "longtext",
        label:
          "Tell us about a time ASTRA helped you, or a time its answer seemed wrong or confusing.",
        placeholder: "Optional",
        visibleWhen: [{ key: "astra_used", equals: "yes" }],
      },
    ],
  },

  {
    id: "overall",
    title: "Last questions",
    questions: [
      {
        key: "overall_like",
        type: "scale",
        label: "Overall, how much did you like the new app?",
        capLow: "Didn't like it",
        capHigh: "Loved it",
      },
      {
        key: "overall_keep",
        type: "single",
        label: "Would you want to keep using this app?",
        required: true,
        options: [
          { value: "no", label: "No" },
          { value: "maybe", label: "Maybe" },
          { value: "yes", label: "Yes" },
        ],
      },
      {
        key: "overall_change",
        type: "longtext",
        label: "If you could change ONE thing about the app, what would it be?",
        placeholder: "Optional",
      },
      {
        key: "overall_else",
        type: "longtext",
        label: "Anything else you want to tell us?",
        placeholder: "Optional",
      },
    ],
  },
];

/** Flat list of every question, in submission order. */
export const ALL_QUESTIONS: Question[] = SECTIONS.flatMap((s) => s.questions);

/** Keys of "parent" questions — those whose answer gates at least one other
 *  question. These get no voice recorder (audio is only for leaf questions). */
export const PARENT_KEYS: ReadonlySet<string> = new Set(
  ALL_QUESTIONS.flatMap((q) => q.visibleWhen?.map((c) => c.key) ?? []),
);
