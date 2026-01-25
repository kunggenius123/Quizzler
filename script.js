import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';

import nlp from "https://cdn.jsdelivr.net/npm/compromise/+esm";

//import OpenAI from "openai";

// Reads the .env file, loads all the keys into the built-in process.env object

//require("dotenv").config();

/*const openAIClient = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY']
});*/

import { pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers/dist/transformers.min.js";



const checkFilename = "images/checkmark.png";
const xFilename = "images/x_mark.png";

const imageId = document.getElementById("image");
const textBoxId = document.getElementById("text-input");
const buttonId = document.getElementById("button-input");
const answerId = document.getElementById("answer");
const image2Id = document.getElementById("image2");
const counterId = document.getElementById("counter");

let pages = [];

let currentMode = "mcq";

let currentIndex = 0;
let counter = 0;

const mcqButtons = document.querySelectorAll(".choice");
for(let i = 0; i < mcqButtons.length; i++){
    mcqButtons[i].addEventListener("click", checkMCQ);
}

/*let randomIndex = Math.floor(Math.random() * images.length);

let image = images[randomIndex];

let imgName = image.name;

let filename = image.filename;*/

//imageId.style.height = "400px";

function stripText(text, includeSpace){

    if(!text) return "";

    // INCLUDE SPACE MAY BE USELESS IF NOT USED LATER
    if(includeSpace){
        return text.replaceAll(" ", "")
        .replaceAll(",", "")
        .replaceAll(".", "")
        .replaceAll("[", "")
        .replaceAll("]", "")
        .replaceAll("(", "")
        .replaceAll(")", "")
        .toLowerCase();
    }
    else{
        return text.replaceAll(",", "")
        .replaceAll(".", "")
        .replaceAll("[", "")
        .replaceAll("]", "")
        .replaceAll("(", "")
        .replaceAll(")", "")
        .toLowerCase();
    }
    
}

function loadMode(mode){
    currentMode = mode;
    const frq = document.getElementById("frq");
    const mcq = document.getElementById("mcq");

    if(mode == "frq"){
        frq.style.display="block";
        mcq.style.display="none";
    }
    else if(mode == "mcq"){
        frq.style.display="none";
        mcq.style.display="block";

        loadMCQ(pages[currentIndex]);
    }
}

let mcqAnsweredCorrect = false; 


function otherRandomPicture(currentPage, usedChoices = []){
    const others = pages.filter(page => currentPage !== page);

    if(!others.length) return null;
    
    let randomIndex = Math.floor(Math.random() * others.length);

    for(const choice of usedChoices){
        while(others[randomIndex].text === choice){
            randomIndex = Math.floor(Math.random() * others.length);
        }
    }

    return others[randomIndex].text;
}

function scrambleWord(choice){

    const words = choice.split(" ");
    const randomIndex = Math.floor(Math.random() * (words.length));

    words[randomIndex] = "";

    return words.join(" ");

}

function swapCategories(answer){
   
    

    const answerDocument = nlp(answer);

    const answerPeople = answerDocument.people().out('array');
    //const nouns = answerDocument.nouns().out('array');
    const answerTopics = answerDocument.nouns().out('array');

   
    let chosenAnswerTopic = answerTopics[Math.floor(Math.random() * (answerTopics.length))];
    let chosenAnswerPeople = answerPeople[Math.floor(Math.random() * (answerPeople.length))];

    let answerTopicWord = chosenAnswerTopic.split(" ")[Math.floor(Math.random() * (chosenAnswerTopic.length))];
    let answerPeopleWord = chosenAnswerPeople.split(" ")[Math.floor(Math.random() * (chosenAnswerPeople.length))];
    

    const otherPages = pages.filter(page => page !== answer);
    const incorrectPage = otherPages[Math.floor(Math.random() * (otherPages.length))];

    const incorrectPeople = answerDocument.people().out('array');
    const incorrectTopics = answerDocument.nouns().out('array');

    let chosenIncorrectTopic = incorrectTopics[Math.floor(Math.random() * (incorrectTopics.length))];
    let chosenIncorrectPeople = incorrectPeople[Math.floor(Math.random() * (incorrectPeople.length))];

    let incorrectTopicWord = chosenIncorrectTopic.split(" ")[Math.floor(Math.random() * (chosenIncorrectTopic.length))];
    let incorrectPeopleWord = chosenIncorrectPeople.split(" ")[Math.floor(Math.random() * (chosenIncorrectPeople.length))];
    

    let choice = answer.replaceAll(answerTopicWord, incorrectTopicWord).replaceAll(answerPeopleWord, incorrectPeopleWord);

    console.log("chosenAnswerTopic", chosenAnswerTopic);
    console.log("chosenIncorrectTopic", chosenIncorrectTopic);
    console.log("chosenAnswerPeople", chosenAnswerPeople);
    console.log("chosenIncorrectPeople", chosenIncorrectPeople);

    console.log("Choice", choice);

    return choice;

    /*

    const randomPage =

    document.people().forEach((name, i) => {

    });

    replaceAll(randomPage.people())*/
    
    
}

async function getAIChoices(correct){
    console.log(correct);
    /*if (!correct || correct.trim() === "") {
        // fallback if the page text is empty
        return ["Choice A", "Choice B"];
    }
    
    if(!generator) await initializeAI();

    const incorrect = [];
    for(let i = 0; i < 2; i++){
        let response = await generator(
            `Give one plausible wrong alternative for: "${correct}"`,
            { max_new_tokens: 10 }
        );
        let choice = response[0].generated_text.trim();
        console.log(choice);
        incorrect.push(choice);
    }
    return incorrect;*/

    const response = await fetch("http://127.0.0.1:5000/api/mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct })
    });

    return await response.json();
    
}

