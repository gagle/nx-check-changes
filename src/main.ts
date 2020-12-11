import { getInput, info, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { NxJson } from '@nrwl/workspace';
import { promises as fs } from 'fs';
import * as globby from 'globby';

type OctoKit = ReturnType<typeof getOctokit>;

interface Commits {
  base?: string;
  head?: string;
}

interface Changes {
  apps: string[];
  libs: string[];
  implicitDependencies: string[];
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

const readNxFile = async (): Promise<NxJson> => {
  const nxFile = await fs.readFile('nx.json', { encoding: 'utf-8' });
  return JSON.parse(nxFile) as NxJson;
};

const directoryFinder = (directories: string[]) => (file: string) =>
  directories.find(dir =>
    file === dir
      ? // If the given path is equal to the file path, then the directory it's actually a file,
        // so it must be skipped. Should never happen but just to sanitize.
        false
      : file.startsWith(dir)
  );

const getChanges = ({
  apps,
  libs,
  implicitDependencies,
  changedFiles
}: {
  apps: string[];
  libs: string[];
  implicitDependencies: string[];
  changedFiles: string[];
}): Changes => {
  const findApps = directoryFinder(apps);
  const findLibs = directoryFinder(libs);
  const findImplicitDependencies = (file: string) =>
    implicitDependencies.find(dependency => file === dependency);

  const changes = changedFiles.reduce<{
    apps: Set<string>;
    libs: Set<string>;
    implicitDependencies: string[];
  }>(
    (accumulatedChanges, file) => {
      const app = findApps(file);
      if (app) {
        accumulatedChanges.apps.add(app);
      }
      const lib = findLibs(file);
      if (lib) {
        accumulatedChanges.libs.add(lib);
      }
      const implicitDependency = findImplicitDependencies(file);
      if (implicitDependency) {
        accumulatedChanges.implicitDependencies.push(implicitDependency);
      }
      return accumulatedChanges;
    },
    {
      apps: new Set<string>(),
      libs: new Set<string>(),
      implicitDependencies: []
    }
  );

  return {
    apps: [...changes.apps.values()],
    libs: [...changes.libs.values()],
    implicitDependencies: changes.implicitDependencies
  };
};

const main = async () => {
  const token = process.env.GITHUB_TOKEN;

  const octokit = getOctokit(token as string);

  const { base, head } = getBaseAndHeadCommits({
    base: getInput('baseRef'),
    head: getInput('headRef')
  });

  const changedFiles = await getChangedFiles(octokit, base, head);

  const nxFile = await readNxFile();
  const implicitDependencies = nxFile.implicitDependencies
    ? Object.keys(nxFile.implicitDependencies)
    : [];
  const appsDirPattern = `${nxFile.workspaceLayout?.appsDir || 'apps'}/*`;
  const libsDirPattern = `${nxFile.workspaceLayout?.libsDir || 'libs'}/*`;

  const apps = await globby(appsDirPattern, {
    onlyDirectories: true
  });

  const libs = await globby(libsDirPattern, {
    onlyDirectories: true
  });

  console.log('apps:');
  console.log(apps);

  console.log('libs:');
  console.log(libs);

  console.log('implicit dependencies:');
  console.log(implicitDependencies);

  const changes = getChanges({
    apps,
    libs,
    implicitDependencies,
    changedFiles
  });

  console.log('changed apps:');
  console.log(changes.apps);

  console.log('changed libs:');
  console.log(changes.libs);

  console.log('changed implicit dependencies:');
  console.log(changes.implicitDependencies);

  setOutput('changed-apps', changes.apps.join(' '));
  setOutput('changed-libs', changes.libs.join(' '));
  setOutput('changed-implicit-dependencies', changes.implicitDependencies.join(' '));
  setOutput(
    'non-affected',
    changes.apps.length === 0 &&
      changes.libs.length === 0 &&
      changes.implicitDependencies.length === 0
  );
};

main().catch(error => setFailed(error));
