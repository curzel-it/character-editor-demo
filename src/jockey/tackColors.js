import { palette, pigment } from "../palette.js";
import { silksRgb } from "./jockeySilks.js";

export const leather = pigment(0.07, 0.42, 0.2);
export const tack = pigment(0.06, 0.38, 0.13);

/** Cloth and padding colours: the rider's silks when one is up, otherwise the stable's plain kit. */
export const trimColors = (jockey) =>
  jockey ? silksRgb(jockey.silks) : { body: palette.ivory, accent: palette.steel, third: palette.steel };
