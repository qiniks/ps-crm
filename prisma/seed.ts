import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean slate (dev only)
  await prisma.session.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.tariff.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      name: "Администратор",
      login: "admin",
      // NOTE: demo only — replace with a real password hash (bcrypt) before production.
      passwordHash: "admin",
      role: "ADMIN",
    },
  });

  await prisma.tariff.createMany({
    data: [
      { name: "День / Day", pricePerHour: 200, isDefault: true },
      { name: "Ночь / Night", pricePerHour: 150 },
      { name: "Happy Hours", pricePerHour: 120 },
    ],
  });

  const stations = [
    { name: "PS5 #1", type: "PS5", hourlyRate: 250 },
    { name: "PS5 #2", type: "PS5", hourlyRate: 250 },
    { name: "PS5 #3", type: "PS5", hourlyRate: 250 },
    { name: "PS4 #1", type: "PS4", hourlyRate: 200 },
    { name: "PS4 #2", type: "PS4", hourlyRate: 200 },
    { name: "VIP Room", type: "PS5", hourlyRate: 400 },
  ];
  for (const s of stations) {
    await prisma.station.create({ data: s });
  }

  await prisma.customer.createMany({
    data: [
      { name: "Иван Петров", phone: "+996700111222", balance: 500, bonusPoints: 30 },
      { name: "Aibek Toktosunov", phone: "+996700333444", balance: 0, bonusPoints: 10 },
      { name: "Мария Иванова", phone: "+996700555666", balance: 1200, bonusPoints: 80 },
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
