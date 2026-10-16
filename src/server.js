import OpenAI from "openai";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
    AnswerSubmissionSchema,
    QuizPayloadSchema,
    
    createInitialKnowledgeLevels
} from "./server/quizSchema.js";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const FLASK_URL = process.env.FLASK_URL || "http://127.0.0.1:5051";

const app = express();

app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5173"
    ],
    credentials: true
}));

// Parses incoming JSON requests into JS objects stored in request.body
app.use(express.json({ limit: "10mb" }));

const TableQuestionItemsSchema = z.array(z.object({
    
    // Used only while matching GPT's row to Flask/OpenCV's image crop.
    row: z.coerce.number(),
    question: z.string().trim().min(1),
    topic: z.string().trim().min(1),
    rightAnswers: z.array(z.string().trim().min(1)).min(1),
    wrongAnswers: z.array(z.string().trim().min(1))
}));

const NotesItemsSchema = z.array(z.object({
    question: z.string().trim().min(1),
    topic: z.string().trim().min(1),
    rightAnswers: z.array(z.string().trim().min(1)).min(1),
    wrongAnswers: z.array(z.string().trim().min(1))
}));

const MIN_KNOWLEDGE_LEVEL = 1;
const MAX_KNOWLEDGE_LEVEL = 5;

const quizzes = new Map();

app.post("/api/parseTable", async(request, response) => {
    console.log("parseTable request received");

    try{

        const base64 = z.string().min(1).parse(request.body.base64);

        const openCV_response = await fetch(`${FLASK_URL}/api/extractCells`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64: base64 })
        });

        if (!openCV_response.ok) {
            throw new Error(`Cell extraction failed with status ${openCV_response.status}`);
        }

        const imageCells = await openCV_response.json();
        const imageRows = [...new Set(
            imageCells.map(cell => Number(cell.clean_row))
        )].sort((a, b) => a - b);

        const chatCompletion = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: { url: `data:image/png;base64,${base64}` }
                    },
                    {
                        type: "text",
                        text: `Analyze this table and create one quiz item for each image row.

                        Use only these image row numbers: ${imageRows.join(", ")}.

                        Return ONLY a raw JSON array. No markdown, no code blocks:
                        [
                            {
                                "row": 0,
                                "question": "question text",
                                "topic": "specific topic or concept",
                                "rightAnswers": ["correct answer"],
                                "wrongAnswers": ["plausible wrong answer", "another plausible wrong answer"]
                            }
                        ]`
                    }
                ]
            }],
            max_tokens: 1000
        });
        
        const content = chatCompletion.choices[0].message.content;

        if (!content) {
            throw new Error("OpenAI returned an empty table response");
        }

        const raw = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

        const generatedItems = TableQuestionItemsSchema.parse(JSON.parse(raw));

        console.log("GPT table questions:", generatedItems);
        
        console.log("OpenCV image cells:", imageCells.map(c => ({
            clean_row: c.clean_row,
            raw_row: c.raw_row,
            col: c.col,
            imageLength: c.image?.length
        })));
        
        const quizId = `table-${randomUUID()}`;

        // flatMap transforms each item and flattens one level of the array in case it's nested
        const questions = generatedItems.flatMap((item, index) => {

            // GPT's row number is matched to the cleaned row number from Flask.
            const imageCell = imageCells
                .filter(cell => Number(cell.clean_row) === Number(item.row))
                .sort((a, b) => Number(a.col) - Number(b.col))[0];

            if (!imageCell?.image) {
                console.warn(`Skipping table row ${item.row}: no image crop matched`);
                return [];
            }

            return [{
                id: `${quizId}-q${index + 1}`,
                question: item.question,
                topic: item.topic,
                rightAnswers: item.rightAnswers,
                wrongAnswers: item.wrongAnswers,
                img: imageCell.image
            }];
        });

        const payload = QuizPayloadSchema.parse({
            quizId,
            sourceType: "table",
            knowledge_levels: createInitialKnowledgeLevels(questions),
            questions
        });

        quizzes.set(payload.quizId, payload);

        response.json(payload);
    }
    catch(error){
        console.error("parseTable failed:", error);
        response.status(500).json([]);
    }
});

