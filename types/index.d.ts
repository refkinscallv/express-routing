import { Application, Router, Request, Response, NextFunction } from 'express';

/**
 * HTTP context passed to ALL handlers and handle() middleware — always { req, res, next, error }
 */
export interface HttpContext {
    req: Request;
    res: Response;
    next: NextFunction;
    /** Populated in errorHandler, null in normal route/middleware handlers */
    error: Error | null;
}

/** Route handler function — receives the full HttpContext */
export type RouteHandler = (ctx: HttpContext) => void | Promise<void>;

/** Controller method reference tuple */
export type ControllerHandler = [any, string];

/** Handler can be an inline function or a controller binding */
export type Handler = RouteHandler | ControllerHandler;

/**
 * Middleware — plain Express function OR object/class with handle()
 *
 * PLAIN FUNCTION — allowed in scoped Routes.middleware([fn], () => { ... }) and per-route:
 *   (req, res, next) => void
 *
 * HANDLE CLASS — required in chaining Routes.middleware([Mw]).get(...):
 *   class Mw { static handle({ req, res, next, error }: HttpContext): void }
 *   class Mw { handle({ req, res, next, error }: HttpContext): void }
 *   const obj = { handle({ req, res, next, error }: HttpContext): void }
 */
export type MiddlewareFn = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

export interface MiddlewareClass {
    handle(ctx: HttpContext): void | Promise<void>;
}

export type Middleware = MiddlewareFn | MiddlewareClass | (new () => MiddlewareClass);

/** HTTP methods supported by the router */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

/** Route information object returned by allRoutes() */
export interface RouteInfo {
    methods: HttpMethod[];
    path: string;
    middlewareCount: number;
    handlerType: 'function' | 'controller';
}

/**
 * Per-method middleware map for Routes.controller().
 * Keys are controller method names; values are a single middleware or array.
 * Only handle()-based middleware classes/objects are recommended here.
 */
export type MethodMiddlewareMap = Record<string, Middleware | Middleware[]>;

/**
 * Proxy returned by Routes.middleware() when called WITHOUT a callback (chaining mode).
 *
 * STRICT: only handle()-based middleware classes/objects are allowed.
 * Each method call is terminal — globalMiddlewares are restored after.
 *
 * Usage:
 *   Routes.middleware([Mw]).get(path, handler)
 *   Routes.middleware([Mw]).post(path, handler)
 *   Routes.middleware([Mw]).group(prefix, callback)
 */
export interface MiddlewareChain {
    group(prefix: string, callback: () => void, middlewares?: Middleware[]): void;
    add(methods: HttpMethod | HttpMethod[], path: string, handler: Handler, middlewares?: Middleware[]): void;
    get(path: string, handler: Handler, middlewares?: Middleware[]): void;
    post(path: string, handler: Handler, middlewares?: Middleware[]): void;
    put(path: string, handler: Handler, middlewares?: Middleware[]): void;
    delete(path: string, handler: Handler, middlewares?: Middleware[]): void;
    patch(path: string, handler: Handler, middlewares?: Middleware[]): void;
    options(path: string, handler: Handler, middlewares?: Middleware[]): void;
    head(path: string, handler: Handler, middlewares?: Middleware[]): void;
}

export default class Routes {
    static routes: Array<{
        methods: HttpMethod[];
        path: string;
        handler: Handler;
        middlewares: Middleware[];
        _resolved?: boolean;
    }>;
    static prefix: string;
    static groupMiddlewares: Middleware[];
    static globalMiddlewares: Middleware[];
    static _errorHandler: RouteHandler | null;
    static _maintenanceMode: boolean;
    static _maintenanceHandler: RouteHandler | null;

    static normalizePath(path: string): string;

    /**
     * Convert method/function name to kebab-case URL segment.
     *   samplePath  → sample-path
     *   SamplePath  → sample-path
     *   sample_path → sample-path
     *   Samplepath  → samplepath
     */
    static nameToPath(name: string): string;

    static resolveHandler(Controller: any, method: string): RouteHandler;

    /**
     * Normalize middleware — accepts plain function OR handle() class/object.
     * Used for scoped middleware and per-route middleware.
     */
    static normalizeMiddleware(mw: Middleware): MiddlewareFn;

    /**
     * Strict normalization — ONLY handle() classes/objects allowed.
     * Used internally by chaining syntax. Throws if a plain function is passed.
     */
    static normalizeMiddlewareStrict(mw: Middleware): MiddlewareFn;

    static add(methods: HttpMethod | HttpMethod[], path: string, handler: Handler, middlewares?: Middleware[]): void;
    static get(path: string, handler: Handler, middlewares?: Middleware[]): void;
    static post(path: string, handler: Handler, middlewares?: Middleware[]): void;
    static put(path: string, handler: Handler, middlewares?: Middleware[]): void;
    static delete(path: string, handler: Handler, middlewares?: Middleware[]): void;
    static patch(path: string, handler: Handler, middlewares?: Middleware[]): void;
    static options(path: string, handler: Handler, middlewares?: Middleware[]): void;
    static head(path: string, handler: Handler, middlewares?: Middleware[]): void;
    static group(prefix: string, callback: () => void, middlewares?: Middleware[]): void;

    /**
     * Apply global middlewares.
     *
     * SCOPED (with callback) — accepts plain functions OR handle() classes:
     *   Routes.middleware([Mw, fn], () => { Routes.get(...) })
     *   Returns `typeof Routes` for fluency.
     *
     * CHAINING (without callback) — STRICT: only handle() classes/objects:
     *   Routes.middleware([Mw]).get(path, handler)
     *   Routes.middleware([Mw]).post(path, handler)
     *   Routes.middleware([Mw]).group(prefix, callback)
     *   Returns MiddlewareChain — each call is terminal.
     */
    static middleware(middlewares: Middleware[], callback: () => void): typeof Routes;
    static middleware(middlewares: Middleware[]): MiddlewareChain;

    static errorHandler(handler: Handler): void;
    static maintenance(enabled: boolean, handler?: Handler): void;

    /**
     * Auto-register all methods of a controller as routes.
     *
     * @param basePath  Base URL for the controller
     * @param Controller  Class (static or instance) or plain object
     * @param methodMiddlewares  Optional per-method middleware map:
     *   {
     *     'index':      AuthMiddleware,
     *     'myProfile':  [AuthMiddleware, LogMiddleware],
     *   }
     */
    static controller(basePath: string, Controller: any, methodMiddlewares?: MethodMiddlewareMap): void;

    static allRoutes(): RouteInfo[];

    /**
     * Apply routes to Express.
     *   Routes.apply(app)           — direct mount
     *   Routes.apply(app, router)   — auto app.use(router)
     */
    static apply(appOrRouter: Application | Router, router?: Router): Promise<void>;
}

export { Routes };
