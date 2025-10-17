import { ContextOctokit, RepoContentResponse, RepoContentSingle } from "../types/github.js";

export async function getExistingFileSha(params: {
  octokit: ContextOctokit;
  owner: string;
  repo: string;
  path: string;
  ref: string;
}): Promise<string | undefined> {
  const { octokit, owner, repo, path, ref } = params;
  try {
    const existingRepoContent = await octokit.repos.getContent({ owner, repo, path, ref });
    const data = (existingRepoContent as RepoContentResponse).data;
    if (Array.isArray(data)) return undefined;
    return (data as RepoContentSingle).sha;
  } catch (error: any) {
    // If file doesn't exist (404), return undefined
    if (error.status === 404) {
      return undefined;
    }
    // Re-throw other errors
    throw error;
  }
}


