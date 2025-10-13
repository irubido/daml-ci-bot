import { Probot } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on("pull_request.opened", async (context) => {
    const { owner, repo } = context.repo();
    const pr = context.payload.pull_request;
    const { number } = pr;
    const ref = pr.head.ref;

    try {
      // 1) Add/Update the workflow file on the PR branch
      try {
        const workflowPath = path.join(__dirname, "../.github/workflows/daml-tests.yml");
        const workflowContent = fs.readFileSync(workflowPath, "utf8");

        await context.octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: ".github/workflows/daml-tests.yml",
          message: "Add Daml CI workflow",
          content: Buffer.from(workflowContent).toString("base64"),
          branch: ref,
        });
      } catch (error) {
        await context.octokit.issues.createComment({
          owner,
          repo,
          issue_number: number,
          body: "❌ Could not add or update 'daml-tests.yml'.",
        });
        throw error;
      }

      // 2) Trigger the workflow on the PR branch
      try {
        await context.octokit.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: "daml-tests.yml",
          ref,
        });
      } catch (error) {
        await context.octokit.issues.createComment({
          owner,
          repo,
          issue_number: number,
          body: "❌ Could not dispatch 'daml-tests.yml'.",
        });
        throw error;
      }

      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: "🚀 Daml tests workflow added and dispatched! Check the Actions tab for results.",
      });
    } catch (error) {
      console.error("Error adding/dispatching daml-tests workflow:", error);
      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: "❌ Could not add or dispatch 'daml-tests.yml'. Ensure app has contents:write and actions:write.",
      });
    }
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