// Needs async to use await
async function loadMCQ(page){

    mcqAnsweredCorrect = false; 
    
    const answer = page.text;

    // Strict equality (===) checks for both value and object type
    



    let choices = [answer, answer, answer];

    let incorrectChoices;
    
    // Makes sure app doesn't crash when API call fails
    
    try{
        incorrectChoices = [swapCategories(answer), swapCategories(answer)];
    }
    catch(error){
        console.error("Generating incorrect choices failed, using fallback:", error);
        incorrectChoices = [scrambleWord(answer), otherRandomPicture(page, choices)];
    }



    // TODO: Create a random object between 0 and 1
    // If less than 1/4, make no choice from another picture
    // If less than 1/2, make one choice from another picture
    // If less than 3/4, make two choices from another picture
    // If less than 1, make all choices from another picture
    // For every choice from another picture, call a randomPicture() method, generates random index between 0 and (number of pictures - 1)

    let choiceFactor = Math.random() * 3;

    if(choiceFactor < 1){
        choices[1] = incorrectChoices[0];
        choices[2] = incorrectChoices[1];
    }
    else if(choiceFactor < 2){
        choices[1] = otherRandomPicture(page, choices);
        choices[2] = incorrectChoices[1]
    }
    else if(choiceFactor < 3){
        choices[1] = otherRandomPicture(page, choices);
        choices[2] = otherRandomPicture(page, choices);
    }
  


    for(let i = 0; i < choices.length; i++){
        
        let choice = choices[i];
        mcqButtons[i].textContent = choice;

        if(stripText(choice, true) === stripText(answer, true)){

            // Creates an attribute "correct" in the data of the button, sets it to true
            mcqButtons[i].dataset.correct = "true";
        }
        else{
            mcqButtons[i].dataset.correct = "false";
        }
        
    } 
    
} 

// Event listener automatically passes in event parameter
function checkMCQ(event){
    
    const button = event.currentTarget;

    if(button.dataset.correct === "true"){
        image2Id.src=checkFilename;
        image2Id.style.opacity=100;
        counter++;

        if(!mcqAnsweredCorrect){
            counterId.textContent=`Correct: ${counter}`;
            answerId.textContent = "";
        }

        mcqAnsweredCorrect = true; 
    }
    else{
        console.log("X");
        image2Id.src=xFilename;
        image2Id.style.opacity=100;
        
    }
    
    
} 

