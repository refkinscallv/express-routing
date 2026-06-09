'use strict'

/**
 * @module express-routing
 * @description Laravel-style routing system for Express.js with support for CommonJS, ESM, and TypeScript
 * @author Refkinscallv
 * @repository https://github.com/refkinscallv/express-routing
 * @version 3.1.0
 * @date 2026
 */

class Routes {
    static routes = []
    static prefix = ''
    static groupMiddlewares = []
    static globalMiddlewares = []
    static _errorHandler = null
    static _maintenanceMode = false
    static _maintenanceHandler = null

    /**
     * Normalize path by removing duplicate slashes and ensuring leading slash
     * @param {string} path
     * @returns {string}
     */
    static normalizePath(path) {
        return '/' + path.split('/').filter(Boolean).join('/')
    }

    /**
     * Convert method/function name to kebab-case URL segment.
     *   SamplePath  -> sample-path
     *   samplePath  -> sample-path
     *   sample_path -> sample-path
     *   Samplepath  -> samplepath
     * @param {string} name
     * @returns {string}
     */
    static nameToPath(name) {
        let result = name.replace(/_/g, '-')
        result = result.replace(/([a-z])([A-Z][a-z])/g, '$1-$2')
        return result.toLowerCase()
    }

    /**
     * Resolve a controller (static class, instance class, plain object) + method name
     * into a bound callable function.
     * @param {Function|Object} Controller
     * @param {string} method
     * @returns {Function}
     */
    static resolveHandler(Controller, method) {
        if (typeof Controller === 'function' && typeof Controller[method] === 'function') {
            return Controller[method].bind(Controller)
        }
        if (typeof Controller === 'function') {
            const instance = new Controller()
            if (typeof instance[method] === 'function') {
                return instance[method].bind(instance)
            }
            throw new Error(`Method "${method}" not found in controller instance "${Controller.name}"`)
        }
        if (typeof Controller === 'object' && Controller !== null && typeof Controller[method] === 'function') {
            return Controller[method].bind(Controller)
        }
        throw new Error(`Cannot resolve handler for method "${method}"`)
    }

    /**
     * Resolve a middleware's handle({ req, res, next, error }) method into a bound
     * callable, or return null if the middleware is a plain Express function.
     * Accepts:
     *   - Class with a STATIC handle()        → bound to the class
     *   - Class with an INSTANCE handle()      → instantiated once, bound to the instance
     *   - Plain object with handle()           → bound to the object
     * @param {Function|Object} mw
     * @returns {Function|null}
     */
    static resolveHandle(mw) {
        if (typeof mw === 'function') {
            if (typeof mw.handle === 'function') {
                return mw.handle.bind(mw)                       // static handle()
            }
            if (mw.prototype && typeof mw.prototype.handle === 'function') {
                const instance = new mw()                       // instance handle()
                return instance.handle.bind(instance)
            }
            return null                                         // plain Express function
        }
        if (typeof mw === 'object' && mw !== null && typeof mw.handle === 'function') {
            return mw.handle.bind(mw)                            // plain object handle()
        }
        return null
    }

    /**
     * Wrap a resolved handle() function into an Express-compatible middleware.
     * @param {Function} handleFn
     * @returns {Function}
     */
    static wrapHandle(handleFn) {
        return (req, res, next) => {
            try {
                const result = handleFn({ req, res, next, error: null })
                Promise.resolve(result).catch(next)
            } catch (err) {
                next(err)
            }
        }
    }

    /**
     * Normalize a middleware entry to an Express-compatible function.
     * Accepts:
     *   - Plain Express function (req, res, next)              — passed through as-is
     *   - Class/object with handle({ req, res, next, error })  — auto-wrapped
     *     (static handle, instance handle, or plain object handle)
     * @param {Function|Object} mw
     * @returns {Function}
     */
    static normalizeMiddleware(mw) {
        const handleFn = this.resolveHandle(mw)
        if (handleFn) {
            return this.wrapHandle(handleFn)
        }
        if (typeof mw === 'function') {
            return mw
        }
        throw new Error(`Invalid middleware: must be a function or an object/class with a "handle({ req, res, next, error })" method`)
    }

