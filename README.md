# Кав'ярня «Зерно» — вебзастосунок

Сайт кав'ярні з REST API та базою даних SQLite. Лабораторна робота № 5.

## Вимоги

- Node.js **22.13 або новіший** (рекомендовано LTS 24). Зовнішні бібліотеки не потрібні.

## Запуск локально

```bash
cp .env.example .env        # Windows: copy .env.example .env
# відкрийте .env і задайте ADMIN_TOKEN (щонайменше 16 символів)
npm start
```

- Сайт: http://localhost:3000
- Адмін-панель: http://localhost:3000/admin.html (вхід за ADMIN_TOKEN)
- Тести: `npm test`

База даних створюється автоматично у файлі `data/zerno.db`.

## REST API

| Метод | Маршрут | Доступ | Опис |
|---|---|---|---|
| GET | /api/health | усі | Перевірка роботи сервера |
| GET | /api/menu | усі | Список позицій меню |
| POST | /api/bookings | усі | Створити заявку на бронювання |
| GET | /api/bookings?status= | адмін | Список заявок (фільтр за статусом) |
| GET | /api/bookings/:id | адмін | Одна заявка |
| PATCH | /api/bookings/:id | адмін | Змінити статус: new, confirmed, cancelled |
| DELETE | /api/bookings/:id | адмін | Видалити заявку |

Адмін-маршрути потребують заголовка `Authorization: Bearer <ADMIN_TOKEN>`.

## Розгортання на Render

1. Завантажте проєкт у репозиторій GitHub.
2. На render.com: **New → Blueprint** і оберіть репозиторій (використовується `render.yaml`),
   або **New → Web Service** зі Start Command `npm start`.
3. У розділі Environment задайте `ADMIN_TOKEN` (Blueprint згенерує його сам).

На безкоштовному тарифі Render диск тимчасовий: після перезапуску база даних створюється заново.
