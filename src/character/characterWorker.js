import { createCharacter } from "./characterAnatomy.js";
import { lightCharacter } from "./characterBuild.js";

/** Builds characters off the main thread: `{ id, spec, round }` in, a light anatomy with its prebuilt skin out. */
self.onmessage = (event) => {
  const { id, spec, round } = event.data;
  try {
    const anatomy = lightCharacter(createCharacter(spec), round);
    const { data } = anatomy.prebuilt;
    self.postMessage({ id, anatomy }, [data.vertices.buffer, data.metals.buffer, data.markings.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error?.stack ?? error) });
  }
};
