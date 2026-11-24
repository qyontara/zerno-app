/**
 * Автоматичні тести REST API (вбудований модуль node:test).
 * Запуск: npm test. Використовується окрема база даних у пам'яті.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { open } = require("../src/db");
const { createApp } = require("../src/app");
const { validateBooking } = require("../src/validate");

const TOKEN = "test-token-1234567890";
let server;
let base;

// Найближчий робочий день о 12:00 (завтра або пізніше)
function futureDate(days = 1) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const valid = { name: "Максим", phone: "+380 99 123 45 67", date: futureDate(), time: "12:00", guests: "3-4", comment: "Біля вікна" };

async function api(method, path, { body, token, raw } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, data: text ? JSON.parse(text) : null };
}

before(async () => {
  server = createApp({ db: open(":memory:"), adminToken: TOKEN, bookingLimit: 100 });
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test("GET /api/health повертає ok", async () => {
  const r = await api("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { status: "ok" });
});

test("GET /api/menu повертає 11 позицій меню", async () => {
  const r = await api("GET", "/api/menu");
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 11);
  assert.ok(r.data.every((i) => i.name && i.price > 0 && ["coffee", "cold", "bakery"].includes(i.category)));
});

test("CRUD: створення, читання, оновлення, видалення заявки", async () => {
  const created = await api("POST", "/api/bookings", { body: valid });
  assert.equal(created.status, 201);
  assert.equal(created.data.phone, "+380991234567", "телефон нормалізовано");
  assert.equal(created.data.status, "new");
  const { id } = created.data;

  const read = await api("GET", `/api/bookings/${id}`, { token: TOKEN });
  assert.equal(read.status, 200);
  assert.equal(read.data.name, "Максим");

  const updated = await api("PATCH", `/api/bookings/${id}`, { token: TOKEN, body: { status: "confirmed" } });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.status, "confirmed");

  const list = await api("GET", "/api/bookings?status=confirmed", { token: TOKEN });
  assert.ok(list.data.some((b) => b.id === id));

  const removed = await api("DELETE", `/api/bookings/${id}`, { token: TOKEN });
  assert.equal(removed.status, 204);
  const gone = await api("GET", `/api/bookings/${id}`, { token: TOKEN });
  assert.equal(gone.status, 404);
});

test("POST з некоректними даними повертає 400 і помилки полів", async () => {
  const r = await api("POST", "/api/bookings", { body: { name: "М", phone: "0991", date: "2020-01-01", time: "25:00", guests: "100" } });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.data.fields).sort(), ["date", "guests", "name", "phone", "time"]);
});

test("Час поза графіком роботи відхиляється", () => {
  const sunday = new Date("2030-06-02T10:00"); // неділя: 09:00–20:00
  const { errors } = validateBooking({ ...valid, date: "2030-06-02", time: "19:30" }, new Date("2030-06-01T10:00"));
  assert.equal(sunday.getDay(), 0);
  assert.match(errors.time, /з 09:00 до 19:00/);
});

test("Без токена адмін-маршрути повертають 401", async () => {
  assert.equal((await api("GET", "/api/bookings")).status, 401);
  assert.equal((await api("GET", "/api/bookings", { token: "wrong-token-000000000" })).status, 401);
  assert.equal((await api("DELETE", "/api/bookings/1")).status, 401);
});

test("Спроба SQL-ін'єкції: ім'я відхиляється, коментар зберігається як звичайний текст", async () => {
  const attack = "Robert'); DROP TABLE bookings;--";
  const r = await api("POST", "/api/bookings", { body: { ...valid, name: attack } });
  assert.equal(r.status, 400, "символи ; ) не дозволені в імені");
  const c = await api("POST", "/api/bookings", { body: { ...valid, comment: attack } });
  assert.equal(c.status, 201);
  assert.equal(c.data.comment, attack, "параметризований запит зберіг текст як є");
  const list = await api("GET", "/api/bookings", { token: TOKEN });
  assert.equal(list.status, 200, "таблиця bookings не постраждала");
});

test("Некоректний JSON, неправильний Content-Type і завеликий запит", async () => {
  assert.equal((await api("POST", "/api/bookings", { raw: "{oops", body: {} })).status, 400);
  const wrongType = await fetch(`${base}/api/bookings`, { method: "POST", body: "name=x" });
  assert.equal(wrongType.status, 415);
  const big = await api("POST", "/api/bookings", { body: { ...valid, comment: "x".repeat(20000) } });
  assert.equal(big.status, 413);
});

test("Невідомий маршрут — 404, неправильний метод — 405", async () => {
  assert.equal((await api("GET", "/api/unknown")).status, 404);
  const r = await api("PUT", "/api/menu", { body: {} });
  assert.equal(r.status, 405);
  assert.equal(r.headers.get("allow"), "GET");
});

test("Статичні файли, заголовки безпеки та захист від виходу з папки", async () => {
  const page = await fetch(`${base}/menu.html`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /text\/html/);
  assert.match(page.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  const traversal = await fetch(`${base}/..%2f..%2fpackage.json`);
  assert.ok([403, 404].includes(traversal.status));
});

test("Обмеження частоти: 6-та заявка за хвилину відхиляється", async () => {
  const limited = createApp({ db: open(":memory:"), adminToken: TOKEN, bookingLimit: 5 });
  await new Promise((resolve) => limited.listen(0, resolve));
  const url = `http://127.0.0.1:${limited.address().port}/api/bookings`;
  const statuses = [];
  for (let k = 0; k < 6; k += 1) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(valid) });
    statuses.push(res.status);
  }
  limited.close();
  assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
});
