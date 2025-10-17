import { Probot } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ListWorkflowRunsResponse, ListJobsForRunResponse, RepoContentSingle, RepoContentResponse } from "./types/github.js";
import { getExistingFileSha } from "./utils/github.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const WORKFLOW_FILENAME = "daml-tests-bot.yml";
export const WORKFLOW_PATH = `.github/workflows/${WORKFLOW_FILENAME}`;

// Workflow completion polling constants
export const INITIAL_DELAY_MS = 3000; // Delay before starting to poll for workflow completion
export const MAX_POLL_ATTEMPTS = 60; // Maximum number of polling attempts
export const POLL_INTERVAL_MS = 5000; // Interval between polling attempts (5 seconds)

export interface WorkflowHandlerParams {
  context: any;
  owner: string;
  repo: string;
  ref: string;
  prNumber: number;
}

export async function addWorkflowFile({ context, owner, repo, ref, prNumber }: WorkflowHandlerParams): Promise<void> {
  try {
    const workflowPath = path.join(__dirname, "../templates/workflows/daml-tests.yml");
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    const existingSha = await getExistingFileSha({
      octokit: { repos: context.octokit.repos },
      owner,
      repo,
      path: WORKFLOW_PATH,
      ref,
    });

    await context.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: WORKFLOW_PATH,
      message: "Add Daml CI workflow",
      content: Buffer.from(workflowContent).toString("base64"),
      branch: ref,
      sha: existingSha,
    });
  } catch (error) {
    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: "Could not add or update 'daml-tests-bot.yml'.",
    });
    throw error;
  }
}

export async function dispatchWorkflow({ context, owner, repo, ref, prNumber }: WorkflowHandlerParams): Promise<void> {
  try {
    await context.octokit.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: WORKFLOW_FILENAME,
      ref,
    });
  } catch (error) {
    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `Could not dispatch workflow '${WORKFLOW_FILENAME}'.`,
    });
    throw error;
  }
}

export async function waitForWorkflowCompletion({ context, owner, repo, ref, prNumber }: WorkflowHandlerParams): Promise<void> {
  try {
    // small delay to let the run get created
    await new Promise((r) => setTimeout(r, INITIAL_DELAY_MS));

    const maxAttempts = MAX_POLL_ATTEMPTS;
    const intervalMs = POLL_INTERVAL_MS;
    let runId: number | undefined;
    let runHtmlUrl: string | undefined;
    let runConclusion: string | null | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const runs = (await context.octokit.request(
        "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs",
        {
          owner,
          repo,
          workflow_id: WORKFLOW_FILENAME,
          branch: ref,
          event: "workflow_dispatch",
          per_page: 1,
        }
      )) as ListWorkflowRunsResponse;

      const run = runs.data.workflow_runs?.[0];
      if (run) {
        runId = run.id;
        runHtmlUrl = run.html_url as string | undefined;
        if (run.status === "completed") {
          runConclusion = run.conclusion;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    let damlStepConclusion: string | undefined;
    if (runId) {
      const jobs = (await context.octokit.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: runId,
        per_page: 50,
      })) as unknown as ListJobsForRunResponse;
      for (const job of jobs.data.jobs) {
        const step = job.steps?.find((s) => s.name === "Run Daml tests");
        if (step) {
          damlStepConclusion = step.conclusion || undefined;
          break;
        }
      }
    }

    const summaryParts: string[] = [];
    if (runConclusion) summaryParts.push(`workflow conclusion: ${runConclusion}`);
    if (damlStepConclusion) summaryParts.push(`Run Daml tests: ${damlStepConclusion}`);
    if (runHtmlUrl) summaryParts.push(`details: ${runHtmlUrl}`);

    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: summaryParts.length
        ? `Daml tests bot run completed — ${summaryParts.join(" | ")}`
        : "Daml tests bot workflow dispatched.",
    });
  } catch (error) {
    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: "Workflow dispatched, but failed to collect results.",
    });
  }
}

export async function removeWorkflowFile({ context, owner, repo, ref, prNumber }: WorkflowHandlerParams): Promise<void> {
  try {
    const current = await context.octokit.repos.getContent({
      owner,
      repo,
      path: WORKFLOW_PATH,
      ref,
    });
    const currentData = (current as RepoContentResponse).data;
    if (!Array.isArray(currentData)) {
      const sha = (currentData as RepoContentSingle).sha;
      await context.octokit.repos.deleteFile({
        owner,
        repo,
        path: WORKFLOW_PATH,
        message: "Remove 'daml-tests-bot.yml' workflow",
        branch: ref,
        sha,
      });
    }
  } catch {
    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: "Could not remove workflow file 'daml-tests-bot.yml'.",
    });
  }
}

export default (app: Probot) => {
  app.on("pull_request.opened", async (context) => {
    const { owner, repo } = context.repo();
    const pr = context.payload.pull_request;
    const { number } = pr;
    const ref = pr.head.ref;

    // Validate that we have a valid branch reference
    if (!ref || typeof ref !== 'string' || ref.trim() === '') {
      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: "Error: Invalid or missing branch reference. Cannot proceed with workflow operations.",
      });
      return;
    }

    try {
      // Add the workflow file to the PR branch
      await addWorkflowFile({ context, owner, repo, ref, prNumber: number });

      // Dispatch the workflow
      await dispatchWorkflow({ context, owner, repo, ref, prNumber: number });

      // Wait for workflow completion and report results
      await waitForWorkflowCompletion({ context, owner, repo, ref, prNumber: number });

      // Remove the temporary workflow file
      await removeWorkflowFile({ context, owner, repo, ref, prNumber: number });
    } catch (error) {
      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: "Could not add or dispatch 'daml-tests-bot.yml'.",
      });
    }
  });

};
