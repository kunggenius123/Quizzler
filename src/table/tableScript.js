
//import nlp from "https://cdn.jsdelivr.net/npm/compromise/+esm";

//import { cat } from "@xenova/transformers";
import { buildMCQ, stripText } from "./tableQuiz.js";
//import { parseTable } from "./tableExtraction.js";

const homePageId = document.getElementById("home-page");
const quizPageId = document.getElementById("quiz-page");

const checkFilename = "images/checkmark.png";
const xFilename = "images/x_mark.png";

const imageId = document.getElementById("image");
const imageLoadingOverlayId = document.getElementById("image-loading-overlay");

const textBoxId = document.getElementById("text-input");
const frqButtonId = document.getElementById("button-input");
const frqQuestionId = document.getElementById("frq-question");
const questionDisplayId = document.getElementById("question-display");

const answerId = document.getElementById("answer");
const checkMarkImgId = document.getElementById("checkMarkImg");
const counterId = document.getElementById("counter");


let table = [];
let quizItems = [];

let quizLoading = false;

let currentMode = "mcq";

let currentTerm = null;

let randomImageIndex = 0;
let currentQuestionIndex = 0;

let counter = 0;

const mcqButtons = document.querySelectorAll(".choice");
for(let i = 0; i < mcqButtons.length; i++){
    mcqButtons[i].addEventListener("click", checkMCQ);
}

const frqDiv = document.getElementById("frq");
const mcqDiv = document.getElementById("mcq");


function showHome(){
    table = [];
    currentTerm = null;
    randomImageIndex = 0;
    counter = 0;

    imageId.src = "";
    counterId.textContent = "Correct: ";

    mcqDiv.style.display = "none";
    frqDiv.style.display = "none";

    answerId.textContent = "";
    textBoxId.value = "";
    checkMarkImgId.style.visibility = "hidden";

    homePageId.style.display = "flex";
    quizPageId.style.display = "none";

    console.log("Returned home");
}

function loadMode(mode){

    console.log("loadMode clicked:", mode);
    console.log("table length:", table.length);

    currentMode = mode;

    if(!table.length){
        console.log("No table loaded yet");
        return;
    }
    if(mode == "frq"){
        console.log("Switching to FRQ");
        
        if (currentTerm) {
            frqQuestionId.textContent = `What is the ${currentTerm}?`;
        }
        
        frqDiv.style.display="inline-block";
        mcqDiv.style.display="none";
        
    }
    else if(mode == "mcq"){
        console.log("Switching to MCQ");

        frqDiv.style.display="none";
        mcqDiv.style.display="flex";

        loadMCQ(table[randomImageIndex]);
    }
}

let mcqAnsweredCorrect = false; 

// Needs async to use await
async function loadMCQ(row){

    mcqAnsweredCorrect = false; 
    
    // Clears previous mcq button state
    for (let button of mcqButtons) {
        button.disabled = true;
        button.textContent = "Loading...";
        button.classList.add("choice-loading");
        button.dataset.correct = "false";
        button.style.backgroundColor = "";
        button.style.color = "";
    }
    
    const mcq = await buildMCQ(row, table, currentTerm);

    console.log("Choices: ", mcq.choices);

    for(let i = 0; i < mcqButtons.length; i++){
        
        mcqButtons[i].textContent = mcq.choices[i];
        mcqButtons[i].classList.remove("choice-loading");

        // Strict equality (===) checks for both value and object type
        if(i === mcq.answerIndex){

            // Creates an attribute "correct" in the data of the button, sets it to true
            mcqButtons[i].dataset.correct = "true";
        }
        else{
            mcqButtons[i].dataset.correct = "false";
        }
        
        mcqButtons[i].disabled = false;
    } 

} 

