// You can import your modules
// import index from '../src/index'

import nock from "nock";
// Requiring our app implementation
import myProbotApp from "../src/index.js";
import { Probot, ProbotOctokit } from "probot";
// Requiring our fixtures
//import payload from "./fixtures/issues.opened.json" with { "type": "json"};
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, beforeEach, afterEach, test, expect } from "vitest";

const issueCreatedBody = { body: "Thanks for opening this issue!" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const privateKey = fs.readFileSync(
  path.join(__dirname, "fixtures/mock-cert.pem"),
  "utf-8",
);

const payload = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/issues.opened.json"), "utf-8"),
);

const prPayload = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/pull_request.opened.json"), "utf-8"),
);

describe("My Probot app", () => {
  let probot: any;

  beforeEach(() => {
    nock.disableNetConnect();
    probot = new Probot({
      appId: 123,
      privateKey,
      // disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    // Load our app into probot
    probot.load(myProbotApp);
  });

  test("creates a comment when an issue is opened", async () => {
    const mock = nock("https://api.github.com")
      // Test that we correctly return a test token
      .post("/app/installations/2/access_tokens")
      .reply(200, {
        token: "test",
        permissions: {
          issues: "write",
        },
      })

      // Test that a comment is posted
      .post("/repos/hiimbex/testing-things/issues/1/comments", (body: any) => {
        expect(body).toMatchObject(issueCreatedBody);
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ name: "issues", payload });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test("adds workflow file when a pull request is opened", async () => {
    const mock = nock("https://api.github.com")
      .persist()
      .post("/app/installations/2/access_tokens")
      .reply(200, {
        token: "test",
        permissions: {
          contents: "write",
          actions: "write",
          issues: "write",
        },
      })

      // Test that the workflow file is added to the PR branch
      .put("/repos/test-owner/test-repo/contents/.github%2Fworkflows%2Fdaml-tests.yml", (body: any) => {
        expect(body.message).toBe("Add Daml CI workflow");
        expect(body.branch).toBe("feature-branch");
        expect(body.content).toBeDefined();
        return true;
      })
      .reply(200)

      // Test that workflow is dispatched
      .post("/repos/test-owner/test-repo/actions/workflows/daml-tests.yml/dispatches", (body: any) => {
        expect(body.ref).toBe("feature-branch");
        return true;
      })
      .reply(204)

      // Test that success comment is posted
      .post("/repos/test-owner/test-repo/issues/1/comments", (body: any) => {
        expect(body.body).toContain("workflow added and dispatched");
        return true;
      })
      .reply(200);

    await expect(probot.receive({ name: "pull_request", payload: prPayload })).resolves.not.toThrow();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});

// For more information about testing with Jest see:
// https://facebook.github.io/jest/

// For more information about using TypeScript in your tests, Jest recommends:
// https://github.com/kulshekhar/ts-jest

// For more information about testing with Nock see:
// https://github.com/nock/nock
