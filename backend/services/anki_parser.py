"""
Parse Anki text export files (.txt) to extract vocabulary words.
Anki text exports are tab-separated files with vocabulary data.
"""
import re
import html
from typing import Set, List


def extract_words_from_anki_txt(file_content: str) -> Set[str]:
    """
    Extract Japanese words from an Anki text export file.

    Anki text exports are tab-separated files where:
    - Each line is a card/note
    - Fields are separated by tabs
    - First field is usually the word/front of the card

    Args:
        file_content: The content of the .txt file as a string

    Returns:
        Set of Japanese words found in the file
    """
    words = set()
    lines = file_content.strip().split('\n')

    for line in lines:
        if not line.strip():
            continue

        # Split by tab (Anki text export format)
        fields = line.split('\t')

        # Only use the first column (the actual word)
        if not fields or not fields[0].strip():
            continue

        # Get the first field (the word)
        first_field = fields[0].strip()

        # Clean HTML tags if present
        cleaned = clean_html(first_field)

        # Extract Japanese words from the first field
        extracted_words = extract_words_from_text(cleaned)

        for word in extracted_words:
            if is_japanese_word(word):
                words.add(word)

    return words


def clean_html(text: str) -> str:
    """Remove HTML tags and decode HTML entities."""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    text = html.unescape(text)
    return text.strip()


def extract_words_from_text(text: str) -> List[str]:
    """
    Extract potential words from text, handling Japanese text.
    Uses regex to find sequences of Japanese characters.
    """
    # Match sequences of Japanese characters (Hiragana, Katakana, Kanji)
    # This regex finds one or more Japanese characters in a row
    words = re.findall(
        r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]+', text)
    return [w.strip() for w in words if w.strip()]


def is_japanese_word(word: str) -> bool:
    """
    Check if a word contains Japanese characters.
    Returns True if word contains Hiragana, Katakana, or Kanji.
    Filters out very short words and common particles.
    """
    if not word or len(word) <= 1:
        return False

    # Filter out common particles and very short words
    common_particles = {'の', 'に', 'は', 'を', 'が', 'で', 'と',
                        'も', 'から', 'まで', 'より', 'へ', 'か', 'ね', 'よ', 'さ'}
    if word in common_particles:
        return False

    # Check for Japanese character ranges
    has_japanese = False
    for char in word:
        # Hiragana: U+3040-U+309F
        # Katakana: U+30A0-U+30FF
        # Kanji: U+4E00-U+9FAF
        # CJK Unified Ideographs Extension A: U+3400-U+4DBF
        code = ord(char)
        if (0x3040 <= code <= 0x309F or  # Hiragana
            0x30A0 <= code <= 0x30FF or  # Katakana
            0x4E00 <= code <= 0x9FAF or  # Kanji
                0x3400 <= code <= 0x4DBF):   # Extension A
            has_japanese = True
            break

    return has_japanese
