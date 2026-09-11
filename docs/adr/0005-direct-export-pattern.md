# Direct Export Instead of Factory Pattern

`reframeCommon.js` exports `reframe` directly via `module.exports = { reframe }`, deviating from the codebase's `createX` factory convention. The factory pattern exists because services need Prisma, env config, or other dependencies injected. `reframe` has no injected dependencies — it's a pure function over file paths. Adding a factory wrapper with no deps to inject is ceremony without benefit.
