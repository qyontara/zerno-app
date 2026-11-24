/**
 * faq.js — акордеон «Часті запитання».
 * Одночасно відкрита лише одна відповідь; працює з клавіатури (Enter / Пробіл),
 * бо заголовки питань — це кнопки.
 */
window.Zerno = window.Zerno || {};

Zerno.faq = {
  init() {
    this.root = Zerno.utils.$("[data-faq]");
    if (!this.root) return;

    this.root.addEventListener("click", (event) => {
      const button = event.target.closest(".faq__q button");
      if (!button) return;
      const willOpen = button.getAttribute("aria-expanded") !== "true";
      this.closeAll();
      if (willOpen) this.setOpen(button, true);
    });
  },

  setOpen(button, open) {
    button.setAttribute("aria-expanded", String(open));
    document.getElementById(button.getAttribute("aria-controls")).hidden = !open;
  },

  closeAll() {
    Zerno.utils.$$(".faq__q button", this.root).forEach((b) => this.setOpen(b, false));
  },
};
