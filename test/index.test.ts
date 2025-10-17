import nock from "nock";
import myProbotApp from "../src/index.js";
import { Probot, ProbotOctokit } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, beforeEach, afterEach, test, expect, vi } from "vitest";

// Import the exported functions and types
import {
  addWorkflowFile,
  dispatchWorkflow,
  waitForWorkflowCompletion,
  removeWorkflowFile,
  WorkflowHandlerParams,
  WORKFLOW_FILENAME,
  WORKFLOW_PATH,
  INITIAL_DELAY_MS,
  MAX_POLL_ATTEMPTS,
  POLL_INTERVAL_MS
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const privateKey = fs.readFileSync(
  path.join(__dirname, "fixtures/mock-cert.pem"),
  "utf-8",
);

const prPayload = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/pull_request.opened.json"), "utf-8"),
);

// Helper function to create mock context
const createMockContext = () => ({
  octokit: {
    repos: {
      createOrUpdateFileContents: vi.fn(),
      getContent: vi.fn(),
      deleteFile: vi.fn(),
    },
    actions: {
      createWorkflowDispatch: vi.fn(),
      listJobsForWorkflowRun: vi.fn(),
    },
    issues: {
      createComment: vi.fn(),
    },
    request: vi.fn(),
  },
});

describe("Daml CI Bot", () => {
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

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    vi.restoreAllMocks();
  });

  describe("Branch validation", () => {
    test("should handle invalid branch reference", async () => {
      const invalidPrPayload = {
        ...prPayload,
        pull_request: {
          ...prPayload.pull_request,
          head: { ref: null }
        }
      };

      const mock = nock("https://api.github.com")
        .post("/repos/test-owner/test-repo/issues/1/comments", (body: any) => {
          expect(body.body).toContain("Invalid or missing branch reference");
          return true;
        })
        .reply(200);

      await probot.receive({ name: "pull_request", payload: invalidPrPayload });
      expect(mock.pendingMocks()).toStrictEqual([]);
    });

    test("should handle empty branch reference", async () => {
      const invalidPrPayload = {
        ...prPayload,
        pull_request: {
          ...prPayload.pull_request,
          head: { ref: "" }
        }
      };

      const mock = nock("https://api.github.com")
        .post("/repos/test-owner/test-repo/issues/1/comments", (body: any) => {
          expect(body.body).toContain("Invalid or missing branch reference");
          return true;
        })
        .reply(200);

      await probot.receive({ name: "pull_request", payload: invalidPrPayload });
      expect(mock.pendingMocks()).toStrictEqual([]);
    });

    test("should handle whitespace-only branch reference", async () => {
      const invalidPrPayload = {
        ...prPayload,
        pull_request: {
          ...prPayload.pull_request,
          head: { ref: "   " }
        }
      };

      const mock = nock("https://api.github.com")
        .post("/repos/test-owner/test-repo/issues/1/comments", (body: any) => {
          expect(body.body).toContain("Invalid or missing branch reference");
          return true;
        })
        .reply(200);

      await probot.receive({ name: "pull_request", payload: invalidPrPayload });
      expect(mock.pendingMocks()).toStrictEqual([]);
    });
  });

  describe("Individual function tests", () => {
    describe("addWorkflowFile", () => {
      test("should successfully add workflow file", async () => {
        // Mock fs.promises.readFile
        const mockWorkflowContent = "name: Test Workflow";
        vi.spyOn(fs.promises, 'readFile').mockResolvedValue(mockWorkflowContent);

        const mockContext = createMockContext();
        
        // Mock the getContent call that getExistingFileSha makes
        mockContext.octokit.repos.getContent.mockResolvedValue({
          data: {
            sha: "existing-sha",
            type: "file"
          }
        });
        
        mockContext.octokit.repos.createOrUpdateFileContents.mockResolvedValue({});

        const params: WorkflowHandlerParams = {
          context: mockContext,
          owner: "test-owner",
          repo: "test-repo",
          ref: "feature-branch",
          prNumber: 1
        };

        await addWorkflowFile(params);

        expect(fs.promises.readFile).toHaveBeenCalled();
        expect(mockContext.octokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          path: WORKFLOW_PATH,
          message: "Add Daml CI workflow",
          content: expect.any(String),
          branch: "feature-branch",
          sha: "existing-sha"
        });
      });

      test("should handle file reading error", async () => {
        // Mock fs.promises.readFile to throw an error
        vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('File not found'));

        const mockContext = createMockContext();
        mockContext.octokit.issues.createComment.mockResolvedValue({});

        const params: WorkflowHandlerParams = {
          context: mockContext,
          owner: "test-owner",
          repo: "test-repo",
          ref: "feature-branch",
          prNumber: 1
        };

        await expect(addWorkflowFile(params)).rejects.toThrow('File not found');
        expect(mockContext.octokit.issues.createComment).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 1,
          body: "Could not add or update 'daml-tests-bot.yml'."
        });
      });
    });

    describe("dispatchWorkflow", () => {
      test("should successfully dispatch workflow", async () => {
        const mockContext = createMockContext();
        mockContext.octokit.actions.createWorkflowDispatch.mockResolvedValue({});

        const params: WorkflowHandlerParams = {
          context: mockContext,
          owner: "test-owner",
          repo: "test-repo",
          ref: "feature-branch",
          prNumber: 1
        };

        await dispatchWorkflow(params);

        expect(mockContext.octokit.actions.createWorkflowDispatch).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          workflow_id: WORKFLOW_FILENAME,
          ref: "feature-branch"
        });
      });

      test("should handle dispatch error", async () => {
        const mockContext = createMockContext();
        mockContext.octokit.actions.createWorkflowDispatch.mockRejectedValue(new Error('Dispatch failed'));
        mockContext.octokit.issues.createComment.mockResolvedValue({});

        const params: WorkflowHandlerParams = {
          context: mockContext,
          owner: "test-owner",
          repo: "test-repo",
          ref: "feature-branch",
          prNumber: 1
        };

        await expect(dispatchWorkflow(params)).rejects.toThrow('Dispatch failed');
        expect(mockContext.octokit.issues.createComment).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 1,
          body: `Could not dispatch workflow '${WORKFLOW_FILENAME}'.`
        });
      });
    });

    describe("waitForWorkflowCompletion", () => {
      test("should successfully wait for workflow completion", async () => {
        // Mock setTimeout to avoid actual delays
        vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
          fn();
          return {} as any;
        });

        const mockContext = createMockContext();
        
        // Mock the workflow runs response
        mockContext.octokit.request.mockResolvedValue({
          data: {
            workflow_runs: [{
              id: 123,
              status: "completed",
              conclusion: "success",
              html_url: "https://github.com/test-owner/test-repo/actions/runs/123"
            }]
          }
        });

        // Mock the jobs response
        mockContext.octokit.actions.listJobsForWorkflowRun.mockResolvedValue({
          data: {
            jobs: [{
              steps: [{
                name: "Run Daml tests",
                conclusion: "success"
              }]
            }]
          }
        });

        mockContext.octokit.issues.createComment.mockResolvedValue({});

        const params: WorkflowHandlerParams = {
          context: mockContext,
          owner: "test-owner",
          repo: "test-repo",
          ref: "feature-branch",
          prNumber: 1
        };

        await waitForWorkflowCompletion(params);

        expect(mockContext.octokit.request).toHaveBeenCalledWith(
          "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
          {
            owner: "test-owner",
            repo: "test-repo",
            workflow_id: WORKFLOW_FILENAME,
            branch: "feature-branch",
            event: "workflow_dispatch",
            per_page: 1,
          }
        );

        expect(mockContext.octokit.issues.createComment).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 1,
          body: expect.stringContaining("Daml tests bot run completed")
        });
      });

      test("should handle polling timeout", async () => {
        // Mock setTimeout to avoid actual delays
        vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
          fn();
          return {} as any;
        });

        const mockContext = createMockContext();
        
        // Mock empty workflow runs response (timeout scenario)
        mockContext.octokit.request.mockResolvedValue({
          data: {
            workflow_runs: []
          }
        });

        mockContext.octokit.issues.createComment.mockResolvedValue({});

        const params: WorkflowHandlerParams = {
          context: mockContext,
          owner: "test-owner",
          repo: "test-repo",
          ref: "feature-branch",
          prNumber: 1
        };

        await waitForWorkflowCompletion(params);

        expect(mockContext.octokit.issues.createComment).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 1,
          body: "Daml tests bot workflow dispatched."
        });
      });
    });

    describe("removeWorkflowFile", () => {
      test("should successfully remove workflow file", async () => {
        const mockContext = createMockContext();
        
        // Mock getContent response
        mockContext.octokit.repos.getContent.mockResolvedValue({
          data: {
            sha: "abc123",
            type: "file"
          }
        });

        // Mock deleteFile response
        mockContext.octokit.repos.deleteFile.mockResolvedValue({});

        const params: WorkflowHandlerParams = {
          context: mockContext,
          owner: "test-owner",
          repo: "test-repo",
          ref: "feature-branch",
          prNumber: 1
        };

        await removeWorkflowFile(params);

        expect(mockContext.octokit.repos.getContent).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          path: WORKFLOW_PATH,
          ref: "feature-branch"
        });

        expect(mockContext.octokit.repos.deleteFile).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          path: WORKFLOW_PATH,
          message: "Remove 'daml-tests-bot.yml' workflow",
          branch: "feature-branch",
          sha: "abc123"
        });
      });

      test("should handle removal error gracefully", async () => {
        const mockContext = createMockContext();
        
        // Mock getContent to throw an error
        mockContext.octokit.repos.getContent.mockRejectedValue(new Error('File not found'));
        mockContext.octokit.issues.createComment.mockResolvedValue({});

        const params: WorkflowHandlerParams = {
          context: mockContext,
          owner: "test-owner",
          repo: "test-repo",
          ref: "feature-branch",
          prNumber: 1
        };

        await removeWorkflowFile(params);

        expect(mockContext.octokit.issues.createComment).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          issue_number: 1,
          body: "Could not remove workflow file 'daml-tests-bot.yml'."
        });
      });
    });
  });

  describe("Constants and configuration", () => {
    test("should have correct workflow filename", () => {
      expect(WORKFLOW_FILENAME).toBe("daml-tests-bot.yml");
    });

    test("should have correct workflow path", () => {
      expect(WORKFLOW_PATH).toBe(".github/workflows/daml-tests-bot.yml");
    });

    test("should have correct polling constants", () => {
      expect(INITIAL_DELAY_MS).toBe(3000);
      expect(MAX_POLL_ATTEMPTS).toBe(60);
      expect(POLL_INTERVAL_MS).toBe(5000);
    });
  });
});