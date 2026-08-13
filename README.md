# Quizzler

Turn class materials into practice quizzes. Upload a **table image** or a **notes file** and Quizzler uses computer vision + GPT to generate multiple choice and free response questions, complete with cropped cell images and AI-generated distractors.

## Prerequisites

- **Node.js** (v18+ recommended)
- **Python 3** with: `flask`, `opencv-python`, `numpy`, `pytesseract`
- **Tesseract OCR** ([install guide](https://github.com/tesseract-ocr/tesseract))

## Setup

```bash
cd Quizzler
npm install
pip install flask opencv-python numpy pytesseract
```



Open **3 terminals** in the project root. Keep all three running.

### Terminal 1 — Frontend (port 5173)

```bash
npm run dev
```

Open **http://localhost:5173/**

### Terminal 2 — Node API (port 5050)

```bash
npm run server
```

### Terminal 3 — Python cell extractor (port 5051)

```bash
python src/extract_cells.py
```

(Use `python3` if needed.)
