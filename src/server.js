"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};

Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const os_1 = __importDefault(require("os"));
const app_1 = __importDefault(require("./app"));
const logger_1 = __importDefault(require("./lib/logger"));
const REQUIRED_ENV = ['DATABASE_URL', 'ADMIN_SECRET'];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        logger_1.default.error(`Missing required environment variable: ${key}`);
        process.exit(1);
    }
}

const PORT = Number(process.env.PORT);

function getLocalIP() {
    const interfaces = os_1.default.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        if (!iface)
            continue;
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address;
            }
        }
    }
    return 'localhost';
}

app_1.default.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    logger_1.default.info('CSC Lockout API running on:');
    logger_1.default.info(`Local: http://localhost:${PORT}`);
    logger_1.default.info(`Network: http://${ip}:${PORT}`);
});
//# sourceMappingURL=server.js.map