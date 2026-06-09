import { Application, Router, Request, Response, NextFunction } from 'express';

/**
 * CommonJS type definitions for `@refkinscallv/express-routing`.
 *
 * Uses `export = Routes` so that:
 *
 *   const Routes = require('@refkinscallv/express-routing')
 *
 * resolves directly to the `Routes` class (with full IDE autocomplete) —
 * no `.default` access required. The `.default` property still exists at
 * runtime for backward compatibility.
 *
 * The ESM/TypeScript counterpart lives in `index.d.mts` (`export default`).
 */

declare namespace Routes {
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
        only?: ResourceAction[];
        except?: ResourceAction[];
        parameter?: string;
        api?: boolean;
        middleware?: Middleware | Middleware[];
    }

    /**
     * Chainable handle returned by route-definition methods, enabling Laravel-style
     * fluent configuration:
     *   Routes.get('/users/:id', h).name('users.show').whereNumber('id')
     */
    export interface RouteRegistration {
        name(name: string): RouteRegistration;
        where(param: string, pattern: RouteConstraint): RouteRegistration;
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

    /**
     * Backward-compatible alias — `require('...').default` still resolves to the Routes class.
     * Prefer `const Routes = require('@refkinscallv/express-routing')` (no `.default`).
     */
    export { Routes as default };
}

declare class Routes {
    static routes: Array<{
        methods: Routes.HttpMethod[];
        path: string;
        handler: Routes.Handler;
        middlewares: Routes.Middleware[];
        name?: string | null;
        constraints?: Record<string, Routes.RouteConstraint>;
        _resolved?: boolean;
    }>;
    static prefix: string;
    static groupMiddlewares: Routes.Middleware[];
    static globalMiddlewares: Routes.Middleware[];
    static middlewareAliases: Record<string, Routes.Middleware>;
    static middlewareGroups: Record<string, Routes.Middleware[]>;
    static _errorHandler: Routes.RouteHandler | null;
    static _maintenanceMode: boolean;
    static _maintenanceHandler: Routes.RouteHandler | null;
    static _fallbackHandler: Routes.RouteHandler | null;

    static normalizePath(path: string): string;

    /**
     * Convert method/function name to kebab-case URL segment.
     *   samplePath  → sample-path
     *   SamplePath  → sample-path
     *   sample_path → sample-path
     *   Samplepath  → samplepath
     */
    static nameToPath(name: string): string;

    static resolveHandler(Controller: any, method: string): Routes.RouteHandler;

    /**
     * Normalize middleware — accepts plain function OR handle() class/object.
     * Used for scoped middleware and per-route middleware.
     */
    static normalizeMiddleware(mw: Routes.Middleware): Routes.MiddlewareFn;

    /**
     * Strict normalization — ONLY handle() classes/objects allowed.
     * Used internally by chaining syntax. Throws if a plain function is passed.
     */
    static normalizeMiddlewareStrict(mw: Routes.Middleware): Routes.MiddlewareFn;

    /** Register named middleware aliases (Laravel-style). */
    static registerMiddleware(name: string, mw: Routes.Middleware): typeof Routes;
    static registerMiddleware(map: Record<string, Routes.Middleware>): typeof Routes;

    /** Register a named middleware group — a string that expands to several middlewares. */
    static middlewareGroup(name: string, list: Routes.Middleware[]): typeof Routes;

    /** Expand a middleware list, resolving string aliases/groups to actual middleware. */
    static expandMiddleware(list: Routes.Middleware[]): Routes.Middleware[];

    static add(methods: Routes.HttpMethod | Routes.HttpMethod[], path: string, handler: Routes.Handler, middlewares?: Routes.Middleware[]): Routes.RouteRegistration;
    static get(path: string, handler: Routes.Handler, middlewares?: Routes.Middleware[]): Routes.RouteRegistration;
    static post(path: string, handler: Routes.Handler, middlewares?: Routes.Middleware[]): Routes.RouteRegistration;
    static put(path: string, handler: Routes.Handler, middlewares?: Routes.Middleware[]): Routes.RouteRegistration;
    static delete(path: string, handler: Routes.Handler, middlewares?: Routes.Middleware[]): Routes.RouteRegistration;
    static patch(path: string, handler: Routes.Handler, middlewares?: Routes.Middleware[]): Routes.RouteRegistration;
    static options(path: string, handler: Routes.Handler, middlewares?: Routes.Middleware[]): Routes.RouteRegistration;
    static head(path: string, handler: Routes.Handler, middlewares?: Routes.Middleware[]): Routes.RouteRegistration;
    static group(prefix: string, callback: () => void, middlewares?: Routes.Middleware[]): void;

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
    static middleware(middlewares: Routes.Middleware[], callback: () => void): typeof Routes;
    static middleware(middlewares: Routes.Middleware[]): Routes.MiddlewareChain;

    static errorHandler(handler: Routes.Handler): void;
    static maintenance(enabled: boolean, handler?: Routes.Handler): void;

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
    static controller(basePath: string, Controller: any, methodMiddlewares?: Routes.MethodMiddlewareMap): void;

    /**
     * Register the seven RESTful resource routes for a controller (Laravel-style).
     * Each is named `<name>.<action>`. Only actions the controller implements are registered.
     */
    static resource(name: string, Controller: any, options?: Routes.ResourceOptions): typeof Routes;

    /** API resource — resource() without the HTML-form create/edit routes. */
    static apiResource(name: string, Controller: any, options?: Routes.ResourceOptions): typeof Routes;

    /**
     * Build a resolver binding a controller method to the class, a single shared
     * instance, or the object — returning null when the method does not exist.
     */
    static makeMethodResolver(Controller: any): (method: string) => Routes.RouteHandler | null;

    /** Register a redirect route (default status 302). */
    static redirect(from: string, to: string, status?: number): Routes.RouteRegistration;

    /** Register a route that renders a view via the Express view engine (res.render). */
    static view(path: string, view: string, data?: Record<string, any>): Routes.RouteRegistration;

    /** Register a fallback handler invoked when no other route matches. */
    static fallback(handler: Routes.Handler): typeof Routes;

    /**
     * Generate a URL for a named route, substituting `:param` segments and appending
     * any extra keys as a query string.
     */
    static url(name: string, params?: Record<string, any>): string;

    /** Alias of Routes.url() — matches Laravel's `route()` helper. */
    static route(name: string, params?: Record<string, any>): string;

    static allRoutes(): Routes.RouteInfo[];

    /**
     * Apply routes to Express.
     *   Routes.apply(app)           — direct mount
     *   Routes.apply(app, router)   — auto app.use(router)
     */
    static apply(appOrRouter: Application | Router, router?: Router): Promise<void>;
}

export = Routes;
