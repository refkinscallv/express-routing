import { Router, Request, Response, NextFunction } from 'express';

/**
 * HTTP context passed to route handlers
 */
export interface HttpContext {
    req: Request;
    res: Response;
    next: NextFunction;
}

/**
 * Route handler function type
 */
export type RouteHandler = (ctx: HttpContext) => void | Promise<void>;

/**
 * Controller method reference
 */
export type ControllerHandler = [any, string];

/**
 * Handler can be either a function or controller reference
 */
export type Handler = RouteHandler | ControllerHandler;

/**
 * Middleware function type
 */
export type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

/**
 * Route information object
 */
export interface RouteInfo {
    methods: HttpMethod[];
    path: string;
    middlewareCount: number;
    handlerType: 'function' | 'controller';
}

/**
 * Laravel-style routing system for Express.js
 */
export default class Routes {
    /**
     * All registered routes
     */
    static routes: Array<{
        methods: HttpMethod[];
        path: string;
        handler: Handler;
        middlewares: Middleware[];
    }>;

    /**
     * Current route prefix
     */
    static prefix: string;

    /**
     * Group-level middlewares
     */
    static groupMiddlewares: Middleware[];

    /**
     * Global-level middlewares
     */
    static globalMiddlewares: Middleware[];

    /**
     * Normalize path by removing duplicate slashes and ensuring leading slash
     * @param path - Path to normalize
     * @returns Normalized path
     */
    static normalizePath(path: string): string;

    /**
     * Add a route with specified HTTP methods, path, handler, and middlewares
     * @param methods - HTTP method(s) for the route
     * @param path - Route path
     * @param handler - Route handler function or controller reference
     * @param middlewares - Array of middleware functions
     */
    static add(
        methods: HttpMethod | HttpMethod[],
        path: string,
        handler: Handler,
        middlewares?: Middleware[]
    ): void;

    /**
     * Register a GET route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static get(path: string, handler: Handler, middlewares?: Middleware[]): void;

    /**
     * Register a POST route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static post(path: string, handler: Handler, middlewares?: Middleware[]): void;

    /**
     * Register a PUT route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static put(path: string, handler: Handler, middlewares?: Middleware[]): void;

    /**
     * Register a DELETE route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static delete(path: string, handler: Handler, middlewares?: Middleware[]): void;

    /**
     * Register a PATCH route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static patch(path: string, handler: Handler, middlewares?: Middleware[]): void;

    /**
     * Register an OPTIONS route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static options(path: string, handler: Handler, middlewares?: Middleware[]): void;

    /**
     * Register a HEAD route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static head(path: string, handler: Handler, middlewares?: Middleware[]): void;

    /**
     * Group routes with a common prefix and middlewares
     * @param prefix - URL prefix for grouped routes
     * @param callback - Function containing route definitions
     * @param middlewares - Middleware functions applied to all routes in group
     */
    static group(prefix: string, callback: () => void, middlewares?: Middleware[]): void;

    /**
     * Apply global middlewares for the duration of the callback
     * @param middlewares - Middleware functions
     * @param callback - Function containing route definitions
     */
    static middleware(middlewares: Middleware[], callback: () => void): void;

    /**
     * Get all registered routes with their information
     * @returns Array of route information objects
     */
    static allRoutes(): RouteInfo[];

    /**
     * Apply all registered routes to the provided Express Router instance
     * @param router - Express Router instance
     */
    static apply(router: Router): Promise<void>;
}

export { Routes };
