/**
 * main.js — точка входу: ініціалізує модулі після завантаження DOM.
 * Скрипти підключено з атрибутом defer, тому DOM уже готовий.
 * Кожен модуль сам перевіряє, чи є його елементи на поточній сторінці.
 */
(function start() {
  const modules = ["cart", "cartView", "navigation", "menuFilter", "faq", "bookingForm"];
  modules.forEach((name) => {
    try {
      Zerno[name].init();
    } catch (error) {
      // Помилка в одному компоненті не повинна ламати інші
      console.error(`Помилка ініціалізації модуля «${name}»:`, error);
    }
  });

  // Меню з сервера завантажується асинхронно, після запуску фільтра
  Zerno.menuApi.init().catch((error) => console.error("Помилка завантаження меню:", error));
}());
