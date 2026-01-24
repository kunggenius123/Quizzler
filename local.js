import express from 'express';
import cors from 'cors';
import { pipeline } from '@xenova/transformers';

const app = express();

// Enable CORS for all routes
app.use(cors()); // <-- allows all origins
app.use(express.json()); // <-- parse JSON body

// Async wrapper for top-level await
async function startServer() {

    // Load AI model once
    const generator = await pipeline('text-generation', 'Xenova/distilgpt2');

    // POST route
    app.post('/api/mcq', async (req, res) => {
        const correct = req.body.choice;
        const prompt = `Generate 2 plausible wrong answers for: "${correct}"`;

        try {
            const result = await generator(prompt, { max_length: 50 });
            const text = result[0].generated_text.replace(correct, "");
            const wrongChoices = text.split(".").slice(0, 2).map(s => s.trim()).filter(Boolean);

            res.json(wrongChoices.length ? wrongChoices : [`${correct}1`, `${correct}2`]);
        } catch (e) {
            res.json([`${correct}1`, `${correct}2`]);
        }
    });

    // Start server
    app.listen(5000, () => console.log('AI server running on port 5000'));
}

// Run server
startServer();
