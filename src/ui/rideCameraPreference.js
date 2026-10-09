const storageKey = "dragonz-ride-camera";
export const rideCameras = ["chase", "rider"];

/** The camera this device last rode with, chase by default. */
export function loadRideCamera() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (rideCameras.includes(saved)) return saved;
  } catch {
    /* Storage is optional. */
  }
  return rideCameras[0];
}

export function saveRideCamera(id) {
  try {
    localStorage.setItem(storageKey, id);
  } catch {
    /* The camera still applies for this flight. */
  }
}
