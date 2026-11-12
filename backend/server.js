require("./src/config/env");

const fs = require("fs");
const path = require("path");
const os = require("os");
const net = require("net");
const http = require("http");
const https = require("https");
const { execFileSync } = require("child_process");
const app = require("./src/app");

const {
    testDatabaseConnection
} = require("./src/config/database");

const PORT = Number(process.env.PORT || 5001);
const HOST = process.env.HOST || "0.0.0.0";

function getLanIps() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const iface of Object.values(interfaces)) {
        for (const info of iface || []) {
            if (info.family === "IPv4" && !info.internal) {
                ips.push(info.address);
            }
        }
    }
    return ips;
}

function ensureLocalTlsCerts(lanIps) {
    const certDir = path.join(__dirname, "certs");
    const keyPath = path.join(certDir, "server.key");
    const certPath = path.join(certDir, "server.crt");

    if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        try {
            fs.mkdirSync(certDir, { recursive: true });
            const sanEntries = [
                "DNS:localhost",
                "IP:127.0.0.1",
                "IP:10.0.2.2",
                ...lanIps.map((ip) => `IP:${ip}`)
            ];
            execFileSync("openssl", [
                "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "3650",
                "-keyout", keyPath,
                "-out", certPath,
                "-subj", "/CN=LocalLink Local Dev",
                "-addext", `subjectAltName=${sanEntries.join(",")}`
            ], { stdio: "ignore" });
        } catch (err) {
            return null;
        }
    }

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
    }
    return null;
}

function printStartupBanner(lanIps, hasHttps) {
    console.log("------------------------------------------------");
    console.log("🚀 LocalLink Backend Started");
    console.log(`🌐 Local Web:  http://localhost:${PORT}`);
    lanIps.forEach((ip) => {
        console.log(`📱 Mobile LAN: http://${ip}:${PORT}${hasHttps ? `  (or https://${ip}:${PORT})` : ""}`);
    });
    console.log(`🤖 Android Emu: http://10.0.2.2:${PORT}`);
    console.log("------------------------------------------------");
}

async function startServer() {
    try {
        await testDatabaseConnection();

        const lanIps = getLanIps();
        const tlsCreds = ensureLocalTlsCerts(lanIps);

        if (tlsCreds) {
            // Serve BOTH HTTP and HTTPS simultaneously on the same port
            const httpServer = http.createServer(app);
            const httpsServer = https.createServer(tlsCreds, app);

            const muxServer = net.createServer((socket) => {
                socket.on("error", () => {});
                socket.once("data", (chunk) => {
                    socket.pause();
                    const isTls = chunk && chunk[0] === 0x16;
                    const target = isTls ? httpsServer : httpServer;
                    socket.unshift(chunk);
                    target.emit("connection", socket);
                    process.nextTick(() => {
                        if (!socket.destroyed) socket.resume();
                    });
                });
            });

            muxServer.listen(PORT, HOST, () => {
                printStartupBanner(lanIps, true);
            });
        } else {
            app.listen(PORT, HOST, () => {
                printStartupBanner(lanIps, false);
            });
        }

    } catch (error) {
        console.error("❌ Server startup failed:", error.message || error);
        process.exit(1);
    }
}

startServer();
