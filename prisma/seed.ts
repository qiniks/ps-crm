import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean slate (dev only). Order respects FKs; cascades handle the rest.
  await prisma.session.deleteMany();
  await prisma.station.deleteMany();
  await prisma.room.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.tenant.deleteMany();

  const club = await prisma.tenant.create({ data: { name: "GameZone Bishkek" } });

  // Standard hall — cheaper.
  const standard = await prisma.room.create({
    data: {
      tenantId: club.id,
      name: "Стандартный зал / Standard hall",
      price1h: 150,
      price3h: 400,
      price5h: 600,
      openHourlyRate: 150,
    },
  });

  // VIP room — pricier.
  const vip = await prisma.room.create({
    data: {
      tenantId: club.id,
      name: "VIP",
      price1h: 300,
      price3h: 800,
      price5h: 1200,
      openHourlyRate: 300,
    },
  });

  // Place a few consoles on each floor plan (posX/posY as % of the canvas).
  const layout = [
    { room: standard, name: "PS5 #1", type: "PS5", posX: 20, posY: 25 },
    { room: standard, name: "PS5 #2", type: "PS5", posX: 50, posY: 25 },
    { room: standard, name: "PS5 #3", type: "PS5", posX: 80, posY: 25 },
    { room: standard, name: "PS4 #1", type: "PS4", posX: 30, posY: 70 },
    { room: standard, name: "PS4 #2", type: "PS4", posX: 70, posY: 70 },
    { room: vip, name: "VIP #1", type: "PS5", posX: 35, posY: 45 },
    { room: vip, name: "VIP #2", type: "PS5", posX: 65, posY: 45 },
  ];
  for (const s of layout) {
    await prisma.station.create({
      data: {
        tenantId: club.id,
        roomId: s.room.id,
        name: s.name,
        type: s.type,
        posX: s.posX,
        posY: s.posY,
      },
    });
  }

  await prisma.customer.createMany({
    data: [
      { tenantId: club.id, name: "Иван Петров", phone: "+996700111222", balance: 500, bonusPoints: 30 },
      { tenantId: club.id, name: "Aibek Toktosunov", phone: "+996700333444", bonusPoints: 10 },
      { tenantId: club.id, name: "Мария Иванова", phone: "+996700555666", balance: 1200, bonusPoints: 80 },
    ],
  });

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
