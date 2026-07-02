-- ============================================================
-- PS Club CRM — Supabase setup (multi-tenant schema)
-- Paste into Supabase → SQL Editor → Run.
-- WARNING: drops existing PS Club CRM tables first (demo data is lost).
-- ============================================================

DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "Shift" CASCADE;
DROP TABLE IF EXISTS "Station" CASCADE;
DROP TABLE IF EXISTS "Room" CASCADE;
DROP TABLE IF EXISTS "Tariff" CASCADE;
DROP TABLE IF EXISTS "Customer" CASCADE;
DROP TABLE IF EXISTS "Tenant" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price1h" INTEGER NOT NULL DEFAULT 0,
    "price3h" INTEGER NOT NULL DEFAULT 0,
    "price5h" INTEGER NOT NULL DEFAULT 0,
    "openHourlyRate" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PS5',
    "status" TEXT NOT NULL DEFAULT 'FREE',
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 50,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
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
    "tenantId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "customerId" TEXT,
    "tariffKind" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedEndAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "cost" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_tenantId_idx" ON "Room"("tenantId");

-- CreateIndex
CREATE INDEX "Station_roomId_idx" ON "Station"("roomId");

-- CreateIndex
CREATE INDEX "Station_tenantId_idx" ON "Station"("tenantId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Session_tenantId_idx" ON "Session"("tenantId");

-- CreateIndex
CREATE INDEX "Session_stationId_idx" ON "Session"("stationId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================
-- Demo data (optional). Delete this section for an empty DB.
-- ============================================================
DO $$
DECLARE
  club_id   text := gen_random_uuid()::text;
  std_id    text := gen_random_uuid()::text;
  vip_id    text := gen_random_uuid()::text;
BEGIN
  INSERT INTO "Tenant" ("id","name") VALUES (club_id, 'GameZone Bishkek');

  INSERT INTO "Room" ("id","tenantId","name","price1h","price3h","price5h","openHourlyRate") VALUES
    (std_id, club_id, 'Стандартный зал / Standard hall', 150, 400, 600, 150),
    (vip_id, club_id, 'VIP', 300, 800, 1200, 300);

  INSERT INTO "Station" ("id","tenantId","roomId","name","type","status","posX","posY") VALUES
    (gen_random_uuid()::text, club_id, std_id, 'PS5 #1', 'PS5', 'FREE', 20, 25),
    (gen_random_uuid()::text, club_id, std_id, 'PS5 #2', 'PS5', 'FREE', 50, 25),
    (gen_random_uuid()::text, club_id, std_id, 'PS5 #3', 'PS5', 'FREE', 80, 25),
    (gen_random_uuid()::text, club_id, std_id, 'PS4 #1', 'PS4', 'FREE', 30, 70),
    (gen_random_uuid()::text, club_id, std_id, 'PS4 #2', 'PS4', 'FREE', 70, 70),
    (gen_random_uuid()::text, club_id, vip_id, 'VIP #1', 'PS5', 'FREE', 35, 45),
    (gen_random_uuid()::text, club_id, vip_id, 'VIP #2', 'PS5', 'FREE', 65, 45);

  INSERT INTO "Customer" ("id","tenantId","name","phone","balance","bonusPoints") VALUES
    (gen_random_uuid()::text, club_id, 'Иван Петров', '+996700111222', 500, 30),
    (gen_random_uuid()::text, club_id, 'Aibek Toktosunov', '+996700333444', 0, 10),
    (gen_random_uuid()::text, club_id, 'Мария Иванова', '+996700555666', 1200, 80);
END $$;
