const mariadb = require("mariadb");

const poolConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    allowPublicKeyRetrieval: true,
    initSql: "SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))"
};

if (process.env.DB_SSL === "true") {
    poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = mariadb.createPool(poolConfig);

async function testDatabaseConnection() {
    let connection;

    try {
        connection = await pool.getConnection();

        const result = await connection.query(
            "SELECT DATABASE() AS databaseName"
        );

        console.log("✅ MariaDB Connected Successfully!");
        console.log("📂 Database:", result[0].databaseName);

    } catch (error) {
        console.error("❌ Database Connection Failed!");
        console.error(error.message);

        throw error;

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    pool,
    testDatabaseConnection
};