    /**
     * Strict middleware normalization used in chaining context.
     * ONLY accepts middleware with a handle({ req, res, next, error }) method.
     * Plain Express functions are NOT allowed in chaining.
     * @param {Function|Object} mw
     * @returns {Function}
     */
    static normalizeMiddlewareStrict(mw) {
        const handleFn = this.resolveHandle(mw)
        if (!handleFn) {
            throw new Error(
                `Chained middleware must implement a "handle({ req, res, next, error })" method. ` +
                `Plain functions are not allowed in chaining syntax. Use the scoped callback form instead: ` +
                `Routes.middleware([fn], () => { ... })`
            )
        }
        return this.wrapHandle(handleFn)
    }

    /**
     * Add a route with specified HTTP methods, path, handler, and middlewares.
     * @param {string|string[]} methods
     * @param {string} path
     * @param {Function|Array} handler
     * @param {Array} middlewares
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

    static get(path, handler, middlewares = [])     { this.add('get',     path, handler, middlewares) }
    static post(path, handler, middlewares = [])    { this.add('post',    path, handler, middlewares) }
    static put(path, handler, middlewares = [])     { this.add('put',     path, handler, middlewares) }
    static delete(path, handler, middlewares = [])  { this.add('delete',  path, handler, middlewares) }
    static patch(path, handler, middlewares = [])   { this.add('patch',   path, handler, middlewares) }
    static options(path, handler, middlewares = []) { this.add('options', path, handler, middlewares) }
    static head(path, handler, middlewares = [])    { this.add('head',    path, handler, middlewares) }

    /**
     * Group routes under a common URL prefix with optional middleware.
     * @param {string} prefix
     * @param {Function} callback
     * @param {Array} middlewares
     */
    static group(prefix, callback, middlewares = []) {
        const previousPrefix = this.prefix
        const previousMiddlewares = this.groupMiddlewares

        const fullPrefix = [previousPrefix, prefix].filter(Boolean).join('/')
        this.prefix = this.normalizePath(fullPrefix)
        this.groupMiddlewares = [
            ...previousMiddlewares,
            ...middlewares.map(mw => this.normalizeMiddleware(mw)),
        ]

        try {
            callback()
        } finally {
            // Always restore — even if the callback throws — so a definition-time
            // error does not corrupt the prefix/middlewares for subsequent routes.
            this.prefix = previousPrefix
            this.groupMiddlewares = previousMiddlewares
        }
    }

    /**
     * Apply global middlewares.
     *
     * SCOPED (with callback) — accepts plain functions OR handle() classes:
     *   Routes.middleware([Mw1, fn], () => { Routes.get(...) })
     *
     * CHAINING (without callback) — STRICT: only handle() classes/objects allowed:
     *   Routes.middleware([Mw1, Mw2]).get(path, handler)
     *   Routes.middleware([Mw1, Mw2]).post(path, handler)
     *   Routes.middleware([Mw1, Mw2]).group(prefix, callback)
     *   Routes.middleware([Mw1, Mw2]).add(methods, path, handler)
     *
     * Each chained call is terminal — globalMiddlewares are restored after.
     *
     * @param {Array} middlewares
     * @param {Function} [callback]
     * @returns {typeof Routes|Object}
     */
    static middleware(middlewares, callback) {
        const prevMiddlewares = this.globalMiddlewares

        if (typeof callback === 'function') {
            // Scoped mode: accepts both plain functions and handle() classes
            const normalized = middlewares.map(mw => this.normalizeMiddleware(mw))
            this.globalMiddlewares = [...prevMiddlewares, ...normalized]
            try {
                callback()
            } finally {
                this.globalMiddlewares = prevMiddlewares
            }
            return this
        }

        // Chaining mode: STRICT — only handle() classes/objects allowed.
        // Validate eagerly so a bad middleware throws immediately, but DO NOT mutate
        // globalMiddlewares here — that mutation is scoped to each terminal call below.
        // (Otherwise `Routes.middleware([Mw])` with no terminal call would leak the
        // middleware into every later route.)
        const normalized = middlewares.map(mw => this.normalizeMiddlewareStrict(mw))

        const self = this

        /**
         * Apply the chained middlewares only for the duration of `action`, then restore.
         */
        const withChained = (action) => {
            const prev = self.globalMiddlewares
            self.globalMiddlewares = [...prev, ...normalized]
            try {
                action()
            } finally {
                self.globalMiddlewares = prev
            }
        }

        return {
            group(prefix, groupCallback, groupMiddlewares = []) {
                withChained(() => self.group(prefix, groupCallback, groupMiddlewares))
            },
            add(methods, path, handler, mws = []) {
                withChained(() => self.add(methods, path, handler, mws))
            },
            get(path, handler, mws = [])     { withChained(() => self.add('get',     path, handler, mws)) },
            post(path, handler, mws = [])    { withChained(() => self.add('post',    path, handler, mws)) },
            put(path, handler, mws = [])     { withChained(() => self.add('put',     path, handler, mws)) },
            delete(path, handler, mws = [])  { withChained(() => self.add('delete',  path, handler, mws)) },
            patch(path, handler, mws = [])   { withChained(() => self.add('patch',   path, handler, mws)) },
            options(path, handler, mws = []) { withChained(() => self.add('options', path, handler, mws)) },
            head(path, handler, mws = [])    { withChained(() => self.add('head',    path, handler, mws)) },
        }
    }

