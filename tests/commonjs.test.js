const request = require('supertest');
const express = require('express');
const Routes = require('../src/routes');

describe('Express Routing - CommonJS', () => {
    let app;
    let router;

    beforeEach(() => {
        Routes.routes = [];
        Routes.prefix = '';
        Routes.groupMiddlewares = [];
        Routes.globalMiddlewares = [];

        app = express();
        router = express.Router();
        app.use(express.json());
    });

    // Helper function to apply routes and set up the app
    const setupApp = async () => {
        await Routes.apply(router);
        app.use(router);
    };

    describe('Basic Routes', () => {
        test('should register and handle GET route', async () => {
            Routes.get('/test', ({ res }) => {
                res.json({ message: 'success' });
            });

            await setupApp(); // Apply routes before making requests

            const response = await request(app).get('/test');
            expect(response.status).toBe(200);
            expect(response.body.message).toBe('success');
        });

        test('should register and handle POST route', async () => {
            Routes.post('/create', ({ req, res }) => {
                res.json({ data: req.body });
            });

            await setupApp();

            const response = await request(app)
                .post('/create')
                .send({ name: 'test' });
            
            expect(response.status).toBe(200);
            expect(response.body.data.name).toBe('test');
        });

        test('should handle PUT route', async () => {
            Routes.put('/update/:id', ({ req, res }) => {
                res.json({ id: req.params.id, updated: true });
            });

            await setupApp();

            const response = await request(app).put('/update/123');
            expect(response.body.id).toBe('123');
            expect(response.body.updated).toBe(true);
        });

        test('should handle DELETE route', async () => {
            Routes.delete('/delete/:id', ({ req, res }) => {
                res.json({ deleted: req.params.id });
            });

            await setupApp();

            const response = await request(app).delete('/delete/456');
            expect(response.body.deleted).toBe('456');
        });

        test('should handle PATCH route', async () => {
            Routes.patch('/patch/:id', ({ res }) => {
                res.json({ patched: true });
            });

            await setupApp();

            const response = await request(app).patch('/patch/789');
            expect(response.body.patched).toBe(true);
        });
    });

    describe('Route Groups', () => {
        test('should handle route groups with prefix', async () => {
            Routes.group('/api', () => {
                Routes.get('/users', ({ res }) => {
                    res.json({ route: 'users' });
                });
            });

            await setupApp();

            const response = await request(app).get('/api/users');
            expect(response.status).toBe(200);
            expect(response.body.route).toBe('users');
        });

        test('should handle nested route groups', async () => {
            Routes.group('/api', () => {
                Routes.group('/v1', () => {
                    Routes.get('/data', ({ res }) => {
                        res.json({ version: 'v1' });
                    });
                });
            });

            await setupApp();

            const response = await request(app).get('/api/v1/data');
            expect(response.body.version).toBe('v1');
        });
    });

    describe('Middleware', () => {
        test('should apply route middleware', async () => {
            const middleware = (req, res, next) => {
                req.customValue = 'middleware-applied';
                next();
            };

            Routes.get('/middleware-test', ({ req, res }) => {
                res.json({ value: req.customValue });
            }, [middleware]);

            await setupApp();

            const response = await request(app).get('/middleware-test');
            expect(response.body.value).toBe('middleware-applied');
        });

        test('should apply group middleware', async () => {
            const groupMw = (req, res, next) => {
                req.groupMw = true;
                next();
            };

            Routes.group('/secured', () => {
                Routes.get('/data', ({ req, res }) => {
                    res.json({ secured: req.groupMw });
                });
            }, [groupMw]);

            await setupApp();

            const response = await request(app).get('/secured/data');
            expect(response.body.secured).toBe(true);
        });

        test('should apply global middleware', async () => {
            const globalMw = (req, res, next) => {
                req.global = 'yes';
                next();
            };

            Routes.middleware([globalMw], () => {
                Routes.get('/global-test', ({ req, res }) => {
                    res.json({ global: req.global });
                });
            });

            await setupApp();

            const response = await request(app).get('/global-test');
            expect(response.body.global).toBe('yes');
        });

        test('should execute middlewares in correct order', async () => {
            const order = [];

            const mw1 = (req, res, next) => {
                order.push('global');
                next();
            };

            const mw2 = (req, res, next) => {
                order.push('group');
                next();
            };

            const mw3 = (req, res, next) => {
                order.push('route');
                next();
            };

            Routes.middleware([mw1], () => {
                Routes.group('/api', () => {
                    Routes.get('/order', ({ res }) => {
                        res.json({ order });
                    }, [mw3]);
                }, [mw2]);
            });

            await setupApp();

            const response = await request(app).get('/api/order');
            expect(response.body.order).toEqual(['global', 'group', 'route']);
        });
    });

    describe('Controllers', () => {
        test('should bind static controller methods', async () => {
            class TestController {
                static index({ res }) {
                    res.json({ controller: 'static' });
                }
            }

            Routes.get('/controller', [TestController, 'index']);

            await setupApp();

            const response = await request(app).get('/controller');
            expect(response.body.controller).toBe('static');
        });

        test('should bind instance controller methods', async () => {
            class InstanceController {
                index({ res }) {
                    res.json({ type: 'instance' });
                }
            }

            Routes.get('/instance', [InstanceController, 'index']);

            await setupApp();

            const response = await request(app).get('/instance');
            expect(response.body.type).toBe('instance');
        });
    });

    describe('Error Handling', () => {
        test('should pass errors to Express error handler', async () => {
            Routes.get('/error', () => {
                throw new Error('Test error');
            });

            await setupApp();

            app.use((err, req, res, next) => {
                res.status(500).json({ error: err.message });
            });

            const response = await request(app).get('/error');
            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Test error');
        });

        test('should handle async errors', async () => {
            Routes.get('/async-error', async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                throw new Error('Async error');
            });

            await setupApp();

            app.use((err, req, res, next) => {
                res.status(500).json({ error: err.message });
            });

            const response = await request(app).get('/async-error');
            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Async error');
        });
    });

    describe('Route Inspection', () => {
        test('should return all routes info', async () => {
            Routes.get('/route1', ({ res }) => res.send('ok'));
            Routes.post('/route2', ({ res }) => res.send('ok'));

            const allRoutes = Routes.allRoutes();
            expect(allRoutes).toHaveLength(2);
            expect(allRoutes[0].methods).toContain('get');
            expect(allRoutes[0].path).toBe('/route1');
            expect(allRoutes[1].methods).toContain('post');
            expect(allRoutes[1].path).toBe('/route2');
        });

        test('should include middleware count', async () => {
            const mw1 = (req, res, next) => next();
            const mw2 = (req, res, next) => next();

            Routes.get('/with-mw', ({ res }) => res.send('ok'), [mw1, mw2]);

            const routes = Routes.allRoutes();
            expect(routes[0].middlewareCount).toBe(2);
        });
    });

    describe('Multiple Methods', () => {
        test('should handle multiple HTTP methods on same route', async () => {
            Routes.add(['get', 'post'], '/multi', ({ req, res }) => {
                res.json({ method: req.method });
            });

            await setupApp();

            const getResponse = await request(app).get('/multi');
            expect(getResponse.body.method).toBe('GET');

            const postResponse = await request(app).post('/multi');
            expect(postResponse.body.method).toBe('POST');
        });
    });

    describe('Path Normalization', () => {
        test('should normalize paths correctly', async () => {
            Routes.get('//api//users//', ({ res }) => {
                res.json({ normalized: true });
            });

            await setupApp();

            const response = await request(app).get('/api/users');
            expect(response.body.normalized).toBe(true);
        });
    });
});
