import test from "node:test";
import assert from "node:assert/strict";
import {
    buildMCQ,
    chooseNextQuestion,
    getCorrectAnswer,
    stripText
} from "./tableQuiz.ts";

function makeQuizItem(id, topic, rightAnswer = topic, wrongAnswers = []) {
    return {
        id,
        question: `Question about ${topic}`,
        topic,
        rightAnswers: [rightAnswer],
        wrongAnswers,
        img: null,
        type: "notes"
    };
}

test("stripText normalizes case and punctuation", () => {
    assert.equal(stripText(" TreeMap, Inc. ", true), "treemapinc");
});

test("getCorrectAnswer returns the first trimmed right answer", () => {
    const item = makeQuizItem("q1", "TreeMap", "  TreeMap  ");
    assert.equal(getCorrectAnswer(item), "TreeMap");
});

test("buildMCQ includes the answer and no more than two distractors", () => {
    const item = makeQuizItem(
        "q1",
        "TreeMap",
        "TreeMap",
        ["HashMap", "LinkedHashMap", "Map"]
    );

    const result = buildMCQ(item);

    assert.equal(result.answer, "TreeMap");
    assert.equal(result.choices.length, 3);
    assert.deepEqual(
        new Set(result.choices),
        new Set(["TreeMap", "HashMap", "LinkedHashMap"])
    );
    assert.equal(result.choices[result.answerIndex], "TreeMap");
});

test("buildMCQ does not duplicate the correct answer", () => {
    const item = makeQuizItem(
        "q1",
        "TreeMap",
        "TreeMap",
        ["TreeMap", "HashMap"]
    );

    const result = buildMCQ(item);

    assert.equal(result.choices.filter(choice => choice === "TreeMap").length, 1);
});

test("chooseNextQuestion selects a question from the lowest-level topic", () => {
    const items = [
        makeQuizItem("q1", "HashMap"),
        makeQuizItem("q2", "TreeMap"),
        makeQuizItem("q3", "LinkedHashMap")
    ];

    const next = chooseNextQuestion(
        items,
        { HashMap: 3, TreeMap: 1, LinkedHashMap: 2 },
        "q1"
    );

    assert.equal(next?.id, "q2");
});

test("chooseNextQuestion does not immediately repeat the current question", () => {
    const items = [
        makeQuizItem("q1", "HashMap"),
        makeQuizItem("q2", "TreeMap")
    ];

    const next = chooseNextQuestion(
        items,
        { HashMap: 1, TreeMap: 5 },
        "q1"
    );

    assert.equal(next?.id, "q2");
});

test("chooseNextQuestion treats a missing knowledge level as 1", () => {
    const items = [
        makeQuizItem("q1", "HashMap"),
        makeQuizItem("q2", "TreeMap"),
        makeQuizItem("q3", "LinkedHashMap")
    ];

    const next = chooseNextQuestion(
        items,
        { HashMap: 3, TreeMap: 2 },
        "q1"
    );

    assert.equal(next?.id, "q3");
});

test("chooseNextQuestion chooses only among tied lowest-level topics", () => {
    const items = [
        makeQuizItem("q1", "HashMap"),
        makeQuizItem("q2", "TreeMap"),
        makeQuizItem("q3", "LinkedHashMap"),
        makeQuizItem("q4", "Map")
    ];

    const next = chooseNextQuestion(
        items,
        { HashMap: 5, TreeMap: 1, LinkedHashMap: 1, Map: 3 },
        "q1"
    );

    assert.equal(["q2", "q3"].includes(next?.id), true);
});

test("chooseNextQuestion reuses the only question in a one-question quiz", () => {
    const item = makeQuizItem("q1", "HashMap");
    assert.equal(chooseNextQuestion([item], { HashMap: 1 }, "q1"), item);
});

test("chooseNextQuestion returns undefined for an empty quiz", () => {
    assert.equal(chooseNextQuestion([], {}, "missing"), undefined);
});
