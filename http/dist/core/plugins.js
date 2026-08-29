"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPlugins = registerPlugins;
const compress_1 = __importDefault(require("@fastify/compress"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
function registerPlugins(app, options) {
    if (options.compression !== false) {
        app.register(compress_1.default);
    }
    if (options.helmet !== false) {
        app.register(helmet_1.default);
    }
}
