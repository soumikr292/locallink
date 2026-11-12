const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Support Railway / Render / Cloud MySQL connection URLs (MYSQL_URL or DATABASE_URL)
const connectionUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
if (connectionUrl && !process.env.DB_HOST) {
    try {
        const parsed = new URL(connectionUrl);
        process.env.DB_HOST = parsed.hostname;
        process.env.DB_PORT = parsed.port || "3306";
        process.env.DB_USER = decodeURIComponent(parsed.username);
        process.env.DB_PASSWORD = decodeURIComponent(parsed.password);
        process.env.DB_NAME = parsed.pathname.replace(/^\//, "") || "locallink";
        if (parsed.searchParams.get("ssl") === "true" || parsed.searchParams.get("sslmode")) {
            process.env.DB_SSL = "true";
        }
    } catch (_) {}
}

// Support standard MYSQL* env vars (Railway MariaDB/MySQL plugin)
if (!process.env.DB_HOST && process.env.MYSQLHOST) {
    process.env.DB_HOST = process.env.MYSQLHOST;
    process.env.DB_PORT = process.env.MYSQLPORT || "3306";
    process.env.DB_USER = process.env.MYSQLUSER || "root";
    process.env.DB_PASSWORD = process.env.MYSQLPASSWORD || "";
    process.env.DB_NAME = process.env.MYSQLDATABASE || "railway";
}

const requiredVariables = [
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_NAME",
    "JWT_SECRET"
];

for (const variable of requiredVariables) {
    if (!process.env[variable]) {
        throw new Error(
            `Missing environment variable: ${variable}`
        );
    }
}

if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
        "JWT_SECRET must contain at least 32 characters"
    );
}

module.exports = {
    PORT: Number(process.env.PORT || 5001),
    NODE_ENV: process.env.NODE_ENV || "development"
};