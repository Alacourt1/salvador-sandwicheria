export function $id(id) { return document.getElementById(id); }
export function $qsa(selector, root = document) { return root.querySelectorAll(selector); }
export function $qs(selector, root = document) { return root.querySelector(selector); }