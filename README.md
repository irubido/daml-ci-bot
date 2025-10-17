# daml-ci-bot

> A GitHub App built with [Probot](https://github.com/probot/probot)

## Setup

```sh
# Install dependencies
npm install

# Build
npm build
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
WEBHOOK_PROXY_URL=https://your-webhook-proxy-url.com
WEBHOOK_SECRET=your-webhook-secret
APP_ID=your-github-app-id
PRIVATE_KEY_PATH=path/to/your/private-key.pem
```

### Variable Descriptions

- `WEBHOOK_PROXY_URL`: The URL for the webhook proxy (used for local development)
- `WEBHOOK_SECRET`: The secret used to verify webhook payloads
- `APP_ID`: Your GitHub App ID
- `PRIVATE_KEY_PATH`: Path to your GitHub App's private key file

## Docker

```sh
# 1. Build container
docker build -t daml-ci-bot .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> daml-ci-bot
```

## Development

### Local Development

For local development with webhook forwarding via smee.io:

```sh
# Start development server with smee.io
npm run dev
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup instructions.

### Running Tests

```sh
# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test
```

## How it Works

The bot works by:

1. **Detecting PRs**: When a pull request is opened, the bot is triggered
2. **Adding Workflow**: It adds a temporary `daml-tests-bot.yml` workflow file to the PR branch
3. **Running Tests**: It dispatches the workflow to run Daml tests
4. **Monitoring**: It polls for completion and reports results
5. **Cleanup**: It removes the temporary workflow file

The workflow template is stored in `templates/workflows/daml-tests.yml` and includes:
- Java (Temurin 11) setup
- Daml SDK installation
- `daml test` execution

