-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CASHIER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PS5',
    "status" TEXT NOT NULL DEFAULT 'FREE',
    "hourlyRate" INTEGER NOT NULL DEFAULT 200,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricePerHour" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "customerId" TEXT,
    "tariffId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "cost" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "shiftId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "totalRevenue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ============================================================
-- Demo data (optional). Delete this section if you want an empty DB.
-- ============================================================

-- Admin user (demo password — replace with a real hash before production)
INSERT INTO "User" ("id","name","login","passwordHash","role") VALUES
  (gen_random_uuid()::text, 'Администратор', 'admin', 'admin', 'ADMIN');

-- Tariffs
INSERT INTO "Tariff" ("id","name","pricePerHour","isDefault") VALUES
  (gen_random_uuid()::text, 'День / Day', 200, true),
  (gen_random_uuid()::text, 'Ночь / Night', 150, false),
  (gen_random_uuid()::text, 'Happy Hours', 120, false);

-- Stations
INSERT INTO "Station" ("id","name","type","status","hourlyRate") VALUES
  (gen_random_uuid()::text, 'PS5 #1', 'PS5', 'FREE', 250),
  (gen_random_uuid()::text, 'PS5 #2', 'PS5', 'FREE', 250),
  (gen_random_uuid()::text, 'PS5 #3', 'PS5', 'FREE', 250),
  (gen_random_uuid()::text, 'PS4 #1', 'PS4', 'FREE', 200),
  (gen_random_uuid()::text, 'PS4 #2', 'PS4', 'FREE', 200),
  (gen_random_uuid()::text, 'VIP Room', 'PS5', 'FREE', 400);

-- Customers
INSERT INTO "Customer" ("id","name","phone","balance","bonusPoints") VALUES
  (gen_random_uuid()::text, 'Иван Петров', '+996700111222', 500, 30),
  (gen_random_uuid()::text, 'Aibek Toktosunov', '+996700333444', 0, 10),
  (gen_random_uuid()::text, 'Мария Иванова', '+996700555666', 1200, 80);
