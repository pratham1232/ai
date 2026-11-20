require("dotenv").config();
const { Sequelize } = require("sequelize");

let sequelize;

if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");

  sequelize = new Sequelize(dbUrl, {
    dialect: "mysql",
    logging: false,
    dialectOptions: !isLocal
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  });
} else {
  const dbName = process.env.DB_NAME || "internshipDB";
  const dbUser = process.env.DB_USER || "root";
  const dbPass = process.env.DB_PASS !== undefined ? process.env.DB_PASS : "ranu@1122";
  const dbHost = process.env.DB_HOST || "localhost";
  const dbPort = parseInt(process.env.DB_PORT || "3306", 10);
  const isLocal = dbHost === "localhost" || dbHost === "127.0.0.1";
  const useSSL = process.env.DB_SSL === "true" || (!isLocal && process.env.DB_SSL !== "false");

  sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: "mysql",
    logging: false,
    dialectOptions: useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  });
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL Database Connected Successfully");
  } catch (error) {
    console.error("❌ DB Connection Error:", error.message);
  }
};

module.exports = { sequelize, connectDB };
