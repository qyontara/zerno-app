/**
 * validate.js — серверна перевірка даних бронювання.
 * Дублює правила клієнтської форми: дані з браузера не можна вважати надійними.
 */
const SCHEDULE = { 0: [9, 20], 1: [8, 21], 2: [8, 21], 3: [8, 21], 4: [8, 21], 5: [8, 21], 6: [9, 22] };
const GUESTS = ["1-2", "3-4", "5-8", "hall"];
const STATUSES = ["new", "confirmed", "cancelled"];

const asText = (v) => (typeof v === "string" ? v.trim() : "");
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Повертає { data, errors }. errors — об'єкт { поле: повідомлення }; порожній, якщо все гаразд.
 * now передається параметром, щоб перевірку можна було протестувати.
 */
function validateBooking(input, now = new Date()) {
  const errors = {};
  const body = input && typeof input === "object" ? input : {};

  const name = asText(body.name);
  if (!name) errors.name = "Вкажіть ім'я";
  else if (name.length < 2 || name.length > 50) errors.name = "Ім'я має містити від 2 до 50 символів";
  else if (!/^[A-Za-zА-ЩЬЮЯҐЄІЇа-щьюяґєії' -]+$/.test(name)) errors.name = "Ім'я може містити лише літери, пробіл, апостроф і дефіс";

  const phone = asText(body.phone).replace(/[\s()-]/g, "");
  if (!/^\+380\d{9}$/.test(phone)) errors.phone = "Формат номера: +380XXXXXXXXX";

  const date = asText(body.date);
  const time = asText(body.time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00`).getTime())) {
    errors.date = "Некоректна дата";
  } else {
    const today = isoDate(now);
    const maxDay = new Date(now);
    maxDay.setDate(maxDay.getDate() + 60);
    if (date < today) errors.date = "Дата не може бути в минулому";
    else if (date > isoDate(maxDay)) errors.date = "Бронювання доступне максимум на 60 днів наперед";
  }

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    errors.time = "Некоректний час";
  } else if (!errors.date) {
    const [open, close] = SCHEDULE[new Date(`${date}T00:00`).getDay()];
    const [h, m] = time.split(":").map(Number);
    const t = h + m / 60;
    if (t < open || t > close - 1) errors.time = `У цей день бронювання можливе з ${pad(open)}:00 до ${close - 1}:00`;
    else if (new Date(`${date}T${time}`) < now) errors.time = "Цей час уже минув";
  }

  const guests = asText(body.guests);
  if (!GUESTS.includes(guests)) errors.guests = "Оберіть кількість гостей";

  const comment = asText(body.comment);
  if (comment.length > 300) errors.comment = "Коментар задовгий (максимум 300 символів)";

  return { data: { name, phone, date, time, guests, comment }, errors };
}

function validateStatus(input) {
  const status = input && typeof input === "object" ? input.status : undefined;
  return STATUSES.includes(status) ? { status } : null;
}

module.exports = { validateBooking, validateStatus, STATUSES };
