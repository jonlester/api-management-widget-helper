import { ViteDevServer, IndexHtmlTransformResult, HtmlTagDescriptor } from "vite";
import { ValuesCommon, APIM_EDITOR_DATA_KEY } from "@azure/api-management-custom-widgets-tools";
import { WidgetWrapperOptions, defaultOptions } from "./widget-wrapper";
const deployConfig = require("../../deployConfig.json");

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { JSDocNonNullableType } from "typescript";

export function wrapWidget(options: WidgetWrapperOptions, widgetValues: any) {
  const WRAPPER_PLACEHOLDER = "<!--widget-wrapper-->";
  let devServer: ViteDevServer;

  const getWidgetConfig = () => {
    const widgetConfig = require(deployConfig.fallbackConfigPath);
    return widgetConfig;
  };

  //pre-load the dev portal config from node since it isn't configured for CORS
  async function getConfig(portalUrl: string | null): Promise<any> {
    if (portalUrl == null) throw "Local debugging requires a developerPortalUrl in vite.config.local.ts.";

    const url = new URL(portalUrl);
    const protocol = url.protocol;
    const port = url.protocol;
    const hostname = url.hostname;
    return new Promise<any>((resolve, reject) => {
      https
        .get(`${protocol}${port}//${hostname}/config.json`, (resp) => {
          let data = "";

          resp.on("data", (chunk) => {
            data += chunk;
          });

          resp.on("end", () => {
            resolve(JSON.parse(data));
          });
        })
        .on("error", (err) => {
          reject("Error: " + err.message);
        });
    });
  }

  async function getSettings() {
    const widgetConfig = getWidgetConfig();

    const editorData = {
      values: widgetValues,
      instanceId: `${widgetConfig.name}_local`,
      environment: "local",
    };

    const extendedOptions = {
      name: widgetConfig.name,
      instanceId: editorData.instanceId,
      src: `${devServer!.resolvedUrls!.local[0]}?${APIM_EDITOR_DATA_KEY}=${encodeURIComponent(
        JSON.stringify(editorData),
      )}`,
    };

    const portalConfig = await getConfig(options.developerPortalUrl);

    return {
      options: {
        ...defaultOptions,
        ...options,
        ...extendedOptions,
      },
      secrets: portalConfig,
    };
  }

  return {
    name: "wrap-widget",
    async configureServer(server: ViteDevServer) {
      devServer = server;

      //inspect the request to see if it should be wrapped
      server.middlewares.use(async (req, res, next) => {
        if (req.headers["sec-fetch-dest"] == "document" && req.url != undefined) {
          res.end(await devServer.transformIndexHtml(req.url, WRAPPER_PLACEHOLDER, req.originalUrl));
        } else next();
      });
    },
    transformIndexHtml: {
      order: "pre",
      async transform(html: string, ctx: any) {
        //transform for 'serve' but not build
        if (ctx.server && html.endsWith(WRAPPER_PLACEHOLDER)) {
          let settings = await getSettings();

          const template = fs.readFileSync(path.resolve("./sdk/dev/widget-page.html"), "utf-8");

          let transform = {
            html: template,
            tags: [] as HtmlTagDescriptor[],
          };
          //inject css ref if requested
          if (settings.options.portalStyles) {
            transform.tags.push({
              tag: "link",
              attrs: {
                rel: "stylesheet",
                type: "text/css",
                href: new URL("/styles/theme.css", settings.options.developerPortalUrl as string).toString(),
              },
              injectTo: "head",
            });
          }
          //inject settings global variable
          transform.tags.push({
            tag: "script",
            injectTo: "body-prepend",
            children: `settings = ${JSON.stringify(settings)}`,
          });

          return transform;
        }
        return html;
      },
    },
  };
}
