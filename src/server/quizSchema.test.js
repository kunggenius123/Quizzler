import test from "node:test";
import assert from "node:assert/strict";
import {
    AnswerSubmissionSchema,
    QuizPayloadSchema,
    createInitialKnowledgeLevels,
    isAnswerCorrect,
    updateKnowledgeLevel
} from "./quizSchema.js";

test("knowledge levels start at 1 for each unique topic", () => {
    const questions = [
        { topic: "HashMap" },
        { topic: "TreeMap" },
        { topic: "HashMap" }
    ];

    assert.deepEqual(createInitialKnowledgeLevels(questions), {
        HashMap: 1,
        TreeMap: 1
    });
});

test("an empty question list creates no knowledge levels", () => {
    assert.deepEqual(createInitialKnowledgeLevels([]), {});
});

test("knowledge levels can use a specified starting level", () => {
    assert.deepEqual(
        createInitialKnowledgeLevels([{ topic: "Arrays" }], 2),
        { Arrays: 2 }
    );
});

test("a correct answer increases the knowledge level", () => {
    assert.equal(updateKnowledgeLevel(3, true), 4);
});

test("the knowledge level cannot exceed 5", () => {
    assert.equal(updateKnowledgeLevel(5, true), 5);
});

test("an incorrect answer decreases the knowledge level", () => {
    assert.equal(updateKnowledgeLevel(3, false), 2);
});

test("the knowledge level cannot go below 1", () => {
    assert.equal(updateKnowledgeLevel(1, false), 1);
});

test("answer checking ignores surrounding spaces and letter case", () => {
    assert.equal(isAnswerCorrect(["TreeMap"], "  treemap  "), true);
});

test("answer checking accepts any listed right answer", () => {
    assert.equal(
        isAnswerCorrect(["Binary Search Tree", "BST"], "bst"),
        true
    );
});

test("answer checking rejects an answer that is not listed", () => {
    assert.equal(isAnswerCorrect(["TreeMap"], "HashMap"), false);
});

test("the answer submission schema accepts the required fields", () => {
    const submission = {
        quizId: "quiz-1",
        questionId: "quiz-1-q1",
        selectedAnswer: "TreeMap"
    };

    assert.deepEqual(AnswerSubmissionSchema.parse(submission), submission);
});

test("the answer submission schema rejects an empty selected answer", () => {
    const result = AnswerSubmissionSchema.safeParse({
        quizId: "quiz-1",
        questionId: "quiz-1-q1",
        selectedAnswer: "   "
    });

    assert.equal(result.success, false);
});

test("the quiz payload schema accepts a valid notes quiz", () => {
    const payload = {
        quizId: "note-1",
        sourceType: "notes",
        knowledge_levels: { TreeMap: 1 },
        questions: [{
            id: "note-1-q1",
            question: "Which map stores sorted keys?",
            topic: "TreeMap",
            rightAnswers: ["TreeMap"],
            wrongAnswers: ["HashMap", "LinkedHashMap"],
            img: null
        }]
    };

    assert.deepEqual(QuizPayloadSchema.parse(payload), payload);
});

test("the quiz payload schema rejects a question with no right answer", () => {
    const result = QuizPayloadSchema.safeParse({
        quizId: "note-1",
        sourceType: "notes",
        knowledge_levels: { TreeMap: 1 },
        questions: [{
            id: "note-1-q1",
            question: "Which map stores sorted keys?",
            topic: "TreeMap",
            rightAnswers: [],
            wrongAnswers: ["HashMap", "LinkedHashMap"],
            img: null
        }]
    });

    assert.equal(result.success, false);
});
