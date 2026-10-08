"""Validate project Markdown links, anchors, fences and whitespace without dependencies."""

from pathlib import Path
import re
import subprocess
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parent.parent


def prose(text):
    return re.sub(r"(?ms)^```[^\n]*\n.*?^```[^\n]*$", "", text)


def anchors(path):
    found = set()
    counts = {}
    for heading in re.findall(r"(?m)^#{1,6}\s+(.+?)\s*$", prose(path.read_text())):
        slug = re.sub(r"[^\w\-\s]", "", heading.replace("`", "").lower()).replace(" ", "-")
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        found.add(slug if count == 0 else f"{slug}-{count}")
    return found


def main():
    listing = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "*.md"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    files = sorted({ROOT / name for name in listing.stdout.split("\0") if name})
    errors = []
    graph = {}
    link_count = 0
    for path in files:
        text = path.read_text()
        label = path.relative_to(ROOT)
        graph[path] = []
        if not text.startswith("# "):
            errors.append(f"{label}: missing H1")
        if len(re.findall(r"(?m)^```", text)) % 2:
            errors.append(f"{label}: unbalanced code fences")
        if not text.endswith("\n") or text.endswith("\n\n"):
            errors.append(f"{label}: expected one final newline")
        for number, line in enumerate(text.splitlines(), 1):
            if line.rstrip() != line:
                errors.append(f"{label}:{number}: trailing whitespace")
        for href in re.findall(r"\[[^\]]+\]\(([^)]+)\)", prose(text)):
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", href):
                continue
            local, _, fragment = href.partition("#")
            target = (path.parent / unquote(local)).resolve() if local else path
            link_count += 1
            if not target.is_file():
                errors.append(f"{label}: missing {href}")
                continue
            graph[path].append(target)
            if fragment and target.suffix == ".md" and unquote(fragment) not in anchors(target):
                errors.append(f"{label}: invalid anchor {href}")
    seen = set()
    pending = [ROOT / "AGENTS.md", ROOT / "README.md"]
    while pending:
        path = pending.pop()
        if path not in seen:
            seen.add(path)
            pending.extend(graph.get(path, []))
    errors.extend(f"{path.relative_to(ROOT)}: unreachable from documentation entry" for path in files if path not in seen)
    if errors:
        print("\n".join(errors))
        return 1
    print(f"PASS: {len(files)} Markdown files, {link_count} internal links/anchors, navigation, fences and whitespace.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
