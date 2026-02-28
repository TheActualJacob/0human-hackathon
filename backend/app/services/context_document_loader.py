from __future__ import annotations

from pathlib import Path

LEASE_CONTEXT_DIR = Path(__file__).parent.parent / "lease_context"

_cached_context: str | None = None


def load_lease_context_documents() -> str:
    """
    Reads all .txt, .md, .pdf, and .docx files from the lease_context folder and
    returns their combined text. Result is cached after the first call.
    """
    global _cached_context
    if _cached_context is not None:
        return _cached_context

    if not LEASE_CONTEXT_DIR.exists():
        _cached_context = ""
        return _cached_context

    parts: list[str] = []

    for path in sorted(LEASE_CONTEXT_DIR.iterdir()):
        if path.name == "README.md" or path.suffix.lower() not in (".txt", ".md", ".pdf", ".docx"):
            continue

        try:
            if path.suffix.lower() == ".pdf":
                text = _read_pdf(path)
            elif path.suffix.lower() == ".docx":
                text = _read_docx(path)
            else:
                text = path.read_text(encoding="utf-8", errors="replace")

            if text.strip():
                parts.append(f"--- {path.name} ---\n{text.strip()}")
        except Exception as exc:
            print(f"[context_document_loader] Could not read {path.name}: {exc}")

    _cached_context = "\n\n".join(parts)
    return _cached_context


def _read_docx(path: Path) -> str:
    try:
        from docx import Document
        doc = Document(str(path))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except ImportError:
        print("[context_document_loader] python-docx not installed — skipping .docx file.")
        return ""


def _read_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
    except ImportError:
        print("[context_document_loader] pypdf not installed — skipping PDF file.")
        return ""


def invalidate_cache() -> None:
    global _cached_context
    _cached_context = None
