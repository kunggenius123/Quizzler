import * as pdfjsLib from 'https://mozilla.github.io/pdf.js/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://mozilla.github.io/pdf.js/build/pdf.worker.mjs';

export async function openPDF() {
  const [fileHandle] = await window.showOpenFilePicker();
  const file = await fileHandle.getFile();

  // arrayBuffer gets raw bytes of File object 
  const arrayBuffer = await file.arrayBuffer();

  // {data: } is to indicate we are passing raw bytes into the method instead of a URL 
  return await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

export async function extractPDFContent(pdf){
    const totalPages = pdf.numPages;

    let pages = [];
    
    for(let pageNum = 1; pageNum <= totalPages; pageNum++){
        let page = await pdf.getPage(pageNum);

        let textContent = await page.getTextContent();


        // textContent.items is a list of small text chunks on the page like: [ {str: "Hello"}, {str: " "}, {str: "world"}, ... ]
        // This joins the text chunks together to get the full page text
        let pageText = textContent.items.map(item => item.str).join(" ")
            .replace(/\s+/g, " ")           // remove extra spaces
            .replace(/\s([,.)])/g, "$1")    // remove space before punctuation
            .replace(/(\d)\s+(th|st|nd|rd)/g, "$1$2")   // fix "17 th" → "17th"
            .trim();

        const images = await extractPDFImages(page);

        pages.push({text: pageText, images});

    }
   
    return pages;
}

async function extractPDFImages(page){

    const operatorList = await page.getOperatorList();
    const images = [];

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

        }

    }
    return images;
}