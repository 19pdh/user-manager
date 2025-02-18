import plaindotenv from "dotenv";
plaindotenv.config();

import dotenv from "rollup-plugin-dotenv";
import { babel } from "@rollup/plugin-babel";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import html from "@rollup/plugin-html";
import fs from "fs";
import path from "path";

const extensions = [".ts", ".js"];

const preventTreeShakingPlugin = () => {
  return {
    name: "no-treeshaking",
    resolveId(id, importer) {
      if (!importer) {
        // let's not treeshake entry points, as we're not exporting anything in App Scripts
        return { id, moduleSideEffects: "no-treeshake" };
      }
      return null;
    },
  };
};

export default {
  input: "./src/index.ts",
  output: {
    dir: "build",
    format: "cjs",
  },
  plugins: [
    preventTreeShakingPlugin(),
    nodeResolve({
      extensions,
      mainFields: ["jsnext:main", "main"],
    }),
    babel({ extensions, babelHelpers: "runtime" }),
    dotenv(),
    commonjs(),
    json(),
    html({
      template: () => {
        // Read the HTML template file
        const templatePath = path.resolve(
          __dirname,
          "src",
          "templates",
          "confirm.html"
        );
        let template = fs.readFileSync(templatePath, "utf8");

        // Replace the placeholders with actual values
        template = template.replace(
          "<?= GOOGLE_CLIENT_ID ?>",
          process.env.GOOGLE_CLIENT_ID
        );
        template = template.replace("<?= PROXY_URL ?>", process.env.PROXY_URL);

        return template;
      },
      fileName: "confirm-zhr.html",
    }),
    html({
      template: () => {
        // Read the HTML template file
        const templatePath = path.resolve(
          __dirname,
          "src",
          "templates",
          "confirm.php"
        );
        let template = fs.readFileSync(templatePath, "utf8");

        // Replace the placeholders with actual values
        template = template.replace("<?= APP_URL ?>", process.env.APP_URL);

        return template;
      },
      fileName: "confirm-zhr.php",
    }),
  ],
};