    /**
     * Register a global error handler.
     * Handler receives { req, res, next, error }.
     * @param {Function|Array} handler  — inline function or [Controller, 'method']
     */
    static errorHandler(handler) {
        if (Array.isArray(handler) && handler.length === 2) {
            const [Controller, method] = handler
            this._errorHandler = this.resolveHandler(Controller, method)
        } else if (typeof handler === 'function') {
            this._errorHandler = handler
        } else {
            throw new Error('Routes.errorHandler: invalid handler — must be a function or [Controller, "method"]')
        }
    }

    /**
     * Enable or disable maintenance mode.
     * When enabled, all requests receive a 503 before any route runs.
     * Handler receives { req, res, next, error }.
     * @param {boolean} enabled
     * @param {Function|Array} [handler]  — inline function or [Controller, 'method']
     */
    static maintenance(enabled, handler) {
        this._maintenanceMode = Boolean(enabled)

        if (handler) {
            if (Array.isArray(handler) && handler.length === 2) {
                const [Controller, method] = handler
                this._maintenanceHandler = this.resolveHandler(Controller, method)
            } else if (typeof handler === 'function') {
                this._maintenanceHandler = handler
            } else {
                throw new Error('Routes.maintenance: invalid handler — must be a function or [Controller, "method"]')
            }
        }
    }

    /**
     * Auto-register all methods of a controller as routes.
     *
     * - `index` method → base path (/<basePath>)
     * - Other methods  → kebab-case segment (/<basePath>/<method-path>)
     * - HTTP prefix detection: `post_create` → POST /<basePath>/create
     *
     * Naming rules:
     *   index       → /           (base path)
     *   samplePath  → sample-path
     *   SamplePath  → sample-path
     *   sample_path → sample-path
     *   Samplepath  → samplepath
     *
     * @param {string} basePath
     * @param {Function|Object} Controller
     * @param {Object} [methodMiddlewares]  — optional per-method middleware map:
     *   {
     *     'methodName': MiddlewareClass,
     *     'methodName': [Mw1, Mw2],
     *   }
     */
    static controller(basePath, Controller, methodMiddlewares = {}) {
        const HTTP_PREFIXES = ['post', 'put', 'delete', 'patch', 'options', 'head']

        let methods = []

        // For class controllers, instance methods share a SINGLE instance so the
        // constructor runs once and `this` state is shared across all routes.
        let sharedInstance = null
        const getInstance = () => {
            if (!sharedInstance) sharedInstance = new Controller()
            return sharedInstance
        }

        if (typeof Controller === 'function') {
            const staticMethods = Object.getOwnPropertyNames(Controller).filter(
                n => typeof Controller[n] === 'function' && !['length', 'name', 'prototype'].includes(n)
            )
            const proto = Controller.prototype
            const instanceMethods = proto
                ? Object.getOwnPropertyNames(proto).filter(
                    n => n !== 'constructor' && typeof proto[n] === 'function'
                )
                : []
            methods = [...new Set([...staticMethods, ...instanceMethods])]
        } else if (typeof Controller === 'object' && Controller !== null) {
            methods = Object.getOwnPropertyNames(Controller).filter(
                n => typeof Controller[n] === 'function'
            )
        } else {
            throw new Error('Routes.controller: invalid Controller — must be a class, instance, or plain object')
        }

        // Private/helper methods — any name starting with "_" (e.g. `_method1`) is
        // treated as internal and is NEVER exposed as a route.
        methods = methods.filter(name => !name.startsWith('_'))

        for (const methodName of methods) {
            let httpMethod = 'get'
            let pathSegment = methodName

            const matchedPrefix = HTTP_PREFIXES.find(
                p => methodName.toLowerCase().startsWith(p + '_') || methodName.toLowerCase() === p
            )
            if (matchedPrefix) {
                httpMethod = matchedPrefix
                pathSegment = methodName.slice(matchedPrefix.length).replace(/^_/, '')
            }

            let routePath
            if (pathSegment === '' || pathSegment.toLowerCase() === 'index') {
                routePath = this.normalizePath(basePath)
            } else {
                routePath = this.normalizePath(`${basePath}/${this.nameToPath(pathSegment)}`)
            }

            // Per-method middlewares (optional 3rd argument)
            const specificMws = methodMiddlewares[methodName]
                ? (Array.isArray(methodMiddlewares[methodName])
                    ? methodMiddlewares[methodName]
                    : [methodMiddlewares[methodName]])
                : []

            // Resolve handler — static methods bind to the class, instance methods
            // bind to the single shared instance (see getInstance above).
            let handler
            if (typeof Controller === 'function') {
                if (typeof Controller[methodName] === 'function') {
                    handler = Controller[methodName].bind(Controller)
                } else {
                    const instance = getInstance()
                    handler = instance[methodName].bind(instance)
                }
            } else {
                handler = Controller[methodName].bind(Controller)
            }

            this.routes.push({
                methods: [httpMethod],
                path: routePath,
                handler,
                middlewares: [
                    ...this.globalMiddlewares,
                    ...this.groupMiddlewares,
                    ...specificMws,
                ],
                _resolved: true,
            })
        }
    }

