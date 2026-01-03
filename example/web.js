const Routes = require('../src/routes');

function pickRequestFields(req) {
    return {
        baseUrl: req.baseUrl,
        body: req.body,
        hostname: req.hostname,
        ip: req.ip,
        method: req.method,
        originalUrl: req.originalUrl,
        params: req.params,
        path: req.path,
        query: req.query
    };
}

class Middleware {
    static unprotected(req, res, next) {
        next();
    }

    static protected(req, res, next) {
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

const ThisObject = {
    index({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with object',
            request: pickRequestFields(req),
        });
    },
    protected({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with object + protected middleware',
            request: pickRequestFields(req),
        });
    },
};

class ThisInstanceClass {
    index({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with instance class',
            request: pickRequestFields(req),
        });
    }

    protected({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with instance class + protected middleware',
            request: pickRequestFields(req),
        });
    }
}

class ThisStaticClass {
    static index({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with static class',
            request: pickRequestFields(req),
        });
    }

    static protected({ req, res }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with static class + protected middleware',
            request: pickRequestFields(req),
        });
    }
}

Routes.middleware([Middleware.unprotected], () => {
    Routes.get('directly', ({ req, res }) => {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with directly function',
            request: pickRequestFields(req),
        });
    });

    Routes.get('object', ThisObject.index);
    Routes.get('instance', [ThisInstanceClass, 'index']);
    Routes.get('static', ThisStaticClass.index);
});

Routes.middleware([Middleware.protected], () => {
    Routes.group('protected', () => {
        Routes.get('directly', ({ req, res }) => {
            return res.status(200).json({
                status: true,
                code: 200,
                message: 'Route handler with directly function + protected middleware',
                request: pickRequestFields(req),
            });
        });

        Routes.get('object', ThisObject.protected);
        Routes.get('instance', [ThisInstanceClass, 'protected']);
        Routes.get('static', ThisStaticClass.protected);
    });
});

Routes.get('routes-info', ({ res }) => {
    const allRoutes = Routes.allRoutes();
    res.json({
        total: allRoutes.length,
        routes: allRoutes
    });
});

module.exports = Routes;
