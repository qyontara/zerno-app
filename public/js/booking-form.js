/**
 * booking-form.js — клієнтська перевірка форми бронювання.
 * Кожне поле має власну функцію-перевірку (об'єкт validators).
 * Помилка показується під полем після того, як користувач залишив поле
 * або натиснув «Надіслати»; під час виправлення повідомлення оновлюється одразу.
 */
window.Zerno = window.Zerno || {};

Zerno.schedule = {
  // Неділя = 0 … субота = 6; [відкриття, закриття] у годинах
  hours: { 0: [9, 20], 1: [8, 21], 2: [8, 21], 3: [8, 21], 4: [8, 21], 5: [8, 21], 6: [9, 22] },

  forDate(date) {
    return this.hours[date.getDay()];
  },

  isOpenNow(now = new Date()) {
    const [open, close] = this.forDate(now);
    const h = now.getHours() + now.getMinutes() / 60;
    return h >= open && h < close;
  },
};

Zerno.bookingForm = {
  touched: new Set(),

  /** Перевірки повертають текст помилки або порожній рядок. */
  validators: {
    name(value) {
      const v = value.trim();
      if (!v) return "Вкажіть ім'я";
      if (v.length < 2) return "Ім'я має містити щонайменше 2 літери";
      if (v.length > 50) return "Ім'я задовге (максимум 50 символів)";
      if (!/^[A-Za-zА-ЩЬЮЯҐЄІЇа-щьюяґєії' -]+$/.test(v)) return "Ім'я може містити лише літери, пробіл, апостроф і дефіс";
      return "";
    },

    phone(value) {
      const v = Zerno.bookingForm.normalizePhone(value);
      if (!v) return "Вкажіть номер телефону";
      if (!/^\+380\d{9}$/.test(v)) return "Формат номера: +380XXXXXXXXX (12 цифр після «+»)";
      return "";
    },

    date(value) {
      if (!value) return "Оберіть дату";
      const chosen = new Date(`${value}T00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (chosen < today) return "Дата не може бути в минулому";
      const max = new Date(today);
      max.setDate(max.getDate() + 60);
      if (chosen > max) return "Бронювання доступне максимум на 60 днів наперед";
      return "";
    },

    time(value, form) {
      if (!value) return "Оберіть час";
      const dateValue = form.elements.date.value;
      if (!dateValue) return "Спочатку оберіть дату";
      const day = new Date(`${dateValue}T00:00`);
      const [open, close] = Zerno.schedule.forDate(day);
      const [h, m] = value.split(":").map(Number);
      const t = h + m / 60;
      if (t < open || t > close - 1) {
        return `У цей день бронювання можливе з ${String(open).padStart(2, "0")}:00 до ${close - 1}:00`;
      }
      const visit = new Date(`${dateValue}T${value}`);
      if (visit < new Date()) return "Цей час уже минув";
      return "";
    },

    guests(value) {
      return value ? "" : "Оберіть кількість гостей";
    },

    comment(value) {
      return value.length > 300 ? "Коментар задовгий (максимум 300 символів)" : "";
    },
  },

  init() {
    const { $ } = Zerno.utils;
    this.form = $("#booking-form");
    this.initOpenStatus();
    if (!this.form) return;

    this.summary = $("[data-form-summary]");
    this.success = $("[data-form-success]");
    this.counter = $("[data-counter]");

    // Не можна обрати дату раніше за сьогодні
    this.form.elements.date.min = this.toISODate(new Date());

    // Перевірка поля, коли користувач його залишає
    this.form.addEventListener("focusout", (event) => {
      const field = event.target;
      if (!(field.name in this.validators)) return;
      this.touched.add(field.name);
      this.check(field.name);
    });

    // Оновлення під час введення (лише для полів, які вже перевірялися)
    this.form.addEventListener("input", (event) => {
      const { name } = event.target;
      if (name === "comment") this.updateCounter();
      if (this.touched.has(name)) this.check(name);
      // Зміна дати впливає на допустимий час
      if (name === "date" && this.touched.has("time")) this.check("time");
    });

    this.form.addEventListener("submit", (event) => this.onSubmit(event));

    $("[data-form-again]").addEventListener("click", () => {
      this.success.hidden = true;
      this.form.hidden = false;
      this.form.elements.name.focus();
    });
  },

  normalizePhone(value) {
    return value.replace(/[\s()-]/g, "");
  },

  toISODate(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  },

  /** Перевіряє одне поле і показує / прибирає повідомлення. */
  check(name) {
    const field = this.form.elements[name];
    const message = this.validators[name](field.value, this.form);
    const wrapper = field.closest(".field");
    const errorBox = document.getElementById(`${name}-error`);
    errorBox.textContent = message;
    wrapper.classList.toggle("has-error", Boolean(message));
    wrapper.classList.toggle("is-valid", !message && field.value !== "");
    field.setAttribute("aria-invalid", String(Boolean(message)));
    return message;
  },

  updateCounter() {
    const length = this.form.elements.comment.value.length;
    this.counter.textContent = `${length} / 300`;
    this.counter.classList.toggle("is-limit", length >= 280);
  },

  /** Збирає дані форми в об'єкт. */
  getData() {
    const data = Object.fromEntries(new FormData(this.form));
    data.name = data.name.trim();
    data.phone = this.normalizePhone(data.phone);
    data.comment = data.comment.trim();
    return data;
  },

  onSubmit(event) {
    event.preventDefault();
    const names = Object.keys(this.validators);
    names.forEach((n) => this.touched.add(n));
    const errors = names.map((n) => [n, this.check(n)]).filter(([, msg]) => msg);

    if (errors.length) {
      this.summary.hidden = false;
      this.summary.textContent = `Перевірте форму: ${errors.length} ${Zerno.utils.plural(errors.length, "поле заповнено", "поля заповнено", "полів заповнено")} неправильно.`;
      this.form.elements[errors[0][0]].focus();
      return;
    }

    this.summary.hidden = true;
    this.submit(this.getData());
  },

  /**
   * Надсилання заявки на сервер (POST /api/bookings).
   * Якщо сайт відкрито як файл без сервера, заявка зберігається в браузері (режим ЛР № 4).
   */
  async submit(data) {
    if (!Zerno.api.available) {
      const bookings = Zerno.utils.load("zerno-bookings", []);
      const booking = { id: bookings.length + 1, ...data };
      bookings.push(booking);
      Zerno.utils.save("zerno-bookings", bookings);
      this.showSuccess(booking);
      return;
    }

    const button = this.form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = "Надсилаємо…";
    try {
      const booking = await Zerno.api.createBooking(data);
      this.showSuccess(booking);
    } catch (error) {
      // Сервер повернув помилки окремих полів — показуємо їх біля полів
      Object.entries(error.fields || {}).forEach(([name, message]) => {
        const errorBox = document.getElementById(`${name}-error`);
        if (!errorBox) return;
        errorBox.textContent = message;
        this.form.elements[name].closest(".field").classList.add("has-error");
        this.form.elements[name].setAttribute("aria-invalid", "true");
      });
      this.summary.hidden = false;
      this.summary.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Надіслати заявку";
    }
  },

  showSuccess(booking) {
    const date = new Date(`${booking.date}T${booking.time}`).toLocaleString("uk-UA", {
      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });
    Zerno.utils.$("[data-success-text]").textContent =
      `Заявка № ${booking.id}: ${booking.name}, ${date}. Ми зателефонуємо на ${booking.phone} протягом 15 хвилин.`;
    this.form.reset();
    this.touched.clear();
    this.updateCounter();
    Zerno.utils.$$(".field", this.form).forEach((f) => f.classList.remove("is-valid", "has-error"));
    this.form.hidden = true;
    this.success.hidden = false;
    this.success.setAttribute("tabindex", "-1");
    this.success.focus();
  },

  /** Динамічний статус «Зараз відчинено / зачинено» і виділення сьогоднішнього дня. */
  initOpenStatus() {
    const status = Zerno.utils.$("[data-open-status]");
    if (!status) return;
    const now = new Date();
    const open = Zerno.schedule.isOpenNow(now);
    const [, close] = Zerno.schedule.forDate(now);
    status.textContent = open ? `Зараз відчинено, до ${close}:00` : "Зараз зачинено";
    status.classList.add(open ? "is-open" : "is-closed");

    const day = now.getDay();
    Zerno.utils.$$(".hours tr[data-day]").forEach((row) => {
      const spec = row.dataset.day;
      const isToday = spec === "1-5" ? day >= 1 && day <= 5 : Number(spec) === day;
      row.classList.toggle("is-today", isToday);
    });
  },
};