    /**
     * Return info for all registered routes.
     * @returns {Array}
     */
    static allRoutes() {
        return this.routes.map(route => ({
            methods: route.methods,
            path: route.path,
            middlewareCount: route.middlewares.length,
            // Controller-resolved routes (_resolved) and [Controller, 'method'] tuples
            // report 'controller'; only inline function handlers report 'function'.
            handlerType: (typeof route.handler === 'function' && !route._resolved) ? 'function' : 'controller',
        }))
    }

    /**
     * Apply all registered routes to Express.
     *
     *   Routes.apply(app)           — mount directly on app
     *   Routes.apply(app, router)   — mount on router, auto app.use(router)
     *
     * @param {import('express').Application|import('express').Router} appOrRouter
     * @param {import('express').Router} [router]
     */
    static async apply(appOrRouter, router) {
        const target = router || appOrRouter

        // Maintenance mode — intercept all requests before routes
        if (this._maintenanceMode) {
            const maintenanceFn = this._maintenanceHandler
                || (({ res }) => res.status(503).json({
                    status: false,
                    code: 503,
                    message: 'Service Unavailable - Maintenance Mode',
                }))

            target.use((req, res, next) => {
                try {
                    const result = maintenanceFn({ req, res, next, error: null })
                    Promise.resolve(result).catch(next)
                } catch (err) {
                    next(err)
                }
            })

            if (router) appOrRouter.use(router)
            return
        }

        const ALLOWED_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']

        for (const route of this.routes) {
            let handlerFunction

            if (route._resolved) {
                handlerFunction = route.handler
            } else if (typeof route.handler === 'function') {
                handlerFunction = route.handler
            } else if (Array.isArray(route.handler) && route.handler.length === 2) {
                const [Controller, method] = route.handler
                handlerFunction = this.resolveHandler(Controller, method)
            } else {
                throw new Error(`Invalid handler format for route: ${route.path}`)
            }

            if (!handlerFunction) continue

            for (const method of route.methods) {
                if (!ALLOWED_METHODS.includes(method)) {
                    throw new Error(`Invalid HTTP method "${method}" for route: ${route.path}`)
                }

                const normalizedMiddlewares = route.middlewares.map(mw => this.normalizeMiddleware(mw))

                target[method](
                    route.path,
                    ...normalizedMiddlewares,
                    async (req, res, next) => {
                        try {
                            const result = handlerFunction({ req, res, next, error: null })
                            await Promise.resolve(result)
                        } catch (error) {
                            next(error)
                        }
                    }
                )
            }
        }

        // Global error handler
        if (this._errorHandler) {
            const errFn = this._errorHandler
            target.use((error, req, res, next) => {
                try {
                    const result = errFn({ req, res, next, error })
                    Promise.resolve(result).catch(err => next(err))
                } catch (err) {
                    next(err)
                }
            })
        }

        if (router) appOrRouter.use(router)
    }
}

module.exports = Routes
module.exports.default = Routes
