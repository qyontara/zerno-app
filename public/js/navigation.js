/**
 * navigation.js — інтерактивна навігація:
 * мобільне меню («бургер»), тінь шапки під час прокручування, кнопка «Нагору».
 */
window.Zerno = window.Zerno || {};

Zerno.navigation = {
  init() {
    const { $ } = Zerno.utils;
    this.toggle = $(".nav-toggle");
    this.nav = $("#main-nav");
    this.header = $(".site-header");
    this.toTop = $("[data-to-top]");

    if (this.toggle && this.nav) {
      this.toggle.addEventListener("click", () => this.setOpen(!this.isOpen()));

      // Закриття меню клавішею Escape
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.isOpen()) {
          this.setOpen(false);
          this.toggle.focus();
        }
      });

      // Закриття меню після кліку поза шапкою
      document.addEventListener("click", (event) => {
        if (this.isOpen() && !this.header.contains(event.target)) this.setOpen(false);
      });

      // Якщо вікно розширили до десктопа — скинути стан меню
      window.matchMedia("(min-width: 641px)").addEventListener("change", (event) => {
        if (event.matches) this.setOpen(false);
      });
    }

    window.addEventListener("scroll", () => this.onScroll(), { passive: true });
    this.onScroll();

    if (this.toTop) {
      this.toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  },

  isOpen() {
    return this.toggle.getAttribute("aria-expanded") === "true";
  },

  setOpen(open) {
    this.toggle.setAttribute("aria-expanded", String(open));
    this.toggle.setAttribute("aria-label", open ? "Закрити меню" : "Відкрити меню");
    this.nav.classList.toggle("is-open", open);
  },

  onScroll() {
    const y = window.scrollY;
    this.header.classList.toggle("is-scrolled", y > 10);
    if (this.toTop) this.toTop.hidden = y < 500;
  },
};
