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

export function otherRandomRow(currentRow, usedChoices = [], rows, term){
    const others = rows.filter(row => row !== currentRow);

    if(!others.length) return null;
    
    let randomIndex = Math.floor(Math.random() * others.length);

    for(const choice of usedChoices){
        while(others[randomIndex].terms[term] === choice){
            randomIndex = Math.floor(Math.random() * others.length);
        }
    }

    return others[randomIndex].terms[term];
}

export async function getAIChoices(correct){
    console.log(correct);

    const response = await fetch("http://127.0.0.1:5050/api/mcq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correct })
    });

    return await response.json();
    
}

export async function buildMCQ(row, rows, term){
    const answer = row.terms[term];

    let choices = [answer];
    
    let newChoices;

    try{
        newChoices = await getAIChoices(answer);
        console.log("AI response success");
    }
    catch(error){
        console.error("AI failed, using fallback: ", error);
        newChoices = [otherRandomRow(row, choices, rows, term), otherRandomRow(row, choices, rows, term)];
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
        choices.push(otherRandomRow(row, choices, rows, term));
        choices.push(newChoices[1]);
    }
    else{
        choices.push(otherRandomRow(row, choices, rows, term));
        choices.push(otherRandomRow(row, choices, rows, term));
    }
  
    

    choices.sort(() => Math.random() - 0.5);

    let answerIndex = choices.indexOf(answer);

    return{answer, choices, answerIndex};

}