import { Probot } from "probot";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (app: Probot) => {
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
          path: ".github/workflows/daml-tests-bot.yml",
          message: "Add Daml CI workflow",
          content: Buffer.from(workflowContent).toString("base64"),
          branch: ref,
        });
      } catch (error) {
        await context.octokit.issues.createComment({
          owner,
          repo,
          issue_number: number,
          body: "Could not add or update 'daml-tests-bot.yml'.",
        });
        throw error;
      }

      // 2) Trigger the workflow on the PR branch
      try {
        await context.octokit.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: "daml-tests-bot.yml",
          ref,
        });
      } catch (error) {
        await context.octokit.issues.createComment({
          owner,
          repo,
          issue_number: number,
          body: "Could not dispatch 'daml-tests-bot.yml'.",
        });
        throw error;
      }


      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: "Daml tests bot workflow added, dispatched, and then removed. Check the Actions tab for results.",
      });
    } catch (error) {
      console.error("Error adding/dispatching daml-tests bot workflow:", error);
      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: number,
        body: "Could not add or dispatch 'daml-tests-bot.yml'.",
      });
    }
  });

};
