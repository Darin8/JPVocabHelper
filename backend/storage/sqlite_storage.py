"""
SQLite-based storage for known words and vocabulary cache.
No external database server required - uses local file.
"""
import sqlite3
from pathlib import Path
from typing import Set, List, Dict, Any
from threading import Lock
from contextlib import contextmanager

STORAGE_DIR = Path(__file__).parent.parent / "data"
DB_FILE = STORAGE_DIR / "vocab.db"

_db_lock = Lock()


def ensure_storage_dir():
    """Create storage directory if it doesn't exist."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_db_connection():
    """Get a database connection with proper locking."""
    ensure_storage_dir()
    with _db_lock:
        conn = sqlite3.connect(DB_FILE, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def init_database():
    """Initialize database tables."""
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS known_words (
                word TEXT PRIMARY KEY,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS vocab_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL,
                frequency INTEGER NOT NULL,
                context TEXT NOT NULL,
                cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_vocab_word ON vocab_cache(word)
        """)


def load_known_words() -> Set[str]:
    """Load known words from database."""
    init_database()
    with get_db_connection() as conn:
        cursor = conn.execute("SELECT word FROM known_words")
        return {row['word'] for row in cursor.fetchall()}


def save_known_words(words: Set[str]):
    """Save known words to database."""
    init_database()
    with get_db_connection() as conn:
        # Clear existing and insert new
        conn.execute("DELETE FROM known_words")
        conn.executemany(
            "INSERT INTO known_words (word) VALUES (?)",
            [(word,) for word in words]
        )


def add_known_words(words: Set[str]):
    """Add words to known words (without clearing existing)."""
    init_database()
    with get_db_connection() as conn:
        conn.executemany(
            "INSERT OR IGNORE INTO known_words (word) VALUES (?)",
            [(word,) for word in words]
        )


def remove_known_words(words: Set[str]):
    """Remove words from known words."""
    init_database()
    with get_db_connection() as conn:
        conn.executemany(
            "DELETE FROM known_words WHERE word = ?",
            [(word,) for word in words]
        )


def clear_all_known_words():
    """Clear all known words from the database."""
    init_database()
    with get_db_connection() as conn:
        conn.execute("DELETE FROM known_words")


def load_vocab_cache() -> List[Dict[str, Any]]:
    """Load vocabulary cache from database."""
    init_database()
    with get_db_connection() as conn:
        cursor = conn.execute("""
            SELECT word, frequency, context 
            FROM vocab_cache 
            ORDER BY cached_at DESC
        """)
        return [
            {
                'word': row['word'],
                'frequency': row['frequency'],
                'context': row['context']
            }
            for row in cursor.fetchall()
        ]


def save_vocab_cache(vocab_list: List[Dict[str, Any]]):
    """Save vocabulary cache to database."""
    init_database()
    with get_db_connection() as conn:
        # Clear old cache
        conn.execute("DELETE FROM vocab_cache")
        # Insert new cache
        conn.executemany(
            "INSERT INTO vocab_cache (word, frequency, context) VALUES (?, ?, ?)",
            [(item['word'], item['frequency'], item['context'])
             for item in vocab_list]
        )
