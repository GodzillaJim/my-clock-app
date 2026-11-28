// Conventional Commits: https://www.conventionalcommits.org
// Enforced by the commit-msg git hook. PR titles must follow it too, because
// squash merges use the PR title as the commit subject.
export default {
  extends: ['@commitlint/config-conventional'],
};
