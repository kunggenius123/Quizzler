
import OpenAI from "openai";
import { Jimp } from "jimp";
import dotenv from "dotenv";

dotenv.config({ path: "/Users/ryandeng/Desktop/Ryan_code/Quizzler/src/.env" });

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function parseTable(base64){

    // Image -> raw bytes -> base64 text
    //const encoded_img = fs.readFileSync(base64).toString("base64");

    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
            role: "user",
            content: [
                {
                    type: "image_url",
                    image_url: { url: `data:image/png;base64,${base64}` }
                },
                {
                    type: "text",
                    text: `Analyze this table. 

                    For each row containing images, 
                    return the exact pixel coordinates of each image's bounding box and pair them with the corresponding text terms in the same row.

                    Return ONLY this JSON structure, no markdown, no explanation:
                    [
                        {
                            "row": 0,
                            "images": [
                                { "x1": 0, "y1": 0, "x2": 0, "y2": 0 }
                            ],
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

    const data = JSON.parse(response.choices[0].message.content);

    for(let row of data){
        for(let image of row.images){

            let buffer = Buffer.from(base64, "base64");

            let cropped_img = await Jimp.read(buffer);

            /* 
                Replaces coordinates with raw image data
                Waits for the promise to finish
            */
            image.data = (await cropped_img
                .crop(image.x1, image.y1, image.x2 - image.x1, image.y2 - image.y1)
                .getBuffer("image/png")).toString("base64");

        }
    }

    console.log(data);

    return data;
}

