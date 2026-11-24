/**
 * menu-api.js — завантаження меню з сервера (GET /api/menu).
 * Статичні картки в HTML залишаються як запасний варіант: якщо сервер недоступний,
 * користувач усе одно бачить меню.
 */
window.Zerno = window.Zerno || {};

Zerno.menuApi = {
  ICONS: {
    coffee: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 24h36v14a16 16 0 0 1-16 16h-4A16 16 0 0 1 10 38z" fill="#4a2a19"/><path d="M46 28h4a7 7 0 0 1 0 14h-5" fill="none" stroke="#4a2a19" stroke-width="4"/><path d="M20 8c-3 4 3 6 0 10M30 8c-3 4 3 6 0 10M40 8c-3 4 3 6 0 10" fill="none" stroke="#4a2a19" stroke-width="3" stroke-linecap="round"/></svg>',
    cold: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 10h32l-4 44H20z" fill="#4a2a19"/><path d="M18 24h28" stroke="#f3e6d8" stroke-width="3"/><path d="M38 4l-6 20" stroke="#e0a458" stroke-width="4"/></svg>',
    bakery: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M6 40c4-16 16-24 26-24s22 8 26 24c-6-4-10-4-14-2-4-6-8-8-12-8s-8 2-12 8c-4-2-8-2-14 2z" fill="#4a2a19"/><path d="M24 30l4 10M40 30l-4 10M32 26v12" stroke="#f3e6d8" stroke-width="2"/></svg>',
  },

  async init() {
    const grids = document.querySelectorAll(".menu-category .grid");
    if (!grids.length || !Zerno.api.available) return;

    try {
      const items = await Zerno.api.getMenu();
      document.querySelectorAll(".menu-category").forEach((section) => {
        const grid = section.querySelector(".grid");
        const list = items.filter((item) => item.category === section.id);
        grid.replaceChildren(...list.map((item) => this.card(item)));
      });
      Zerno.menuFilter.reload(); // фільтр має знати про нові картки
      document.body.dataset.menuSource = "api";
    } catch (error) {
      console.warn("Меню з сервера не завантажено, показано статичну версію:", error.message);
    }
  },

  /** Створює картку товару; текст вставляється через textContent. */
  card(item) {
    const article = document.createElement("article");
    article.className = "product";
    Object.assign(article.dataset, { id: item.id, name: item.name, price: item.price, category: item.category });
    article.innerHTML = `
      <div class="product__media">${this.ICONS[item.category] || ""}</div>
      <div class="product__body">
        <h3></h3>
        <p></p>
        <div class="product__footer">
          <span class="price"></span>
          <button class="btn btn--small" type="button" data-action="add">Додати</button>
        </div>
      </div>`;
    if (item.badge) {
      const badge = document.createElement("span");
      badge.className = "badge product__badge";
      badge.textContent = item.badge;
      article.querySelector(".product__media").prepend(badge);
    }
    article.querySelector("h3").textContent = item.name;
    article.querySelector("p").textContent = item.description;
    article.querySelector(".price").textContent = Zerno.utils.formatPrice(item.price);
    return article;
  },
};