async function loadNotesMCQ(quizItem){
    
    // Clears previous mcq button state
    for (let button of mcqButtons) {
        button.disabled = true;
        button.textContent = "Loading...";
        button.classList.add("choice-loading");
        button.dataset.correct = "false";
        button.style.backgroundColor = "";
        button.style.color = "";
    }
    
    const mcq = await buildMCQ(quizItem, table, currentTerm);

    for(let i = 0; i < mcqButtons.length; i++){
        
        mcqButtons[i].textContent = mcq.choices[i];
        mcqButtons[i].classList.remove("choice-loading");

        // Strict equality (===) checks for both value and object type
        if(i === mcq.answerIndex){

            // Creates an attribute "correct" in the data of the button, sets it to true
            mcqButtons[i].dataset.correct = "true";
        }
        else{
            mcqButtons[i].dataset.correct = "false";
        }
        
        mcqButtons[i].disabled = false;
    } 

} 

// Event listener automatically passes in event parameter
function checkMCQ(event){

    console.log("Button Clicked: ", event.currentTarget.textContent);
    
    const button = event.currentTarget;

    if(button.dataset.correct === "true"){
        
        console.log("Correct:", button.textContent);

        if(!mcqAnsweredCorrect){
            counter++;
            counterId.textContent=`Correct: ${counter}`;
            answerId.textContent = "";
            
            mcqAnsweredCorrect = true; 

            
        }

        checkMarkImgId.src=checkFilename;
        
    }
    else{

        checkMarkImgId.src=xFilename;
        
    }

    checkMarkImgId.style.visibility = "visible";

    mcqButtons.forEach(button => {
        button.disabled = true;
        if(button.dataset.correct === "true"){
            button.style.backgroundColor = "white";
            button.style.color = "black";
        }
    })
    
} 

function checkFRQ(){
    
    let name = table[randomImageIndex].terms[currentTerm];

    let strippedName = stripText(name, true);

    let input = stripText(textBoxId.value, true);
    
    if(input === strippedName){
        console.log("Check");
        checkMarkImgId.src=checkFilename;
        //checkMarkImgId.style.display = "block";
        checkMarkImgId.style.visibility = "visible";
        counter++;
        counterId.textContent=`Correct: ${counter}`;
        answerId.textContent = "";

    }
    else{
        console.log("X");
        checkMarkImgId.src=xFilename;
        //checkMarkImgId.style.display = "block";
        checkMarkImgId.style.visibility = "visible";
        answerId.textContent = name;
    }

    frqButtonId.disabled=true;
    
} 

function randomImage(array){
    randomImageIndex = Math.floor(Math.random() * array.length);

    return array[randomImageIndex].images[0].data;

}

function randomTerm(row){

    // Gets category names of terms
    // Goes through each term and filters out empty ones
    const terms = Object.keys(row.terms).filter(term => row.terms[term].trim() !== "");
    
    if (!terms.length) {
        console.error("No valid terms found for row:", row);
        currentTerm = null;
        return;
    }

    const randomTermIndex = Math.floor(Math.random() * terms.length);
    currentTerm = terms[randomTermIndex];

    console.log("Selected term:", currentTerm, "=", row.terms[currentTerm]);
}

function nextImage(){

    textBoxId.value = "";
    answerId.textContent = "";
    checkMarkImgId.style.visibility = "hidden";

    if (!table.length) return;
  
    if(randomImageIndex >= table.length - 1){
        randomImageIndex = 0;
    }
    else{
        randomImageIndex++;
    }

    let row = table[randomImageIndex]
    let rowImages = row.images;

    randomTerm(row);
    frqQuestionId.textContent = `What is the ${currentTerm}?`;

    if (!rowImages.length) return;
    
    imageId.src = `data:image/png;base64,${rowImages[0].data}`;

    if(currentMode === "mcq"){
        loadMCQ(row);
    }

    mcqButtons.forEach(button => {
        button.disabled = false;
        button.style.backgroundColor = "";
        button.style.color = "";
       
    });

    frqButtonId.disabled=false;
}

