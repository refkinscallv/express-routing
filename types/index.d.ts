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

/**
 * Route handler function — receives the full HttpContext.
 * The return value is ignored, so handlers may freely `return res.json(...)`
 * or be `async`. (Typed as `any` to allow the common `({ res }) => res.json(...)` form.)
 */
export type RouteHandler = (ctx: HttpContext) => any;

/** Controller method reference tuple */
export type ControllerHandler = [any, string];

/** Handler can be an inline function or a controller binding */
export type Handler = RouteHandler | ControllerHandler;

/**
 * Middleware — plain Express function, object/class with handle(), OR a registered
 * alias/group name (string, see Routes.registerMiddleware / Routes.middlewareGroup).
 *
 * PLAIN FUNCTION — allowed in scoped Routes.middleware([fn], () => { ... }) and per-route:
 *   (req, res, next) => void
 *
 * HANDLE CLASS — required in chaining Routes.middleware([Mw]).get(...):
 *   class Mw { static handle({ req, res, next, error }: HttpContext): void }
 *   class Mw { handle({ req, res, next, error }: HttpContext): void }
 *   const obj = { handle({ req, res, next, error }: HttpContext): void }
 *
 * STRING — a registered middleware alias or group: 'auth', 'web', ...
 */
export type MiddlewareFn = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

export interface MiddlewareClass {
    handle(ctx: HttpContext): void | Promise<void>;
}

export type Middleware = MiddlewareFn | MiddlewareClass | (new () => MiddlewareClass) | string;

/** HTTP methods supported by the router */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

/** Parameter constraint — a regex source string or a RegExp. */
export type RouteConstraint = string | RegExp;

/** Route information object returned by allRoutes() */
export interface RouteInfo {
    methods: HttpMethod[];
    path: string;
    /** Route name (Routes...name()), or null if unnamed */
    name: string | null;
    middlewareCount: number;
    handlerType: 'function' | 'controller';
}

/** The seven RESTful resource actions. */
export type ResourceAction = 'index' | 'create' | 'store' | 'show' | 'edit' | 'update' | 'destroy';

/** Options for Routes.resource() / Routes.apiResource(). */
export interface ResourceOptions {
    /** Only register these actions. */
    only?: ResourceAction[];
    /** Register all actions except these. */
    except?: ResourceAction[];
    /** Path parameter name for show/update/destroy/edit (default: 'id'). */
    parameter?: string;
    /** When true, omit the HTML-form `create` and `edit` routes. */
    api?: boolean;
    /** Middleware applied to every generated resource route. */
    middleware?: Middleware | Middleware[];
}

/**
 * Chainable handle returned by route-definition methods, enabling Laravel-style
 * fluent configuration:
 *   Routes.get('/users/:id', h).name('users.show').whereNumber('id')
 */
export interface RouteRegistration {
    /** Assign a route name for URL generation via Routes.url() / Routes.route(). */
    name(name: string): RouteRegistration;
    /** Constrain a path parameter to a pattern (regex string or RegExp). */
    where(param: string, pattern: RouteConstraint): RouteRegistration;
    /** Constrain several path parameters at once. */
    where(constraints: Record<string, RouteConstraint>): RouteRegistration;
    whereNumber(param: string): RouteRegistration;
    whereAlpha(param: string): RouteRegistration;
    whereAlphaNumeric(param: string): RouteRegistration;
    whereUuid(param: string): RouteRegistration;
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
 * STRICT: only handle()-based middleware classes/objects (or aliases that resolve to one)
 * are allowed. Each method call is terminal — globalMiddlewares are restored after.
 *
 * Usage:
 *   Routes.middleware([Mw]).get(path, handler).name('...')
 *   Routes.middleware([Mw]).group(prefix, callback)
 */
export interface MiddlewareChain {
    group(prefix: string, callback: () => void, middlewares?: Middleware[]): void;
    add(methods: HttpMethod | HttpMethod[], path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    get(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    post(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    put(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    delete(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    patch(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    options(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    head(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
}

export default class Routes {
    static routes: Array<{
        methods: HttpMethod[];
        path: string;
        handler: Handler;
        middlewares: Middleware[];
        name?: string | null;
        constraints?: Record<string, RouteConstraint>;
        _resolved?: boolean;
    }>;
    static prefix: string;
    static groupMiddlewares: Middleware[];
    static globalMiddlewares: Middleware[];
    static middlewareAliases: Record<string, Middleware>;
    static middlewareGroups: Record<string, Middleware[]>;
    static _errorHandler: RouteHandler | null;
    static _maintenanceMode: boolean;
    static _maintenanceHandler: RouteHandler | null;
    static _fallbackHandler: RouteHandler | null;

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

    /** Register named middleware aliases (Laravel-style). */
    static registerMiddleware(name: string, mw: Middleware): typeof Routes;
    static registerMiddleware(map: Record<string, Middleware>): typeof Routes;

    /** Register a named middleware group — a string that expands to several middlewares. */
    static middlewareGroup(name: string, list: Middleware[]): typeof Routes;

    /** Expand a middleware list, resolving string aliases/groups to actual middleware. */
    static expandMiddleware(list: Middleware[]): Middleware[];

    static add(methods: HttpMethod | HttpMethod[], path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    static get(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    static post(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    static put(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    static delete(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    static patch(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    static options(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
    static head(path: string, handler: Handler, middlewares?: Middleware[]): RouteRegistration;
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
     * Methods whose name starts with `_` (e.g. `_helper`) are treated as private
     * helpers and are NEVER registered as routes.
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

    /**
     * Register the seven RESTful resource routes for a controller (Laravel-style):
     *   GET index · GET create · POST store · GET show · GET edit · PUT|PATCH update · DELETE destroy
     * Each is named `<name>.<action>`. Only actions the controller implements are registered.
     */
    static resource(name: string, Controller: any, options?: ResourceOptions): typeof Routes;

    /** API resource — resource() without the HTML-form create/edit routes. */
    static apiResource(name: string, Controller: any, options?: ResourceOptions): typeof Routes;

    /**
     * Build a resolver binding a controller method to the class, a single shared
     * instance, or the object — returning null when the method does not exist.
     */
    static makeMethodResolver(Controller: any): (method: string) => RouteHandler | null;

    /** Register a redirect route (default status 302). */
    static redirect(from: string, to: string, status?: number): RouteRegistration;

    /** Register a route that renders a view via the Express view engine (res.render). */
    static view(path: string, view: string, data?: Record<string, any>): RouteRegistration;

    /** Register a fallback handler invoked when no other route matches. */
    static fallback(handler: Handler): typeof Routes;

    /**
     * Generate a URL for a named route, substituting `:param` segments and appending
     * any extra keys as a query string.
     *   Routes.url('users.show', { id: 5 })    // → /users/5
     */
    static url(name: string, params?: Record<string, any>): string;

    /** Alias of Routes.url() — matches Laravel's `route()` helper. */
    static route(name: string, params?: Record<string, any>): string;

    static allRoutes(): RouteInfo[];

    /**
     * Apply routes to Express.
     *   Routes.apply(app)           — direct mount
     *   Routes.apply(app, router)   — auto app.use(router)
     */
    static apply(appOrRouter: Application | Router, router?: Router): Promise<void>;
}

export { Routes };