function checkFRQ(){
    
    let name = pages[currentIndex].text

    let strippedName = stripText(name, true);

    let input = stripText(textBoxId.value, true);
    
    if(input === strippedName){
        console.log("Check");
        image2Id.src=checkFilename;
        image2Id.style.opacity=100;
        counter++;
        counterId.textContent=`Correct: ${counter}`;
        answerId.textContent = "";

    }
    else{
        console.log("X");
        image2Id.src=xFilename;
        image2Id.style.opacity=100;
        answerId.textContent = name;
    }

    
} 

function nextImage(){

    textBoxId.value = "";
    answerId.textContent = "";
    image2Id.style.opacity=0;

    if (!pages.length) return;

    if(currentIndex >= pages.length - 1){
        currentIndex = 0;
    }
    else{
        currentIndex++;
    }

    let page = pages[currentIndex]
    let pageImages = page.images;

    if (!pageImages.length) return;
    
    imageId.src = pageImages[0];

    if(currentMode === "mcq"){
        loadMCQ(page);
    }
   
}

async function extractPdfContent(pdf){
    const totalPages = pdf.numPages;
    //const pageTexts = [];
    let pages = [];
    

    for(let pageNum = 1; pageNum < totalPages; pageNum++){
        let page = await pdf.getPage(pageNum);

        let textContent = await page.getTextContent();


        // textContent.items is a list of small text chunks on the page like: [ {str: "Hello"}, {str: " "}, {str: "world"}, ... ]
        // This joins the text chunks together to get the full page text
        let pageText = textContent.items.map(item => item.str).join("");

        const operatorList = await page.getOperatorList();

        let images = [];

        for(let i = 0; i < operatorList.fnArray.length; i++){

            // The current drawing operation
            let fn = operatorList.fnArray[i];

            // Data needed for the drawing operation
            let args = operatorList.argsArray[i];

            // Check for JPEG and other image types
            if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintJpegXObject) {

                // args[0] is the image name
                let imgObject = page.objs.get(args[0]);

     
                
                // If no valid image object, skip to next for loop iteration
                if(!imgObject) continue;

                /*let imgData;

                if (imgObject instanceof ImageData) {
                    imgData = imgObject;
                } else {
                    imgData = new ImageData(imgObject.data, imgObject.width, imgObject.height);
                }*/

                if(imgObject.bitmap instanceof ImageBitmap){
                    let canvas = document.createElement('canvas');

                    // 2D drawing context of the canvas, draws on the canvas
                    let canvasContext = canvas.getContext('2d');

                    canvas.width = imgObject.bitmap.width;
                    canvas.height = imgObject.bitmap.height;

                    // Position (0, 0)
                    canvasContext.drawImage(imgObject.bitmap, 0, 0);
                    
                    let dataUrl = canvas.toDataURL('image/png');

                    images.push(dataUrl);
                }

                /*
                let canvas = document.createElement('canvas');

                // 2D drawing context of the canvas, draws on the canvas
                let canvasContext = canvas.getContext('2d');

                canvas.width = imgData.width;
                canvas.height = imgData.height;

                // Position (0, 0)
                canvasContext.putImageData(imgData, 0, 0);
                
                let dataUrl = canvas.toDataURL('image/png');

                images.push(dataUrl);*/

            }

        }

        pages.push({text: pageText, images});

    }

    
   
    return pages;
}

function randomImage(array){
    currentIndex = Math.floor(Math.random() * array.length);

    return array[currentIndex].images[0];


}

async function openFile(){
    let [firstHandle] = await window.showOpenFilePicker();
    let file = await firstHandle.getFile();
    //let text = await file.text();

    // arrayBuffer gets raw bytes of File object 
    let arrayBuffer = await file.arrayBuffer();

    // {data: } is to indicate we are passing raw bytes into the method instead of a URL 
    let pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;

    pages = await extractPdfContent(pdf);

    console.log(pages);

    imageId.src = randomImage(pages);

    loadMode("mcq");
    
}

// These functions are not global so we have to attach them to window (the object for the whole page) 
// They're not global it is type "module" according to the html script
window.checkFRQ = checkFRQ;
window.nextImage  = nextImage;
window.openFile   = openFile;
window.loadMode = loadMode;