app.post("/api/parseNotes", async(request, response) => {
    console.log("parseNotes request received");
    try{
        
        const notes = z.string().trim().min(1).parse(request.body.notes);
        const prompt = `
                        Convert these study notes accurately into quiz items.

                        Return ONLY a raw JSON array. No markdown, no code blocks.

                        Each item should have this structure:
                        [
                            {
                                "question": "question text",
                                "topic": "specific topic or concept",
                                "rightAnswers": ["correct answer"],
                                "wrongAnswers": ["plausible wrong answer", "another plausible wrong answer"]
                            }
                        ]

                        Rules:
                            - Generate 5–10 unique, clear questions when supported.
                            - Assign each question one specific, consistently named main-concept topic and one unambiguous correct concept.
                            - Use only facts stated in the notes; omit uncertain, ambiguous, or unsupported items.
                            - Preserve each fact’s qualifiers, conditions, relationships, and scope; rightAnswers must match or directly paraphrase it. Do not infer, generalize, reverse, or correct.
                            - Include at least one concise right answer and up to two plausible distractors when supported; distractors must be wrong for that question.
                            - Return only question, topic, rightAnswers, and wrongAnswers; do not generate IDs.
                        
                        Notes:
                        ${notes}
                        `;

        const chatCompletion = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1000
        });



        const content = chatCompletion.choices[0].message.content;

        if (!content) {
            throw new Error("OpenAI returned an empty notes response");
        }

        const raw = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

        const generatedItems = NotesItemsSchema.parse(JSON.parse(raw));

        console.log("GPT notes questions:", generatedItems);

        // Creates a random unique ID for the quiz
        const quizId = `note-${randomUUID()}`;

        const questions = generatedItems.map((item, index) => ({
            // Creates a question ID by attaching an index to the quiz ID
            id: `${quizId}-q${index + 1}`,
            ...item,
            img: null
        }));

        const payload = QuizPayloadSchema.parse({
            quizId,
            sourceType: "notes",
            knowledge_levels: createInitialKnowledgeLevels(questions),
            questions
        });

        quizzes.set(payload.quizId, payload);

        response.json(payload);
        

    }
    catch(error){
        console.error("parseNotes failed:", error);
        response.status(500).json([]);
    }
})

app.post("/api/answers", async(request, response) => {
    try{
        const answer = AnswerSubmissionSchema.parse(request.body);
        
        const quiz = quizzes.get(answer.quizId);
        if(!quiz){
            return response.status(404).json({
                error: "Quiz not found"
            })
        }

        const question = quiz.questions.find(
            question => question.id === answer.questionId
        );

        if (!question) {
            return response.status(404).json({
                error: "Question not found"
            });
        }

        // Boolean checking if the user's answer matches at least one of the acceptable answers
        const correct = question.rightAnswers.some(
            rightAnswer =>
            rightAnswer.trim().toLowerCase() === answer.selectedAnswer.trim().toLowerCase()
        );

        // If knowledge level missing set it to 1
        const currentLevel = quiz.knowledge_levels[question.topic] ?? 1;

        /* If correct, knowledge level increments
           If incorrect, knowledge level decrements 
           Math.max() prevents level from going below 1, Math.min() prevents level from exceeding 5
        */
        quiz.knowledge_levels[question.topic] = correct
            ? Math.min(MAX_KNOWLEDGE_LEVEL, currentLevel + 1)
            : Math.max(MIN_KNOWLEDGE_LEVEL, currentLevel - 1);

        response.json({
            quizId: answer.quizId,
            questionId: answer.questionId,
            correct,
            knowledge_level: quiz.knowledge_levels[question.topic],
            knowledge_levels: quiz.knowledge_levels
        });

      

    }
    catch(error){
        console.error("Answer submission failed:", error);
        response.status(400).json({
            error: "Invalid answer submission"
        });
    }
})

const port = Number(process.env.PORT) || 5050;

// Express app starts running, listens for requests on the port
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})
