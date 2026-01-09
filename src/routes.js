'use strict'

/**
 * @module express-routing
 * @description Laravel-style routing system for Express.js with support for CommonJS, ESM, and TypeScript
 * @author Refkinscallv
 * @repository https://github.com/refkinscallv/express-routing
 * @version 2.0.2
 * @date 2026
 */

class Routes {
    static routes = []
    static prefix = ''
    static groupMiddlewares = []
    static globalMiddlewares = []

    /**
     * Normalize path by removing duplicate slashes and ensuring leading slash
     * @param {string} path - Path to normalize
     * @returns {string} Normalized path
     */
    static normalizePath(path) {
        return '/' + path
            .split('/')
            .filter(Boolean)
            .join('/')
    }

    /**
     * Add a route with specified HTTP methods, path, handler, and middlewares
     * @param {string|string[]} methods - HTTP method(s) for the route
     * @param {string} path - Route path
     * @param {Function|Array} handler - Route handler function or [Controller, method]
     * @param {Function[]} middlewares - Array of middleware functions
     */
    static add(methods, path, handler, middlewares = []) {
        const methodArray = Array.isArray(methods) ? methods : [methods]
        const fullPath = this.normalizePath(`${this.prefix}/${path}`)

        this.routes.push({
            methods: methodArray,
            path: fullPath,
            handler,
            middlewares: [
                ...this.globalMiddlewares,
                ...this.groupMiddlewares,
                ...middlewares,
            ],
        })
    }

    /**
     * Register a GET route
     * @param {string} path - Route path
     * @param {Function|Array} handler - Route handler
     * @param {Function[]} middlewares - Middleware functions
     */
    static get(path, handler, middlewares = []) {
        this.add('get', path, handler, middlewares)
    }

    /**
     * Register a POST route
     * @param {string} path - Route path
     * @param {Function|Array} handler - Route handler
     * @param {Function[]} middlewares - Middleware functions
     */
    static post(path, handler, middlewares = []) {
        this.add('post', path, handler, middlewares)
    }

    /**
     * Register a PUT route
     * @param {string} path - Route path
     * @param {Function|Array} handler - Route handler
     * @param {Function[]} middlewares - Middleware functions
     */
    static put(path, handler, middlewares = []) {
        this.add('put', path, handler, middlewares)
    }

    /**
     * Register a DELETE route
     * @param {string} path - Route path
     * @param {Function|Array} handler - Route handler
     * @param {Function[]} middlewares - Middleware functions
     */
    static delete(path, handler, middlewares = []) {
        this.add('delete', path, handler, middlewares)
    }

    /**
     * Register a PATCH route
     * @param {string} path - Route path
     * @param {Function|Array} handler - Route handler
     * @param {Function[]} middlewares - Middleware functions
     */
    static patch(path, handler, middlewares = []) {
        this.add('patch', path, handler, middlewares)
    }

    /**
     * Register an OPTIONS route
     * @param {string} path - Route path
     * @param {Function|Array} handler - Route handler
     * @param {Function[]} middlewares - Middleware functions
     */
    static options(path, handler, middlewares = []) {
        this.add('options', path, handler, middlewares)
    }

    /**
     * Register a HEAD route
     * @param {string} path - Route path
     * @param {Function|Array} handler - Route handler
     * @param {Function[]} middlewares - Middleware functions
     */
    static head(path, handler, middlewares = []) {
        this.add('head', path, handler, middlewares)
    }

    /**
     * Group routes with a common prefix and middlewares
     * @param {string} prefix - URL prefix for grouped routes
     * @param {Function} callback - Function containing route definitions
     * @param {Function[]} middlewares - Middleware functions applied to all routes in group
     */
    static group(prefix, callback, middlewares = []) {
        const previousPrefix = this.prefix
        const previousMiddlewares = this.groupMiddlewares

        const fullPrefix = [previousPrefix, prefix]
            .filter(Boolean)
            .join('/')

        this.prefix = this.normalizePath(fullPrefix)
        this.groupMiddlewares = [...previousMiddlewares, ...middlewares]

        callback()

        this.prefix = previousPrefix
        this.groupMiddlewares = previousMiddlewares
    }

    /**
     * Apply global middlewares for the duration of the callback
     * @param {Function[]} middlewares - Middleware functions
     * @param {Function} callback - Function containing route definitions
     */
    static middleware(middlewares, callback) {
        const prevMiddlewares = this.globalMiddlewares

        this.globalMiddlewares = [...prevMiddlewares, ...middlewares]

        callback()

        this.globalMiddlewares = prevMiddlewares
    }

    /**
     * Get all registered routes with their information
     * @returns {Array} Array of route information objects
     */
    static allRoutes() {
        return this.routes.map(route => ({
            methods: route.methods,
            path: route.path,
            middlewareCount: route.middlewares.length,
            handlerType: typeof route.handler === 'function' ? 'function' : 'controller'
        }))
    }

    /**
     * Apply all registered routes to the provided Express Router instance
     * Handles controller-method binding and middleware application
     * All errors are thrown to Express error handling middleware
     * @param {import('express').Router} router - Express Router instance
     */
    static async apply(router) {
        for (const route of this.routes) {
            let handlerFunction = null

            try {
                if (typeof route.handler === 'function') {
                    handlerFunction = route.handler
                } else if (
                    Array.isArray(route.handler) &&
                    route.handler.length === 2
                ) {
                    const [Controller, method] = route.handler

                    if (
                        typeof Controller === 'function' &&
                        typeof Controller[method] === 'function'
                    ) {
                        handlerFunction = Controller[method].bind(Controller)
                    }
                    else if (typeof Controller === 'function') {
                        const instance = new Controller()
                        if (typeof instance[method] === 'function') {
                            handlerFunction = instance[method].bind(instance)
                        } else {
                            throw new Error(
                                `Method "${method}" not found in controller instance "${Controller.name}"`
                            )
                        }
                    } else {
                        throw new Error(`Invalid controller type for route: ${route.path}`)
                    }
                } else {
                    throw new Error(`Invalid handler format for route: ${route.path}`)
                }
            } catch (error) {
                console.error(`[ROUTES] Error setting up route ${route.path}:`, error.message)
                throw error
            }

            if (!handlerFunction) continue

            for (const method of route.methods) {
                const allowedMethods = [
                    'get',
                    'post',
                    'put',
                    'delete',
                    'patch',
                    'options',
                    'head',
                ]

                if (!allowedMethods.includes(method)) {
                    const error = new Error(
                        `Invalid HTTP method: ${method} for route: ${route.path}`
                    )
                    console.error(`[ROUTES]`, error.message)
                    throw error
                }

                router[method](
                    route.path,
                    ...(route.middlewares || []),
                    async (req, res, next) => {
                        try {
                            const ctx = { req, res, next }
                            const result = handlerFunction(ctx)
                            await Promise.resolve(result)
                        } catch (error) {
                            next(error)
                        }
                    }
                )
            }
        }
    }
}

module.exports = Routes
module.exports.default = Routes
