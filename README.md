# changed-directories

GitHub Action that detects changed directories in a push or pull request events.

There are times when you want to know which directories have been modified in a pull request. This is especially useful for monorepo projects, for instance for [Nx workspaces](https://nx.dev/).

Some application examples are:
- Integration with SonarQube and SonarCloud. If you want to analyse apps or libs isolated from the others you have to create a `sonar-project.properties` file for each of them and execute the scanner one by one.
- Linting projects. With Nx you have the command `nx affected:lint` but currently this script is not useful the way it behaves because it will also lint affected projects and this is something not desired, you only want to lint the project that has been modified.

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

You want to run some actions for each app or lib that is modified in a pull request. For instance, you're refactoring something internal of `lib1` and  you want to lint all the code inside it. You could use `nx affected:lint` but this will also lint apps that depend on `lib1` which is something that you know that has not been modified. This can be improved by running this GitHub action. Its output will be an array of libs and apps that has been <u>directly</u> modified. There is no dependency graph, just a diff between commits.

For instance, with this input:

```yaml
baseDirectories: >
  apps/*
  libs/*
```

It will be expanded into the array:

```js
[
  'apps/app1',
  'apps/app2',
  'libs/lib1',
  'libs/lib2'
]
```

If something inside `lib1` is modified in a pull request, the output will be:

```js
[
  'libs/lib1'
]
```

<br/>

## Inputs

- **baseDirectories**: _string_ | required

  Space-delimited list of directory paths. Glob patterns are valid and will only expand to directories, not files.

  Examples:

  `apps/dir1 apps/dir2`

  `apps/*`

- **token**: _string_ | required

  GitHub token for authenticating GitHub API requests.

## Outputs

- **directories**: _string_

  Space-delimited list of directory paths that matched the ones provided in the `baseDirectories` input. If none of the given directories have been modified, an empty string is returned. Example: `apps/dir1`.

<br/>

## Usage

Without globs.

```yaml
- uses: gagle/changed-directories@v1
  id: changed-directories
  with:
    baseDirectories: >
      apps/dir1
      apps/dir2
    token: ${{ secrets.GITHUB_TOKEN }}
```

You typically will use globs to avoid hardcoding paths:

```yaml
- uses: gagle/changed-directories@v1
  id: changed-directories
  with:
    baseDirectories: apps/*
    token: ${{ secrets.GITHUB_TOKEN }}
```

<br/>

## Full example

Suppose you have `apps` and `libs` directories that you want to lint each time they are modified.

```yaml
jobs:
  changed-directories:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - name: Detect changed directories
        id: changed-directories
        uses: gagle/changed-directories@v1
        with:
          baseDirectories: >
            apps/*
            libs/*
          token: ${{ secrets.GITHUB_TOKEN }}
    outputs:
      directories: ${{ steps.changed-directories.outputs.directories }}

  lint:
    runs-on: ubuntu-latest
    needs: [changed-directories]
    if: needs.changed-directories.outputs.directories != ''

    steps:
      # Loop over 'needs.changed-directories.outputs.directories'
```
