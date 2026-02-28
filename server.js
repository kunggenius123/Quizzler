import OpenAI from "openai";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";

console.log("Test run");

dotenv.config();

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

console.log("API Key:", process.env.OPENAI_API_KEY);

const app = express();

app.options("/api/mcq", cors());



app.use(cors({
    origin: 'http://127.0.0.1:5500',
    credentials: true
}));

// Parses incoming JSON requests into JS objects stored in request.body
app.use(express.json());

// Sends correct answer to server and recieves incorrect choices
app.post("/api/mcq", async(request, response) => {

    console.log("Request received:", request.body);

    const correct = request.body.correct;
    
    const prompt = `You are generating multiple incorrect choices for a quiz. Correct label: "${correct}". Generate 2 plausible but incorrect options for the details of an artwork. Return them as two lines, no numbering, no extra text.`
    
    // Trying to use OpenAI, makes sure app doesn't crash when API call fails
    try{
        const chatCompletion = await client.chat.completions.create({
            model : "gpt-4o",
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

})

const port = 5000;

// Express app starts running, listens for requests on the port
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})

