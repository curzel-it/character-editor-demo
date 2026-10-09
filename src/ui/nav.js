import { icon } from "./icons.js";
import { t } from "../i18n.js";

export const tabs = [
  { id: "stable", icon: "home", href: "#/stable" },
  { id: "race", icon: "race", href: "#/race" },
  { id: "altar", icon: "altar", href: "#/altar" },
  { id: "more", icon: "settings", href: "#/more" },
];

export function renderNav(nav) {
  nav.style.setProperty("--n", tabs.length);
  nav.innerHTML = tabs.map((tab) => `<a class="dz-nav__item" href="${tab.href}" data-tab="${tab.id}">${icon(tab.icon)}${t(`nav.${tab.id}`)}</a>`).join("");
}

export function setActiveTab(nav, id) {
  for (const link of nav.querySelectorAll("[data-tab]")) {
    if (link.dataset.tab === id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}
