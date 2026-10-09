export const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);
