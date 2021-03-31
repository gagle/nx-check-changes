import { getInput, info, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { NxJson } from '@nrwl/workspace';
import { promises as fs } from 'fs';

type OctoKit = ReturnType<typeof getOctokit>;

interface Changes {
  apps: string[];
  libs: string[];
  implicitDependencies: string[];
}

interface Refs {
  base: string;
  head: string;
}

const getBaseAndHeadRefs = ({ base, head }: Partial<Refs>): Refs => {
  if (!base && !head) {
    switch (context.eventName) {
      case 'pull_request':
        base = context.payload.pull_request?.base?.sha as string;
        head = context.payload.pull_request?.head?.sha as string;
        break;
      case 'push':
        base = context.payload.before as string;
        head = context.payload.after as string;
        break;
    }
  }

  if (!base || !head) {
    throw new Error(`Base or head refs are missing`);
  }

  info(`Event name: ${context.eventName}`);
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

const dirFinder = (dir: string): ((file: string) => string | undefined) => {
  const pathRegExp = new RegExp(`^${dir}/([^/]+)`);
  return (file: string) => file.match(pathRegExp)?.[1];
};

const getChanges = ({
  appsDir,
  libsDir,
  implicitDependencies,
  changedFiles
}: {
  appsDir: string;
  libsDir: string;
  implicitDependencies: string[];
  changedFiles: string[];
}): Changes => {
  const findApp = dirFinder(appsDir);
  const findLib = dirFinder(libsDir);
  const findImplicitDependencies = (file: string) =>
    implicitDependencies.find(dependency => file === dependency);

  const changes = changedFiles.reduce<{
    apps: Set<string>;
    libs: Set<string>;
    implicitDependencies: string[];
  }>(
    (accumulatedChanges, file) => {
      const app = findApp(file);
      if (app) {
        accumulatedChanges.apps.add(app);
      }
      const lib = findLib(file);
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

  const { base, head } = getBaseAndHeadRefs({
    base: getInput('baseRef'),
    head: getInput('headRef')
  });

  const changedFiles = await getChangedFiles(octokit, base, head);

  console.log('changed files:');
  console.log(JSON.stringify(changedFiles, null, 2));

  const nxFile = await readNxFile();
  const implicitDependencies = nxFile.implicitDependencies
    ? Object.keys(nxFile.implicitDependencies)
    : [];
  const appsDir = nxFile.workspaceLayout?.appsDir || 'apps';
  const libsDir = nxFile.workspaceLayout?.libsDir || 'libs';

  const changes = getChanges({
    appsDir,
    libsDir,
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
  setOutput('changed-dirs', [...changes.apps, ...changes.libs].join(' '));
  setOutput('changed-implicit-dependencies', changes.implicitDependencies.join(' '));
  setOutput(
    'not-affected',
    changes.apps.length === 0 &&
      changes.libs.length === 0 &&
      changes.implicitDependencies.length === 0
  );
};

main().catch(error => setFailed(error));
