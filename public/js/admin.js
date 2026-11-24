/**
 * admin.js — адмін-панель: вхід за токеном, перегляд, зміна статусу та видалення заявок.
 * Токен зберігається лише в sessionStorage і зникає після закриття вкладки.
 */
window.Zerno = window.Zerno || {};

Zerno.admin = {
  TOKEN_KEY: "zerno-admin-token",
  GUESTS: { "1-2": "1–2", "3-4": "3–4", "5-8": "5–8", hall: "Увесь зал" },
  STATUSES: { new: "Нова", confirmed: "Підтверджена", cancelled: "Скасована" },

  init() {
    const { $ } = Zerno.utils;
    this.el = {
      login: $("[data-login]"),
      loginForm: $("[data-login-form]"),
      loginError: $("[data-login-error]"),
      dashboard: $("[data-dashboard]"),
      rows: $("[data-rows]"),
      noRows: $("[data-no-rows]"),
      stats: $("[data-stats]"),
      filter: $("[data-status-filter]"),
      logout: $("[data-logout]"),
    };

    this.el.loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const token = this.el.loginForm.elements.token.value.trim();
      if (!token) {
        this.el.loginError.textContent = "Введіть токен";
        return;
      }
      this.login(token);
    });
    this.el.logout.addEventListener("click", () => this.logout());
    this.el.filter.addEventListener("change", () => this.load());
    $("[data-refresh]").addEventListener("click", () => this.load());

    // Делегування: зміна статусу і видалення в будь-якому рядку таблиці
    this.el.rows.addEventListener("change", (event) => {
      if (event.target.matches("[data-status]")) {
        this.changeStatus(event.target.closest("tr").dataset.id, event.target.value);
      }
    });
    this.el.rows.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete]");
      if (button) this.remove(button);
    });

    const saved = sessionStorage.getItem(this.TOKEN_KEY);
    if (saved) this.login(saved);
  },

  async login(token) {
    this.token = token;
    try {
      await this.load();
      sessionStorage.setItem(this.TOKEN_KEY, token);
      this.el.login.hidden = true;
      this.el.dashboard.hidden = false;
      this.el.logout.hidden = false;
      this.el.loginError.textContent = "";
    } catch (error) {
      this.token = null;
      sessionStorage.removeItem(this.TOKEN_KEY);
      this.el.loginError.textContent = error.status === 401 ? "Неправильний токен" : error.message;
    }
  },

  logout() {
    sessionStorage.removeItem(this.TOKEN_KEY);
    this.token = null;
    this.el.dashboard.hidden = true;
    this.el.logout.hidden = true;
    this.el.login.hidden = false;
    this.el.loginForm.reset();
  },

  async load() {
    const bookings = await Zerno.api.listBookings(this.token, this.el.filter.value);
    this.render(bookings);
  },

  render(bookings) {
    this.el.rows.replaceChildren(...bookings.map((b) => this.row(b)));
    this.el.noRows.hidden = bookings.length > 0;
    const fresh = bookings.filter((b) => b.status === "new").length;
    this.el.stats.textContent = `Показано заявок: ${bookings.length}. Нових: ${fresh}.`;
  },

  row(b) {
    const tr = document.createElement("tr");
    tr.dataset.id = b.id;
    tr.className = `is-${b.status}`;
    const date = new Date(`${b.date}T${b.time}`).toLocaleString("uk-UA", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const cells = [b.id, date, b.name, b.phone, this.GUESTS[b.guests] || b.guests, b.comment || "—"];
    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value; // лише текст: захист від XSS у даних користувача
      tr.append(td);
    });

    const statusCell = document.createElement("td");
    const select = document.createElement("select");
    select.dataset.status = "";
    select.setAttribute("aria-label", `Статус заявки № ${b.id}`);
    Object.entries(this.STATUSES).forEach(([value, label]) => select.add(new Option(label, value, false, value === b.status)));
    statusCell.append(select);

    const actions = document.createElement("td");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn btn--secondary btn--small";
    del.dataset.delete = "";
    del.textContent = "Видалити";
    actions.append(del);

    tr.append(statusCell, actions);
    return tr;
  },

  async changeStatus(id, status) {
    try {
      await Zerno.api.updateStatus(this.token, id, status);
      Zerno.utils.toast(`Заявка № ${id}: статус «${this.STATUSES[status]}»`);
      await this.load();
    } catch (error) {
      Zerno.utils.toast(error.message);
    }
  },

  /** Видалення у два кліки: перший просить підтвердження, другий видаляє. */
  async remove(button) {
    const id = button.closest("tr").dataset.id;
    if (!button.dataset.confirm) {
      button.dataset.confirm = "1";
      button.textContent = "Точно видалити?";
      setTimeout(() => {
        delete button.dataset.confirm;
        button.textContent = "Видалити";
      }, 3000);
      return;
    }
    try {
      await Zerno.api.deleteBooking(this.token, id);
      Zerno.utils.toast(`Заявку № ${id} видалено`);
      await this.load();
    } catch (error) {
      Zerno.utils.toast(error.message);
    }
  },
};

Zerno.admin.init();
