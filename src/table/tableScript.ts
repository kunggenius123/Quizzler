import { buildMCQ, stripText, getCorrectAnswer} from "./tableQuiz";
import type {QuizItem, TableQuizItem} from "./tableQuiz";

// Optional properties
type TableRowRaw = {
    terms?: Record<string, string>;
    images?: { data: string }[];
}

type NoteItemRaw = {
    question: string;
    answer: string;
    category?: string;
};

const homePageId = document.getElementById("home-page") as HTMLElement;
const quizPageId = document.getElementById("quiz-page") as HTMLElement;

const imageId = document.getElementById("image") as HTMLImageElement;
const imageLoadingOverlayId = document.getElementById("image-loading-overlay") as HTMLDivElement;

const textBoxId = document.getElementById("text-input") as HTMLInputElement;
const frqButtonId = document.getElementById("button-input") as HTMLButtonElement;
const frqQuestionId = document.getElementById("frq-question") as HTMLHeadingElement;
const questionDisplayId = document.getElementById("question-display") as HTMLDivElement;

const answerId = document.getElementById("answer") as HTMLHeadingElement;
const checkMarkImgId = document.getElementById("checkMarkImg") as HTMLImageElement;
const counterId = document.getElementById("counter") as HTMLHeadingElement;

const fileInput = document.getElementById("file-input") as HTMLInputElement;

function selectFile(acceptedTypes: string): Promise<File | null> {
    return new Promise(function(resolve) {
        fileInput.accept = acceptedTypes;
        fileInput.value = "";

        fileInput.onchange = function() {

            let file: File | null = null

            // Length checks if user at least selected a file, not just opened the file picker
            if (fileInput.files && fileInput.files.length > 0) {
                file = fileInput.files[0];
            }
            else {
                file = null;
            }

            resolve(file);
        };

        fileInput.click();
    });
}

const checkFilename: string = "images/checkmark.png";
const xFilename: string = "images/x_mark.png";

let quizItems: QuizItem[] = [];

let quizLoading: boolean = false;

let currentMode: string = "mcq";

let currentQuestionIndex: number = 0;

let counter: number = 0;

const mcqButtons = document.querySelectorAll<HTMLButtonElement>(".choice");
for(let i = 0; i < mcqButtons.length; i++){
    mcqButtons[i].addEventListener("click", checkMCQ);
}

const frqDiv = document.getElementById("frq") as HTMLDivElement;
const mcqDiv = document.getElementById("mcq") as HTMLDivElement;


function setFrqPrompt(quizItem: QuizItem): void{
    if(quizItem.type === "notes"){
        frqQuestionId.textContent = "Answer:";
        return;
    }

    if(!quizItem.category){
        frqQuestionId.textContent = "";
        return;
    }

    frqQuestionId.textContent = `What is the ${quizItem.category}?`;
}

function pickRandomCategory(quizItem: TableQuizItem): void{
    // Filters out terms that are empty or non-strings
    const terms: string[] = Object.keys(quizItem.terms).filter(
        term => typeof quizItem.terms[term] === "string" && quizItem.terms[term].trim() !== ""
    );

    if(!terms.length){
        console.error("No valid terms found for quiz item:", quizItem);
        quizItem.category = null;
        return;
    }

    quizItem.category = terms[Math.floor(Math.random() * terms.length)];
    console.log("Selected term:", quizItem.category, "=", quizItem.terms[quizItem.category]);
}

function rowsToQuizItems(rows: TableRowRaw[]): QuizItem[]{
    const items: QuizItem[] = [];

    for(const row of rows){
        const terms = row.terms || {};
        
        // If at least one term is a non-empty string
        const hasTerm = Object.values(terms).some(
            value => typeof value === "string" && value.trim() !== ""
        );

        if(!hasTerm || !(row.images?.length)){
            continue;
        }

        items.push({
            type: "table",
            terms,
            images: row.images,
            category: null,
        });
    }

    return items;
}

function notesToQuizItems(noteItems: NoteItemRaw[]): QuizItem[]{
    return noteItems.map(item => ({
        type: "notes",
        question: item.question,
        answer: item.answer,
        category: item.category || "",
        images: [],
    }));
}

