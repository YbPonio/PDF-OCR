import "./style.css";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "https://mozilla.github.io/pdf.js/build/pdf.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://mozilla.github.io/pdf.js/build/pdf.worker.mjs";

document.getElementById("sendBtn").addEventListener("click", checkFile);
let result = document.getElementById("result");
let fileInfo = document.getElementById("uploadInfo");

let labels = ["FORTO", "FOR", "TO", "FROM", "SUBJECT", "DATE", "ATTENTION"];

function checkFile() {
  let input = document.getElementById("upload");
  let file = input.files[0];

  if (!file) alert("Please select a file first!");
  if (file.type.startsWith("image/")) {
    OCRImg(file);
  } else {
    let fileType = file.type;
    if (fileType === "application/pdf") {
      let fileURL = URL.createObjectURL(file);
      convertPdfPageToJpg(fileURL, 1).then((jpegUrl) => {
        fetch(jpegUrl)
          .then((res) => res.blob())
          .then((blob) => {
            let jpgFile = new File([blob], "page1.jpg", {
              type: "image/jpeg",
            });
            OCRImg(jpgFile);
          });
      });
    } else {
      alert("Please upload a valid PDF file.");
    }
  }
}

async function convertPdfPageToJpg(pdfUrl, pageNumber) {
  let loadingTask = pdfjsLib.getDocument(pdfUrl);
  let pdfDoc = await loadingTask.promise;

  let page = await pdfDoc.getPage(pageNumber);

  let scale = 1.5;
  let viewport = page.getViewport({ scale: scale });
  let canvas = document.createElement("canvas");
  let context = canvas.getContext("2d");
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  let renderContext = {
    canvasContext: context,
    viewport: viewport,
  };
  await page.render(renderContext).promise;

  let jpegUrl = canvas.toDataURL("image/jpeg", 0.9);

  return jpegUrl;
}

async function OCRImg(file) {
  if (!file) {
    alert("Please select a file first!");
    return;
  }

  fileInfo.innerHTML = "Processing...";
  let worker = await createWorker("eng");
  let res = await worker.recognize(file);

  let text = res.data.text;

  let cleanText = text
    .replace(/\r/g, "")
    .replace(/[^a-zA-Z0-9.,\-?! \n]/g, "")
    .replace(/:/g, "")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  let textMatch = {
    no: extractField(cleanText, "NO"),
    "for/To": extractField(cleanText, "FORTO"),
    to: extractField(cleanText, "TO"),
    attention: extractField(cleanText, "ATTENTION"),
    from: extractField(cleanText, "FROM"),
    date: extractField(cleanText, "DATE"),
    subject: extractField(cleanText, "SUBJECT"),
  };

  console.log(JSON.stringify(cleanText));

  if (textMatch) {
    fileInfo.innerHTML = "";
    for (let [key, value] of Object.entries(textMatch)) {
      if (value) {
        fileInfo.innerHTML += `<p>${key.toUpperCase()}: <span>${value}</span></p>`;
      }
    }
  } else {
    result.innerText = "No matching found.";
  }

  await worker.terminate();
}

function extractField(text, label) {
  let labelPattern =
    label === "TO"
      ? "^T[O0][\\.:]?\\s*"
      : `^${label.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}[\\.:]?\\s*`;

  let startRegex = new RegExp(labelPattern, "im");
  let startMatch = text.match(startRegex);

  if (!startMatch) return "";

  let startIndex = startMatch.index + startMatch[0].length;
  let remaining = text.slice(startIndex);

  if (label.toUpperCase() === "DATE") {
    return remaining.split("\n")[0].trim();
  }

  let otherLabels = labels.filter((l) => l !== label.toUpperCase());

  let stopPatterns = otherLabels.map((lbl) =>
    lbl === "TO" ? "^T[O0]\\b" : `^${lbl}\\b`
  );

  let stopRegex = new RegExp(stopPatterns.join("|"), "im");

  let endIndex = remaining.length;
  let stopMatch = remaining.match(stopRegex);

  if (stopMatch) {
    if (label === "SUBJECT" && stopMatch[0].toUpperCase().indexOf("DATE") === -1) {
      let newlineIndex = remaining.indexOf("\n");
      if (newlineIndex !== -1) {
      endIndex = newlineIndex;
      } else {
      endIndex = stopMatch.index;
      }
    } else {
      endIndex = stopMatch.index;
    }
  }

  let content = remaining.slice(0, endIndex).trim();

  labels.forEach((lbl) => {
    let safe = lbl === "TO" ? "^T[O0][\\.:]?\\s*" : `^${lbl}[\\.:]?\\s*`;
    content = content.replace(new RegExp(safe, "i"), "").trim();
  });

  return content;
}
