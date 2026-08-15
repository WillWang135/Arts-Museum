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
    cove: new THREE.MeshBasicMaterial({ color: 0xFFEBCB }),
    blob: new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.5 }),
    /* the artwork click target must never touch the colour or depth buffer */
    hit: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0 })
  };
}
