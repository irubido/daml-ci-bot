# Templates

This directory contains templates that the daml-ci-bot uses when working with other repositories.

## Workflows

The `workflows/` directory contains GitHub Actions workflow templates that the bot can inject into target repositories.

### daml-tests.yml

This is the Daml test workflow template that the bot adds to pull requests in target repositories. It:

- Sets up Java (Temurin 11)
- Installs the Daml SDK
- Runs `daml test` to execute Daml tests

