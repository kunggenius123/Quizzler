type TableImage = {
    data: string;
};

export type TableQuizItem = {
    type: "table",
    terms: Record<string, string>;
    images: TableImage[];
    category: string | null;
}

export type NotesQuizItem = {
    type: "notes";
    question: string;
    answer: string;
    category: string;
    images: [];
}

export type QuizItem = TableQuizItem | NotesQuizItem;

type MCQResult = {
    answer: string;
    choices: string[];
    answerIndex: number;
}

export function stripText(text: string, includeSpace: boolean): string {

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

export function getCorrectAnswer(item: QuizItem): string{
    if(item.type === "notes"){
        return item.answer;
    }

    if(!item.category){
        return "";
    }

    const value = item.terms[item.category];
    return typeof value === "string" ? value.trim() : "";
}

export function sameCategoryDistractor(currentItem: QuizItem, usedChoices: string[] = [], items: QuizItem[]): string | null{
    let otherItems = items.filter(item => item !== currentItem);

    if(!otherItems.length){
        return null;
    }

    let possibleAnswers: string[] = [];

    for(const otherItem of otherItems){
        let answer: string = "";

        if(currentItem.type === "table" && currentItem.category && otherItem.type === "table"){
           
            const value = otherItem.terms[currentItem.category];

            answer = typeof value === "string" ? value.trim() : "";
                
        }

        else if(currentItem.type === "notes" && otherItem.type === "notes"){
                
            const value = otherItem.answer;

            
            answer = typeof value === "string" ? value.trim() : "";
        }

        
        // Add valid answers that not already used   
        if(answer && !usedChoices.includes(answer)){
            possibleAnswers.push(answer);
        
        }
    }

    if(!possibleAnswers.length){
        return null;
    }

    // Pick one of the other item answers randomly
    const randomIndex = Math.floor(Math.random() * possibleAnswers.length);
    return possibleAnswers[randomIndex];
}

export async function getAIChoices(correct: string): Promise<string[]>{
    console.log(correct);

    const response = await fetch("http://127.0.0.1:5050/api/mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct })
    });

    return await response.json();
    
}

export async function buildMCQ(item: QuizItem, items: QuizItem[]): Promise<MCQResult>{
    const answer = getCorrectAnswer(item);

    let choices: string[] = [answer];
    
    function addChoice(choice: string | null | undefined): void {
        if(choice && !choices.includes(choice)){
            choices.push(choice);
        }
    }
    let newChoices: string[] = [];

    try{
        newChoices = await getAIChoices(answer);
        console.log("AI response success");
    }
    catch(error){
        console.error("AI failed, using fallback: ", error);
        newChoices = [];
    }


    // TODO: Create a random object between 0 and 1
    // If less than 1/4, make no choice from another picture
    // If less than 1/2, make one choice from another picture
    // If less than 3/4, make two choices from another picture
    // If less than 1, make all choices from another picture
    // For every choice from another picture, call a randomPicture() method, generates random index between 0 and (number of pictures - 1)

    let choiceFactor = Math.random() * 3;


    if(choiceFactor < 1.5){
  
        addChoice(newChoices[0]);
        addChoice(newChoices[1]);
    }
    else if(choiceFactor < 2.5){
        addChoice(sameCategoryDistractor(item, choices, items));
        addChoice(newChoices[1]);
    }
    else{
        addChoice(sameCategoryDistractor(item, choices, items));
        addChoice(sameCategoryDistractor(item, choices, items));
    }
  
    while(choices.length < 3){
        const distractor = sameCategoryDistractor(item, choices, items);
    
        if(!distractor){
            break;
        }
    
        addChoice(distractor);
    }
    

    choices.sort(() => Math.random() - 0.5);

    let answerIndex = choices.indexOf(answer);

    return{answer, choices, answerIndex};

}
