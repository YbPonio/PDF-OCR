import "./style.css";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "https://mozilla.github.io/pdf.js/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs";

document.getElementById("sendBtn").addEventListener("click", checkFile);
let result = document.getElementById("result");

function checkFile() {
  let input = document.getElementById("upload");
  let file = input.files[0];

  if (!file) alert("Please select a file first!");
  if(file.type.startsWith("image/")) {
    OCRImg(file);
  }
  else {
    const fileType = file.type;
    if (fileType === "application/pdf") {
      const fileURL = URL.createObjectURL(file);
      convertPdfPageToJpg(fileURL, 1).then((jpegUrl) => {
        fetch(jpegUrl)
          .then((res) => res.blob())
          .then((blob) => {
            const jpgFile = new File([blob], "page1.jpg", { type: "image/jpeg" });
            OCRImg(jpgFile);
          });
      });
    } else {
      alert("Please upload a valid PDF file.");
    }
  }
}

async function convertPdfPageToJpg(pdfUrl, pageNumber) {
  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdfDoc = await loadingTask.promise;

  const page = await pdfDoc.getPage(pageNumber);

  const scale = 1.5; 
  const viewport = page.getViewport({ scale: scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };
  await page.render(renderContext).promise;

  const jpegUrl = canvas.toDataURL("image/jpeg", 0.9);

  console.log(jpegUrl);
  return jpegUrl;
}

async function OCRImg(file) {
  if (!file) {
    alert("Please select a file first!");
    return;
  }
  result.classList.add("result");
  result.innerText = "Processing...";
  
  const worker = await createWorker("eng");
  const ret = await worker.recognize(file);

  result.innerText = ret.data.text;

  await worker.terminate();
}
