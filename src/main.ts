import { getInput, info, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import * as globby from 'globby';

type OctoKit = ReturnType<typeof getOctokit>;

interface Commits {
  base?: string;
  head?: string;
}

const getBaseAndHeadCommits = ({ base, head }: Commits) => {
  switch (context.eventName) {
    case 'pull_request':
      base = context.payload.pull_request?.base?.sha as string;
      head = context.payload.pull_request?.head?.sha as string;
      break;
    case 'push':
      base = context.payload.before as string;
      head = context.payload.after as string;
      break;
    default:
      if (!base || !head) {
        throw new Error(`Missing 'base' or 'head' refs for event type '${context.eventName}'`);
      }
  }

  if (!base || !head) {
    throw new Error(`Base or head refs are missing`);
  }

  info(`Base ref: ${base}`);
  info(`Head ref: ${head}`);

  return {
    base,
    head
  };
};

const getChangedFiles = async (octokit: OctoKit, base: string, head: string): Promise<string[]> => {
  const response = await octokit.repos.compareCommits({
    base,
    head,
    owner: context.repo.owner,
    repo: context.repo.repo
  });

  const files = response.data.files;

  return files.map(file => file.filename);
};

const reduceFilesToDirectoriesMap = (baseDirectories: string[], files: string[]): string[] => {
  const findBaseDirectory = (file: string) =>
    baseDirectories.find(dir =>
      file === dir
        ? // If a given "directory" path is equal to the file path, then the directory it's actually a
          // file, so it must be skipped
          false
        : file.startsWith(dir)
    );

  const directoriesSet = files.reduce<Set<string>>((set, file) => {
    const dir = findBaseDirectory(file);
    if (dir) {
      set.add(dir);
    }
    return set;
  }, new Set<string>());

  return [...directoriesSet.values()];
};

const main = async () => {
  const token = process.env.GITHUB_TOKEN;

  const octokit = getOctokit(token as string);

  const { base, head } = getBaseAndHeadCommits({
    base: getInput('baseRef'),
    head: getInput('headRef')
  });

  const files = await getChangedFiles(octokit, base, head);

  const directoriesGlobPatterns = ['apps/*', 'libs/*'];

  const directories = await globby(directoriesGlobPatterns, {
    onlyDirectories: true
  });

  console.log('Directories:');
  console.log(directories);

  const changedApps = reduceFilesToDirectoriesMap(directories, files);

  console.log('Apps that have been modified:');
  console.log(changedApps);

  setOutput('changed-apps', changedApps.join(' '));
  setOutput('non-affected', changedApps.length === 0);
};

main().catch(error => setFailed(error));
