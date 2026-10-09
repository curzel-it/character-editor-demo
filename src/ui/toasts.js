import { icon } from "./icons.js";
import { playUi } from "../sound/uiSounds.js";

/** Short notices that pop in under the top bar and fade on their own, led by an optional icon. */
export function createToasts(host) {
  return function notify(message, iconName = null) {
    const toast = document.createElement("div");
    toast.className = "dz-toast";
    toast.textContent = message;
    if (iconName) toast.insertAdjacentHTML("afterbegin", icon(iconName));
    host.append(toast);
    while (host.children.length > 3) host.firstElementChild.remove();
    toast.addEventListener("animationend", () => toast.remove());
    playUi(iconName === "star" ? "reward" : "toast");
  };
}
