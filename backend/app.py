from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
import csv
import io
from typing import List, Optional
from pydantic import BaseModel

from services.epub_processor import extract_chapters_from_epub, get_vocab_with_context
from services.anki_generator import create_anki_deck_bytes
from services.anki_parser import extract_words_from_anki_txt
from storage import (
    load_known_words,
    add_known_words,
    remove_known_words,
    clear_all_known_words,
    load_vocab_cache,
    save_vocab_cache
)

app = FastAPI(title="Japanese Vocabulary Frequency Analyzer")

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Using SQLite storage - data persists across server restarts
# Storage is handled by the storage module


class KnownWordsUpdate(BaseModel):
    words: List[str]
    action: str  # "add" or "remove"


@app.post("/upload-epub")
async def upload_epub(file: UploadFile = File(...), limit: int = 2000):
    """
    Upload an EPUB file and return the parsed frequency list.
    """
    if not file.filename.endswith('.epub'):
        raise HTTPException(
            status_code=400, detail="File must be an EPUB file")

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.epub') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name

    try:
        # Extract chapters
        chapters = extract_chapters_from_epub(tmp_path)

        # Load known words from SQLite database
        known_words = load_known_words()

        # Analyze text
        top_vocab = get_vocab_with_context(chapters, known_words, limit=limit)

        # Convert to dict format for JSON response
        vocab_list = [
            {
                "word": word,
                "frequency": info[0],
                "context": info[1]
            }
            for word, info in top_vocab
        ]

        # Save to SQLite database for Anki generation
        save_vocab_cache(vocab_list)

        return JSONResponse(content={
            "success": True,
            "count": len(vocab_list),
            "vocab": vocab_list
        })

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing EPUB: {str(e)}")

    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/upload-anki")
async def upload_anki(file: UploadFile = File(...)):
    """
    Upload an Anki text export (.txt) file and extract words to populate known words list.
    """
    if not file.filename.endswith('.txt'):
        raise HTTPException(
            status_code=400, detail="File must be an Anki text export (.txt file)")

    try:
        # Read file content
        content = await file.read()
        file_content = content.decode('utf-8')

        # Extract words from Anki text file
        words = extract_words_from_anki_txt(file_content)

        if not words:
            raise HTTPException(
                status_code=400,
                detail="No Japanese words found in the file. Make sure the file contains Japanese vocabulary in Anki text export format."
            )

        # Add words to known words database
        add_known_words(words)

        # Get updated count
        known_words = load_known_words()

        return JSONResponse(content={
            "success": True,
            "words_imported": len(words),
            "total_known_words": len(known_words),
            "sample_words": list(words)[:10]  # Show first 10 as preview
        })

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400, detail="File must be UTF-8 encoded text file")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/update-known")
async def update_known_words(update: KnownWordsUpdate):
    """
    Add or remove words from the known words list.
    Uses SQLite database for persistent storage.
    """
    if update.action == "add":
        add_known_words(set(update.words))
    elif update.action == "remove":
        remove_known_words(set(update.words))
    else:
        raise HTTPException(
            status_code=400, detail="Action must be 'add' or 'remove'")

    # Get updated count
    known_words = load_known_words()

    return JSONResponse(content={
        "success": True,
        "known_words_count": len(known_words)
    })


@app.get("/generate-anki")
async def generate_anki():
    """
    Generate and stream the .apkg file to the browser.
    Loads vocabulary from SQLite database.
    """
    vocab_list = load_vocab_cache()

    if not vocab_list:
        raise HTTPException(
            status_code=400, detail="No vocabulary data available. Please upload an EPUB first.")

    try:
        # Create Anki deck from database cache
        apkg_bytes = create_anki_deck_bytes(vocab_list)

        return StreamingResponse(
            io.BytesIO(apkg_bytes),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": "attachment; filename=Japanese_Vocab.apkg"
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating Anki deck: {str(e)}")


@app.get("/generate-anki-known")
async def generate_anki_known():
    """
    Generate an Anki deck from the current known words list.
    """
    known_words = load_known_words()
    if not known_words:
        raise HTTPException(
            status_code=400, detail="No known words available. Please import or add known words first.")

    # Map to vocab-like structure expected by the generator
    vocab_list = [
        {"word": word, "frequency": 1, "context": word}
        for word in known_words
    ]

    try:
        apkg_bytes = create_anki_deck_bytes(vocab_list)

        return StreamingResponse(
            io.BytesIO(apkg_bytes),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": "attachment; filename=Known_Words.apkg"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error generating Anki deck from known words: {str(e)}")


@app.get("/known-words")
async def get_known_words():
    """
    Get the current list of known words from SQLite database.
    """
    known_words = load_known_words()
    return JSONResponse(content={
        "known_words": list(known_words),
        "count": len(known_words)
    })


@app.post("/reset-known-words")
async def reset_known_words():
    """
    Clear all known words from the database.
    """
    clear_all_known_words()
    return JSONResponse(content={
        "success": True,
        "message": "All known words have been cleared"
    })


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
