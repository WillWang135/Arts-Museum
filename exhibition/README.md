# The published exhibition

Whatever is described here is the museum a visitor sees when they open the
site. Nothing has to be imported by hand.

    exhibition/
      museum.json     what is in the show
      images/         the pictures
      audio/          the tracks (MP3)

`museum.json` is read once when the page opens. If it is missing, empty, or
not valid JSON, the site opens as an empty museum and says why in the browser
console — it never fails to load.

## Two ways to write it

**1. Save the museum from the site.** Arrange the exhibition on the home
screen — names, descriptions, rooms, the featured wall — press **Save**, and
drop the downloaded file in here as `museum.json`. This is the app's own save
format, so everything is preserved. Pictures already in `images/` are written
out as paths rather than copied into the file, which keeps it small.

**2. Write it by hand.** For a show that is just a folder of files, listing
the filenames is enough. Everything else is worked out on load — an image is
measured for its shape, a track is given a sleeve, and the title comes from
the filename:

```json
{
  "title": "Year 9 Showcase",
  "images": ["still-life.jpg", "self-portrait.png"],
  "audio": ["opening-theme.mp3"]
}
```

Any entry can carry its wall label instead of just a filename:

```json
{ "file": "still-life.jpg", "name": "Still Life", "author": "Ada Chen",
  "desc": "Charcoal on cartridge paper." }
```

## Adding the files

Dropping files into `images/` and `audio/` is not enough on its own. A static
site cannot read a folder — GitHub Pages serves files, and nothing it serves
says what is in a directory — so `museum.json` has to name them.

From the project folder:

```
python3 build-exhibition.py
```

That lists both folders into `museum.json`. Run it after adding or removing
files, then commit `museum.json` along with them. Anything you have written
against an entry — a name, an artist, a description, the room it hangs in — is
kept; only the list of files changes.

Paths are relative to this folder, so `"images/one.jpg"`, `"one.jpg"` and
`"exhibition/images/one.jpg"` all mean the same file.

## What visitors can and cannot change

A visitor can add their own pictures and tracks while they are looking round,
and those hang alongside the published ones for as long as the tab is open.
Nothing they add is written back here, and a refresh returns the site to
exactly what is in this folder.
