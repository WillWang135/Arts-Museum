#!/usr/bin/env python3
"""
List exhibition/images/ and exhibition/audio/ into exhibition/museum.json.

    python3 build-exhibition.py

A static site cannot read a directory: GitHub Pages serves files, and
nothing it serves says what is in a folder. So museum.json is the list,
and this writes it from whatever is actually there.

Run it after adding or removing files, then commit museum.json with them.

Anything already written against an entry - a name, an artist, a
description, the room it hangs in - is kept. Only the list of files
changes: new files are appended, and entries whose file has gone are
dropped.
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
EXHIBITION = ROOT / "exhibition"
MANIFEST = EXHIBITION / "museum.json"

IMAGE_EXT = {".jpg", ".jpeg", ".png"}
AUDIO_EXT = {".mp3"}


def natural(name):
    """P2 before P10, the way a person reads them."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def scan(folder, wanted):
    d = EXHIBITION / folder
    if not d.is_dir():
        return []
    names = [p.name for p in d.iterdir()
             if p.is_file() and p.suffix.lower() in wanted and not p.name.startswith(".")]
    return sorted(names, key=natural)


def entry_path(entry):
    """The file an existing entry points at, however it was written."""
    if isinstance(entry, str):
        ref = entry
    else:
        ref = entry.get("src") or entry.get("file") or ""
    ref = re.sub(r"^\.?/", "", str(ref))
    ref = re.sub(r"^exhibition/", "", ref)
    return ref.rsplit("/", 1)[-1]


def merge(folder, names, existing):
    """Keep what the host has written; follow what is on disk."""
    by_file = {}
    for e in existing or []:
        by_file[entry_path(e)] = e if isinstance(e, dict) else {}

    out = []
    for name in names:
        kept = dict(by_file.get(name, {}))
        kept["src"] = folder + "/" + name
        kept.pop("file", None)
        kept.setdefault("name", pathlib.Path(name).stem)
        out.append(kept)
    return out


def main():
    if not EXHIBITION.is_dir():
        sys.exit("no exhibition/ folder beside this script")

    old = {}
    if MANIFEST.is_file():
        try:
            text = MANIFEST.read_text(encoding="utf-8").strip()
            if text:
                old = json.loads(text)
        except ValueError:
            print("museum.json was not valid JSON - writing a fresh one")
            old = {}
    if old.get("format") == "student-art-museum":
        sys.exit("museum.json is a saved museum, not a file list.\n"
                 "That form is written by the site's own Save button and is left alone.\n"
                 "Delete it first if you want a plain list of the files instead.")

    images = scan("images", IMAGE_EXT)
    audio = scan("audio", AUDIO_EXT)

    doc = {
        "version": 1,
        "title": old.get("title", ""),
        "images": merge("images", images, old.get("images")),
        "audio": merge("audio", audio, old.get("audio")),
    }
    if not doc["title"]:
        del doc["title"]

    MANIFEST.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("museum.json  (%d image%s, %d track%s)"
          % (len(images), "" if len(images) == 1 else "s",
             len(audio), "" if len(audio) == 1 else "s"))
    for n in images + audio:
        print("   " + n)


if __name__ == "__main__":
    main()
