# nx-check-changes

GitHub Action that checks if a code change affects any app, lib or implicit dependency in a Nx workspace.

Checking-out the repository is mandatory before executing the action because it needs to read the `nx.json` file.

There are times when you want to know which apps, libs or implicit dependencies configured inside `nx.json` have changed from commit to commit before executing `nx affected:*` commands. If there's nothing to build, test and deploy, then you actually don't need to execute all the steps before running the nx command. This is some valious time that you can save.

Some practical use cases are:
- Integration with SonarQube or SonarCloud. If you want to analyse apps or libs isolated from the others you have to create a `sonar-project.properties` file for each of them. Then you need to go to all the apps/libs that have changed and run the scanner.
- Linting projects. With Nx you have the command `nx affected:lint` but this script is not useful the way it behaves because it will also lint affected projects and this is something not desired, you only want to lint the project that has been modified, or even better only lint the files that changed but that's another improvement out of the scope of this GitHub action.

Given this directory tree:

```
.
├─ apps
│  ├─ app1
│  └─ app2
└─ libs
   ├─ lib1
   └─ lib2
```

You want to run some actions for each app or lib that is modified in a pull request. For instance, you're refactoring something internal from `lib1` and you want to lint all the code inside it. You could use `nx affected:lint` but this will also lint apps that depend on `lib1` which is something that you know that has not been modified. This can be improved by running this GitHub action. The output will be a space-delimited array of libs that has been <u>directly</u> modified, eg. `lib1`. There is no dependency graph, just a two dot diff between commits.

## Event types

This action automatically takes the base and head refs from the `pull_request` and `push` events. If you need to support any other event, then the `baseRef` and the `headRef` inputs need to be specified.

<br/>

- **baseRef**: _string_ | optional

  Base ref. Used when this action is used from a workflow for events different from `pull_request` and `push`.

- **headRef**: _string_ | optional

  Head ref. Used when this action is used from a workflow for events different from `pull_request` and `push`.

## Outputs

- **changed-apps**: _string_

  Space-delimited list of app root paths that have been modified. If no apps have been modified, an empty string is returned. Example: `apps/dir1`.

- **changed-libs**: _string_

  Space-delimited list of lib root paths that have been modified. If no libs have been modified, an empty string is returned. Example: `libs/lib1 libs/lib2`.

- **changed-implicit-dependencies**: _string_

  Space-delimited list of implicit dependency files that have been modified. If none of the given directories have been modified, an empty string is returned. The implicit dependencies are read from the `nx.json` file. Example: `package.json`.

- **not-affected**: _string_

  Whether or not code changes affect the apps or libs. Values: `'true'` or `'false'`.

<br/>

## Usage

For a `pull_request` or `push` events.

```yaml
- uses: gagle/nx-check-changes@v1.0.0
  id: nx-changes
```

<br/>

## Full example

Suppose you have `apps` and `libs` directories that you want to lint each time they are modified.

You will want to have a job that stores the outputs of this action.

```yaml
jobs:
  pre-run:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Detect changed directories
        uses: gagle/nx-check-changes@v1.0.0
        id: nx-changes

    outputs:
      changed-dirs: ${{ steps.nx-changes.outputs.changed-dirs }}
      skip: ${{ steps.nx-changes.outputs.not-affected }}

  lint:
    runs-on: ubuntu-latest
    needs: [pre-run]
    if: needs.pre-run.outputs.skip == 'false'

    steps:
      # Loop over 'needs.pre-run.outputs.changed-dirs'
```
