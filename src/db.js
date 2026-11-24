/**
 * db.js — підключення до бази даних SQLite (вбудований модуль node:sqlite).
 * Схема створюється автоматично під час першого запуску, меню заповнюється стартовими даними.
 */
const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const MENU_SEED = [
  // id, назва, опис, ціна, категорія, бейдж
  ["espreso", "Еспресо", "Насичений смак із нотами шоколаду та горіха.", 50, "coffee", null],
  ["amerykano", "Американо", "Еспресо, розведений гарячою водою.", 55, "coffee", null],
  ["kapuchyno", "Капучино", "Еспресо, молоко та щільна молочна пінка.", 75, "coffee", "Хіт"],
  ["flet-vait", "Флет вайт", "Подвійний ристрето з тонким шаром молока.", 85, "coffee", null],
  ["ais-late", "Айс-лате", "Еспресо з холодним молоком і льодом.", 85, "cold", null],
  ["kold-briu", "Колд брю", "Кава холодного заварювання, 12 годин настоювання.", 80, "cold", null],
  ["matcha-tonik", "Матча тонік", "Японський чай матча з тоніком і лимоном.", 95, "cold", "Новинка"],
  ["kruasan-klasychnyi", "Круасан класичний", "Вершкове масло, хрустке тісто.", 55, "bakery", null],
  ["kruasan-z-myhdalem", "Круасан з мигдалем", "З мигдальним кремом і пелюстками.", 70, "bakery", "Новинка"],
  ["chyzkeik", "Чизкейк", "Нью-йоркський, на пісочній основі.", 95, "bakery", null],
  ["brauni", "Брауні", "Шоколадний, з волоським горіхом.", 65, "bakery", null],
];

function open(file = process.env.DB_FILE || path.join(__dirname, "..", "data", "zerno.db")) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS menu_items (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL,
      price       INTEGER NOT NULL CHECK (price > 0),
      category    TEXT NOT NULL CHECK (category IN ('coffee', 'cold', 'bakery')),
      badge       TEXT,
      available   INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT NOT NULL,
      date       TEXT NOT NULL,            -- YYYY-MM-DD
      time       TEXT NOT NULL,            -- HH:MM
      guests     TEXT NOT NULL CHECK (guests IN ('1-2', '3-4', '5-8', 'hall')),
      comment    TEXT NOT NULL DEFAULT '',
      status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (date, time);
  `);

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM menu_items").get();
  if (count === 0) {
    const insert = db.prepare(
      "INSERT INTO menu_items (id, name, description, price, category, badge) VALUES (?, ?, ?, ?, ?, ?)"
    );
    MENU_SEED.forEach((row) => insert.run(...row));
  }
  return db;
}

module.exports = { open };
