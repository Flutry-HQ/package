import { FastifyReply, FastifyRequest } from 'fastify';

export class Ctx {
  public constructor(
    public readonly req: FastifyRequest,
    public readonly reply: FastifyReply,
  ) {}

  public get params(): unknown {
    return this.req.params;
  }

  public get body(): unknown {
    return this.req.body;
  }

  public get query(): unknown {
    return this.req.query;
  }

  public send(data: unknown, status = 200): FastifyReply {
    return this.reply.code(status).send(data);
  }

  public status(code: number): FastifyReply {
    return this.reply.code(code);
  }

  public redirect(url: string, code = 302): FastifyReply {
    return this.reply.redirect(url, code);
  }

  public getHeader(name: string): string | undefined {
    const value = this.req.headers[name.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0];
    }

    return value;
  }

  public setHeader(name: string, value: string): FastifyReply {
    return this.reply.header(name, value);
  }

  public end(): FastifyReply {
    return this.reply.send();
  }
}
