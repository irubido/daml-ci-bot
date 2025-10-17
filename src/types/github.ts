import type { Endpoints } from "@octokit/types";

export type RepoContentParams = { owner: string; repo: string; path: string; ref: string };

// https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content
export type RepoContentSingle = Extract<
  Endpoints["GET /repos/{owner}/{repo}/contents/{path}"]["response"]["data"],
  { type: "file" | "symlink" | "submodule" }
>;

export type RepoContentDirEntry = Extract<
  Endpoints["GET /repos/{owner}/{repo}/contents/{path}"]["response"]["data"],
  any[]
>[number];

export type RepoContentResponse = {
  data: Endpoints["GET /repos/{owner}/{repo}/contents/{path}"]["response"]["data"];
};


// https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#list-workflow-runs-for-a-workflow
export type ListWorkflowRunsResponse = Endpoints["GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"]["response"];

// https://docs.github.com/en/rest/actions/workflow-jobs?apiVersion=2022-11-28#list-jobs-for-a-workflow-run
export type ListJobsForRunResponse = Endpoints["GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"]["response"];

export type ContextOctokit = {
  repos: {
    getContent(params: RepoContentParams): Promise<RepoContentResponse>;
  };
};


