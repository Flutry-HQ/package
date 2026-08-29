"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLifecycle = registerLifecycle;
const common_1 = require("@flutry/common");
function registerLifecycle(app, _options) {
    app.addHook('onRequest', onRequest);
}
async function onRequest(request, reply) {
    if (request.raw.url === '/favicon.ico') {
        return;
    }
    const start = performance.now();
    reply.raw.once('finish', () => {
        const duration = performance.now() - start;
        common_1.logger.http(`http ${request.method} ${request.raw.url} ${duration.toFixed(2)}ms ${reply.statusCode}`);
    });
}
