import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Request context wrapper used by Flutry route handlers.
 *
 * Ctx provides a simplified interface around Fastify's
 * request and reply objects, making common request and
 * response operations easier to use inside routes.
 *
 * The original Fastify request and reply instances remain
 * accessible through the `req` and `reply` properties.
 */
export class Ctx {
  /**
   * Creates a new request context.
   *
   * @param req Incoming Fastify request.
   * @param reply Fastify response instance.
   */
  public constructor(
    public readonly req: FastifyRequest,
    public readonly reply: FastifyReply,
  ) {}

  /**
   * Returns the route parameters.
   *
   * For example, a route such as `/users/:id` can access
   * the `id` parameter through this property.
   */
  public get params(): unknown {
    return this.req.params;
  }

  /**
   * Returns the parsed request body.
   */
  public get body(): unknown {
    return this.req.body;
  }

  /**
   * Returns the parsed query parameters.
   */
  public get query(): unknown {
    return this.req.query;
  }

  /**
   * Sends a response to the client.
   *
   * @param data Response payload.
   * @param status HTTP status code. Defaults to `200`.
   *
   * @returns The Fastify reply instance.
   */
  public send(data: unknown, status = 200): FastifyReply {
    return this.reply.code(status).send(data);
  }

  /**
   * Sets the HTTP response status code.
   *
   * This method does not send the response by itself.
   *
   * @param code HTTP status code.
   *
   * @returns The Fastify reply instance.
   */
  public status(code: number): FastifyReply {
    return this.reply.code(code);
  }

  /**
   * Redirects the client to another URL.
   *
   * @param url Target URL.
   * @param code HTTP redirect status code. Defaults to `302`.
   *
   * @returns The Fastify reply instance.
   */
  public redirect(url: string, code = 302): FastifyReply {
    return this.reply.redirect(url, code);
  }

  /**
   * Returns a request header value.
   *
   * Header names are normalized to lowercase because HTTP
   * header names are case-insensitive.
   *
   * When a header contains multiple values, only the first
   * value is returned.
   *
   * @param name Header name.
   *
   * @returns Header value or `undefined` when the header
   * does not exist.
   */
  public getHeader(name: string): string | undefined {
    const value = this.req.headers[name.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  /**
   * Sets a response header.
   *
   * @param name Header name.
   * @param value Header value.
   *
   * @returns The Fastify reply instance.
   */
  public setHeader(name: string, value: string): FastifyReply {
    return this.reply.header(name, value);
  }

  /**
   * Ends the response without sending a response body.
   *
   * @returns The Fastify reply instance.
   */
  public end(): FastifyReply {
    return this.reply.send();
  }
}
