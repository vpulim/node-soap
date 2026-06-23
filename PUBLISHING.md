Publishing
===================

This document describes the steps a maintainer of this project generally takes in
order to publish a newer version of `node-soap`.

## Ideals
* Pull Requests that alter, add, or correct functionality have a single commit.
* All commit messages are descriptive.
* Maintainers spend little time looking at git history to update HISTORY.md.

## Process
1. Checkout the commit that you would like to publish.  This is usually accomplished
   with `git checkout master`.
2. Run `git log --oneline`
3. Copy the commit messages above the last release commit message into History.md.
4. Consolidate the commit messages:
  * Remove any futile commits I.E. "Removing white space"
  * Remove Pull Request merge commits.  In some cases, you may need to reference the issue in
    order to get the commit message for that Pull Request.
  * Prefix commit messages with "Enhancement", "Fixed", "Deprecated" and so forth
    accordingly.
  * Reword line items as necessary.
5. Update package.json to the appropriate version for the release.
6. Commit your changes to master and push them up to github.
7. Use the github interface to create a tag.
  * Use existing release notes as a reference when adding the release notes to github.
8. `npm publish`.
