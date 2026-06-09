/**
 * @module express-routing
 * @description Laravel-style routing system for Express.js with support for CommonJS, ESM, and TypeScript
 * @author Refkinscallv
 * @repository https://github.com/refkinscallv/express-routing
 * @version 3.1.0
 * @date 2026
 */

export default class Routes {
    static routes = []
    static prefix = ''
    static groupMiddlewares = []
    static globalMiddlewares = []
    static _errorHandler = null
    static _maintenanceMode = false
    static _maintenanceHandler = null

    static normalizePath(path) {
        return '/' + path.split('/').filter(Boolean).join('/')
    }

    static nameToPath(name) {
        let result = name.replace(/_/g, '-')
        result = result.replace(/([a-z])([A-Z][a-z])/g, '$1-$2')
        return result.toLowerCase()
    }

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
     * callable, or null if the middleware is a plain Express function.
     *   - Class with STATIC handle()    → bound to the class
     *   - Class with INSTANCE handle()  → instantiated once, bound to the instance
     *   - Plain object with handle()     → bound to the object
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

    /** Wrap a resolved handle() function into an Express-compatible middleware. */
    static wrapHandle(handleFn) {
        return (req, res, next) => {
            try {
                const result = handleFn({ req, res, next, error: null })
                Promise.resolve(result).catch(next)
            } catch (err) { next(err) }
        }
    }

    /**
     * Normalize middleware — accepts plain function OR class/object with handle()
     * (static handle, instance handle, or plain object handle).
     */
    static normalizeMiddleware(mw) {
        const handleFn = this.resolveHandle(mw)
        if (handleFn) return this.wrapHandle(handleFn)
        if (typeof mw === 'function') return mw
        throw new Error(`Invalid middleware: must be a function or an object/class with a "handle({ req, res, next, error })" method`)
    }

    /**
     * Strict normalization for chaining — ONLY handle() classes/objects allowed.
     * Plain Express functions are NOT permitted in chaining syntax.
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
     *   Routes.middleware([Mw, fn], () => { Routes.get(...) })
     *
     * CHAINING (without callback) — STRICT: only handle() classes/objects:
     *   Routes.middleware([Mw]).get(path, handler)
     *   Routes.middleware([Mw]).post(path, handler)
     *   Routes.middleware([Mw]).group(prefix, callback)
     *   ... and all other HTTP methods
     *
     * Each chained call is terminal — globalMiddlewares restored after.
     */
    static middleware(middlewares, callback) {
        const prevMiddlewares = this.globalMiddlewares

        if (typeof callback === 'function') {
            const normalized = middlewares.map(mw => this.normalizeMiddleware(mw))
            this.globalMiddlewares = [...prevMiddlewares, ...normalized]
            try {
                callback()
            } finally {
                this.globalMiddlewares = prevMiddlewares
            }
            return this
        }

        // Chaining mode — strict handle() only.
        // Validate eagerly, but DO NOT mutate globalMiddlewares here; the mutation is
        // scoped to each terminal call below so a chain with no terminal call (e.g.
        // `Routes.middleware([Mw])`) can never leak into later routes.
        const normalized = middlewares.map(mw => this.normalizeMiddlewareStrict(mw))

        const self = this
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
     * @param {string} basePath
     * @param {Function|Object} Controller
     * @param {Object} [methodMiddlewares]  — per-method middleware map (optional):
     *   { 'methodName': Mw, 'methodName': [Mw1, Mw2] }
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
     *   Routes.apply(app)           — mount directly on app
     *   Routes.apply(app, router)   — mount on router, auto app.use(router)
     */
    static async apply(appOrRouter, router) {
        const target = router || appOrRouter

        if (this._maintenanceMode) {
            const maintenanceFn = this._maintenanceHandler
                || (({ res }) => res.status(503).json({
                    status: false, code: 503,
                    message: 'Service Unavailable - Maintenance Mode',
                }))
            target.use((req, res, next) => {
                try {
                    const result = maintenanceFn({ req, res, next, error: null })
                    Promise.resolve(result).catch(next)
                } catch (err) { next(err) }
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

        if (this._errorHandler) {
            const errFn = this._errorHandler
            target.use((error, req, res, next) => {
                try {
                    const result = errFn({ req, res, next, error })
                    Promise.resolve(result).catch(err => next(err))
                } catch (err) { next(err) }
            })
        }

        if (router) appOrRouter.use(router)
    }
}

export { Routes }
