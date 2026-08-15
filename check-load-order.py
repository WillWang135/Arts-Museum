#!/usr/bin/env python3
"""
Catch the one mistake this project's file layout makes easy.

    python3 check-load-order.py

The scripts are plain <script> tags sharing one scope, so a file can only
use what the files above it have already defined. Code inside a function
is fine - it runs later, once everything is loaded. Code that runs at load
time is not.

The bug that motivated this:

    js/hud.js       $("exit-btn").addEventListener("click", exitMuseum);
    js/main.js      function exitMuseum() { ... }        <- loads afterwards

hud.js names exitMuseum while main.js is still unparsed, so it throws, the
listener is never attached, and the button is silently dead for the rest of
the session. The fix is to defer the lookup:

    $("exit-btn").addEventListener("click", () => exitMuseum());

Exit status 1 if anything is wrong, so it can gate a commit or CI step.
"""

import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
CANDIDATES = ("index.html", "student-art-museum.html")

# statement keywords that look like a call but are not
KEYWORDS = {
    "if", "for", "while", "switch", "catch", "return", "function", "typeof",
    "new", "delete", "void", "throw", "else", "do", "try", "with", "yield",
    "await", "super", "this", "case", "in", "of", "instanceof",
}

DECL = re.compile(r"^(?:function\s+|const\s+|let\s+|var\s+|class\s+)([A-Za-z_$][\w$]*)")
LISTENER = re.compile(r'addEventListener\(\s*[\'"][^\'"]+[\'"]\s*,\s*([A-Za-z_$][\w$]*)\s*[,)]')
CALL = re.compile(r"^([A-Za-z_$][\w$]*)\s*\(")


def load_order(html):
    return re.findall(r'<script src="js/([^"]+)\.js"></script>', html)


def main():
    source = next((ROOT / n for n in CANDIDATES if (ROOT / n).is_file()), None)
    if source is None:
        sys.exit("cannot find the page - looked for: " + ", ".join(CANDIDATES))

    order = load_order(source.read_text(encoding="utf-8"))
    if not order:
        sys.exit("no <script src=\"js/...\"> tags found in %s" % source.name)

    files = {}
    for name in order:
        path = ROOT / "js" / (name + ".js")
        if not path.is_file():
            sys.exit("%s lists js/%s.js, which does not exist" % (source.name, name))
        files[name] = path.read_text(encoding="utf-8").split("\n")

    # first file index that declares each top-level name
    declared_in = {}
    for i, name in enumerate(order):
        for line in files[name]:
            m = DECL.match(line)
            if m and m.group(1) not in declared_in:
                declared_in[m.group(1)] = i

    problems = []

    def flag(fi, lineno, ident, what):
        where = declared_in.get(ident)
        if where is None:
            return                                  # a browser global, or a typo
        if where > fi:
            problems.append((order[fi], lineno, ident, order[where], what))

    for i, name in enumerate(order):
        for n, line in enumerate(files[name], 1):
            # Only column-0 lines run at load time; anything indented sits
            # inside a function body and is therefore deferred.
            if not line or line[0].isspace():
                continue

            # A bare name handed to addEventListener is evaluated immediately,
            # even though the handler itself runs later.
            for ident in LISTENER.findall(line):
                flag(i, n, ident, "handler")

            # A top-level call executes right now.
            m = CALL.match(line)
            if m and m.group(1) not in KEYWORDS:
                flag(i, n, m.group(1), "call")

    print("%s -> %d scripts, %d top-level names" % (source.name, len(order), len(declared_in)))

    if not problems:
        print("OK: nothing at load time depends on a file that loads later.")
        return 0

    print("\n%d problem(s):\n" % len(problems))
    for f, n, ident, owner, what in problems:
        print("  js/%s.js:%d" % (f, n))
        print("      %s '%s' is declared later, in js/%s.js" % (what, ident, owner))
        if what == "handler":
            print("      fix: pass () => %s() instead of %s" % (ident, ident))
        else:
            print("      fix: move js/%s.js earlier, or defer the call" % owner)
        print("")
    return 1


if __name__ == "__main__":
    sys.exit(main())
