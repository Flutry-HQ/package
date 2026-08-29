"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServer = void 0;
const fastify_1 = __importDefault(require("fastify"));
const node_path_1 = __importDefault(require("node:path"));
const plugins_1 = require("./plugins");
const lifecycle_1 = require("./lifecycle");
const common_1 = require("@flutry/common");
const router_1 = require("@flutry/router");
class HttpServer {
    constructor(options = {
        prefix: '',
    }) {
        this.startTime = performance.now();
        const fastifyOptions = {
            trustProxy: options.trustProxy ?? true,
            logger: options.logger ?? false,
        };
        this.app = (0, fastify_1.default)(fastifyOptions);
        this.routeLoader = new router_1.RouteLoader(this.app, {
            directory: node_path_1.default.resolve(process.cwd(), 'src', 'routes'),
            prefix: options.prefix,
        });
        (0, plugins_1.registerPlugins)(this.app, options);
        (0, lifecycle_1.registerLifecycle)(this.app, options);
    }
    async listen(port, host = '0.0.0.0') {
        /*
         * Routes must be registered before
         * Fastify starts accepting requests.
         */
        await this.routeLoader.load();
        const address = await this.app.listen({
            port,
            host,
        });
        const startupTime = performance.now() - this.startTime;
        common_1.logger.info(`=====================================`);
        common_1.logger.info(`🚀 Flutry Server ${process.env.NODE_ENV}`);
        common_1.logger.info(`⏰ Start Time: ${startupTime.toFixed(2)}ms`);
        common_1.logger.info(`🌐 ${address}`);
        common_1.logger.info(`=====================================`);
        return address;
    }
    async close() {
        await this.app.close();
    }
}
exports.HttpServer = HttpServer;
