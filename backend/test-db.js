require("./src/config/env");

const {
    pool,
    testDatabaseConnection
} = require("./src/config/database");

async function main() {
    try {
        await testDatabaseConnection();
        process.exitCode = 0;
    } catch (error) {
        process.exitCode = 1;
    } finally {
        await pool.end().catch(() => {});
    }
}

main();