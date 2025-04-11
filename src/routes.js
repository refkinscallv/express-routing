'use strict'

/**
 * Express Routing by Refkinscallv
 * version 1.0.0
 * 
 * Laravel-style routing class for Express apps
 */

module.exports = class Routes {
    static routes = []                    // Stores all route definitions
    static prefix = ''                    // Used for route groups
    static groupMiddlewares = []          // Used for middleware grouping

    /**
     * Register a route definition
     */
    static add(methods, path, handler, middlewares = []) {
        const methodArray = Array.isArray(methods) ? methods : [methods]
        const fullPath = `${this.prefix}${path}`.replace(/\/{2,}/g, '/') // Normalize double slashes

        this.routes.push({
            methods: methodArray,
            path: fullPath,
            handler,
            middlewares: [...this.groupMiddlewares, ...middlewares],
        })
    }

    // HTTP verb helpers
    static get(path, handler, middlewares = []) {
        this.add('get', path, handler, middlewares)
    }

    static post(path, handler, middlewares = []) {
        this.add('post', path, handler, middlewares)
    }

    static put(path, handler, middlewares = []) {
        this.add('put', path, handler, middlewares)
    }

    static delete(path, handler, middlewares = []) {
        this.add('delete', path, handler, middlewares)
    }

    static patch(path, handler, middlewares = []) {
        this.add('patch', path, handler, middlewares)
    }

    static options(path, handler, middlewares = []) {
        this.add('options', path, handler, middlewares)
    }

    static head(path, handler, middlewares = []) {
        this.add('head', path, handler, middlewares)
    }

    /**
     * Group multiple routes under a common prefix and/or middleware
     */
    static group(prefix, callback, middlewares = []) {
        const previousPrefix = this.prefix
        const previousMiddlewares = this.groupMiddlewares

        this.prefix = `${previousPrefix}${prefix}`.replace(/\/{2,}/g, '/')
        this.groupMiddlewares = [...previousMiddlewares, ...middlewares]

        callback()

        // Restore previous state after group is done
        this.prefix = previousPrefix
        this.groupMiddlewares = previousMiddlewares
    }

    /**
     * Apply the registered routes to an Express router instance
     */
    static async apply(router) {
        for (const route of this.routes) {
            let handlerFunction

            // 1. Direct function handler
            if (typeof route.handler === 'function') {
                handlerFunction = route.handler

            // 2. Callable descriptor [Class/Object, 'method']
            } else if (
                Array.isArray(route.handler) &&
                route.handler.length === 2
            ) {
                const [Controller, method] = route.handler
                if (typeof Controller[method] !== 'function') {
                    console.error(
                        `Method "${method}" not found in controller "${Controller.name}"`
                    )
                    continue
                }

                // Bind to class or object context
                handlerFunction = Controller[method].bind(Controller)

            // 3. Invalid handler format
            } else {
                console.error(`Invalid handler format for route: ${route.path}`)
                continue
            }

            // Register to Express router
            for (const method of route.methods) {
                router[method](
                    route.path,
                    ...(route.middlewares || []),
                    async (req, res, next) => {
                        try {
                            const routeHttpHandler = { req, res, next }
                            const result = handlerFunction(routeHttpHandler)
                            await Promise.resolve(result)
                        } catch (error) {
                            console.error(
                                `Error in route ${method.toUpperCase()} ${route.path}: ${error.message}`
                            )
                            next(error)
                        }
                    }
                )
            }
        }
    }
}
