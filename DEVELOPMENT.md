# Development Guide

This guide explains how to set up and run the daml-ci-bot for local development.

## Prerequisites

1. **Node.js** (version 18 or higher)
2. **GitHub App** - You need to create a GitHub App with the following permissions:
   - Repository permissions:
     - Contents: Read & write
     - Actions: Write
     - Issues: Write
   - Subscribe to events:
     - Pull requests

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# GitHub App Configuration
APP_ID=your-github-app-id
PRIVATE_KEY_PATH=path/to/your/private-key.pem

# Webhook Configuration (for development)
WEBHOOK_PROXY_URL=https://your-smee-channel.smee.io
WEBHOOK_SECRET=your-webhook-secret

# Development Configuration (optional)
SMEE_URL=https://smee.io/your-channel
PORT=3000
```

### 3. GitHub App Setup

1. Go to [GitHub Apps](https://github.com/settings/apps) and create a new app
2. Set the webhook URL to your smee.io channel URL
3. Download the private key and save it to a file
4. Note the App ID from the app settings

### 4. Smee.io Setup

1. Go to [smee.io](https://smee.io) and create a new channel
2. Copy the channel URL (e.g., `https://smee.io/your-channel`)
3. Use this URL in your environment variables

## Running the Bot

### Using npm script

```bash
npm run dev
```

### Manual setup

```bash
# Terminal 1: Start smee client
npx smee-client --url https://smee.io/your-channel --target http://localhost:3000

# Terminal 2: Start the bot
npm start
```

## Testing

1. **Install the app** on a test repository
2. **Create a pull request** in that repository
3. **Check the logs** to see the bot's activity
4. **Verify** that the bot adds the workflow file and runs tests

## Scripts

- `npm run dev` - Start development server with smee.io
- `npm start` - Start the bot (production mode)
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run lint` - Run ESLint
- `npm run build` - Build the project

## Troubleshooting

### Common Issues

1. **"APP_ID is required"**
   - Make sure you've set the `APP_ID` environment variable
   - Check that your `.env` file is in the project root

2. **"PRIVATE_KEY_PATH is required"**
   - Make sure you've set the `PRIVATE_KEY_PATH` environment variable
   - Verify the path to your private key file is correct

3. **"smee-client not found"**
   - Install smee-client globally: `npm install -g smee-client`
   - The development script will automatically install it if missing

4. **Webhook not receiving events**
   - Check that your GitHub App webhook URL is set to your smee.io channel
   - Verify the smee client is running and connected
   - Make sure the app is installed on the repository you're testing

### Debug Mode

To run with debug logging:

```bash
DEBUG=probot* npm run dev
```

## Production Deployment

For production deployment, you'll need:

1. A server with Node.js 18+
2. Environment variables set (without smee.io)
3. A proper webhook URL pointing to your server
4. SSL certificate for HTTPS

The bot will automatically detect if it's running in production mode (no `WEBHOOK_PROXY_URL` set) and skip the smee.io setup.