function nextQuestion(){

    textBoxId.value = "";
    answerId.textContent = "";
    checkMarkImgId.style.visibility = "hidden";

    if (!quizItems.length) return;
  
    if(currentQuestionIndex >= quizItems.length - 1){
        currentQuestionIndex = 0;
    }
    else{
        currentQuestionIndex++;
    }

    const quizItem = quizItems[currentQuestionIndex];

    imageId.style.display = "none";
    questionDisplayId.style.display = "flex";
    questionDisplayId.textContent = item.question;

    frqQuestionId.textContent = "Answer:";

    if(currentMode === "mcq"){
        loadNotesMCQ(quizItem);
    }

    frqButtonId.disabled=false;
}

export async function openImage() {
    try{
        const [fileHandle] = await window.showOpenFilePicker();
        
        const file = await fileHandle.getFile();

        if(!file.type.startsWith("image/")){
            throw new Error("File is not an image");
        }

        // Reads raw bytes from file
        const arrayBuffer = await file.arrayBuffer();

        // arrayBuffer -> numbered bytes -> char equivalent -> base64 text
        // "..." passes each number from array as separate argument
        //const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        
        // Raw bytes -> Numbered bytes -> Char equivalent -> Builds string from each char -> Base64 text
        const bytes = new Uint8Array(arrayBuffer);

        let byteString = "";
        for (const byte of bytes) {
            byteString += String.fromCharCode(byte);
        }

        const base64 = btoa(byteString);

        return base64;
    }
    catch(error){
        console.error("Error opening image: ", error);
        return null;
    }
}

async function openTable(){

    homePageId.style.display = "none";
    quizPageId.style.display = "grid";
    
    questionDisplayId.style.display = "none";
    imageId.style.display = "block";

    // Prevent opening another file while one is already loading
    if (quizLoading) return;

    quizLoading = true;

    console.log("openTable clicked");
    
    try {
        const base64 = await openImage();

        console.log("after openImage:", base64 ? base64.length : base64);

        if(!base64){
            console.log("No base64, stopping");
            return;
        }

        imageLoadingOverlayId.classList.add("active");

        console.log("sending to parseTable");

        const response = await fetch("http://127.0.0.1:5050/api/parseTable", {
            method: "POST",
            headers: { "Content-Type": "application/json" },

            // name: value
            body: JSON.stringify({ base64: base64 })
        });

        console.log("parseTable status:", response.status);

        table = await response.json(); 

        console.log("Frontend received table:", table);
        console.log("Frontend table length:", table.length);
        console.log("First row images:", table[0]?.images);

        console.log("Table on openTable():", table);

        imageId.src = `data:image/png;base64,${randomImage(table)}`;

        randomTerm(table[randomImageIndex]);

        console.log("Init term:", currentTerm);

        loadMode("mcq");
        
    }
    catch(error){
        console.error("Error opening file: ", error);
    }
    finally{

        imageLoadingOverlayId.classList.remove("active");
        quizLoading = false;
    }
    
}

async function openNotes(){
 
    homePageId.style.display = "none";
    quizPageId.style.display = "grid";

    if (quizLoading) return;

    quizLoading = true;

    try{
        // Gets first item
        const [fileHandle] = await window.showOpenFilePicker({
            types: [
                {
                    description: "Text notes",
                    accept: {
                        "text/plain": [".txt", ".md"]
                    }
                }
            ]
        });

        const file = await fileHandle.getFile();
        const notes = await file.text();

        if (!notes.trim()) {
            console.log("Notes file is empty");
            return;
        }

        imageLoadingOverlayId.classList.add("active");

        const response = await fetch("http://127.0.0.1:5050/api/parseNotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes })
        });

        quizItems = await response.json(); 

        imageId.style.display = "none";
        questionDisplayId.style.display = "flex";
        questionDisplayId.textContent = quizItems[currentQuestionIndex].question;

    }
    catch(error){
        console.error("Error opening notes:", error);
    }
    finally{
        imageLoadingOverlayId.classList.remove("active");
        quizLoading = false;
    }
}

// These functions are not global so we have to attach them to window (the object for the whole row) 
// They're not global it is type "module" according to the html script
window.checkFRQ = checkFRQ;
window.nextImage  = nextImage;
window.openTable   = openTable;
window.openNotes = openNotes;

window.loadMode = loadMode;
window.showHome = showHome;
