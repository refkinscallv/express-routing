/**
 * @module express-routing
 * @description Laravel-style routing system for Express.js with support for CommonJS, ESM, and TypeScript
 * @author Refkinscallv
 * @repository https://github.com/refkinscallv/express-routing
 * @version 3.2.0
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
    static _fallbackHandler = null
    static middlewareAliases = {}
    static middlewareGroups = {}

    /**
     * Register named middleware aliases (Laravel-style).
     *   Routes.registerMiddleware('auth', AuthMiddleware)
     *   Routes.registerMiddleware({ auth: AuthMiddleware, guest: GuestMiddleware })
     */
    static registerMiddleware(name, mw) {
        if (name && typeof name === 'object') {
            for (const key of Object.keys(name)) this.middlewareAliases[key] = name[key]
            return this
        }
        this.middlewareAliases[name] = mw
        return this
    }

    /** Register a named middleware group — a string that expands to several middlewares. */
    static middlewareGroup(name, list) {
        this.middlewareGroups[name] = Array.isArray(list) ? list : [list]
        return this
    }

    /** Expand a middleware list, resolving string entries to their alias/group. */
    static expandMiddleware(list) {
        const out = []
        for (const mw of list) {
            if (typeof mw === 'string') {
                if (Object.prototype.hasOwnProperty.call(this.middlewareGroups, mw)) {
                    out.push(...this.expandMiddleware(this.middlewareGroups[mw]))
                } else if (Object.prototype.hasOwnProperty.call(this.middlewareAliases, mw)) {
                    out.push(this.middlewareAliases[mw])
                } else {
                    throw new Error(`Unknown middleware "${mw}" — register it with Routes.registerMiddleware() or Routes.middlewareGroup()`)
                }
            } else {
                out.push(mw)
            }
        }
        return out
    }

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
        const route = {
            methods: methodArray,
            path: fullPath,
            handler,
            middlewares: [
                ...this.globalMiddlewares,
                ...this.groupMiddlewares,
                ...middlewares,
            ],
            name: null,
            constraints: {},
        }
        this.routes.push(route)
        return this.registration(route)
    }

    /** Chainable registration handle: Routes.get(...).name('users.show').whereNumber('id') */
    static registration(route) {
        const handle = {
            name(routeName) { route.name = routeName; return handle },
            where(param, pattern) {
                if (param && typeof param === 'object') {
                    Object.assign(route.constraints, param)
                } else {
                    route.constraints[param] = pattern
                }
                return handle
            },
            whereNumber(param)       { route.constraints[param] = '[0-9]+';           return handle },
            whereAlpha(param)        { route.constraints[param] = '[A-Za-z]+';        return handle },
            whereAlphaNumeric(param) { route.constraints[param] = '[A-Za-z0-9]+';     return handle },
            whereUuid(param)         { route.constraints[param] = '[0-9a-fA-F-]{36}'; return handle },
        }
        return handle
    }

    static get(path, handler, middlewares = [])     { return this.add('get',     path, handler, middlewares) }
    static post(path, handler, middlewares = [])    { return this.add('post',    path, handler, middlewares) }
    static put(path, handler, middlewares = [])     { return this.add('put',     path, handler, middlewares) }
    static delete(path, handler, middlewares = [])  { return this.add('delete',  path, handler, middlewares) }
    static patch(path, handler, middlewares = [])   { return this.add('patch',   path, handler, middlewares) }
    static options(path, handler, middlewares = []) { return this.add('options', path, handler, middlewares) }
    static head(path, handler, middlewares = [])    { return this.add('head',    path, handler, middlewares) }

    static group(prefix, callback, middlewares = []) {
        const previousPrefix = this.prefix
        const previousMiddlewares = this.groupMiddlewares
        const fullPrefix = [previousPrefix, prefix].filter(Boolean).join('/')
        this.prefix = this.normalizePath(fullPrefix)
        this.groupMiddlewares = [
            ...previousMiddlewares,
            ...this.expandMiddleware(middlewares).map(mw => this.normalizeMiddleware(mw)),
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
            const normalized = this.expandMiddleware(middlewares).map(mw => this.normalizeMiddleware(mw))
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
        const normalized = this.expandMiddleware(middlewares).map(mw => this.normalizeMiddlewareStrict(mw))

        const self = this
        const withChained = (action) => {
            const prev = self.globalMiddlewares
            self.globalMiddlewares = [...prev, ...normalized]
            try {
                return action()
            } finally {
                self.globalMiddlewares = prev
            }
        }

        return {
            group(prefix, groupCallback, groupMiddlewares = []) {
                return withChained(() => self.group(prefix, groupCallback, groupMiddlewares))
            },
            add(methods, path, handler, mws = []) {
                return withChained(() => self.add(methods, path, handler, mws))
            },
            get(path, handler, mws = [])     { return withChained(() => self.add('get',     path, handler, mws)) },
            post(path, handler, mws = [])    { return withChained(() => self.add('post',    path, handler, mws)) },
            put(path, handler, mws = [])     { return withChained(() => self.add('put',     path, handler, mws)) },
            delete(path, handler, mws = [])  { return withChained(() => self.add('delete',  path, handler, mws)) },
            patch(path, handler, mws = [])   { return withChained(() => self.add('patch',   path, handler, mws)) },
            options(path, handler, mws = []) { return withChained(() => self.add('options', path, handler, mws)) },
            head(path, handler, mws = [])    { return withChained(() => self.add('head',    path, handler, mws)) },
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
                name: null,
                constraints: {},
            })
        }
    }

    /**
     * Register the seven RESTful resource routes for a controller (Laravel-style).
     * Only actions that exist on the controller are registered.
     * @param {string} name
     * @param {Function|Object} Controller
     * @param {Object} [options]  { only?, except?, parameter?, api?, middleware? }
     */
    static resource(name, Controller, options = {}) {
        const param = options.parameter || 'id'
        const base = this.normalizePath(`${this.prefix}/${name}`)
        const nameBase = name.split('/').filter(Boolean).join('.')
        const resolve = this.makeMethodResolver(Controller)

        const specMws = options.middleware
            ? (Array.isArray(options.middleware) ? options.middleware : [options.middleware])
            : []

        const definitions = [
            ['index',   ['get'],          base],
            ['create',  ['get'],          `${base}/create`],
            ['store',   ['post'],         base],
            ['show',    ['get'],          `${base}/:${param}`],
            ['edit',    ['get'],          `${base}/:${param}/edit`],
            ['update',  ['put', 'patch'], `${base}/:${param}`],
            ['destroy', ['delete'],       `${base}/:${param}`],
        ]

        let allowed = definitions.map(d => d[0])
        if (options.api) allowed = allowed.filter(a => a !== 'create' && a !== 'edit')
        if (Array.isArray(options.only)) allowed = allowed.filter(a => options.only.includes(a))
        if (Array.isArray(options.except)) allowed = allowed.filter(a => !options.except.includes(a))

        for (const [action, methods, routePath] of definitions) {
            if (!allowed.includes(action)) continue
            const handler = resolve(action)
            if (!handler) continue
            this.routes.push({
                methods,
                path: this.normalizePath(routePath),
                handler,
                middlewares: [
                    ...this.globalMiddlewares,
                    ...this.groupMiddlewares,
                    ...specMws,
                ],
                _resolved: true,
                name: `${nameBase}.${action}`,
                constraints: {},
            })
        }
        return this
    }

    /** API resource — resource() without the HTML-form create/edit routes. */
    static apiResource(name, Controller, options = {}) {
        return this.resource(name, Controller, { ...options, api: true })
    }

    /**
     * Build a resolver binding a controller method to the class (static), a single
     * shared instance (instance method), or the object — null if the method is absent.
     */
    static makeMethodResolver(Controller) {
        let instance = null
        return (methodName) => {
            if (typeof Controller === 'function') {
                if (typeof Controller[methodName] === 'function') {
                    return Controller[methodName].bind(Controller)
                }
                const proto = Controller.prototype
                if (proto && typeof proto[methodName] === 'function') {
                    if (!instance) instance = new Controller()
                    return instance[methodName].bind(instance)
                }
                return null
            }
            if (typeof Controller === 'object' && Controller !== null && typeof Controller[methodName] === 'function') {
                return Controller[methodName].bind(Controller)
            }
            return null
        }
    }

    /** Register a redirect route. Default status 302. */
    static redirect(from, to, status = 302) {
        return this.add('get', from, ({ res }) => res.redirect(status, to))
    }

    /** Register a route that renders a view via the Express view engine (res.render). */
    static view(path, view, data = {}) {
        return this.add('get', path, ({ res }) => res.render(view, data))
    }

    /** Register a fallback handler invoked when no other route matches. */
    static fallback(handler) {
        if (Array.isArray(handler) && handler.length === 2) {
            const [Controller, method] = handler
            this._fallbackHandler = this.resolveHandler(Controller, method)
        } else if (typeof handler === 'function') {
            this._fallbackHandler = handler
        } else {
            throw new Error('Routes.fallback: invalid handler — must be a function or [Controller, "method"]')
        }
        return this
    }

    /**
     * Generate a URL for a named route, substituting `:param` segments and appending
     * extra keys as a query string.
     */
    static url(name, params = {}) {
        const route = this.routes.find(r => r.name === name)
        if (!route) {
            throw new Error(`Route name "${name}" not found`)
        }
        const used = new Set()
        let path = route.path.replace(/:([A-Za-z0-9_]+)(\?)?/g, (match, key, optional) => {
            used.add(key)
            if (params[key] === undefined || params[key] === null) {
                if (optional) return ''
                throw new Error(`Missing parameter "${key}" for route "${name}"`)
            }
            return encodeURIComponent(params[key])
        })
        path = this.normalizePath(path)
        const query = Object.keys(params)
            .filter(key => !used.has(key) && params[key] !== undefined && params[key] !== null)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        return query.length ? `${path}?${query.join('&')}` : path
    }

    /** Alias of Routes.url() — matches Laravel's `route()` helper. */
    static route(name, params = {}) {
        return this.url(name, params)
    }

    static allRoutes() {
        return this.routes.map(route => ({
            methods: route.methods,
            path: route.path,
            name: route.name || null,
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

            // Parameter constraints (Routes...where()) — skip with next('route') on mismatch
            // so a later route can still match.
            const constraintKeys = Object.keys(route.constraints || {})
            const constraintGuard = constraintKeys.length
                ? (req, res, next) => {
                    for (const key of constraintKeys) {
                        const pattern = route.constraints[key]
                        const re = pattern instanceof RegExp ? pattern : new RegExp(`^(?:${pattern})$`)
                        const value = req.params[key] != null ? String(req.params[key]) : ''
                        if (!re.test(value)) return next('route')
                    }
                    next()
                }
                : null

            for (const method of route.methods) {
                if (!ALLOWED_METHODS.includes(method)) {
                    throw new Error(`Invalid HTTP method "${method}" for route: ${route.path}`)
                }

                const normalizedMiddlewares = this.expandMiddleware(route.middlewares).map(mw => this.normalizeMiddleware(mw))
                const chain = constraintGuard ? [constraintGuard, ...normalizedMiddlewares] : normalizedMiddlewares

                target[method](
                    route.path,
                    ...chain,
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

        // Fallback — runs when no route above matched (Laravel-style).
        if (this._fallbackHandler) {
            const fallbackFn = this._fallbackHandler
            target.use((req, res, next) => {
                try {
                    const result = fallbackFn({ req, res, next, error: null })
                    Promise.resolve(result).catch(next)
                } catch (err) { next(err) }
            })
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
