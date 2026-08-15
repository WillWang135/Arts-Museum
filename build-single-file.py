#!/usr/bin/env python3
"""
Squash the museum back into ONE self-contained .html file.

    python3 build-single-file.py

Writes student-art-museum-single.html: every stylesheet and script
inlined, nothing else beside it needed. That is the file to AirDrop,
email, or drop on a USB stick - handy for phones and tablets, where
opening a folder of files is awkward.

The multi-file version stays the one you edit. Re-run this after any
change, or the single file will quietly be out of date.
"""

import re
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent

# index.html once the site is on GitHub Pages; the original name before that.
CANDIDATES = ("index.html", "student-art-museum.html")
SOURCE = next((ROOT / n for n in CANDIDATES if (ROOT / n).is_file()), None)
TARGET = ROOT / "student-art-museum-single.html"

BANNER = """<!-- ============================================================
     GENERATED FILE - do not edit.

     Built from the page + css/ + js/ by
     build-single-file.py. Edit those, then re-run the script.
     ============================================================ -->
"""


def read(rel):
    path = ROOT / rel
    if not path.is_file():
        sys.exit("missing file: %s (referenced by the HTML)" % rel)
    text = path.read_text(encoding="utf-8").rstrip()
    # A literal </script> or </style> inside a source file would close the
    # tag early and split the file in half. Nothing does this today; catch
    # it here rather than shipping a silently broken page.
    for tag in ("</script", "</style"):
        if tag in text:
            sys.exit("%s contains %s> - it cannot be inlined safely" % (rel, tag))
    return text


def inline_css(match):
    href = match.group(1)
    return '<style>\n/* ===== %s ===== */\n%s\n</style>' % (href, read(href))


def inline_js(match):
    src = match.group(1)
    if src.startswith(("http://", "https://", "//")):
        return match.group(0)          # leave the three.js CDN tag alone
    return '<script>\n/* ===== %s ===== */\n%s\n</script>' % (src, read(src))


def main():
    if SOURCE is None:
        sys.exit("cannot find the page - looked for: " + ", ".join(CANDIDATES))

    html = SOURCE.read_text(encoding="utf-8")

    html, css_n = re.subn(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
    html, js_n = re.subn(r'<script src="([^"]+)"[^>]*></script>', inline_js, html)

    # the CDN tag is matched but returned unchanged, so it is not a real inline
    js_n -= sum(1 for m in re.finditer(r'<script src="(https?:|//)[^"]*"', html))

    html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + BANNER, 1)

    if 'href="css/' in html or re.search(r'<script src="(?!http)', html):
        sys.exit("something was left un-inlined - the output would not be standalone")

    TARGET.write_text(html, encoding="utf-8")

    kb = TARGET.stat().st_size / 1024
    print("%s  (%d stylesheets + %d scripts inlined, %.0f KB)"
          % (TARGET.name, css_n, js_n, kb))
    print("Self-contained: copy just this one file anywhere.")


if __name__ == "__main__":
    main()
