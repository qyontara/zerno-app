/**
 * utils.js — спільні допоміжні функції.
 * Усі модулі сайту зберігаються в одному глобальному об'єкті window.Zerno,
 * щоб не засмічувати глобальну область видимості.
 */
window.Zerno = window.Zerno || {};

Zerno.utils = {
  /** Пошук одного елемента (обгортка над querySelector). */
  $(selector, root = document) {
    return root.querySelector(selector);
  },

  /** Пошук усіх елементів у вигляді масиву. */
  $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  },

  /** Форматування ціни: 1250 -> "1 250 грн". */
  formatPrice(value) {
    return `${value.toLocaleString("uk-UA")} грн`;
  },

  /** Безпечне читання з localStorage (може бути недоступне в приватному режимі). */
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("Не вдалося прочитати дані:", error);
      return fallback;
    }
  },

  /** Безпечний запис у localStorage. */
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Не вдалося зберегти дані:", error);
    }
  },

  /** Відкладений виклик: функція виконається, коли користувач перестане друкувати. */
  debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /** Коротке сповіщення внизу екрана. */
  toast(message) {
    const box = document.querySelector("[data-toast]");
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { box.hidden = true; }, 2500);
  },

  /** Правильна форма слова після числа: 1 позиція, 2 позиції, 5 позицій. */
  plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  },
};
