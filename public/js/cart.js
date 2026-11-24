/**
 * cart.js — попереднє замовлення (кошик).
 * Модель Zerno.cart зберігає дані й повідомляє підписників про зміни,
 * а Zerno.cartView перемальовує лічильник у шапці та панель «Ваше замовлення».
 */
window.Zerno = window.Zerno || {};

Zerno.cart = {
  STORAGE_KEY: "zerno-cart",
  items: [],          // [{ id, name, price, qty }]
  listeners: [],

  init() {
    this.items = Zerno.utils.load(this.STORAGE_KEY, []);
    // Зміни, зроблені в іншій вкладці, теж потрапляють на сторінку
    window.addEventListener("storage", (event) => {
      if (event.key === this.STORAGE_KEY) {
        this.items = Zerno.utils.load(this.STORAGE_KEY, []);
        this.notify();
      }
    });
  },

  subscribe(fn) {
    this.listeners.push(fn);
    fn(this);
  },

  notify() {
    Zerno.utils.save(this.STORAGE_KEY, this.items);
    this.listeners.forEach((fn) => fn(this));
  },

  find(id) {
    return this.items.find((item) => item.id === id);
  },

  add(product) {
    const existing = this.find(product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      this.items.push({ ...product, qty: 1 });
    }
    this.notify();
  },

  changeQty(id, delta) {
    const item = this.find(id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      this.remove(id);
      return;
    }
    this.notify();
  },

  remove(id) {
    this.items = this.items.filter((item) => item.id !== id);
    this.notify();
  },

  clear() {
    this.items = [];
    this.notify();
  },

  get count() {
    return this.items.reduce((sum, item) => sum + item.qty, 0);
  },

  get total() {
    return this.items.reduce((sum, item) => sum + item.qty * item.price, 0);
  },
};

Zerno.cartView = {
  init() {
    const { $, $$ } = Zerno.utils;
    this.counters = $$("[data-cart-count]");
    this.list = $("[data-order-list]");
    this.empty = $("[data-order-empty]");
    this.totalBox = $("[data-order-total]");
    this.sum = $("[data-order-sum]");
    this.clearBtn = $("[data-order-clear]");

    // Делегування подій: один обробник на весь документ для всіх кнопок «Додати»
    document.addEventListener("click", (event) => {
      const button = event.target.closest('[data-action="add"]');
      if (!button) return;
      const card = button.closest(".product");
      const product = {
        id: card.dataset.id,
        name: card.dataset.name,
        price: Number(card.dataset.price),
      };
      Zerno.cart.add(product);
      Zerno.utils.toast(`«${product.name}» додано до замовлення`);
      button.classList.add("is-added");
      button.textContent = "Додано ✓";
      setTimeout(() => {
        button.classList.remove("is-added");
        button.textContent = "Додати";
      }, 1200);
    });

    // Делегування в панелі замовлення: +, −, видалити
    if (this.list) {
      this.list.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-qty], button[data-remove]");
        if (!btn) return;
        const id = btn.closest("[data-id]").dataset.id;
        if (btn.dataset.remove !== undefined) {
          Zerno.cart.remove(id);
        } else {
          Zerno.cart.changeQty(id, Number(btn.dataset.qty));
        }
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener("click", () => {
        Zerno.cart.clear();
        Zerno.utils.toast("Замовлення очищено");
      });
    }

    Zerno.cart.subscribe(() => this.render());
  },

  render() {
    const { formatPrice } = Zerno.utils;
    const { items, count, total } = Zerno.cart;

    this.counters.forEach((el) => {
      if (el.textContent !== String(count)) {
        el.textContent = count;
        el.classList.remove("is-bumped");
        void el.offsetWidth; // перезапуск анімації
        el.classList.add("is-bumped");
      }
    });

    if (!this.list) return; // панель є лише на сторінці «Меню»

    // Динамічне створення рядків замовлення
    this.list.replaceChildren(...items.map((item) => {
      const li = document.createElement("li");
      li.className = "order__item";
      li.dataset.id = item.id;
      li.innerHTML = `
        <span class="order__name"></span>
        <button type="button" class="order__remove" data-remove aria-label="Видалити">×</button>
        <span class="qty">
          <button type="button" data-qty="-1" aria-label="Зменшити кількість">−</button>
          <span>${item.qty}</span>
          <button type="button" data-qty="1" aria-label="Збільшити кількість">+</button>
        </span>
        <span class="order__sum">${formatPrice(item.qty * item.price)}</span>`;
      li.querySelector(".order__name").textContent = item.name; // текст, а не HTML
      return li;
    }));

    const isEmpty = items.length === 0;
    this.empty.hidden = !isEmpty;
    this.totalBox.hidden = isEmpty;
    this.clearBtn.hidden = isEmpty;
    this.sum.textContent = formatPrice(total);
  },
};
