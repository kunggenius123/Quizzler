import OpenAI from "openai";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { z } from "zod";

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

const TableRowsSchema = z.array(z.object({
    // Converts value to target type before checking
    row: z.coerce.number(),
    terms: z.record(z.string(), z.coerce.string())
}));

const NotesItemsSchema = z.array(z.object({
    question: z.string(),
    answer: z.string(),
    category: z.string().optional()
}));

// Sends correct answer to server and recieves incorrect choices
app.post("/api/mcq", async(request, response) => {

    console.log("Request received:", request.body);

    const correct = request.body.correct;
    
    const prompt = `You are generating multiple incorrect choices for a quiz. Correct label: "${correct}". 
    Generate exactly 2 plausible but incorrect alternatives from the same subject matter and of the same type as the correct answer. 
    Return them as two lines, no numbering, no extra text.`
    
    // Trying to use OpenAI, makes sure app doesn't crash when API call fails
    try{
        const chatCompletion = await client.chat.completions.create({
            model : "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }]
        })

        const text = chatCompletion.choices[0].message.content;

        console.log(text);

        const choices = text
        .split("\n")

        response.json(choices);
    }
    catch(error){
        console.error("AI failed, using fallback:", error);
        response.status(500).json([]);
    }

});

app.post("/api/parseTable", async(request, response) => {
    console.log("parseTable request received");

    try{

        const base64 = request.body.base64;

        const openCV_response = await fetch(`${FLASK_URL}/api/extractCells`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64: base64 })
        });

        const imageCells = await openCV_response.json();

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
                        text: `Analyze this table. For each row return the text terms paired with their column headers.
    
                        Return ONLY a raw JSON array. No markdown, no code blocks. Start with [ end with ]:
                        [
                            {
                                "row": 0,
                                "terms": {
                                    "header_name": "cell value"
                                }
                            }
                        ]`
                    }
                ]
            }],
            max_tokens: 1000
        });
        
        const raw = chatCompletion.choices[0].message.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

        const rows = TableRowsSchema.parse(JSON.parse(raw));

        console.log("GPT response:", rows);
        
        console.log("OpenCV image cells:", imageCells.map(c => ({
            clean_row: c.clean_row,
            raw_row: c.raw_row,
            col: c.col,
            imageLength: c.image?.length
        })));
        
        for (const row of rows) {

            // Gets images row by row, filter compares row numbers
            const images = imageCells.filter(cell => Number(cell.clean_row) === Number(row.row));

            // Sorts images from left to right
            // Takes the image crop given by extract_cells, attaches it to the corresponding row
            row.images = images
                .sort((a, b) => Number(a.col) - Number(b.col))
                .map(cell => ({ data: cell.image }));

            console.log(`GPT row ${row.row} got ${row.images.length} images`);
        }

        response.json(rows);
    }
    catch(error){
        console.error("parseTable failed:", error);
        response.status(500).json([]);
    }
});

app.post("/api/parseNotes", async(request, response) => {
    try{
        
        const notes = request.body.notes;
        const prompt = `
                        Convert these study notes accurately into quiz items.

                        Return ONLY a raw JSON array. No markdown, no code blocks.

                        Each item should have this structure:
                        [
                        {
                            "question": "question text",
                            "answer": "answer text",
                            "category": "topic or term"
                        }
                        ]

                        Rules:
                        - Make clear study questions, no duplicates.
                        - Answers should be short.
                        - Generate 5 to 10 items if possible.
                        - Do not invent facts unsupported by the notes.

                        Notes:
                        ${notes}
                        `;

        const chatCompletion = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1000
        });

        const raw = chatCompletion.choices[0].message.content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

        const quizItems = NotesItemsSchema.parse(JSON.parse(raw));
        response.json(quizItems);

    }
    catch(error){
        console.error("parseNotes failed:", error);
        response.status(500).json([]);
    }
})

const port = Number(process.env.PORT) || 5050;

// Express app starts running, listens for requests on the port
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})
