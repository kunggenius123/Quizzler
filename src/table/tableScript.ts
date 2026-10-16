import { buildMCQ, stripText, getCorrectAnswer, chooseNextQuestion} from "./tableQuiz";
import type {
    QuizItem,
    QuizPayload,
    QuizQuestion,
    NotesQuizItem,
    TableQuizItem
} from "./tableQuiz";
import { API_URL } from "./config";

const homePageId = document.getElementById("home-page") as HTMLElement;
const quizPageId = document.getElementById("quiz-page") as HTMLElement;
const progressPageId = document.getElementById("progress-page") as HTMLElement;
const progressListId = document.getElementById("progress-list") as HTMLDivElement;
const progressEmptyId = document.getElementById("progress-empty") as HTMLParagraphElement;

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
const errorBannerId = document.getElementById("error-banner") as HTMLDivElement;
const tableUploadButton = document.querySelector(".nav-upload-button") as HTMLButtonElement | null;
const notesUploadButton = document.querySelector(".nav-notes-button") as HTMLButtonElement | null;

// Dropzone DOM elements (incremental feature)
const dropOverlay = document.getElementById("drop-overlay") as HTMLDivElement | null;
const dropzone = document.getElementById("dropzone") as HTMLDivElement | null;
const dropzoneTitle = document.getElementById("dropzone-title") as HTMLHeadingElement | null;
const dropzoneInstructions = document.getElementById("dropzone-instructions") as HTMLParagraphElement | null;
const dropzoneCancel = document.getElementById("dropzone-cancel") as HTMLButtonElement | null;

let dropMode: "table" | "notes" | null = null;

const checkFilename: string = "images/checkmark.png";
const xFilename: string = "images/x_mark.png";

let quizItems: QuizItem[] = [];

let quizLoading: boolean = false;

let currentMode: string = "mcq";

let currentQuestionIndex: number = 0;

let counter: number = 0;

let currentQuizId: string | null = null;

let knowledgeLevels: Record<string, number> = {};


function setUploadModeState(mode: "table" | "notes" | null): void {
    const isTable = mode === "table";
    const isNotes = mode === "notes";

    if (tableUploadButton) {
        tableUploadButton.classList.toggle("active", isTable);

        // Sets to true if mode is table
        tableUploadButton.setAttribute("aria-pressed", String(isTable));
    }

    if (notesUploadButton) {
        notesUploadButton.classList.toggle("active", isNotes);

        // Sets to true if mode is notes
        notesUploadButton.setAttribute("aria-pressed", String(isNotes));
    }
}

function showError(message: string): void {
    errorBannerId.textContent = message;
    errorBannerId.style.display = "block";
}

function showDropzone(mode: "table" | "notes"){
    dropMode = mode;
    setUploadModeState(mode);

    // Clear the previous quiz while the upload dropzone is open.
    clearQuizState();
    homePageId.style.display = "none";
    quizPageId.style.display = "none";
    progressPageId.style.display = "none";

    if(!dropOverlay || !dropzone || !dropzoneTitle || !dropzoneInstructions) return;
    dropzone.classList.remove("dragover");
    dropzoneTitle.textContent = mode === "table" ? "Drop table image here" : "Drop notes file here";
    dropzoneInstructions.textContent = mode === "table" ? "Drag and drop an image file here, or click to select." : "Drag and drop a .txt or .md file here, or click to select.";
    dropOverlay.style.display = "flex";
    dropzone.focus();
}

function hideDropzone(showHome: boolean = true){
    dropMode = null;
    setUploadModeState(null);
    if (showHome) {
        homePageId.style.display = "flex";
    }
    if(dropOverlay){
        dropOverlay.style.display = "none";
    }
    if(dropzone){
        dropzone.classList.remove("dragover");
    }
}

async function processSelectedFile(file: File): Promise<void> {
    if (!dropMode) return;

    const selectedMode = dropMode;
    hideDropzone(false);

    if (selectedMode === "table") {
        await openTableWithFile(file);
    }
    else if (selectedMode === "notes") {
        await openNotesWithFile(file);
    }
}

if (dropzone) {
    dropzone.addEventListener("dragover", (event: DragEvent) => {
        event.preventDefault();
        dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", async (event: DragEvent) => {
        event.preventDefault();
        dropzone.classList.remove("dragover");

        const file = event.dataTransfer?.files?.[0];
        if (!file) return;

        await processSelectedFile(file);
    });

    dropzone.addEventListener("click", () => {
        if (!dropMode) return;

        fileInput.accept = dropMode === "table" ? "image/*" : ".txt,.md,text/plain";
        fileInput.value = "";
        fileInput.onchange = async () => {
            const file = fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null;
            if (file) {
                await processSelectedFile(file);
            }
        };

        fileInput.click();
    });
}

if (dropzoneCancel) {
    dropzoneCancel.addEventListener("click", () => {
        hideDropzone();
    });
}

function clearError(): void {
    errorBannerId.textContent = "";
    errorBannerId.style.display = "none";
}

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

    frqQuestionId.textContent = quizItem.question;
}

