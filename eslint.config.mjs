import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const noFloatForMoney = [
  {
    selector: "CallExpression[callee.name='parseFloat']",
    message: "Use decimal (src/domain/shared/decimal.ts), nunca parseFloat.",
  },
  {
    selector: "CallExpression[callee.name='Number']",
    message: "Use decimal (src/domain/shared/decimal.ts), nunca Number().",
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    ".specify/**",
    ".stryker-tmp/**",
    "reports/**",
    "src/infra/db/migrations/**",
  ]),
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "domain", pattern: "src/domain/**" },
        { type: "application", pattern: "src/application/**" },
        { type: "infra", pattern: "src/infra/**" },
        { type: "actions", pattern: "src/actions/**" },
        { type: "components", pattern: "src/components/**" },
      ],
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          policies: [
            {
              from: { element: { type: "domain" } },
              disallow: ["application", "infra", "actions", "components"].map((type) => ({
                to: { element: { type } },
              })),
            },
            {
              from: { element: { type: "application" } },
              disallow: ["infra", "actions", "components"].map((type) => ({ to: { element: { type } } })),
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    ignores: ["src/domain/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["react", "react-dom", "next", "next/*", "pg", "drizzle-orm", "drizzle-orm/*"] },
      ],
      "no-restricted-syntax": [
        "error",
        ...noFloatForMoney,
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: "Domínio não lê o relógio: receba a data por parâmetro.",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Domínio não lê o relógio: receba a data por parâmetro.",
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    ignores: ["src/application/**/*.test.ts"],
    rules: { "no-restricted-syntax": ["error", ...noFloatForMoney] },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "tests/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "it", property: "only" },
        { object: "describe", property: "only" },
        { object: "test", property: "only" },
        { object: "it", property: "skip" },
        { object: "describe", property: "skip" },
        { object: "test", property: "skip" },
      ],
    },
  },
]);
