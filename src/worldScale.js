// Dragons are modelled at a reference size and scaled so the average wingspan is 16 m.
export const creatureScale = 16 / 12.3;
// Froude scaling: speeds grow by `speedScale` (average top speed 200 km/h) and the race world by its
// square, so gravity-driven flight keeps the character it was tuned with. Times grow by `speedScale`.
export const speedScale = 200 / 3.6 / 35;
export const lengthScale = speedScale ** 2;
