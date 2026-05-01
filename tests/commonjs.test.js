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
        Routes._errorHandler = null;
        Routes._maintenanceMode = false;
        Routes._maintenanceHandler = null;

        app = express();
        router = express.Router();
        app.use(express.json());
    });

    const setupApp = async () => {
        await Routes.apply(app, router);
    };

    // ─── Basic Routes ──────────────────────────────────────────────────────────

    describe('Basic Routes', () => {
        test('GET route', async () => {
            Routes.get('/test', ({ res }) => res.json({ message: 'success' }));
            await setupApp();
            const res = await request(app).get('/test');
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('success');
        });

        test('POST route', async () => {
            Routes.post('/create', ({ req, res }) => res.json({ data: req.body }));
            await setupApp();
            const res = await request(app).post('/create').send({ name: 'test' });
            expect(res.body.data.name).toBe('test');
        });

        test('PUT route', async () => {
            Routes.put('/update/:id', ({ req, res }) => res.json({ id: req.params.id }));
            await setupApp();
            const res = await request(app).put('/update/123');
            expect(res.body.id).toBe('123');
        });

        test('DELETE route', async () => {
            Routes.delete('/delete/:id', ({ req, res }) => res.json({ deleted: req.params.id }));
            await setupApp();
            const res = await request(app).delete('/delete/456');
            expect(res.body.deleted).toBe('456');
        });

        test('PATCH route', async () => {
            Routes.patch('/patch/:id', ({ res }) => res.json({ patched: true }));
            await setupApp();
            const res = await request(app).patch('/patch/789');
            expect(res.body.patched).toBe(true);
        });

        test('handler context includes error: null', async () => {
            Routes.get('/ctx', ({ res, error }) => res.json({ error }));
            await setupApp();
            const res = await request(app).get('/ctx');
            expect(res.body.error).toBeNull();
        });
    });

    // ─── apply() ──────────────────────────────────────────────────────────────

    describe('apply(app, router)', () => {
        test('auto-mounts router on app', async () => {
            Routes.get('/auto', ({ res }) => res.json({ ok: true }));
            await Routes.apply(app, router);
            expect((await request(app).get('/auto')).body.ok).toBe(true);
        });

        test('works without router (direct mount)', async () => {
            const directApp = express();
            directApp.use(express.json());
            Routes.get('/direct', ({ res }) => res.json({ direct: true }));
            await Routes.apply(directApp);
            expect((await request(directApp).get('/direct')).body.direct).toBe(true);
        });
    });

    // ─── Route Groups ──────────────────────────────────────────────────────────

    describe('Route Groups', () => {
        test('group with prefix', async () => {
            Routes.group('/api', () => {
                Routes.get('/users', ({ res }) => res.json({ route: 'users' }));
            });
            await setupApp();
            expect((await request(app).get('/api/users')).body.route).toBe('users');
        });

        test('nested groups', async () => {
            Routes.group('/api', () => {
                Routes.group('/v1', () => {
                    Routes.get('/data', ({ res }) => res.json({ version: 'v1' }));
                });
            });
            await setupApp();
            expect((await request(app).get('/api/v1/data')).body.version).toBe('v1');
        });
    });

    // ─── Middleware (scoped) ───────────────────────────────────────────────────

    describe('Middleware — scoped (with callback)', () => {
        test('plain function middleware still works', async () => {
            const mw = (req, res, next) => { req.v = 'fn'; next(); };
            Routes.middleware([mw], () => {
                Routes.get('/fn-mw', ({ req, res }) => res.json({ v: req.v }));
            });
            await setupApp();
            expect((await request(app).get('/fn-mw')).body.v).toBe('fn');
        });

        test('handle() class middleware in scoped callback', async () => {
            class HMw {
                static handle({ req, res, next }) { req.h = true; next(); }
            }
            Routes.middleware([HMw], () => {
                Routes.get('/hmw', ({ req, res }) => res.json({ h: req.h }));
            });
            await setupApp();
            expect((await request(app).get('/hmw')).body.h).toBe(true);
        });

        test('plain object with handle()', async () => {
            const ObjMw = { handle({ req, res, next }) { req.o = 'obj'; next(); } };
            Routes.get('/obj-mw', ({ req, res }) => res.json({ o: req.o }), [ObjMw]);
            await setupApp();
            expect((await request(app).get('/obj-mw')).body.o).toBe('obj');
        });

        test('middleware order: global → group → route', async () => {
            const order = [];
            const mw1 = (req, res, next) => { order.push('global'); next(); };
            const mw2 = (req, res, next) => { order.push('group'); next(); };
            const mw3 = (req, res, next) => { order.push('route'); next(); };
            Routes.middleware([mw1], () => {
                Routes.group('/api', () => {
                    Routes.get('/order', ({ res }) => res.json({ order }), [mw3]);
                }, [mw2]);
            });
            await setupApp();
            expect((await request(app).get('/api/order')).body.order)
                .toEqual(['global', 'group', 'route']);
        });
    });

    // ─── Middleware chaining ───────────────────────────────────────────────────

    describe('Middleware — chaining (without callback, strict handle())', () => {
        test('chaining .get()', async () => {
            class Mw { static handle({ req, res, next }) { req.c = 'chained'; next(); } }
            Routes.middleware([Mw]).get('/chain-get', ({ req, res }) => res.json({ c: req.c }));
            await setupApp();
            expect((await request(app).get('/chain-get')).body.c).toBe('chained');
        });

        test('chaining .post()', async () => {
            class Mw { static handle({ req, res, next }) { req.c = true; next(); } }
            Routes.middleware([Mw]).post('/chain-post', ({ req, res }) => res.json({ c: req.c }));
            await setupApp();
            expect((await request(app).post('/chain-post')).body.c).toBe(true);
        });

        test('chaining .put()', async () => {
            class Mw { static handle({ req, res, next }) { req.c = true; next(); } }
            Routes.middleware([Mw]).put('/chain-put/:id', ({ req, res }) => res.json({ c: req.c, id: req.params.id }));
            await setupApp();
            const res = await request(app).put('/chain-put/5');
            expect(res.body.c).toBe(true);
            expect(res.body.id).toBe('5');
        });

        test('chaining .delete()', async () => {
            class Mw { static handle({ req, res, next }) { req.c = true; next(); } }
            Routes.middleware([Mw]).delete('/chain-del/:id', ({ req, res }) => res.json({ c: req.c }));
            await setupApp();
            expect((await request(app).delete('/chain-del/1')).body.c).toBe(true);
        });

        test('chaining .patch()', async () => {
            class Mw { static handle({ req, res, next }) { req.c = true; next(); } }
            Routes.middleware([Mw]).patch('/chain-patch/:id', ({ req, res }) => res.json({ c: req.c }));
            await setupApp();
            expect((await request(app).patch('/chain-patch/1')).body.c).toBe(true);
        });

        test('chaining .group()', async () => {
            class Mw { static handle({ req, res, next }) { req.g = true; next(); } }
            Routes.middleware([Mw]).group('/grp', () => {
                Routes.get('/val', ({ req, res }) => res.json({ g: req.g }));
            });
            await setupApp();
            expect((await request(app).get('/grp/val')).body.g).toBe(true);
        });

        test('chaining .add() multi-method', async () => {
            class Mw { static handle({ req, res, next }) { req.m = true; next(); } }
            Routes.middleware([Mw]).add(['get', 'post'], '/chain-multi', ({ req, res }) => res.json({ m: req.m, method: req.method }));
            await setupApp();
            expect((await request(app).get('/chain-multi')).body.m).toBe(true);
            expect((await request(app).post('/chain-multi')).body.m).toBe(true);
        });

        test('globalMiddlewares restored after chaining', async () => {
            class Mw { static handle({ req, res, next }) { req.c = true; next(); } }
            Routes.middleware([Mw]).get('/chain-restore', ({ res }) => res.json({}));
            // Route registered AFTER chaining should NOT have Mw
            Routes.get('/after-chain', ({ req, res }) => res.json({ c: req.c ?? null }));
            await setupApp();
            const res = await request(app).get('/after-chain');
            expect(res.body.c).toBeNull();
        });

        test('throws when plain function is passed in chaining', () => {
            const fn = (req, res, next) => next();
            expect(() => Routes.middleware([fn])).toThrow(/handle/);
        });

        test('object with handle() works in chaining', async () => {
            const ObjMw = { handle({ req, res, next }) { req.ov = 'object'; next(); } };
            Routes.middleware([ObjMw]).get('/chain-obj', ({ req, res }) => res.json({ v: req.ov }));
            await setupApp();
            expect((await request(app).get('/chain-obj')).body.v).toBe('object');
        });
    });

    // ─── Controllers ([Controller, method] binding) ────────────────────────────

    describe('Controllers — [Controller, method]', () => {
        test('static class method', async () => {
            class C { static index({ res }) { res.json({ t: 'static' }); } }
            Routes.get('/ctrl-s', [C, 'index']);
            await setupApp();
            expect((await request(app).get('/ctrl-s')).body.t).toBe('static');
        });

        test('instance class method', async () => {
            class C { index({ res }) { res.json({ t: 'instance' }); } }
            Routes.get('/ctrl-i', [C, 'index']);
            await setupApp();
            expect((await request(app).get('/ctrl-i')).body.t).toBe('instance');
        });

        test('plain object method', async () => {
            const obj = { list({ res }) { res.json({ t: 'object' }); } };
            Routes.get('/ctrl-o', [obj, 'list']);
            await setupApp();
            expect((await request(app).get('/ctrl-o')).body.t).toBe('object');
        });
    });

    // ─── Routes.controller() auto-routing ─────────────────────────────────────

    describe('Routes.controller() auto-routing', () => {
        test('index → base path', async () => {
            class C { static index({ res }) { res.json({ m: 'index' }); } }
            Routes.controller('base', C);
            await setupApp();
            expect((await request(app).get('/base')).body.m).toBe('index');
        });

        test('camelCase → kebab-case', async () => {
            class C { static myProfile({ res }) { res.json({ m: 'my-profile' }); } }
            Routes.controller('ctrl', C);
            await setupApp();
            expect((await request(app).get('/ctrl/my-profile')).body.m).toBe('my-profile');
        });

        test('PascalCase → kebab-case', async () => {
            class C { static MySettings({ res }) { res.json({ m: 'my-settings' }); } }
            Routes.controller('ctrl2', C);
            await setupApp();
            expect((await request(app).get('/ctrl2/my-settings')).body.m).toBe('my-settings');
        });

        test('snake_case → kebab-case', async () => {
            class C { static my_page({ res }) { res.json({ m: 'my-page' }); } }
            Routes.controller('ctrl3', C);
            await setupApp();
            expect((await request(app).get('/ctrl3/my-page')).body.m).toBe('my-page');
        });

        test('post_create → POST /base/create', async () => {
            class C { static post_create({ res }) { res.status(201).json({ ok: true }); } }
            Routes.controller('items', C);
            await setupApp();
            expect((await request(app).post('/items/create')).status).toBe(201);
        });

        test('instance class controller', async () => {
            class C { index({ res }) { res.json({ t: 'instance' }); } }
            Routes.controller('inst', C);
            await setupApp();
            expect((await request(app).get('/inst')).body.t).toBe('instance');
        });

        test('plain object controller', async () => {
            const obj = { index({ res }) { res.json({ t: 'obj' }); } };
            Routes.controller('objc', obj);
            await setupApp();
            expect((await request(app).get('/objc')).body.t).toBe('obj');
        });

        test('per-method middleware map (single middleware)', async () => {
            class C {
                static index({ res }) { res.json({ ok: true }); }
                static show({ req, res }) { res.json({ auth: req.authed }); }
            }
            class AuthMw { static handle({ req, res, next }) { req.authed = true; next(); } }
            Routes.controller('pmc', C, { 'show': AuthMw });
            await setupApp();
            // index has no AuthMw
            expect((await request(app).get('/pmc')).body.ok).toBe(true);
            // show has AuthMw
            expect((await request(app).get('/pmc/show')).body.auth).toBe(true);
        });

        test('per-method middleware map (array of middleware)', async () => {
            class C {
                static detail({ req, res }) { res.json({ a: req.a, b: req.b }); }
            }
            class MwA { static handle({ req, res, next }) { req.a = 1; next(); } }
            class MwB { static handle({ req, res, next }) { req.b = 2; next(); } }
            Routes.controller('pmc2', C, { 'detail': [MwA, MwB] });
            await setupApp();
            const res = await request(app).get('/pmc2/detail');
            expect(res.body.a).toBe(1);
            expect(res.body.b).toBe(2);
        });
    });

    // ─── Routes.errorHandler() ────────────────────────────────────────────────

    describe('Routes.errorHandler()', () => {
        test('receives { req, res, next, error }', async () => {
            Routes.get('/err', () => { throw new Error('Test error'); });
            Routes.errorHandler(({ res, error }) => {
                res.status(500).json({ caught: error.message });
            });
            await setupApp();
            expect((await request(app).get('/err')).body.caught).toBe('Test error');
        });

        test('[Controller, method] binding', async () => {
            class EC { static handle({ res, error }) { res.status(500).json({ from: 'ctrl', msg: error.message }); } }
            Routes.get('/err-ctrl', () => { throw new Error('Ctrl error'); });
            Routes.errorHandler([EC, 'handle']);
            await setupApp();
            const res = await request(app).get('/err-ctrl');
            expect(res.body.from).toBe('ctrl');
        });
    });

    // ─── Routes.maintenance() ─────────────────────────────────────────────────

    describe('Routes.maintenance()', () => {
        test('default 503', async () => {
            Routes.maintenance(true);
            await setupApp();
            expect((await request(app).get('/any')).status).toBe(503);
        });

        test('custom handler', async () => {
            Routes.maintenance(true, ({ res }) => res.status(503).json({ custom: true }));
            await setupApp();
            expect((await request(app).get('/any')).body.custom).toBe(true);
        });

        test('routes work when off', async () => {
            Routes.maintenance(false);
            Routes.get('/ok', ({ res }) => res.json({ ok: true }));
            await setupApp();
            expect((await request(app).get('/ok')).body.ok).toBe(true);
        });
    });

    // ─── Error handling ───────────────────────────────────────────────────────

    describe('Error Handling', () => {
        test('sync error → next(error)', async () => {
            Routes.get('/sync-err', () => { throw new Error('sync'); });
            await setupApp();
            app.use((err, req, res, next) => res.status(500).json({ e: err.message }));
            expect((await request(app).get('/sync-err')).body.e).toBe('sync');
        });

        test('async error → next(error)', async () => {
            Routes.get('/async-err', async () => {
                await new Promise(r => setTimeout(r, 10));
                throw new Error('async');
            });
            await setupApp();
            app.use((err, req, res, next) => res.status(500).json({ e: err.message }));
            expect((await request(app).get('/async-err')).body.e).toBe('async');
        });

        test('no console.error leaks — errors thrown cleanly', async () => {
            const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
            Routes.get('/no-log', () => { throw new Error('silent'); });
            await setupApp();
            app.use((err, req, res, next) => res.status(500).json({}));
            await request(app).get('/no-log');
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    // ─── Route Inspection ─────────────────────────────────────────────────────

    describe('Route Inspection', () => {
        test('allRoutes() returns info', () => {
            Routes.get('/r1', ({ res }) => res.send('ok'));
            Routes.post('/r2', ({ res }) => res.send('ok'));
            const all = Routes.allRoutes();
            expect(all).toHaveLength(2);
            expect(all[0].methods).toContain('get');
            expect(all[1].methods).toContain('post');
        });

        test('middlewareCount is correct', () => {
            const mw = (req, res, next) => next();
            Routes.get('/mw', ({ res }) => res.send('ok'), [mw, mw]);
            expect(Routes.allRoutes()[0].middlewareCount).toBe(2);
        });
    });

    // ─── Multiple Methods ─────────────────────────────────────────────────────

    describe('Multiple Methods', () => {
        test('add() with [get, post]', async () => {
            Routes.add(['get', 'post'], '/multi', ({ req, res }) => res.json({ m: req.method }));
            await setupApp();
            expect((await request(app).get('/multi')).body.m).toBe('GET');
            expect((await request(app).post('/multi')).body.m).toBe('POST');
        });
    });

    // ─── Path Normalization ───────────────────────────────────────────────────

    describe('Path Normalization', () => {
        test('normalizes duplicate slashes', async () => {
            Routes.get('//api//users//', ({ res }) => res.json({ ok: true }));
            await setupApp();
            expect((await request(app).get('/api/users')).body.ok).toBe(true);
        });
    });

    // ─── nameToPath() ─────────────────────────────────────────────────────────

    describe('nameToPath()', () => {
        test('samplePath → sample-path', () => expect(Routes.nameToPath('samplePath')).toBe('sample-path'));
        test('SamplePath → sample-path', () => expect(Routes.nameToPath('SamplePath')).toBe('sample-path'));
        test('sample_path → sample-path', () => expect(Routes.nameToPath('sample_path')).toBe('sample-path'));
        test('Samplepath → samplepath',   () => expect(Routes.nameToPath('Samplepath')).toBe('samplepath'));
    });
});
