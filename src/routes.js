'use strict'

/**
 * @module express-routing
 * @description Laravel-style routing system for Express.js.
 * @author Refkinscallv
 * @repository https://github.com/refkinscallv/express-routing
 * @version 1.2.1
 * @date 2025
 */
module.exports = class Routes {
    static routes = []
    static prefix = ''
    static groupMiddlewares = []
    static globalMiddlewares = []

    /**
     * Normalizations path
     */
    static normalizePath(path) {
        return '/' + path
            .split('/')
            .filter(Boolean)
            .join('/')
    }    

    /**
     * Adds a route with specified methods, path, handler, and middlewares.
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
     * Groups routes with a common prefix and middlewares.
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
     * Applies global middlewares for the duration of the callback.
     */
    static middleware(middlewares, callback) {
        const prevMiddlewares = this.globalMiddlewares

        this.globalMiddlewares = [...prevMiddlewares, ...middlewares]

        callback()

        this.globalMiddlewares = prevMiddlewares
    }

    /**
     * Applies all registered routes to the provided Express Router instance.
     * Handles controller-method binding and middleware application.
     */
    static async apply(router) {
        for (const route of this.routes) {
            let handlerFunction = null

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
                    try {
                        const instance = new Controller()
                        if (typeof instance[method] === 'function') {
                            handlerFunction = instance[method].bind(instance)
                        } else {
                            console.error(
                                `[ROUTES] Method "${method}" not found in controller instance "${Controller.name}"`
                            )
                            continue
                        }
                    } catch (err) {
                        console.error(
                            `[ROUTES] Failed to instantiate controller "${Controller.name}": ${err.message}`
                        )
                        continue
                    }
                } else {
                    console.error(
                        `[ROUTES] Invalid controller type for route: ${route.path}`
                    )
                    continue
                }
            } else {
                console.error(`[ROUTES] Invalid handler format for route: ${route.path}`)
                continue
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
                    console.error(
                        `[ROUTES] Invalid HTTP method: ${method} for route: ${route.path}`
                    )
                    continue
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
                            console.error(
                                `[ROUTES] Error in route ${method.toUpperCase()} ${route.path}: ${error.message}`
                            )
                            next(error)
                        }
                    }
                )
            }
        }
    }
}