function tableToQuizItems(questions: QuizQuestion[]): TableQuizItem[] {
    return questions.map(question => ({
        ...question,
        type: "table"
    }));
}

function notesToQuizItems(questions: QuizQuestion[]): NotesQuizItem[] {
    return questions.map(question => ({
        ...question,
        type: "notes"
    }));
}

function clearQuizState(): void {
    quizItems = [];
    currentQuizId = null;
    currentQuestionIndex = 0;
    counter = 0;
    currentMode = "mcq";

    imageId.src = "";
    imageId.style.display = "none";
    questionDisplayId.textContent = "";
    questionDisplayId.style.display = "none";

    counterId.textContent = "Correct: ";
    answerId.textContent = "";
    frqQuestionId.textContent = "";
    textBoxId.value = "";
    checkMarkImgId.style.visibility = "hidden";

    mcqDiv.style.display = "none";
    frqDiv.style.display = "none";

    mcqButtons.forEach(button => {
        button.textContent = "";
        button.disabled = true;
        button.dataset.correct = "false";
        button.style.backgroundColor = "";
        button.style.color = "";
    });

    imageLoadingOverlayId.classList.remove("active");
    clearError();
}

function showHome(): void{
    // Ensure any open upload UI is closed when returning home
    hideDropzone();

    clearQuizState();
    setUploadModeState(null);

    homePageId.style.display = "flex";
    quizPageId.style.display = "none";
    progressPageId.style.display = "none";

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

function showProgress(): void{
    hideDropzone(false);

    setUploadModeState(null);

    homePageId.style.display = "none";
    quizPageId.style.display = "none";
    progressPageId.style.display = "block";

    console.log("Progress loaded");
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
    
    const mcq = await buildMCQ(quizItem);

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
async function checkMCQ(event: MouseEvent): Promise<void>{
    
    const button = event.currentTarget as HTMLButtonElement | null;

    if(!button) return;

    
    const selectedAnswer = button.textContent?.trim() ?? "";

    try{
        const correct = await submitAnswer(selectedAnswer);

        if(correct){
            
            console.log("Correct:", selectedAnswer);

            if(!mcqAnsweredCorrect){
                counter++;
                counterId.textContent=`Correct: ${counter}`;
                answerId.textContent = "";
                
                mcqAnsweredCorrect = true; 

                
            }

            checkMarkImgId.src=checkFilename;
            
        }
        else{
            console.log("Incorrect:", selectedAnswer);
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
    catch(error){
        console.error("Could not submit answer:", error);
        showError("Your answer could not be submitted");
    }

    
} 

async function checkFRQ(): Promise<void>{
    
    const quizItem = quizItems[currentQuestionIndex];

    const input = textBoxId.value.trim();
    
    try{
        const isCorrect = await submitAnswer(input);
    
        if(isCorrect){
            console.log("Check");
            checkMarkImgId.src=checkFilename;
            //checkMarkImgId.style.display = "block";
            
            counter++;
            counterId.textContent=`Correct: ${counter}`;
            answerId.textContent = "";

        }
        else{
            console.log("X");
            checkMarkImgId.src=xFilename;
            //checkMarkImgId.style.display = "block";
            answerId.textContent = getCorrectAnswer(quizItem);
        }

        checkMarkImgId.style.visibility = "visible";
        frqButtonId.disabled=true;

    }
    catch(error){
        console.error("Could not submit answer:", error);
        showError("Your answer could not be submitted");
    }
    
    
    
} 

function displayCurrentQuestion(): void{
    const quizItem: QuizItem = quizItems[currentQuestionIndex];

    if(quizItem.type === "table"){

        if(quizItem.img){
            imageId.style.display = "block";
            questionDisplayId.style.display = "none";
            imageId.src = `data:image/png;base64,${quizItem.img}`;
        }
        else{
            imageId.style.display = "none";
            questionDisplayId.style.display = "flex";
            questionDisplayId.textContent = quizItem.question;
        }
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
  
    const currentQuestionId = quizItems[currentQuestionIndex].id;

    const nextQuizItem = chooseNextQuestion(quizItems, knowledgeLevels, currentQuestionId);

    if(!nextQuizItem) return;

    currentQuestionIndex = quizItems.indexOf(nextQuizItem);

    displayCurrentQuestion();

    if(currentMode === "mcq"){
        loadMCQ(nextQuizItem);
    }

    frqButtonId.disabled=false;
}

async function fileToBase64(file: File): Promise<string | null> {
    try {
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

        return btoa(byteString);
    }
    catch (error) {
        console.error("Error opening image: ", error);
        return null;
    }
}


export async function openImage(): Promise<string | null> {
    const file = await selectFile("image/*");
    if (!file) return null;

    return fileToBase64(file);
}

/* Helper function that opens the file picker
   Drag/drop calls openTableWithFile() directly */

async function openTable(): Promise<void> {
    const file = await selectFile("image/*");
    if (file) {
        await openTableWithFile(file);
    }
}

async function openTableWithFile(file: File): Promise<void> {
    homePageId.style.display = "none";
    quizPageId.style.display = "grid";
    progressPageId.style.display = "none";

    questionDisplayId.style.display = "none";
    imageId.style.display = "block";
    checkMarkImgId.style.visibility = "hidden";

    // Prevent opening another file while one is already loading
    if (quizLoading) return;

    quizLoading = true;
    clearError();

    console.log("openTable clicked");
    
    try {
        if (!file.type.startsWith("image/")) {
            showError("This file is not an image.");
            return;
        }

        const base64 = await fileToBase64(file);
        if (!base64) {
            console.log("No base64, stopping");
            return;
        }

        imageLoadingOverlayId.classList.add("active");
        console.log("sending to parseTable");

        const response = await fetch(`${API_URL}/api/parseTable`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },

            // name: value
            body: JSON.stringify({ base64: base64 })
        });

        console.log("parseTable status:", response.status);

        if (!response.ok) {
            showError("The server could not parse this table. Please try another image.");
            return;
        }

        const tablePayload = await response.json() as QuizPayload;
        if (tablePayload.sourceType !== "table") {
            throw new Error("Table endpoint returned a non-table quiz payload");
        }

        knowledgeLevels = tablePayload.knowledge_levels;

        currentQuizId = tablePayload.quizId;

        quizItems = tableToQuizItems(tablePayload.questions);

        console.log("Frontend received quiz items:", quizItems.length);

        if (!quizItems.length) {
            showError("No quiz questions could be created from this table. Try a clearer image with a ruled grid.");
            return;
        }

        currentQuestionIndex = Math.floor(Math.random() * quizItems.length);
        displayCurrentQuestion();
        loadMode("mcq");
    }
    catch (error) {
        console.error("Error opening file: ", error);
        showError("Something went wrong while creating the quiz. Make sure the API server is running, then try again.");
    }
    finally {
        imageLoadingOverlayId.classList.remove("active");
        quizLoading = false;
    }
}

/* Helper function that opens the file picker
   Drag/drop calls openNotesWithFile() directly */
async function openNotes(): Promise<void> {
    const file = await selectFile(".txt,.md,text/plain");
    if (file) {
        await openNotesWithFile(file);
    }
}

async function openNotesWithFile(file: File): Promise<void> {
    homePageId.style.display = "none";
    quizPageId.style.display = "grid";
    progressPageId.style.display = "none";

    checkMarkImgId.style.visibility = "hidden";

    if (quizLoading) return;

    quizLoading = true;
    clearError();

    try {
        const notes = await file.text();

        if (!notes.trim()) {
            showError("This notes file is empty.");
            return;
        }

        imageLoadingOverlayId.classList.add("active");

        const response = await fetch(`${API_URL}/api/parseNotes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes })
        });

        if (!response.ok) {
            showError("The server could not create questions from these notes. Please try again.");
            return;
        }

        const notesPayload = await response.json() as QuizPayload;
        if (notesPayload.sourceType !== "notes") {
            throw new Error("Notes endpoint returned a non-notes quiz payload");
        }

        knowledgeLevels = notesPayload.knowledge_levels;

        currentQuizId = notesPayload.quizId;
        quizItems = notesToQuizItems(notesPayload.questions);

        if (!quizItems.length) {
            showError("No quiz questions could be created from these notes.");
            return;
        }

        currentQuestionIndex = 0;
        displayCurrentQuestion();
        loadMode("mcq");
    }
    catch (error) {
        console.error("Error opening notes:", error);
        showError("Something went wrong while creating the quiz. Make sure the API server is running, then try again.");
    }
    finally {
        imageLoadingOverlayId.classList.remove("active");
        quizLoading = false;
    }
}


async function submitAnswer(selectedAnswer: string): Promise<boolean>{
    const quizItem = quizItems[currentQuestionIndex];

    // Makes sure there's an active quiz
    if (!currentQuizId) {
        throw new Error("No active quiz ID");
    }

    // Sends answer to /api/answers
    const response = await fetch(`${API_URL}/api/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            quizId: currentQuizId,
            questionId: quizItem.id,
            selectedAnswer
        })
    });

    if (!response.ok) {
        throw new Error(`Answer submission failed with status ${response.status}`);
    }

    const result = await response.json();

    knowledgeLevels = result.knowledge_levels;

    return result.correct;
}

// These functions are not global so we have to attach them to window (the object for the whole row)
// They're not global because this file is type "module" according to the html script
const globalWindow = window as any;
globalWindow.checkFRQ = checkFRQ;
globalWindow.nextQuestion = nextQuestion;
globalWindow.nextImage = nextQuestion;
globalWindow.openTable = openTable;
globalWindow.openNotes = openNotes;
globalWindow.showDropzone = showDropzone;
globalWindow.hideDropzone = hideDropzone;

globalWindow.loadMode = loadMode;
globalWindow.showHome = showHome;
globalWindow.showProgress = showProgress;