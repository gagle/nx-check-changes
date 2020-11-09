# changed-directories

GitHub Action that detects changed directories in a push or pull request events.

There are times when you want to know which directories have been modified in a pull request. This is especially useful for monorepo projects, for instance for [Nx workspaces](https://nx.dev/).

Some application examples are:
- Integration with SonarQube and SonarCloud. If you want to analyse apps or libs isolated from the others you have to create a `sonar-project.properties` file for each of them and execute the scanner one by one.
- Linting projects. Again, for instance, with Nx you have the command `nx affected:lint` but currently this script is not useful the way it behaves because it will also lint affected projects and this is something that is not desired, we only want to lint the project that has been modified.

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
    token: ${{ secrets.GITHUB_TOKEN }}
    baseDirectories: >
      apps/dir1
      apps/dir2
```

You typically will use globs to avoid hardcoding paths:

```yaml
- uses: gagle/changed-directories@v1
  id: changed-directories
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    baseDirectories: apps/*
```

<br/>

## Full example

Suppose you have `apps` and `libs` directories that you want to lint each time they are modified.

```yaml
changed-directories:
  runs-on: ubuntu-latest

  steps:
    - uses: actions/checkout@v2
    - name: Detect changed directories
      id: changed-directories
      uses: gagle/changed-directories@v1
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        baseDirectories: >
          apps/*
          libs/*
lint:
  runs-on: ubuntu-latest
  needs: [changed-directories]
  if: needs.changed-directories.outputs.directories != ''

  steps:
    # Loop over 'needs.changed-directories.outputs.directories'
```
