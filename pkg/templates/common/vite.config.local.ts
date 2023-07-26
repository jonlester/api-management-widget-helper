import { defineConfig, mergeConfig } from "vite";
import { wrapWidget } from "./widget-helper/debug/vite-plugin-widget-loader";
import { WidgetWrapperOptions } from "./widget-helper/debug/widget-wrapper";

const valuesDefault = require("../../src/values");

const baseConfig = require("./vite.config").default();

let developerPortalUrl: string | null = null;

if ("server" in baseConfig && "open" in baseConfig.server) {
  try {
    const url = new URL(baseConfig.server.open);
    developerPortalUrl = `${url.protocol}${url.port}//${url.hostname}`;
  } catch {}
}

const helperConfig = defineConfig({
  plugins: [
    wrapWidget(
      //WidgetWrapperOptions
      {
        developerPortalUrl: developerPortalUrl,
        startPage: "/",
        impersonateUserId: "1",
        portalStyles: true,
      } as WidgetWrapperOptions,
      //any values the widget needs to function or scenarios you want to test
      valuesDefault,
    ),
  ],
  server: {
    port: 3000,
    open: "http://localhost:3000",
  },
});

export default mergeConfig(baseConfig, helperConfig);
