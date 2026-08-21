/* ============================================================
   MATERIALS  --  shared across every rebuild, never disposed.
   ============================================================ */
let MAT = null;
function buildMaterials() {
  MAT = {
    floor: new THREE.MeshStandardMaterial({ map: woodFloorTexture(), roughness: 0.4, metalness: 0.03 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xF1ECE2, roughness: 0.96 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xFBF8F2, roughness: 0.98, side: THREE.DoubleSide }),
    trim: new THREE.MeshStandardMaterial({ color: 0xE7E0D2, roughness: 0.7 }),
    base: new THREE.MeshStandardMaterial({ color: 0x3A3833, roughness: 0.5, metalness: 0.12 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xC7A85C, metalness: 0.85, roughness: 0.33 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xC9A961, metalness: 0.92, roughness: 0.26 }),
    bronzeDark: new THREE.MeshStandardMaterial({ color: 0x39413F, metalness: 0.62, roughness: 0.42 }),
    mat: new THREE.MeshStandardMaterial({ color: 0xFCFAF4, roughness: 0.94 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xDDD6C8, roughness: 0.58, metalness: 0.05 }),
    darkStone: new THREE.MeshStandardMaterial({ color: 0x272C31, roughness: 0.78 }),
    porcelain: new THREE.MeshStandardMaterial({ color: 0xF4F1EA, roughness: 0.18, metalness: 0.06 }),
    glaze: new THREE.MeshStandardMaterial({ color: 0x0E4C44, roughness: 0.14, metalness: 0.18 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0xA97142, metalness: 0.88, roughness: 0.34 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x715C45, roughness: 0.55 }),
    ropeMat: new THREE.MeshStandardMaterial({ color: 0x333A40, roughness: 0.92 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x36613F, roughness: 0.85 }),

    /* ---- the gallery palette ----
       Cream limestone, speckled travertine, terracotta, olive and charcoal,
       with a pale oak for the furniture legs. Everything decorative in the
       building is cut from one of these six, which is what holds the rooms
       together as a designed space rather than a collection of objects. */
    travertine: new THREE.MeshStandardMaterial({ map: travertineTexture(), roughness: 0.72, metalness: 0.0 }),
    limestone: new THREE.MeshStandardMaterial({ color: 0xE9E2D2, roughness: 0.82 }),
    limestoneLo: new THREE.MeshStandardMaterial({ color: 0xE3DBC9, roughness: 0.8, flatShading: true }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xC26A3C, roughness: 0.68 }),
    terracottaLo: new THREE.MeshStandardMaterial({ color: 0xBC6537, roughness: 0.66, flatShading: true }),
    olive: new THREE.MeshStandardMaterial({ color: 0x5B6248, roughness: 0.76 }),
    oliveLo: new THREE.MeshStandardMaterial({ color: 0x565D45, roughness: 0.74, flatShading: true }),
    charcoal: new THREE.MeshStandardMaterial({ color: 0x33383B, roughness: 0.66 }),
    charcoalLo: new THREE.MeshStandardMaterial({ color: 0x2F3437, roughness: 0.64, flatShading: true }),
    linen: new THREE.MeshStandardMaterial({ color: 0xE7DFCC, roughness: 0.92 }),
    paleWood: new THREE.MeshStandardMaterial({ color: 0xA97A4E, roughness: 0.62 }),
    pebble: new THREE.MeshStandardMaterial({ color: 0xD9D2C3, roughness: 0.8, flatShading: true }),
    /* Case glass. Barely there, and never writing to the depth buffer, so
       what is inside it is not sorted away by the box around it. */
    vitrine: new THREE.MeshStandardMaterial({ color: 0xDCE6E6, roughness: 0.06, metalness: 0.02,
      transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    leafDeep: new THREE.MeshStandardMaterial({ color: 0x2F5138, roughness: 0.86, side: THREE.DoubleSide }),
    leafMid: new THREE.MeshStandardMaterial({ color: 0x3E6B45, roughness: 0.84, side: THREE.DoubleSide }),
    cove: new THREE.MeshBasicMaterial({ color: 0xFFEBCB }),
    blob: new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.5 }),
    /* the artwork click target must never touch the colour or depth buffer */
    hit: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 })
  };
}
