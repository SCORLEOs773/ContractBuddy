from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from models import Contract, User
from auth import get_current_user
from database import get_db
from utils import extract_text_from_file, analyze_contract
import shutil
import os

router = APIRouter(prefix="/contracts", tags=["contracts"])

# Get all user's contracts (History)
@router.get("/")
async def get_user_contracts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contracts = db.query(Contract).filter(Contract.user_id == current_user.id).order_by(Contract.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "filename": c.filename,
            "jurisdiction": c.jurisdiction,
            "risk_report": eval(c.risk_report) if c.risk_report else {},
            "created_at": c.created_at
        } for c in contracts
    ]

# Upload new contract
@router.post("/upload")
async def upload_contract(
    file: UploadFile = File(...),
    jurisdiction: str = "India",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        os.makedirs("uploads", exist_ok=True)
        
        file_path = f"uploads/{current_user.id}_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        text = extract_text_from_file(file_path)
        
        if len(text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Could not extract text from file")

        analysis = analyze_contract(text, jurisdiction)
        
        new_contract = Contract(
            filename=file.filename,
            file_path=file_path,
            jurisdiction=jurisdiction,
            raw_text=text[:15000],
            risk_report=str(analysis),
            user_id=current_user.id
        )
        db.add(new_contract)
        db.commit()
        db.refresh(new_contract)
        
        return {
            "id": new_contract.id,
            "filename": file.filename,
            "analysis": analysis
        }
    except Exception as e:
        print("Upload error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

# Delete contract
@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.user_id == current_user.id
    ).first()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if os.path.exists(contract.file_path):
        try:
            os.remove(contract.file_path)
        except:
            pass
    
    db.delete(contract)
    db.commit()
    
    return {"message": "Contract deleted successfully"}

# Smart Contract Generator
@router.post("/generate")
async def generate_contract(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    description = request.get("description")
    jurisdiction = request.get("jurisdiction", "India")

    if not description or len(description.strip()) < 10:
        raise HTTPException(status_code=400, detail="Please provide a proper description of the contract you need.")

    system_prompt = f"""You are ContractBuddy, an expert Indian contract drafter.
    Create a **fair, balanced, and professional** contract based on the user's description.

    Jurisdiction: {jurisdiction} (follow Indian Contract Act 1872, relevant labour laws, DPDP Act, state-specific rules, etc.)

    Requirements:
    - Use clear, simple language (Hinglish-friendly where appropriate)
    - Make it balanced — protect the user but remain reasonable
    - Include standard clauses like parties, scope of work, payment terms, termination, dispute resolution, governing law, etc.
    - Add appropriate safeguards for the user

    User Description: {description}

    Return the **full contract text** in a clean, professional format with proper headings and numbering."""

    try:
        from utils import client

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate the complete contract now."}
            ],
            temperature=0.4,
            max_tokens=4000
        )
        
        contract_text = response.choices[0].message.content.strip()
        return {"contract": contract_text}
        
    except Exception as e:
        print("Contract generation error:", str(e))
        raise HTTPException(status_code=500, detail="Failed to generate contract. Please try again.")

# Compare Two Documents - Ultra Simple Debug Version
@router.post("/compare")
async def compare_two_documents(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
    jurisdiction: str = "India",
    current_user: User = Depends(get_current_user)
):
    print("=== COMPARE ENDPOINT CALLED ===")
    print(f"File1 received: {file1.filename} ({file1.content_type})")
    print(f"File2 received: {file2.filename} ({file2.content_type})")

    ext1 = file1.filename.split(".")[-1]
    ext2 = file2.filename.split(".")[-1]

    path1 = f"uploads/debug_c1_{current_user.id}.{ext1}"
    path2 = f"uploads/debug_c2_{current_user.id}.{ext2}"

    try:
        os.makedirs("uploads", exist_ok=True)

        print(f"Saving file1 to: {path1}")
        with open(path1, "wb") as f:
            await file1.seek(0)
            content = await file1.read()
            f.write(content)

        print(f"Saving file2 to: {path2}")
        with open(path2, "wb") as f:
            await file2.seek(0)
            content = await file2.read()
            f.write(content)

        print("Files saved successfully")

        text1 = extract_text_from_file(path1)
        text2 = extract_text_from_file(path2)

        print(f"Extracted Text1 length: {len(text1)}")
        print(f"Extracted Text2 length: {len(text2)}")

        if len(text1.strip()) < 50 or len(text2.strip()) < 50:
            raise HTTPException(status_code=400, detail="Very little text extracted from one or both files.")
        
        system_prompt = f"""You are an expert Indian contract lawyer.

            Document 1:
            {text1[:7000]}

            Document 2:
            {text2[:7000]}

            Compare them and give clear analysis:
            - Key differences
            - Which is better for the user
            - Risky clauses
            - Suggested changes
            - Recommendation

            Use bullet points."""
            
        from utils import client

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Compare the two documents."}
            ],
            temperature=0.5,
            max_tokens=2500
        )

        return {"analysis": response.choices[0].message.content.strip()}

        # For now, return a simple message so we know it reached here
#         return {
#             "analysis": f"""Comparison Result:

# Document 1 ({file1.filename}): {len(text1)} characters extracted
# Document 2 ({file2.filename}): {len(text2)} characters extracted

# Full comparison coming soon. For now, both files were successfully processed."""
#         }

    except Exception as e:
        print("Comparison error:", str(e))
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to compare documents: {str(e)}")
    finally:
        for p in [path1, path2]:
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except:
                    pass

# ChatBot
@router.post("/chat")
async def chat_with_contract(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    contract_id = request.get("contract_id")
    message = request.get("message")
    language = request.get("language", "hinglish")

    if not contract_id or not message:
        raise HTTPException(status_code=400, detail="Missing contract_id or message")

    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.user_id == current_user.id
    ).first()
    
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    try:
        analysis = eval(contract.risk_report) if isinstance(contract.risk_report, str) else contract.risk_report
    except:
        analysis = {"summary": contract.raw_text[:500] if contract.raw_text else ""}

    lang_instruction = {
        "english": "Answer in clear, professional English.",
        "hinglish": "Answer in simple Hinglish (mix of Hindi and English).",
        "hindi": "Answer fully in Hindi using Devanagari script."
    }.get(language, "Answer in simple Hinglish.")

    system_prompt = f"""You are ContractBuddy, a friendly and expert Indian legal assistant.
    {lang_instruction}

    Current Document:
    Summary: {analysis.get('summary', 'No summary available')}
    Overall Risk: {analysis.get('overall_risk', 50)}/100

    Be practical, honest and easy to understand."""

    try:
        from utils import client

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            temperature=0.7,
            max_tokens=900
        )
        
        return {"response": response.choices[0].message.content.strip()}
        
    except Exception as e:
        print("Chat error:", str(e))
        return {"response": "माफ़ कीजिए, अभी जवाब देने में समस्या हो रही है। कृपया दोबारा प्रयास करें।"}