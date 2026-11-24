/**
 * app.js — HTTP-застосунок: REST API + віддача статичних файлів клієнта.
 * Використано лише вбудовані модулі Node.js (http, fs, path, crypto, sqlite),
 * тому застосунок не потребує встановлення залежностей.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { validateBooking, validateStatus, STATUSES } = require("./validate");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const MAX_BODY = 10 * 1024; // 10 КБ досить для будь-якої заявки
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
};

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function sendJson(res, status, payload) {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const headers = { ...SECURITY_HEADERS, "Content-Type": MIME[".json"], "Cache-Control": "no-store" };
  if (status === 413) headers.Connection = "close";
  res.writeHead(status, headers);
  res.end(body);
}

/** Читає тіло запиту як JSON з обмеженням розміру. */
function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!(req.headers["content-type"] || "").startsWith("application/json")) {
      reject(new HttpError(415, "Очікується Content-Type: application/json"));
      return;
    }
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        // Решту тіла просто пропускаємо, щоб клієнт отримав відповідь 413, а не обрив з'єднання
        req.removeAllListeners("data");
        req.resume();
        reject(new HttpError(413, "Завеликий запит"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new HttpError(400, "Некоректний JSON"));
      }
    });
    req.on("error", reject);
  });
}

/** Порівняння токена за сталий час (захист від атак за часом відповіді). */
function isAdmin(req, token) {
  const header = req.headers.authorization || "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(token);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** Просте обмеження частоти: не більше limit запитів за windowMs з однієї IP-адреси. */
function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return (ip) => {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length <= limit;
  };
}

const toBooking = (row) => row && ({
  id: row.id, name: row.name, phone: row.phone, date: row.date, time: row.time,
  guests: row.guests, comment: row.comment, status: row.status, createdAt: row.created_at,
});

function createApp({ db, adminToken, bookingLimit = 5 }) {
  if (!adminToken || adminToken.length < 16) {
    throw new Error("Змінна середовища ADMIN_TOKEN не задана або коротша за 16 символів");
  }
  const allowBooking = rateLimiter(bookingLimit, 60 * 1000);

  const q = {
    menu: db.prepare("SELECT id, name, description, price, category, badge FROM menu_items WHERE available = 1 ORDER BY rowid"),
    insert: db.prepare("INSERT INTO bookings (name, phone, date, time, guests, comment) VALUES (?, ?, ?, ?, ?, ?)"),
    byId: db.prepare("SELECT * FROM bookings WHERE id = ?"),
    all: db.prepare("SELECT * FROM bookings ORDER BY date DESC, time DESC, id DESC"),
    byStatus: db.prepare("SELECT * FROM bookings WHERE status = ? ORDER BY date DESC, time DESC, id DESC"),
    setStatus: db.prepare("UPDATE bookings SET status = ? WHERE id = ?"),
    remove: db.prepare("DELETE FROM bookings WHERE id = ?"),
  };

  function requireAdmin(req) {
    if (!isAdmin(req, adminToken)) throw new HttpError(401, "Потрібна авторизація адміністратора");
  }

  function parseId(raw) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Некоректний ідентифікатор");
    return id;
  }

  /** Таблиця маршрутів REST API: [метод, шаблон шляху, обробник]. */
  const routes = [
    ["GET", /^\/api\/health$/, () => [200, { status: "ok" }]],

    ["GET", /^\/api\/menu$/, () => [200, q.menu.all()]],

    ["POST", /^\/api\/bookings$/, async (req) => {
      const ip = req.socket.remoteAddress;
      if (!allowBooking(ip)) throw new HttpError(429, "Забагато заявок. Спробуйте за хвилину");
      const { data, errors } = validateBooking(await readJson(req));
      if (Object.keys(errors).length) throw new HttpError(400, "Перевірте дані форми", errors);
      const { lastInsertRowid } = q.insert.run(data.name, data.phone, data.date, data.time, data.guests, data.comment);
      return [201, toBooking(q.byId.get(lastInsertRowid))];
    }],

    ["GET", /^\/api\/bookings$/, (req, _m, url) => {
      requireAdmin(req);
      const status = url.searchParams.get("status");
      if (status && !STATUSES.includes(status)) throw new HttpError(400, "Невідомий статус");
      const rows = status ? q.byStatus.all(status) : q.all.all();
      return [200, rows.map(toBooking)];
    }],

    ["GET", /^\/api\/bookings\/(\w+)$/, (req, m) => {
      requireAdmin(req);
      const row = q.byId.get(parseId(m[1]));
      if (!row) throw new HttpError(404, "Заявку не знайдено");
      return [200, toBooking(row)];
    }],

    ["PATCH", /^\/api\/bookings\/(\w+)$/, async (req, m) => {
      requireAdmin(req);
      const id = parseId(m[1]);
      const patch = validateStatus(await readJson(req));
      if (!patch) throw new HttpError(400, `Статус має бути одним із: ${STATUSES.join(", ")}`);
      const { changes } = q.setStatus.run(patch.status, id);
      if (!changes) throw new HttpError(404, "Заявку не знайдено");
      return [200, toBooking(q.byId.get(id))];
    }],

    ["DELETE", /^\/api\/bookings\/(\w+)$/, (req, m) => {
      requireAdmin(req);
      const { changes } = q.remove.run(parseId(m[1]));
      if (!changes) throw new HttpError(404, "Заявку не знайдено");
      return [204];
    }],
  ];

  async function handleApi(req, res, url) {
    const matching = routes.filter(([, re]) => re.test(url.pathname));
    if (!matching.length) throw new HttpError(404, "Маршрут не знайдено");
    const route = matching.find(([method]) => method === req.method);
    if (!route) {
      res.setHeader("Allow", matching.map(([method]) => method).join(", "));
      throw new HttpError(405, "Метод не підтримується");
    }
    const [status, payload] = await route[2](req, url.pathname.match(route[1]), url);
    sendJson(res, status, payload);
  }

  function serveStatic(req, res, url) {
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Метод не підтримується");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.normalize(path.join(PUBLIC_DIR, pathname));
    // Захист від виходу за межі папки public (../../etc/passwd)
    if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(403, "Доступ заборонено");
    fs.readFile(file, (err, content) => {
      if (err) {
        res.writeHead(404, { ...SECURITY_HEADERS, "Content-Type": MIME[".html"] });
        res.end("<!DOCTYPE html><meta charset=\"utf-8\"><title>404</title><p>Сторінку не знайдено. <a href=\"/\">На головну</a></p>");
        return;
      }
      const type = MIME[path.extname(file)] || "application/octet-stream";
      res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": type, "Cache-Control": "public, max-age=300" });
      res.end(req.method === "HEAD" ? undefined : content);
    });
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
      else serveStatic(req, res, url);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.message, ...(error.details && { fields: error.details }) });
      } else {
        console.error(error); // подробиці — лише в журнал сервера, не клієнту
        sendJson(res, 500, { error: "Внутрішня помилка сервера" });
      }
    }
  });
}

module.exports = { createApp };
