/**
 * api.js — клієнт REST API. Усі запити до сервера проходять через функцію request(),
 * яка використовує Fetch API та async/await і перетворює помилки на ApiError.
 */
window.Zerno = window.Zerno || {};

class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

Zerno.api = {
  /** true, якщо сторінку відкрито через сервер, а не як файл із диска. */
  get available() {
    return location.protocol === "http:" || location.protocol === "https:";
  },

  async request(method, url, { body, token } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError("Немає з'єднання з сервером. Перевірте інтернет і спробуйте ще раз", 0);
    }

    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(data.error || `Помилка сервера (${response.status})`, response.status, data.fields);
    return data;
  },

  getMenu() {
    return this.request("GET", "/api/menu");
  },

  createBooking(booking) {
    return this.request("POST", "/api/bookings", { body: booking });
  },

  listBookings(token, status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request("GET", `/api/bookings${query}`, { token });
  },

  updateStatus(token, id, status) {
    return this.request("PATCH", `/api/bookings/${id}`, { token, body: { status } });
  },

  deleteBooking(token, id) {
    return this.request("DELETE", `/api/bookings/${id}`, { token });
  },
};

Zerno.ApiError = ApiError;
