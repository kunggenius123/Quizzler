export function stripText(text, includeSpace){

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

export function otherRandomPicture(currentPage, usedChoices = [], pages){
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


export function swapParts(answer, pages){

    const otherPages = pages.filter(page => page.text !== answer);

    // Check if otherPages empty
    if (!otherPages.length) return answer;

    const incorrect = otherPages[Math.floor(Math.random() * (otherPages.length))].text;
    
    // Splits and then trims each element
    const correctParts = answer.split(",").map(parts => parts.trim());
    const incorrectParts = incorrect.split(",").map(parts => parts.trim());

    // If not same number of parts, return whole incorrect choice
    if(correctParts.length !== incorrectParts.length){
        return incorrect;
    }

    let swapCount = Math.ceil(Math.random() * 2);

    for(let i = 0; i < swapCount; i++){
        let swapIndex = Math.floor(Math.random() * (correctParts.length));
        
        while (correctParts.includes(incorrectParts[swapIndex])) {
            swapIndex = Math.floor(Math.random() * (correctParts.length));
        }

        correctParts[swapIndex] = incorrectParts[swapIndex];
        
    }

    // Spread syntax [...] makes a new array copy (doesn't point to original)
    const swappedChoice = [...correctParts].join(", ");

    console.log("Swapped Choice: ", swappedChoice);

    return swappedChoice;

}

// OLD FAULTY METHOD
/*
function swapCategories(answer){
   
    

    const answerDocument = nlp(answer);

    const answerPeople = answerDocument.people().out('array');

    const answerTopics = answerDocument.nouns().out('array').filter(noun => !/\d/.test(noun) && !noun.toLowerCase().includes("century"));

   
    let chosenAnswerTopic = answerTopics[Math.floor(Math.random() * (answerTopics.length))];
    let chosenAnswerPeople = answerPeople[Math.floor(Math.random() * (answerPeople.length))];

    const otherPages = pages.filter(page => page.text !== answer);
    const incorrect = otherPages[Math.floor(Math.random() * (otherPages.length))].text;
    const incorrectDocument = nlp(incorrect);

    const incorrectPeople = incorrectDocument.people().out('array');
    const incorrectTopics = incorrectDocument.nouns().out('array');

    let chosenIncorrectTopic = incorrectTopics[Math.floor(Math.random() * (incorrectTopics.length))];
    let chosenIncorrectPeople = incorrectPeople[Math.floor(Math.random() * (incorrectPeople.length))];  
      
    if (chosenAnswerPeople && chosenIncorrectPeople) {
        if(!answer.includes(chosenIncorrectPeople.replace(/[\d()[\]{}]/g, ""))){
            answerDocument.people().first().replaceWith(chosenIncorrectPeople);
        }
        
    }

    
    if (chosenAnswerTopic && chosenIncorrectTopic) {
        if(!answer.includes(chosenIncorrectTopic.replace(/[\d()[\]{}]/g, ""))){
            answerDocument.nouns().first().replaceWith(chosenIncorrectTopic);
        }
        
    }

    let choice = answerDocument.text();
    choice = choice.replace(/,+/g, ",");

    console.log("Choice", choice);

    return choice;
    
}
*/

export async function getAIChoices(correct){
    console.log(correct);

    const response = await fetch("http://127.0.0.1:5050/api/mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct })
    });

    return await response.json();
    
}

export async function buildMCQ(page, pages){
    const answer = page.text;

    let choices = [answer];
    
    let newChoices;

    try{
        newChoices = await getAIChoices(answer);
        console.log("AI response success");
    }
    catch(error){
        console.error("AI failed, using fallback: ", error);
        newChoices = [swapParts(answer, pages), swapParts(answer, pages)];
    }


    // TODO: Create a random object between 0 and 1
    // If less than 1/4, make no choice from another picture
    // If less than 1/2, make one choice from another picture
    // If less than 3/4, make two choices from another picture
    // If less than 1, make all choices from another picture
    // For every choice from another picture, call a randomPicture() method, generates random index between 0 and (number of pictures - 1)

    let choiceFactor = Math.random() * 3;

    if(choiceFactor < 1.5){
  
        choices.push(newChoices[0]);
        choices.push(newChoices[1]);
    }
    else if(choiceFactor < 2.5){
        choices.push(otherRandomPicture(page, choices, pages));
        choices.push(newChoices[1]);
    }
    else{
        choices.push(swapParts(answer, pages));
        choices.push(otherRandomPicture(page, choices, pages));
    }
  
    

    choices.sort(() => Math.random() - 0.5);

    let answerIndex = choices.indexOf(answer);

    return{answer, choices, answerIndex};

}