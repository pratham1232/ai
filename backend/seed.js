const path = require("path");
const fs = require("fs");
const { sequelize } = require("./config/db");
const User = require("./models/user");
const Internship = require("./models/internship");
const Application = require("./models/application");

async function seedDatabase() {
  try {
    const dataPath = path.join(__dirname, "database_data.json");
    if (!fs.existsSync(dataPath)) {
      console.log("⚠️ database_data.json not found, skipping seeder.");
      return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    // Check if Internships already seeded
    const count = await Internship.count();
    if (count > 0) {
      console.log(`ℹ️ Database already has ${count} internships. Skipping auto-seed.`);
      return;
    }

    console.log("🌱 Seeding initial database data...");

    // 1. Seed Users
    if (data.users && data.users.length > 0) {
      for (const u of data.users) {
        const existing = await User.findOne({ where: { email: u.email } });
        if (!existing) {
          await User.create({
            id: u.id,
            name: u.name,
            email: u.email,
            password: u.password,
            role: u.role,
            createdAt: u.createdAt || new Date(),
            updatedAt: u.updatedAt || new Date(),
          });
        }
      }
      console.log(`✅ Seeded ${data.users.length} users.`);
    }

    // 2. Seed Internships
    if (data.internships && data.internships.length > 0) {
      for (const item of data.internships) {
        await Internship.create({
          id: item.id,
          title: item.title,
          company: item.company,
          description: item.description,
          skills: item.skills,
          location: item.location,
          duration: item.duration,
          apply_link: item.apply_link || "",
          createdAt: item.createdAt || new Date(),
          updatedAt: item.updatedAt || new Date(),
        });
      }
      console.log(`✅ Seeded ${data.internships.length} internships.`);
    }

    // 3. Seed Applications
    if (data.applications && data.applications.length > 0) {
      for (const app of data.applications) {
        await Application.create({
          id: app.id,
          studentId: app.studentId,
          internshipId: app.internshipId,
          status: app.status || "applied",
          createdAt: app.createdAt || new Date(),
          updatedAt: app.updatedAt || new Date(),
        });
      }
      console.log(`✅ Seeded ${data.applications.length} applications.`);
    }

    console.log("🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
}

if (require.main === module) {
  sequelize.sync({ alter: true })
    .then(() => seedDatabase())
    .then(() => {
      console.log("Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
