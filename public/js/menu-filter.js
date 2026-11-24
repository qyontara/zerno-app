/**
 * menu-filter.js — фільтр меню за категорією та пошук за назвою.
 * Сторінка не перезавантажується: картки приховуються або показуються,
 * а повідомлення про кількість результатів оновлюється динамічно.
 */
window.Zerno = window.Zerno || {};

Zerno.menuFilter = {
  state: { category: "all", query: "" },

  init() {
    const { $, $$, debounce } = Zerno.utils;
    this.group = $("[data-filter-group]");
    if (!this.group) return; // компонент є лише на сторінці «Меню»

    this.search = $("#menu-search");
    this.cards = $$(".product[data-category]");
    this.sections = $$(".menu-category");
    this.status = $("[data-menu-status]");
    this.empty = $("[data-empty]");

    // Делегування: один обробник на групу кнопок-фільтрів
    this.group.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      this.state.category = button.dataset.filter;
      $$("[data-filter]", this.group).forEach((b) => {
        const active = b === button;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      this.apply();
    });

    this.search.addEventListener("input", debounce(() => {
      this.state.query = this.search.value.trim().toLowerCase();
      this.apply();
    }, 200));

    // Посилання з головної виду menu.html#cold одразу вмикає потрібний фільтр
    const fromHash = location.hash.slice(1);
    const preset = fromHash && $(`[data-filter="${fromHash}"]`, this.group);
    if (preset) preset.click();
    else this.apply();
  },

  /** Повторно зчитує картки (після завантаження меню з сервера). */
  reload() {
    if (!this.group) return;
    this.cards = Zerno.utils.$$(".product[data-category]");
    this.apply();
  },

  matches(card) {
    const { category, query } = this.state;
    const byCategory = category === "all" || card.dataset.category === category;
    const byQuery = !query || card.dataset.name.toLowerCase().includes(query);
    return byCategory && byQuery;
  },

  apply() {
    const { plural } = Zerno.utils;
    let visible = 0;

    this.cards.forEach((card) => {
      const show = this.matches(card);
      card.classList.toggle("is-hidden", !show);
      if (show) visible += 1;
    });

    // Ховаємо заголовок категорії, якщо в ній не залишилось карток
    this.sections.forEach((section) => {
      const hasVisible = section.querySelector(".product:not(.is-hidden)");
      section.classList.toggle("is-hidden", !hasVisible);
    });

    this.empty.hidden = visible > 0;
    const total = this.cards.length;
    this.status.textContent = visible === total
      ? `Усього ${total} ${plural(total, "позиція", "позиції", "позицій")}`
      : `Знайдено ${visible} ${plural(visible, "позицію", "позиції", "позицій")} з ${total}`;
  },
};
