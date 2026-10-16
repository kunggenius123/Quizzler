import { z } from "zod";

const NonEmptyString = z.string().trim().min(1);

export const MIN_KNOWLEDGE_LEVEL = 1;
export const MAX_KNOWLEDGE_LEVEL = 5;

export const QuizQuestionSchema = z.object({
    id: NonEmptyString,
    question: NonEmptyString,
    topic: NonEmptyString,
    rightAnswers: z.array(NonEmptyString).min(1),
    wrongAnswers: z.array(NonEmptyString),

    // Notes Questions - null;
    // Table Questions - contain a base64 PNG string
    img: z.string().trim().min(1).nullable()
});

export const QuizPayloadSchema = z.object({
    quizId: NonEmptyString,
    sourceType: z.enum(["notes", "table"]),
    knowledge_levels: z.record(z.string(), z.number().int()),
    questions: z.array(QuizQuestionSchema).min(1)
});

// The client submits the selected answer; the server should calculate whether
// it is correct from the stored QuizQuestion rather than trusting a boolean.
export const AnswerSubmissionSchema = z.object({
    quizId: NonEmptyString,
    questionId: NonEmptyString,
    selectedAnswer: NonEmptyString
});

export function createInitialKnowledgeLevels(questions, initialLevel = 1) {
    const levels = {};

    for (const question of questions) {
        if (!(question.topic in levels)) {
            levels[question.topic] = initialLevel;
        }
    }

    return levels;
}

export function updateKnowledgeLevel(currentLevel, correct) {
    return correct
        ? Math.min(MAX_KNOWLEDGE_LEVEL, currentLevel + 1)
        : Math.max(MIN_KNOWLEDGE_LEVEL, currentLevel - 1);
}

export function isAnswerCorrect(rightAnswers, selectedAnswer) {
    const normalizedSelection = selectedAnswer.trim().toLowerCase();

    return rightAnswers.some(
        rightAnswer => rightAnswer.trim().toLowerCase() === normalizedSelection
    );
}
