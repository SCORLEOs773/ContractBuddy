import fitz  # PyMuPDF
import easyocr
import io
from PIL import Image
from groq import Groq
import os
from dotenv import load_dotenv
import json

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def extract_text_from_file(file_path: str) -> str:
    text = ""
    try:
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text("text")
        doc.close()
    except:
        pass

    # OCR fallback if very little text
    if len(text.strip()) < 200:
        print("🔍 Using OCR fallback...")
        reader = easyocr.Reader(['en', 'hi'], gpu=False)
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=300)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            result = reader.readtext(img_byte_arr.getvalue(), detail=0)
            text += " ".join([res[1] for res in result]) + "\n"
        doc.close()

    return text.strip()[:20000]

def analyze_contract(text: str, jurisdiction: str = "India") -> dict:
    if not text or len(text) < 100:
        return {
            "overall_risk": 30,
            "summary": "Could not extract readable text from the document.",
            "top_risks": [],
            "clauses": []
        }

    system_prompt = f"""You are ContractBuddy, an expert Indian legal analyst.
Jurisdiction: {jurisdiction}.

Analyze the document and return **ONLY** this exact JSON format. No other text, no markdown, no explanation.

{{
  "overall_risk":  number (0-100),
  "summary": "short summary in 1-2 sentences",
  "top_risks": ["risk 1", "risk 2"],
  "clauses": [
    {{"clause": "clause title", "risk": number, "explanation": "simple explanation"}}
  ]
}}

Document:
{text[:14000]}"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Output the JSON now."}
            ],
            temperature=0.1,      # Very low for consistent JSON
            max_tokens=3000
        )

        content = response.choices[0].message.content.strip()

        # Clean common LLM wrappers
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        content = content.strip()

        result = json.loads(content)
        return result

    except json.JSONDecodeError as e:
        print("JSON Decode Error. Raw output was:", content[:300] if 'content' in locals() else "No content")
    except Exception as e:
        print("Groq error:", str(e))

    # Final safe fallback
    return {
        "overall_risk": 45,
        "summary": "The AI had trouble structuring the analysis. The document appears to be a legal deed. Please try uploading again or use a PDF version if possible.",
        "top_risks": ["Parsing difficulty"],
        "clauses": []
    }