import { defineConfig, mergeConfig } from "vite";
import { wrapWidget } from "./widget-helper/debug/vite-plugin-widget-loader";
import { WidgetWrapperOptions } from "./widget-helper/debug/widget-wrapper";

const valuesDefault = require("./src/values").valuesDefault;

const baseConfig = require("./vite.config").default;

let developerPortalUrl: string | null = null;

if ("server" in baseConfig && "open" in baseConfig.server) {
  try {
    const url = new URL(baseConfig.server.open);
    developerPortalUrl = `${url.protocol}${url.port}//${url.hostname}`;
    console.log(`widget-helper: Developer portal url is ${developerPortalUrl}`);
  } catch {}
}

const helperConfig = defineConfig({
  plugins: [
    wrapWidget(
      //WidgetWrapperOptions
      {
        developerPortalUrl: developerPortalUrl, //root url of the live developer portal
        startPage: "/", //the page to launch on the live site when redirected
        impersonateUserId: "1", //the id of the user impersonate. "1" is the built-in admin
        portalStyles: true, //if you want style sheets loaded from the live site
        width: "75%", //iframe width
        height: "75%", //iframe height
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
