import { dressOwner, renameOwner, restyleOwner } from "../../stable/owner.js";
import { createRiderMaker } from "../riderMaker.js";
import { createMeadowStage } from "../meadowStage.js";
import { t } from "../../i18n.js";

const TURN = 0.8,
  FACE_TURN = 0.45,
  FACE_SHARE = 0.3;

/**
 * More > Profile, a developer tool: the owner as the rider of every owned dragon, standing in a band of meadow that stays on top while the rider maker scrolls under it.
 */
export function createOwnerProfileScreen(ctx) {
  const { game, module } = ctx;
  const el = document.createElement("section");
  el.className = "screen owner-profile";
  el.innerHTML = `
    <div class="owner-profile__stage" data-stage></div>
    <div class="dz-card dz-card--parchment owner-profile__maker" data-maker></div>
    <p class="dz-caption owner-profile__caption">${t("ownerProfileScreen.caption")}</p>`;
  const $ = (selector) => el.querySelector(selector);
  const stage = createMeadowStage(module, { onTap() {} });
  $("[data-stage]").append(stage.el);
  const frame = () => (maker.closeUp() ? stage.pick(0, true, FACE_TURN, FACE_SHARE) : stage.pick(0, false, TURN));
  const showRider = () => stage.setItems([{ rider: maker.shown() }]);
  const showTitle = () => ctx.setTitle(game.stable.owner.name);

  const maker = createRiderMaker({
    id: "owner",
    rider: () => game.stable.owner,
    onChange({ name, look, silks }) {
      if (name !== undefined) renameOwner(game.stable, name);
      if (look) restyleOwner(game.stable, look);
      if (silks) dressOwner(game.stable, silks);
      ctx.save();
      maker.render();
      showRider();
      showTitle();
    },
    onFocus() {
      stage.orbit.reset();
      frame();
      showRider();
    },
  });
  $("[data-maker]").append(maker.el);
  let following = false;

  function render() {
    showTitle();
    frame();
    showRider();
    maker.render();
  }

  return {
    el,
    show() {
      const scroller = el.closest(".screens");
      if (scroller && !following) {
        maker.follow(scroller, () => $("[data-stage]").getBoundingClientRect().bottom);
        following = true;
      }
      render();
      stage.show();
    },
    hide() {
      stage.hide();
    },
    setStyle(id) {
      stage.setStyle(id);
    },
    tick() {},
    render,
  };
}
