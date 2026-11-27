import { defineConfig } from "@playwright/test";
import fullStack from "./playwright.full-stack.config";

export default defineConfig({
  ...fullStack,
  testMatch: "scanner-audio.spec.ts",
});
