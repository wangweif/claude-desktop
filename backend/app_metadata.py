"""Read app version and latest changelog section from repository root."""

import re
from pathlib import Path


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent


CHANGELOG_FILENAME = "CHANGELOG.md"


def changelog_path() -> Path:
    return project_root() / CHANGELOG_FILENAME


def read_changelog_file() -> tuple[Path | None, str]:
    path = changelog_path()
    if not path.is_file():
        return None, ""
    try:
        return path, path.read_text(encoding="utf-8")
    except OSError:
        return None, ""


def parse_latest_version_block(text: str) -> tuple[str | None, str]:
    """
    Parse the first version section (newest when file lists versions descending).

    Supported headings:
    - ## [0.0.1] - 2026-04-19
    - ## [0.0.1]
    - ## 0.0.1
    """
    lines = text.splitlines()
    bracket = re.compile(r"^##\s+\[([^\]]+)\]\s*(.*)$")
    plain = re.compile(r"^##\s+(v?\d+\.\d+\.\d+[^\s]*)\s*$")

    version: str | None = None
    start_idx: int | None = None

    for i, line in enumerate(lines):
        m = bracket.match(line)
        if m:
            version = m.group(1).strip()
            start_idx = i + 1
            break

    if start_idx is None:
        for i, line in enumerate(lines):
            m = plain.match(line.rstrip())
            if m:
                version = m.group(1).strip()
                start_idx = i + 1
                break

    if version is None or start_idx is None:
        return None, ""

    body_lines: list[str] = []
    for j in range(start_idx, len(lines)):
        if lines[j].startswith("## "):
            break
        body_lines.append(lines[j])

    return version, "\n".join(body_lines).strip()


def get_latest_release_notes() -> tuple[str | None, str]:
    """Return (version, body_markdown) for the topmost version block in changelog."""
    _, text = read_changelog_file()
    if not text.strip():
        return None, ""
    return parse_latest_version_block(text)
