// Bilingual dictionary (Russian / English).
// Add a key here once and use t("key") everywhere.

export type Locale = "ru" | "en";

export const LOCALES: Locale[] = ["ru", "en"];
export const DEFAULT_LOCALE: Locale = "ru";

export const dictionaries = {
  ru: {
    "app.name": "PS Club CRM",
    "app.tagline": "Система управления игровым клубом",

    "nav.dashboard": "Станции",
    "nav.customers": "Клиенты",
    "nav.tariffs": "Тарифы",
    "nav.reports": "Отчёты",

    "lang.switch": "Язык",

    "dashboard.title": "Игровые станции",
    "dashboard.subtitle": "Управление сессиями в реальном времени",
    "dashboard.free": "Свободно",
    "dashboard.busy": "Занято",
    "dashboard.maintenance": "Обслуживание",
    "dashboard.total": "Всего станций",
    "dashboard.active": "Активных сессий",
    "dashboard.revenueToday": "Выручка за сегодня",

    "station.start": "Начать",
    "station.stop": "Завершить",
    "station.elapsed": "Время",
    "station.cost": "Сумма",
    "station.perHour": "/час",
    "station.empty": "Станция свободна",

    "customers.title": "Клиенты",
    "customers.name": "Имя",
    "customers.phone": "Телефон",
    "customers.balance": "Баланс",
    "customers.bonus": "Бонусы",
    "customers.since": "С нами с",
    "customers.empty": "Клиентов пока нет",

    "tariffs.title": "Тарифы",
    "tariffs.name": "Название",
    "tariffs.price": "Цена за час",
    "tariffs.default": "По умолчанию",

    "reports.title": "Отчёты",
    "reports.revenueToday": "Выручка сегодня",
    "reports.sessionsToday": "Сессий сегодня",
    "reports.avgCheck": "Средний чек",
    "reports.recent": "Последние сессии",
    "reports.station": "Станция",
    "reports.duration": "Длительность",
    "reports.amount": "Сумма",
    "reports.when": "Когда",
    "reports.empty": "Нет данных",

    "common.currency": "сом",
    "common.minutes": "мин",
    "common.loading": "Загрузка…",
  },
  en: {
    "app.name": "PS Club CRM",
    "app.tagline": "Gaming club management system",

    "nav.dashboard": "Stations",
    "nav.customers": "Customers",
    "nav.tariffs": "Tariffs",
    "nav.reports": "Reports",

    "lang.switch": "Language",

    "dashboard.title": "Gaming stations",
    "dashboard.subtitle": "Real-time session management",
    "dashboard.free": "Free",
    "dashboard.busy": "Busy",
    "dashboard.maintenance": "Maintenance",
    "dashboard.total": "Total stations",
    "dashboard.active": "Active sessions",
    "dashboard.revenueToday": "Revenue today",

    "station.start": "Start",
    "station.stop": "Stop",
    "station.elapsed": "Elapsed",
    "station.cost": "Cost",
    "station.perHour": "/hr",
    "station.empty": "Station is free",

    "customers.title": "Customers",
    "customers.name": "Name",
    "customers.phone": "Phone",
    "customers.balance": "Balance",
    "customers.bonus": "Bonus",
    "customers.since": "Since",
    "customers.empty": "No customers yet",

    "tariffs.title": "Tariffs",
    "tariffs.name": "Name",
    "tariffs.price": "Price per hour",
    "tariffs.default": "Default",

    "reports.title": "Reports",
    "reports.revenueToday": "Revenue today",
    "reports.sessionsToday": "Sessions today",
    "reports.avgCheck": "Average check",
    "reports.recent": "Recent sessions",
    "reports.station": "Station",
    "reports.duration": "Duration",
    "reports.amount": "Amount",
    "reports.when": "When",
    "reports.empty": "No data",

    "common.currency": "KGS",
    "common.minutes": "min",
    "common.loading": "Loading…",
  },
} satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof (typeof dictionaries)["ru"];
