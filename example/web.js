const Routes = require('@refkinscallv/express-routing');

// ─── Controllers ──────────────────────────────────────────────────────────────

class Middleware {
    /** Plain Express-style middleware — passes through as-is */
    static unprotected(req, res, next) {
        next();
    }

    /** Object/class with handle() — new style: auto-applied */
    static handle({ req, res, next }) {
        const id = req.query.id;
        if (!id || id !== '12345678') {
            return res.status(403).json({
                status: false,
                code: 403,
                message: 'Forbidden',
            });
        }
        next();
    }
}

/** Plain object middleware via handle() */
const LogMiddleware = {
    handle({ req, res, next }) {
        console.log(`[LOG] ${req.method} ${req.path}`);
        next();
    }
};

class HomeController {
    static index({ req, res }) {
        res.status(200).json({
            status: true,
            code: 200,
            message: 'Home - index (controller auto-routing)',
        });
    }

    static about({ req, res }) {
        res.status(200).json({
            status: true,
            code: 200,
            message: 'Home - about',
        });
    }

    // post_ prefix → POST /home/create
    static post_create({ req, res }) {
        res.status(201).json({
            status: true,
            code: 201,
            message: 'Home - POST create',
            body: this._method1(req.body),
        });
    }

    // Private helper — name starts with "_", so it is NEVER exposed as a route.
    static _method1(payload) {
        return { received: payload, normalizedAt: new Date().toISOString() };
    }
}

class UserController {
    index({ req, res }) {
        res.status(200).json({
            status: true,
            code: 200,
            message: 'User list (instance controller)',
        });
    }

    // camelCase → kebab-case: myProfile → my-profile
    myProfile({ req, res }) {
        res.status(200).json({
            status: true,
            code: 200,
            message: 'User - my-profile',
        });
    }
}

const ProductController = {
    index({ req, res }) {
        res.status(200).json({
            status: true,
            code: 200,
            message: 'Product list (plain object controller)',
        });
    },
    featuredItems({ req, res }) {
        res.status(200).json({
            status: true,
            code: 200,
            message: 'Product - featured-items',
        });
    },
};

class ErrorController {
    static handle({ req, res, next, error }) {
        console.error('[ErrorController]', error?.message);
        res.status(error?.status || 500).json({
            status: false,
            code: error?.status || 500,
            message: error?.message || 'Internal Server Error',
        });
    }
}

class MaintenanceController {
    static handle({ req, res }) {
        res.status(503).json({
            status: false,
            code: 503,
            message: 'We are under maintenance. Please try again later.',
        });
    }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// 1. Global middleware via handle() — no callback needed for simple cases
Routes.middleware([Middleware], () => {
    Routes.get('unprotected', ({ req, res }) => {
        res.status(200).json({ message: 'Unprotected with handle() middleware' });
    });
});

// 2. Old-style plain function middleware still works
Routes.middleware([Middleware.unprotected], () => {
    Routes.get('plain-middleware', ({ req, res }) => {
        res.status(200).json({ message: 'Plain Express middleware still works' });
    });
});

// 3. Chaining: middleware().group()
Routes.middleware([LogMiddleware])
    .group('log-group', () => {
        Routes.get('hello', ({ req, res }) => {
            res.status(200).json({ message: 'Inside chained middleware group' });
        });
    });

// 4. Nested groups with middleware
Routes.group('api', () => {
    Routes.get('status', ({ res }) => {
        res.status(200).json({ status: 'ok', version: '3.2.0' });
    });

    Routes.group('v1', () => {
        Routes.get('ping', ({ res }) => res.json({ pong: true }));
    }, [LogMiddleware]);
});

// 5. Auto-routing from controller classes / objects
Routes.controller('home', HomeController);          // static class
Routes.controller('users', UserController);         // instance class
Routes.controller('products', ProductController);   // plain object

// 6. Error handler route (route-level throw)
Routes.get('throw-error', ({ req, res }) => {
    throw Object.assign(new Error('Demo route error'), { status: 422 });
});

// 7. Routes info
Routes.get('routes-info', ({ res }) => {
    res.json({ total: Routes.allRoutes().length, routes: Routes.allRoutes() });
});

// ─── v3.2.0 — Laravel-style features ────────────────────────────────────────────

// 8. Named middleware alias + group
Routes.registerMiddleware('auth', Middleware);          // use ?id=12345678 to pass
Routes.middlewareGroup('web', ['auth', LogMiddleware]);

// 9. Named route + URL generation (whereNumber constrains :id to digits)
Routes.get('articles/:id', ({ req, res }) => {
    res.json({ id: req.params.id, self: Routes.url('articles.show', { id: req.params.id }) });
}).name('articles.show').whereNumber('id');

// 10. Resource routes (RESTful, auto-named photos.index/show/store/update/destroy)
const PhotoController = {
    index({ res }) { res.json({ photos: [], link: Routes.url('photos.index') }); },
    show({ req, res }) { res.json({ id: req.params.id }); },
    store({ res }) { res.status(201).json({ created: true }); },
    update({ res }) { res.json({ updated: true }); },
    destroy({ res }) { res.json({ deleted: true }); },
};
Routes.apiResource('photos', PhotoController);

// 11. Redirect + fallback
Routes.redirect('legacy-home', '/home', 301);
Routes.fallback(({ res }) => res.status(404).json({ status: false, code: 404, message: 'Not Found' }));

// 12. Register a global Routes-level error handler
Routes.errorHandler([ErrorController, 'handle']);

module.exports = Routes;
