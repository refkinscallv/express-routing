const Routes = require('../src/routes')

// Helper function: pick some request properties to include in JSON response
function pickRequestFields(req) {
    return {
        app: req.app,
        baseUrl: req.baseUrl,
        body: req.body,
        cookies: req.cookies,
        fresh: req.fresh,
        hostname: req.hostname,
        ip: req.ip,
        ips: req.ips,
        method: req.method,
        originalUrl: req.originalUrl,
    }
}

// ==================== Sample Middlewares ====================
class Middleware {
    // Middleware that allows all requests (unprotected)
    static unprotected(req, res, next) {
        // Just pass through
        next()
    }

    // Middleware that restricts access based on query parameter 'id'
    static protected(req, res, next) {
        const id = req.query.id

        if (!id || id !== '12345678') {
            return res.status(403).json({
                status: false,
                code: 403,
                message: 'Forbidden',
            })
        }

        next()
    }
}

// ==================== Sample Controllers ====================

// Object literal controller
const ThisObject = {
    index({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with object',
            request: pickRequestFields(req),
        })
    },

    protected({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with object + protected middleware',
            request: pickRequestFields(req),
        })
    },
}

// Instance class controller
class ThisInstanceClass {
    index({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with instance class',
            request: pickRequestFields(req),
        })
    }

    protected({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with instance class + protected middleware',
            request: pickRequestFields(req),
        })
    }
}

// Static class controller
class ThisStaticClass {
    static index({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with static class',
            request: pickRequestFields(req),
        })
    }

    static protected({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with static class + protected middleware',
            request: pickRequestFields(req),
        })
    }
}

// ==================== Routes Registration ====================

// Unprotected routes group with unprotected middleware applied
Routes.middleware([Middleware.unprotected], () => {
    Routes.get('directly', ({ req, res }) => {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with directly function',
            request: pickRequestFields(req),
        })
    })
    Routes.get('object', ThisObject.index)
    Routes.get('instance', [ThisInstanceClass, 'index'])
    Routes.get('static', ThisStaticClass.index)
})

// Protected routes group with protected middleware applied, nested under /protected prefix
Routes.middleware([Middleware.protected], () => {
    Routes.group('protected', () => {
        Routes.get('directly', ({ req, res }) => {
            return res.status(200).json({
                status: true,
                code: 200,
                message: 'Route handler with directly function + protected middleware',
                request: pickRequestFields(req),
            })
        })
        Routes.get('object', ThisObject.protected)
        Routes.get('instance', [ThisInstanceClass, 'protected'])
        Routes.get('static', ThisStaticClass.protected)
    })
})
