/* ============================================================
   STUDENT ART MUSEUM  --  shared state and small helpers.
   A single-page 3D gallery for Year 7-10 sketch and design work.
   ============================================================ */

/* ---------- element lookup ---------- */
const $ = id => document.getElementById(id);
function pad3(i) { return String(i).padStart(3, "0"); }

/* ---------- state ---------- */
const State = {
  art: [],        // {id,name,author,desc,src,aw,ah,featured}
  stickers: [],   // {artId, slot, type}
  nextId: 1,
  guest: false,                                      // joined with a code
  session: { code: null, title: "", published: null }
};

const STAMPS = {
  flower: { label: "Wonderful work",        color: "#F49AC1" },
  heart:  { label: "Amazing effort",        color: "#E8556D" },
  tick:   { label: "Excellent standard",    color: "#3AA655" },
  star:   { label: "Standout achievement",  color: "#F2B233" }
};

const SVG = {
  flower: '<svg viewBox="0 0 32 32"><g fill="#F49AC1"><circle cx="16" cy="7.5" r="5.6"/><circle cx="24.5" cy="13.7" r="5.6"/><circle cx="21.2" cy="23.7" r="5.6"/><circle cx="10.8" cy="23.7" r="5.6"/><circle cx="7.5" cy="13.7" r="5.6"/></g><circle cx="16" cy="16.5" r="4.4" fill="#FFD35C"/></svg>',
  heart:  '<svg viewBox="0 0 32 32"><path fill="#E8556D" d="M16 28C7 21.6 3 17.2 3 12.2 3 8.2 6.2 5 10.1 5c2.4 0 4.6 1.2 5.9 3.1C17.3 6.2 19.5 5 21.9 5 25.8 5 29 8.2 29 12.2c0 5-4 9.4-13 15.8z"/></svg>',
  tick:   '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#3AA655"/><path d="M9.5 16.6l4.4 4.4 8.8-9.2" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star:   '<svg viewBox="0 0 32 32"><path fill="#F2B233" stroke="#D9971A" stroke-width="1.2" stroke-linejoin="round" d="M16 2.6l4.2 8.6 9.5 1.4-6.9 6.7 1.7 9.4L16 24.2l-8.5 4.5 1.7-9.4L2.3 12.6l9.5-1.4z"/></svg>',
  erase:  '<svg viewBox="0 0 32 32"><path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" d="M11 25h14M7.5 21.5l9-9a3 3 0 014.2 0l4.3 4.3a3 3 0 010 4.2l-6 6H12z"/></svg>'
};

/* ---------- exhibition title ---------- */
function museumTitle() {
  return (State.session.title || "").trim() || "Student Art Museum";
}
