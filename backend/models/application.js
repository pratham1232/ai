const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Application = sequelize.define("Application", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  internshipId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("applied", "reviewing", "rejected", "accepted"),
    defaultValue: "applied",
  },
}, {
  tableName: "applications",
  timestamps: true,
});

module.exports = Application;