function showHome(): void{
    quizItems = [];
    currentQuestionIndex = 0;
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

function loadMode(mode: string): void{

    checkMarkImgId.style.visibility = "hidden";

    console.log("loadMode clicked:", mode);
    console.log("quiz items:", quizItems.length);

    currentMode = mode;

    if(!quizItems.length){
        console.log("No quiz loaded yet");
        return;
    }

    const quizItem = quizItems[currentQuestionIndex];

    if(quizItem.type === "table" && !quizItem.category){
        pickRandomCategory(quizItem);
    }

    if(mode == "frq"){
        console.log("Switching to FRQ");

        setFrqPrompt(quizItem);
        
        frqDiv.style.display="inline-block";
        mcqDiv.style.display="none";
        
    }
    else if(mode == "mcq"){
        console.log("Switching to MCQ");

        frqDiv.style.display="none";
        mcqDiv.style.display="flex";

        loadMCQ(quizItem);
    }
}

let mcqAnsweredCorrect = false; 

// Needs async to use await
async function loadMCQ(quizItem: QuizItem): Promise<void>{

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
    
    const mcq = await buildMCQ(quizItem, quizItems);

    console.log("Choices: ", mcq.choices);

    for(let i = 0; i < mcqButtons.length; i++){

        if(!mcq.choices[i]){
            mcqButtons[i].textContent = "";
            mcqButtons[i].disabled = true;
            mcqButtons[i].style.display = "none";
            continue;
        }

        mcqButtons[i].style.display = "block";
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
function checkMCQ(event: MouseEvent): void{
    
    const button = event.currentTarget as HTMLButtonElement | null;

    if(!button) return;

    console.log("Button Clicked: ", button.textContent);

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

function checkFRQ(): void{
    
    const quizItem = quizItems[currentQuestionIndex];
    let strippedName = stripText(getCorrectAnswer(quizItem), true);

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
        answerId.textContent = getCorrectAnswer(quizItem);
    }

    frqButtonId.disabled=true;
    
} 

function displayCurrentQuestion(): void{
    const quizItem: QuizItem = quizItems[currentQuestionIndex];

    if(quizItem.type === "table"){

        if(!quizItem.images.length || !quizItem.category){
            return;
        }

        imageId.style.display = "block";
        questionDisplayId.style.display = "none";
        imageId.src = `data:image/png;base64,${quizItem.images[0].data}`;
    }
    else{
        imageId.style.display = "none";
        questionDisplayId.style.display = "flex";
        questionDisplayId.textContent = quizItem.question;
    }

    setFrqPrompt(quizItem);
}

function nextQuestion(): void{

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

    const quizItem: QuizItem = quizItems[currentQuestionIndex];

    if(quizItem.type === "table"){
        pickRandomCategory(quizItem);
    }

    displayCurrentQuestion();

    if(currentMode === "mcq"){
        loadMCQ(quizItems[currentQuestionIndex]);
    }

    frqButtonId.disabled=false;
}

export async function openImage(): Promise<string | null> {
    try {
        const file = await selectFile("image/*");
        if (!file) return null;

        if (!file.type.startsWith("image/")) {
            console.error("File is not an image", file.type);
            return null;
        }

        // Reads raw bytes from file
        const arrayBuffer = await file.arrayBuffer();
        
        // Raw bytes -> Numbered bytes -> Char equivalent -> Builds string from each char -> Base64 text
        const bytes = new Uint8Array(arrayBuffer);

        let byteString = "";
        for (const byte of bytes) {
            byteString += String.fromCharCode(byte);
        }

        const base64 = btoa(byteString);

        return base64;
    }
    catch (error) {
        console.error("Error opening image: ", error);
        return null;
    }
}

async function openTable(): Promise<void> {

    homePageId.style.display = "none";
    quizPageId.style.display = "grid";
    
    questionDisplayId.style.display = "none";
    imageId.style.display = "block";
    checkMarkImgId.style.visibility = "hidden";

    // Prevent opening another file while one is already loading
    if (quizLoading) return;

    quizLoading = true;

    console.log("openTable clicked");
    
    try {
        const base64 = await openImage();

        console.log("after openImage:", base64 ? base64.length : base64);

        if (!base64) {
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

        const rows = await response.json() as TableRowRaw[]; 

        quizItems = rowsToQuizItems(rows);

        console.log("Frontend received quiz items:", quizItems.length);

        if (!quizItems.length) {
            console.log("No quiz items parsed from table");
            return;
        }

        currentQuestionIndex = Math.floor(Math.random() * quizItems.length);
        const quizItem = quizItems[currentQuestionIndex];

        if (quizItem.type === "table") {
            pickRandomCategory(quizItem);
        }

        displayCurrentQuestion();
        loadMode("mcq");
    }
    catch (error) {
        console.error("Error opening file: ", error);
    }
    finally {
        imageLoadingOverlayId.classList.remove("active");
        quizLoading = false;
    }
}

async function openNotes(): Promise<void> {
    
    homePageId.style.display = "none";
    quizPageId.style.display = "grid";

    checkMarkImgId.style.visibility = "hidden";

    if (quizLoading) return;

    quizLoading = true;

    try {
        const file = await selectFile(".txt,.md,text/plain");
        if (!file) return;

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

        const noteItems = await response.json()  as NoteItemRaw[];
        quizItems = notesToQuizItems(noteItems);

        if (!quizItems.length) {
            console.log("No quiz items parsed from notes");
            return;
        }

        currentQuestionIndex = 0;
        displayCurrentQuestion();
        loadMode("mcq");
    }
    catch (error) {
        console.error("Error opening notes:", error);
    }
    finally {
        imageLoadingOverlayId.classList.remove("active");
        quizLoading = false;
    }
}

// These functions are not global so we have to attach them to window (the object for the whole row)
// They're not global because this file is type "module" according to the html script
const globalWindow = window as any;
globalWindow.checkFRQ = checkFRQ;
globalWindow.nextQuestion = nextQuestion;
globalWindow.nextImage = nextQuestion;
globalWindow.openTable = openTable;
globalWindow.openNotes = openNotes;

globalWindow.loadMode = loadMode;
globalWindow.showHome = showHome;
