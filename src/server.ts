import https from "https";

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { createClient } from '@supabase/supabase-js'

import { env } from "./config/env.js";
import { log } from "./config/logger.js";
import { corsConfig } from "./config/cors.js";
import { ratelimit } from "./config/ratelimit.js";
import { errorHandler, notFoundHandler } from "./config/errorHandler.js";
import type { AniwatchAPIVariables } from "./config/variables.js";

import { hianimeRouter } from "./routes/hianime.js";
import { logging } from "./middleware/logging.js";
import { cacheConfigSetter, cacheControl } from "./middleware/cache.js";

import pkgJson from "../package.json" with { type: "json" };

//
const BASE_PATH = "/api/v2" as const;

const app = new Hono<{ Variables: AniwatchAPIVariables }>();

app.use(logging);
app.use(corsConfig);
app.use(cacheControl);

//
// CAUTION: For personal deployments, "refrain" from having an env
// named "ANIWATCH_API_HOSTNAME". You may face rate limitting
// or other issues if you do.
const ISNT_PERSONAL_DEPLOYMENT = Boolean(env.ANIWATCH_API_HOSTNAME);
if (ISNT_PERSONAL_DEPLOYMENT) {
    app.use(ratelimit);
}

app.use("/", serveStatic({ root: "public" }));
app.get("/health", (c) => c.text("daijoubu", { status: 200 }));
app.get("/v", async (c) =>
    c.text(
        `aniwatch-api: v${"version" in pkgJson && pkgJson?.version ? pkgJson.version : "-1"}\n` +
            `aniwatch-package: v${"dependencies" in pkgJson && pkgJson?.dependencies?.aniwatch ? pkgJson?.dependencies?.aniwatch : "-1"}`
    )
);

app.use(cacheConfigSetter(BASE_PATH.length));

app.basePath(BASE_PATH).route("/hianime", hianimeRouter);
app.basePath(BASE_PATH).route("/quotes", quotesRouter);
app.basePath(BASE_PATH).get("/anicrush", (c) =>
    c.text("Anicrush could be implemented in future.")
);

app.notFound(notFoundHandler);
app.onError(errorHandler);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
)

app.get('/quotes', async (c) => {
  try {
    const { data, error } = await supabase
      .from('kartun')
      .select('*')
      .order('random()')
      .limit(1)
      .single()

    if (error) {
      throw error
    }

    return c.json(data)
  } catch (error) {
    console.error('Error fetching quote:', error)
    return c.json({ error: 'Failed to fetch quote' }, 500)
  }
})

//
// NOTE: this env is "required" for vercel deployments
if (!env.ANIWATCH_API_VERCEL_DEPLOYMENT) {
    serve({
        port: env.ANIWATCH_API_PORT,
        fetch: app.fetch,
    }).addListener("listening", () => {
        log.info(
            `aniwatch-api RUNNING at http://localhost:${env.ANIWATCH_API_PORT}`
        );
    });

    // NOTE: remove the `if` block below for personal deployments
    if (ISNT_PERSONAL_DEPLOYMENT) {
        const interval = 9 * 60 * 1000; // 9mins

        // don't sleep
        setInterval(() => {
            log.info(
                `aniwatch-api HEALTH_CHECK at ${new Date().toISOString()}`
            );
            https
                .get(`https://${env.ANIWATCH_API_HOSTNAME}/health`)
                .on("error", (err) => log.error(err.message.trim()));
        }, interval);
    }
}

export default app;
