// registerHooks, not register(): the hook is synchronous and in-thread, which is what
// a resolver this small wants, and register() is deprecated on the Node this repo runs.
import { registerHooks } from "node:module";
import { resolve } from "./alias-hooks.mjs";

registerHooks({ resolve });
