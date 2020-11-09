import { getInput, info, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import * as globby from 'globby';

type OctoKit = ReturnType<typeof getOctokit>;

const getBaseAndHeadCommits = () => {
  let base: string | undefined;
  let head: string | undefined;

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
      throw new Error(
        `'${context.eventName}' events are not supported. Supported events: 'pull_request', 'push'`
      );
  }

  if (!base || !head) {
    throw new Error(`Base or head commits are missing`);
  }

  info(`Base commit: ${base}`);
  info(`Head commit: ${head}`);

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
  const token = getInput('token') || (process.env.GITHUB_TOKEN as string);
  console.log(process.env.GITHUB_TOKEN);
  console.log(process.version);
  const octokit = getOctokit(token);

  const { base, head } = getBaseAndHeadCommits();

  const files = await getChangedFiles(octokit, base, head);

  const baseDirectoriesGlob = getInput('baseDirectories', { required: true }).split(' ');

  const baseDirectories = await globby(baseDirectoriesGlob, { onlyDirectories: true });

  console.log('Base directories:');
  console.log(baseDirectories);

  const changedDirectories = reduceFilesToDirectoriesMap(baseDirectories, files);

  if (!changedDirectories) {
    console.log('No directories have been modified!');
  } else {
    console.log('Directories that have been modified:');
    console.log(changedDirectories);
  }

  setOutput('directories', changedDirectories.join(' '));
};

main().catch(error => setFailed(error));
