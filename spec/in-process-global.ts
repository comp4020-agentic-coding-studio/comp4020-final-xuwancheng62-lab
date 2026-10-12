import type { TestProject } from "vitest/node";
export default function setup(project: TestProject): void {
  project.provide("baseUrl", "http://localhost:8080");
}
