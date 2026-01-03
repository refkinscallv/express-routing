# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2025-01-03

### Added
- Full ESM (ES Module) support with dedicated `.mjs` file
- Complete TypeScript definitions with full type safety
- `allRoutes()` method to inspect all registered routes with metadata
- Comprehensive test suites for CommonJS, ESM, and TypeScript environments
- Cross-platform test scripts with Windows support
- Build validation and type checking scripts
- Detailed API documentation (API.md)
- Complete testing guide (TESTING.md)
- Jest configuration for all module formats
- This changelog

### Changed
- **BREAKING**: Upgraded to Express 5.x (minimum version 5.1.0)
- **BREAKING**: Minimum Node.js version now 22.0.0
- All errors now properly thrown to Express error handling middleware
- Improved error messages with better context and stack traces
- Enhanced JSDoc comments throughout source code
- Updated README with examples for all module formats
- Package.json now includes proper module exports configuration
- Test infrastructure completely rewritten for better reliability

### Fixed
- Error handling now correctly delegates to Express instead of console.error
- Controller instantiation errors properly propagated
- Invalid HTTP method errors properly thrown
- Route application timing issues in tests
- Windows compatibility for test scripts
- TypeScript module resolution in Jest

### Documentation
- Complete API reference documentation with examples
- Testing guide covering CommonJS, ESM, and TypeScript
- Updated README with migration guide
- Added best practices and usage patterns
- Improved JSDoc comments for better IDE support

### Development
- Added `cross-env` for cross-platform environment variables
- Integrated `ts-jest` for TypeScript testing
- Improved build scripts with type generation
- Added pre-publish validation

## [1.2.1] - 2024-12-15

### Added
- Basic ESM support (experimental)
- TypeScript type definitions
- Route inspection capability

### Changed
- Error handling improvements
- Documentation updates

### Fixed
- Controller binding issues
- Path normalization edge cases

## [1.1.1] - 2024-12-10

### Fixed
- Controller binding for instance methods
- Path normalization edge cases with trailing slashes

### Changed
- Improved error logging messages
- Better handling of undefined middleware arrays

## [1.1.0] - 2024-12-01

### Added
- Support for multiple HTTP methods in single route via `add()` method
- Instance class controller support
- Enhanced middleware stacking

### Changed
- Improved controller method binding logic
- Better error messages for invalid handlers

### Fixed
- Middleware execution order in nested groups
- Path normalization with empty prefix

## [1.0.5] - 2024-11-15

### Fixed
- Group middleware not properly applied to nested routes
- Route path normalization with double slashes

### Changed
- Optimized route registration performance

## [1.0.0] - 2024-11-01

### Added
- Initial release
- Laravel-style routing for Express.js
- Support for GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD methods
- Route grouping with prefix
- Middleware support (global, group, and route-level)
- Controller binding (static and instance methods)
- HttpContext style handlers
- Path normalization
- Express-compatible error handling

### Features
- Clean route definitions
- Middleware stacking
- Controller-method pair support
- Auto-binding of controller methods
- Fully Express-compatible

## Notes

### Breaking Changes in 2.0.1

#### Express Version
- **Old**: Express 4.x
- **New**: Express 5.x (minimum 5.1.0)

Express 5 includes several breaking changes. Most notably:
- `res.json()` and `res.send()` now work asynchronously
- Error handling is more strict
- Some deprecated methods removed

**Migration**: Update your Express installation:
```bash
npm install express@^5.1.0
```

#### Node.js Version
- **Old**: Node.js 14.x or higher
- **New**: Node.js 22.0.0 or higher

**Migration**: Upgrade your Node.js version to 22 or higher.

#### No Other Breaking Changes
All routing APIs remain backward compatible. Your existing route definitions will work without modification.

### Deprecations

None at this time.

### Security

No known security issues. Please report any security vulnerabilities to refkinscallv@gmail.com.

## Migration Guide

### From 1.x to 2.0.1

#### 1. Update Dependencies

```bash
npm install @refkinscallv/express-routing@latest express@^5.1.0
```

#### 2. Update Node.js

Ensure you're running Node.js 22.0.0 or higher:

```bash
node --version  # Should be v22.0.0 or higher
```

#### 3. Review Express 5 Changes

Check the [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html) for any Express-specific changes that might affect your application.

#### 4. No Route Code Changes Needed

Your existing route definitions work without modification:

```javascript
// This still works exactly the same
Routes.get('/users', ({ res }) => {
    res.json({ users: [] });
});

Routes.group('/api', () => {
    Routes.post('/data', handler);
});
```

### Module Format Examples

#### CommonJS (Default)

```javascript
const Routes = require('@refkinscallv/express-routing');

Routes.get('/test', ({ res }) => {
    res.json({ message: 'CommonJS works!' });
});
```

#### ESM

```javascript
import Routes from '@refkinscallv/express-routing';

Routes.get('/test', ({ res }) => {
    res.json({ message: 'ESM works!' });
});
```

#### TypeScript

```typescript
import Routes from '@refkinscallv/express-routing';
import type { HttpContext } from '@refkinscallv/express-routing';

Routes.get('/test', ({ res }: HttpContext) => {
    res.json({ message: 'TypeScript works!' });
});
```

### New Features in 2.0.1

#### Route Inspection

```javascript
Routes.get('/users', handler);
Routes.post('/users', handler);

const routes = Routes.allRoutes();
console.log(routes);
// [
//   {
//     methods: ['get'],
//     path: '/users',
//     middlewareCount: 0,
//     handlerType: 'function'
//   },
//   {
//     methods: ['post'],
//     path: '/users',
//     middlewareCount: 0,
//     handlerType: 'function'
//   }
// ]
```

## Roadmap

### Planned for 2.1.0
- Route naming with `name()` method
- URL generation from named routes
- Route parameter constraints (regex patterns)
- Resource routing helpers (`Routes.resource()`)
- Route prefixes for API versioning

### Planned for 2.2.0
- Route caching for production performance
- Route middleware groups (named middleware sets)
- Rate limiting integration
- CORS helper methods

### Planned for 3.0.0
- Plugin system for extensibility
- Advanced middleware features
- Route documentation auto-generation
- OpenAPI/Swagger integration
- Performance monitoring hooks

## Support

For questions, issues, or feature requests:
- **GitHub Issues**: https://github.com/refkinscallv/express-routing/issues
- **Email**: refkinscallv@gmail.com
- **Documentation**: See API.md and TESTING.md

## Contributors

- **Refkinscallv** - Creator and maintainer

## License

MIT License - see LICENSE file for details

---

## Version History Summary

| Version | Release Date | Major Changes |
|---------|--------------|---------------|
| 2.0.1   | 2025-01-03  | Express 5, Node 22, Full ESM/TS support |
| 1.2.1   | 2024-12-15  | Basic ESM, TypeScript definitions |
| 1.1.1   | 2024-12-10  | Controller fixes |
| 1.1.0   | 2024-12-01  | Multiple methods, instance controllers |
| 1.0.5   | 2024-11-15  | Group middleware fixes |
| 1.0.0   | 2024-11-01  | Initial release |
