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
        Routes._fallbackHandler = null;
        Routes.middlewareAliases = {};
        Routes.middlewareGroups = {};

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

    // ─── v3.2.0 — Laravel-style features ───────────────────────────────────────

    describe('Named routes & url()', () => {
        test('name() + url() substitutes params', () => {
            Routes.get('/users/:id', ({ res }) => res.end()).name('users.show');
            expect(Routes.url('users.show', { id: 5 })).toBe('/users/5');
        });

        test('route() is an alias of url() and appends extras as query string', () => {
            Routes.get('/users', ({ res }) => res.end()).name('users.index');
            expect(Routes.route('users.index', { page: 2, q: 'a b' })).toBe('/users?page=2&q=a%20b');
        });

        test('url() throws for unknown name and for a missing required param', () => {
            Routes.get('/p/:id', ({ res }) => res.end()).name('p.show');
            expect(() => Routes.url('nope')).toThrow(/not found/);
            expect(() => Routes.url('p.show', {})).toThrow(/Missing parameter/);
        });

        test('allRoutes() includes the route name', () => {
            Routes.get('/x', ({ res }) => res.end()).name('x.home');
            expect(Routes.allRoutes()[0].name).toBe('x.home');
        });
    });

    describe('Parameter constraints — where()', () => {
        test('whereNumber() falls through to a later matching route', async () => {
            Routes.get('/item/:id', ({ res }) => res.json({ type: 'num' })).whereNumber('id');
            Routes.get('/item/:slug', ({ res }) => res.json({ type: 'slug' }));
            await setupApp();
            expect((await request(app).get('/item/42')).body.type).toBe('num');
            expect((await request(app).get('/item/abc')).body.type).toBe('slug');
        });

        test('where() with a custom pattern 404s when nothing else matches', async () => {
            Routes.get('/code/:c', ({ res }) => res.json({ ok: true })).where('c', '[A-Z]{3}');
            await setupApp();
            expect((await request(app).get('/code/ABC')).status).toBe(200);
            expect((await request(app).get('/code/ab')).status).toBe(404);
        });
    });

    describe('resource() / apiResource()', () => {
        class PhotoController {
            static index({ res }) { res.json({ a: 'index' }); }
            static store({ res }) { res.status(201).json({ a: 'store' }); }
            static show({ req, res }) { res.json({ a: 'show', id: req.params.id }); }
            static update({ res }) { res.json({ a: 'update' }); }
            static destroy({ res }) { res.json({ a: 'destroy' }); }
        }

        test('registers RESTful routes with conventional verbs, paths and names', async () => {
            Routes.resource('photos', PhotoController);
            const info = Routes.allRoutes();
            expect(info.map(r => `${r.methods.join('|')} ${r.path}`)).toEqual([
                'get /photos',
                'post /photos',
                'get /photos/:id',
                'put|patch /photos/:id',
                'delete /photos/:id',
            ]);
            expect(info.map(r => r.name)).toEqual([
                'photos.index', 'photos.store', 'photos.show', 'photos.update', 'photos.destroy',
            ]);

            await setupApp();
            expect((await request(app).get('/photos')).body.a).toBe('index');
            expect((await request(app).post('/photos')).status).toBe(201);
            expect((await request(app).patch('/photos/9')).body.a).toBe('update'); // PUT and PATCH
            expect((await request(app).put('/photos/9')).body.a).toBe('update');
            expect((await request(app).delete('/photos/9')).body.a).toBe('destroy');
            expect(Routes.url('photos.show', { id: 7 })).toBe('/photos/7');
        });

        test('only / except / parameter options', () => {
            Routes.resource('books', PhotoController, { only: ['index', 'show'], parameter: 'book' });
            expect(Routes.allRoutes().map(r => r.path)).toEqual(['/books', '/books/:book']);
        });

        test('apiResource() omits create and edit', () => {
            const C = {
                index({ res }) { res.end(); },
                create({ res }) { res.end(); },
                edit({ res }) { res.end(); },
                show({ res }) { res.end(); },
            };
            Routes.apiResource('api/posts', C);
            expect(Routes.allRoutes().map(r => r.path)).toEqual(['/api/posts', '/api/posts/:id']);
        });
    });

    describe('Named middleware aliases & groups', () => {
        test('registerMiddleware() alias usable by string', async () => {
            const calls = [];
            class AuthMw { static handle({ next }) { calls.push('auth'); next(); } }
            Routes.registerMiddleware('auth', AuthMw);
            Routes.middleware(['auth']).get('/dash', ({ res }) => res.json({ ok: true }));
            await setupApp();
            await request(app).get('/dash');
            expect(calls).toEqual(['auth']);
        });

        test('middlewareGroup() expands to several middlewares (and nested aliases)', async () => {
            const calls = [];
            class AuthMw { static handle({ next }) { calls.push('auth'); next(); } }
            class LogMw { static handle({ next }) { calls.push('log'); next(); } }
            Routes.registerMiddleware('auth', AuthMw);
            Routes.middlewareGroup('web', ['auth', LogMw]);
            Routes.middleware(['web'], () => {
                Routes.get('/home', ({ res }) => res.json({ ok: true }));
            });
            await setupApp();
            await request(app).get('/home');
            expect(calls).toEqual(['auth', 'log']);
        });

        test('unknown alias throws', () => {
            expect(() => Routes.middleware(['ghost'], () => {})).toThrow(/Unknown middleware/);
        });
    });

    describe('redirect() / view() / fallback()', () => {
        test('redirect() issues the given status and Location', async () => {
            Routes.redirect('/old', '/new', 301);
            await setupApp();
            const res = await request(app).get('/old');
            expect(res.status).toBe(301);
            expect(res.headers.location).toBe('/new');
        });

        test('fallback() handles unmatched routes', async () => {
            Routes.get('/exists', ({ res }) => res.json({ ok: true }));
            Routes.fallback(({ res }) => res.status(404).json({ fallback: true }));
            await setupApp();
            expect((await request(app).get('/exists')).body.ok).toBe(true);
            const miss = await request(app).get('/does-not-exist');
            expect(miss.status).toBe(404);
            expect(miss.body.fallback).toBe(true);
        });
    });

    // ─── Regression: state isolation & instance reuse ──────────────────────────

    describe('Regression', () => {
        test('group() restores prefix even if the callback throws', () => {
            expect(() => {
                Routes.group('/api', () => { throw new Error('boom'); });
            }).toThrow('boom');
            // prefix must be restored so the next route is NOT nested under /api
            Routes.get('/after', ({ res }) => res.end());
            expect(Routes.routes[0].path).toBe('/after');
            expect(Routes.prefix).toBe('');
        });

        test('scoped middleware() restores globals even if the callback throws', () => {
            class Mw { static handle({ next }) { next(); } }
            expect(() => {
                Routes.middleware([Mw], () => { throw new Error('boom'); });
            }).toThrow('boom');
            Routes.get('/plain', ({ res }) => res.end());
            expect(Routes.routes[0].middlewares).toHaveLength(0);
            expect(Routes.globalMiddlewares).toHaveLength(0);
        });

        test('chaining middleware() with no terminal call does not leak globals', () => {
            class Mw { static handle({ next }) { next(); } }
            // No .get()/.group() after — must NOT mutate global middleware
            Routes.middleware([Mw]);
            Routes.get('/unrelated', ({ res }) => res.end());
            expect(Routes.globalMiddlewares).toHaveLength(0);
            expect(Routes.routes[0].middlewares).toHaveLength(0);
        });

        test('chaining middleware().get() applies middleware only to that route', async () => {
            const calls = [];
            class Mw { static handle({ next }) { calls.push('mw'); next(); } }
            Routes.middleware([Mw]).get('/guarded', ({ res }) => res.json({ ok: true }));
            Routes.get('/open', ({ res }) => res.json({ ok: true }));
            await setupApp();
            await request(app).get('/guarded');
            await request(app).get('/open');
            expect(calls).toEqual(['mw']); // ran once, only for /guarded
        });

        test('instance controller shares a single instance across methods', async () => {
            const ctorCalls = { n: 0 };
            class CounterController {
                constructor() { ctorCalls.n++; this.hits = 0; }
                first({ res }) { this.hits++; res.json({ hits: this.hits }); }
                second({ res }) { this.hits++; res.json({ hits: this.hits }); }
            }
            Routes.controller('counter', CounterController);
            await setupApp();
            expect(ctorCalls.n).toBe(1); // constructed once, not once-per-method
            await request(app).get('/counter/first');
            const res = await request(app).get('/counter/second');
            expect(res.body.hits).toBe(2); // shared `this.hits` across routes
        });

        test('class middleware with an INSTANCE handle() is supported (scoped)', async () => {
            const calls = [];
            class LogMiddleware {
                handle({ next }) { calls.push('log'); next(); }   // instance method, not static
            }
            Routes.middleware([LogMiddleware], () => {
                Routes.get('/logged', ({ res }) => res.json({ ok: true }));
            });
            await setupApp();
            const res = await request(app).get('/logged');
            expect(res.status).toBe(200);   // must NOT 500 "cannot be invoked without 'new'"
            expect(calls).toEqual(['log']);
        });

        test('class middleware with an INSTANCE handle() is supported (chaining)', async () => {
            const calls = [];
            class AuthMiddleware {
                handle({ res, next }) {
                    calls.push('auth');
                    if (calls.length > 99) return res.status(401).end();
                    next();
                }
            }
            Routes.middleware([AuthMiddleware]).get('/secured', ({ res }) => res.json({ ok: true }));
            await setupApp();
            const res = await request(app).get('/secured');
            expect(res.status).toBe(200);
            expect(calls).toEqual(['auth']);
        });

        test('controller() ignores private "_"-prefixed methods', async () => {
            class UserController {
                static index({ res }) { res.json({ users: [] }); }       // GET /users
                static profile({ res }) { res.json({ ok: true }); }      // GET /users/profile
                static _helper() { return 'internal'; }                  // ignored
                _build() { return 42; }                                  // ignored
            }
            Routes.controller('users', UserController);
            const paths = Routes.allRoutes().map(r => r.path);
            expect(paths).toEqual(['/users', '/users/profile']);
            expect(paths).not.toContain('/users/helper');
            expect(paths).not.toContain('/users/build');

            await setupApp();
            // private methods are not reachable
            expect((await request(app).get('/users/helper')).status).toBe(404);
            expect((await request(app).get('/users/profile')).status).toBe(200);
        });

        test('controller() ignores "_"-prefixed keys on plain-object controllers', () => {
            const ApiController = {
                index({ res }) { res.end(); },
                _secret() { return 'nope'; },
            };
            Routes.controller('api', ApiController);
            expect(Routes.allRoutes().map(r => r.path)).toEqual(['/api']);
        });

        test('allRoutes() reports controller routes as "controller"', () => {
            class C { static index({ res }) { res.end(); } }
            Routes.controller('c', C);
            Routes.get('/fn', ({ res }) => res.end());
            Routes.get('/tuple', [C, 'index']);
            expect(Routes.allRoutes().map(r => r.handlerType)).toEqual([
                'controller', 'function', 'controller',
            ]);
        });
    });
});
