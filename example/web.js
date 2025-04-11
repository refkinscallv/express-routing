/**
 * PACKAGES
 */
const Routes = require('../src/routes')

/** ======================================================================== */
/**
 * ROUTE HANDLERS
 */

/**
 * Handler using a class
 * Used with [ClassName, 'methodName'] as a callable descriptor
 */
class Sample1Class {
    static index({ res }) {
        res.status(200).json({
            status: true,
            code: 200,
            message: 'Success: Sample1Class',
            result: {},
        })
    }
}

/**
 * Handler using an object
 * Can be called directly via its method reference
 */
const Sample2Object = {
    index: ({ res }) => {
        res.status(200).json({
            status: true,
            code: 200,
            message: 'Success: Sample2Object',
            result: {},
        })
    },
}

/** ======================================================================== */
/**
 * MIDDLEWARES
 */

/**
 * Auth middleware to simulate token check
 * Add header `Authorization: Bearer mysecrettoken` to pass
 */
const authMiddleware = (req, res, next) => {
    const token = req.headers['authorization']

    if (!token || token !== 'Bearer mysecrettoken') {
        return res.status(401).json({
            status: false,
            code: 401,
            message: 'Unauthorized: Invalid or missing token',
        })
    }

    // Attach dummy user to request
    req.user = { id: 1, name: 'John Doe' }
    next()
}

/** ======================================================================== */
/**
 * DEFINE ROUTES
 */

// Direct callback handler (anonymous function)
Routes.get('/', ({ res }) => {
    res.send('Hello World!')
})

// Using class method directly
Routes.get('/sample1.0', Sample1Class.index)

// Using class method as callable descriptor
Routes.get('/sample1.1', [Sample1Class, 'index'])

// Using object method directly
Routes.get('/sample2.0', Sample2Object.index)

// Using object method as callable descriptor
Routes.get('/sample2.1', [Sample2Object, 'index'])

// Protected route using middleware
Routes.get('/sample-middleware', [Sample1Class, 'index'], [authMiddleware])

/** ======================================================================== */
/**
 * GROUP ROUTES
 */

// Group without middleware
Routes.group('/group', () => {
    Routes.get('/sample1.0', Sample1Class.index)
    Routes.get('/sample1.1', [Sample1Class, 'index'])
    Routes.get('/sample2.0', Sample2Object.index)
    Routes.get('/sample2.1', [Sample2Object, 'index'])
    Routes.get('/sample-middleware', [Sample1Class, 'index'], [authMiddleware])
})

// Group with middleware applied to all nested routes
Routes.group('/secure-group', () => {
    Routes.get('/sample1.0', Sample1Class.index)
    Routes.get('/sample1.1', [Sample1Class, 'index'])
    Routes.get('/sample2.0', Sample2Object.index)
    Routes.get('/sample2.1', [Sample2Object, 'index'])
    Routes.get('/sample-middleware', [Sample1Class, 'index'])
}, [authMiddleware])

// Nested group
Routes.group('/nested', () => {
    Routes.group('/sample1', () => {
        Routes.get('/sample1.0', Sample1Class.index)
        Routes.get('/sample1.1', [Sample1Class, 'index'])
    })

    Routes.group('/sample2', () => {
        Routes.get('/sample2.0', Sample2Object.index)
        Routes.get('/sample2.1', [Sample2Object, 'index'])
    })
})