import os
import re
import ebooklib
from ebooklib import epub
from janome.tokenizer import Tokenizer
import lxml.html
from tqdm import tqdm

# Initialize constants
TOKENIZER = Tokenizer()
BLACKList = {'いる', 'する', 'ある', 'なる', 'れる', 'られる', 'いう',
             'もの', 'こと', 'とき', 'そう', 'よう', 'くる', 'いく'}


def extract_chapters_from_epub(epub_path):
    """Extracts raw text from each chapter and returns a list of strings."""
    book = epub.read_epub(epub_path)
    chapters = []

    items = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
    for item in tqdm(items, desc="Extracting Chapters", disable=True):  # Disable progress bar for API
        content = item.get_content()
        if not content:
            continue
        tree = lxml.html.fromstring(content)
        text = tree.text_content().strip()
        if text:
            chapters.append(text)
    return chapters


def load_known_words(file_path):
    """Loads known words from an Anki export txt file into a set."""
    known_words = set()
    if not os.path.exists(file_path):
        return known_words

    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.split('\t')
            if parts:
                word = parts[0].strip()
                known_words.add(word)
    return known_words


def get_vocab_with_context(chapters, known_words, limit=2000):
    """Processes text to find frequencies and a sample sentence for each word."""
    word_info = {}  # Format: { "word": [count, "example sentence"] }

    for text in tqdm(chapters, desc="Analyzing Japanese", disable=True):  # Disable progress bar for API
        # Split into sentences using Japanese punctuation
        sentences = re.split(r'(?<=[。！？])', text)

        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 5:  # Skip tiny fragments
                continue

            tokens = TOKENIZER.tokenize(sentence)
            for t in tokens:
                base = t.base_form
                pos = t.part_of_speech

                # Filters
                if len(base) <= 1:
                    continue
                if base in BLACKList or base in known_words:
                    continue

                # Keep only independent Nouns, Verbs, Adjectives
                if pos.startswith(('名詞', '動詞', '形容詞')) and '非自立' not in pos:
                    if base not in word_info:
                        word_info[base] = [1, sentence]
                    else:
                        word_info[base][0] += 1

    # Sort by frequency and return top N
    sorted_vocab = sorted(
        word_info.items(), key=lambda x: x[1][0], reverse=True)
    return sorted_vocab[:limit]

