/**
 * server.js — точка запуску вебзастосунку «Зерно».
 * Налаштування беруться зі змінних середовища (файл .env або налаштування хостингу).
 */
const fs = require("node:fs");
const path = require("node:path");
const { open } = require("./src/db");
const { createApp } = require("./src/app");

// Мінімальне читання файлу .env (без сторонніх бібліотек)
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
  }
}

const PORT = Number(process.env.PORT) || 3000;
const db = open();
const server = createApp({ db, adminToken: process.env.ADMIN_TOKEN });

server.listen(PORT, () => {
  console.log(`Кав'ярня «Зерно» працює: http://localhost:${PORT}`);
  console.log(`Адмін-панель: http://localhost:${PORT}/admin.html`);
});

// Коректне завершення: закрити з'єднання і базу даних
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
