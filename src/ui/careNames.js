import { t } from "../i18n.js";

/** A need's name, such as `Fed`. @param {string} id */
export const needName = (id) => t(`careNames.needs.${id}`);

/** A care action's name, such as `Feed`. @param {string} id */
export const careActionName = (id) => t(`careNames.actions.${id}`);
