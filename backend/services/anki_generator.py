import genanki
import tempfile
import os
from jamdict import Jamdict
from typing import List, Dict

# Initialize Dictionary
jam = Jamdict()

# Define the Anki Note Model
MY_MODEL = genanki.Model(
    1607392319,
    'Japanese Vocab (Auto-Def)',
    fields=[
        {'name': 'Word'},
        {'name': 'Frequency'},
        {'name': 'Sentence'},
        {'name': 'Meaning'},
    ],
    templates=[{
        'name': 'Card 1',
        'qfmt': '<div style="font-family: Arial; font-size: 40px; color: #66ccff; text-align: center;">{{Word}}</div>',
        'afmt': '''
            {{FrontSide}}
            <hr id="answer">
            <div style="font-size: 18px; color: #ddd; margin-bottom: 10px;">{{Sentence}}</div>
            <div style="font-size: 20px; color: #ff9999; background: #222; padding: 10px; border-radius: 5px;">
                {{Meaning}}
            </div>
            <div style="color: gray; font-size: 12px; margin-top: 10px;">Freq: {{Frequency}}</div>
        ''',
    }],
    css='.card { font-family: "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif; text-align: center; background-color: #2c2c2c; color: white; }'
)


def get_definition(word):
    """Fetch the first English definition from JMdict."""
    result = jam.lookup(word)
    if result.entries:
        # Get the first sense of the first entry
        definitions = result.entries[0].senses[0].gloss
        return "; ".join([d.text for d in definitions])
    return "Definition not found"


def create_anki_deck_bytes(vocab_list: List[Dict[str, any]]) -> bytes:
    """
    Create an Anki deck from vocab list and return as bytes.
    vocab_list format: [{"word": str, "frequency": int, "context": str}, ...]
    """
    my_deck = genanki.Deck(2059400110, 'Japanese Vocabulary')

    for item in vocab_list:
        word = item['word']
        frequency = str(item['frequency'])
        context = item['context']

        # 1. Skip if Context is messy (like the TOC you found)
        if "Navigation" in context or len(context) > 300:
            continue

        # 2. Skip non-Kanji filler words (san, nai, etc.)
        # This checks if the word contains at least one Kanji
        if not any('\u4e00' <= char <= '\u9fff' for char in word):
            continue

        # 3. Lookup Meaning
        meaning = get_definition(word)

        note = genanki.Note(
            model=MY_MODEL,
            fields=[word, frequency, context, meaning]
        )
        my_deck.add_note(note)

    # Write to temporary file, then read as bytes
    with tempfile.NamedTemporaryFile(delete=False, suffix='.apkg') as tmp_file:
        tmp_path = tmp_file.name

    try:
        package = genanki.Package(my_deck)
        package.write_to_file(tmp_path)

        with open(tmp_path, 'rb') as f:
            apkg_bytes = f.read()

        return apkg_bytes
    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
