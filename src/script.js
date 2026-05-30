
import nlp from "https://cdn.jsdelivr.net/npm/compromise/+esm";

import { openPDF, extractPDFContent } from "./pdf.js";
import { buildMCQ, stripText } from "./quiz.js";

const checkFilename = "images/checkmark.png";
const xFilename = "images/x_mark.png";

const imageId = document.getElementById("image");
const textBoxId = document.getElementById("text-input");
const frqButtonId = document.getElementById("button-input");
const answerId = document.getElementById("answer");
const checkMarkImgId = document.getElementById("checkMarkImg");
const counterId = document.getElementById("counter");


let pages = [];

let currentMode = "mcq";

let randomIndex = 0;
let counter = 0;

const mcqButtons = document.querySelectorAll(".choice");
for(let i = 0; i < mcqButtons.length; i++){
    mcqButtons[i].addEventListener("click", checkMCQ);
}

const frqDiv = document.getElementById("frq");
const mcqDiv = document.getElementById("mcq");

/*let randomIndex = Math.floor(Math.random() * images.length);

let image = images[randomIndex];

let imgName = image.name;

let filename = image.filename;*/

//imageId.style.height = "400px";

function loadMode(mode){
    currentMode = mode;

    if(mode == "frq"){
        
        frqDiv.style.display="inline-block";
        mcqDiv.style.display="none";
        
    }
    else if(mode == "mcq"){

        frqDiv.style.display="none";
        mcqDiv.style.display="flex";

        loadMCQ(pages[randomIndex]);
    }
}

let mcqAnsweredCorrect = false; 

// Needs async to use await
async function loadMCQ(page){

    mcqAnsweredCorrect = false; 
    
    // Clears previous mcq button state
    for (let button of mcqButtons) {
        button.dataset.correct = "false";
    }
    
    const mcq = await buildMCQ(page, pages);

    console.log("Choices: ", mcq.choices);

    for(let i = 0; i < mcqButtons.length; i++){
        
        mcqButtons[i].textContent = mcq.choices[i];

        // Strict equality (===) checks for both value and object type
        if(i === mcq.answerIndex){

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
    
    let name = pages[randomIndex].text

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

function nextImage(){

    textBoxId.value = "";
    answerId.textContent = "";
    checkMarkImgId.style.visibility = "hidden";

    if (!pages.length) return;

    if(randomIndex >= pages.length - 1){
        randomIndex = 0;
    }
    else{
        randomIndex++;
    }

    let page = pages[randomIndex]
    let pageImages = page.images;

    if (!pageImages.length) return;
    
    imageId.src = pageImages[0];

    if(currentMode === "mcq"){
        loadMCQ(page);
    }

    mcqButtons.forEach(button => {
        button.disabled = false;
        button.style.backgroundColor = "";
        button.style.color = "";
       
    });

    frqButtonId.disabled=false;
}

function randomImage(array){
    randomIndex = Math.floor(Math.random() * array.length);

    return array[randomIndex].images[0];


}

async function openFile(){
 
    let pdf = await openPDF();

    pages = await extractPDFContent(pdf);

    console.log(pages);

    imageId.src = randomImage(pages);

    mcqDiv.style.display="none";
    frqDiv.style.display="none";
    
}

// These functions are not global so we have to attach them to window (the object for the whole page) 
// They're not global it is type "module" according to the html script
window.checkFRQ = checkFRQ;
window.nextImage  = nextImage;
window.openFile   = openFile;
window.loadMode = loadMode;
