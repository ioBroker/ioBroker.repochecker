# Migration Guide to NPM Trusted Publishing

This guide will help you migrate your ioBroker adapter from using NPM tokens to trusted publishing for secure and automated package deployment.

## Overview

**Starting situation:**
- You are using the standard ioBroker workflow `test-and-release.yml`
- NPM authorization is stored as a secret token `NPM_TOKEN` in your repository settings
- Your adapter repository follows the pattern like `mcm4iob/ioBroker.hoymiles-ms`

**Target situation:**
- Continue using the existing `test-and-release.yml` workflow (minimal changes only if required)
- Remove NPM token dependencies 
- Use NPM Trusted Publishing for secure, automated deployments
- Access to NPM controlled entirely through GitHub Actions via OIDC (OpenID Connect)

## Benefits of Trusted Publishing

- **Enhanced Security**: No more storing sensitive NPM tokens in repository secrets
- **Automated Setup**: GitHub Actions can authenticate directly with NPM
- **Reduced Maintenance**: No token rotation or expiration management needed
- **Audit Trail**: Better tracking of who published what and when

## Prerequisites

Before starting, ensure you have:
- Administrator access to your NPM package
- Administrator access to your GitHub repository
- Your adapter is already published on NPM
- You are using a standard `test-and-release.yml` workflow

## Step-by-Step Migration Process

### Step 1: Access Your NPM Package Settings

1. **Log in to NPM**: Go to [npmjs.com](https://npmjs.com) and sign in to your account
2. **Navigate to your package**: Go to your adapter package (e.g., `iobroker.hoymiles-ms`)
3. **Access package settings**: Click on your package name, then navigate to the "Settings" tab

![NPM Package Settings - Access your package settings page](placeholder_npm_package_settings.png)

### Step 2: Configure Trusted Publishing on NPM

1. **Find Publishing Access section**: Scroll to the "Publishing access" section in your package settings
2. **Click on "Trusted publishing"**: This will open the trusted publishing configuration
3. **Add GitHub as a trusted publisher**: Click "Add trusted publisher"

![NPM Trusted Publishing Setup - Add GitHub as trusted publisher](placeholder_npm_trusted_publisher.png)

### Step 3: Configure GitHub Repository Settings

Fill in the following information exactly:

- **Repository**: `your-github-username/ioBroker.your-adapter-name` (e.g., `mcm4iob/ioBroker.hoymiles-ms`)
- **Workflow**: `test-and-release.yml` (this is the standard ioBroker workflow name)
- **Environment**: Leave empty (or use `production` if you have environment-specific deployments)

![GitHub Repository Configuration - Configure the repository details](placeholder_github_repo_config.png)

**Important Notes:**
- The repository name must exactly match your GitHub repository
- The workflow name must match the actual workflow file name in `.github/workflows/`
- If you use a different branch than `master` for releases, ensure your workflow is configured accordingly

### Step 4: Verify Workflow Configuration

Check your current `.github/workflows/test-and-release.yml` file. The deploy job should look similar to this:

```yaml
deploy:
  needs: [tests]
  if: |
    contains(github.event.head_commit.message, '[skip ci]') == false &&
    github.event_name == 'push' &&
    startsWith(github.ref, 'refs/tags/')
  runs-on: ubuntu-latest
  steps:
    - name: Checkout code
      uses: actions/checkout@v5
    - name: Use Node.js 18.x
      uses: actions/setup-node@v4
      with:
        node-version: 18.x
    - name: Install Dependencies
      run: npm install
    - name: Publish package to npm
      run: |
        npm config set //registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}
        npm whoami
        npm publish
```

### Step 5: Update Workflow for Trusted Publishing

**ONLY IF REQUIRED**: If your workflow doesn't support trusted publishing yet, you need to make minimal changes.

#### Option A: Keep Current Workflow (Recommended)

Most existing ioBroker workflows already support trusted publishing. The `@iobroker/testing` action handles trusted publishing automatically when `NPM_TOKEN` is not available.

#### Option B: Manual Workflow Update (Only if Option A doesn't work)

Replace the npm publish step with:

```yaml
- name: Publish package to npm
  run: |
    npm config set //registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}
    npm whoami
    npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Update to:**

```yaml
- name: Setup Node.js with NPM registry
  uses: actions/setup-node@v4
  with:
    node-version: 18.x
    registry-url: 'https://registry.npmjs.org'
- name: Publish package to npm
  run: npm publish --provenance
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Step 6: Test the Configuration

1. **Create a test tag**: Make a small change to your package.json version and create a git tag
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. **Monitor the workflow**: Go to your GitHub repository's "Actions" tab and watch the deployment process

3. **Verify publication**: Check that your package was published successfully to NPM

![GitHub Actions Success - Successful workflow run with trusted publishing](placeholder_github_actions_success.png)

### Step 7: Remove NPM Token (Final Step)

**Only after successful testing:**

1. **Go to GitHub repository settings**: Navigate to Settings > Secrets and variables > Actions
2. **Remove NPM_TOKEN**: Delete the `NPM_TOKEN` secret from your repository
3. **Verify removal**: Run another test deployment to ensure it works without the token

![Remove NPM Token - Delete NPM_TOKEN from repository secrets](placeholder_remove_npm_token.png)

## Changes Required for @iobroker/testing Workflow

If you are using the `@iobroker/testing` action in your workflow, you may need to update it to the latest version that supports trusted publishing:

### Current Standard Workflow

Most ioBroker adapters use a workflow that calls:

```yaml
- name: Test and Release
  uses: ioBroker/testing@v3
  with:
    node-version: '18.x'
```

### Updated Workflow for Trusted Publishing

Update to the latest version:

```yaml
- name: Test and Release  
  uses: ioBroker/testing@v4
  with:
    node-version: '18.x'
    npm-token: ${{ secrets.NPM_TOKEN }}  # This will be ignored when trusted publishing is used
```

The testing action will automatically detect and use trusted publishing when available, falling back to the token method if needed.

## Troubleshooting

### Common Issues and Solutions

1. **"Failed to authenticate with NPM" error**
   - Verify the repository name exactly matches your GitHub repository
   - Ensure the workflow name matches your actual workflow file
   - Check that the package name is correct

2. **"Workflow not found" error**
   - Confirm your workflow file is named exactly `test-and-release.yml`
   - Ensure the workflow has been committed to your repository
   - Verify the workflow contains the correct deploy job

3. **"Package not found" error**
   - Ensure your package is already published on NPM
   - Verify you have maintainer permissions for the package
   - Check that the package name matches exactly

4. **Permission denied errors**
   - Confirm you are an administrator on the NPM package
   - Verify your GitHub repository permissions
   - Ensure the trusted publisher configuration is saved correctly

### Testing Your Configuration

Before going live, you can test the trusted publishing setup:

1. Create a pre-release version (e.g., `v1.0.0-beta.1`)
2. Tag and push to trigger the workflow
3. Monitor the GitHub Actions logs
4. Verify the package appears on NPM
5. Only remove the NPM token after successful testing

## Security Considerations

- **Repository Access**: Ensure only trusted maintainers have admin access to your repository
- **Workflow Files**: Protect your `.github/workflows/` directory with branch protection rules
- **Package Ownership**: Regularly review NPM package collaborators and permissions
- **Audit Logs**: Monitor NPM and GitHub audit logs for unexpected activity

## Rollback Plan

If you need to revert to token-based publishing:

1. **Re-add NPM_TOKEN**: Go to repository Settings > Secrets and add your NPM token back
2. **Remove trusted publisher**: Remove the GitHub trusted publisher from your NPM package settings
3. **Revert workflow changes**: If you modified your workflow, revert to the previous version
4. **Test deployment**: Create a test tag to verify token-based publishing works

## Conclusion

Trusted publishing provides a more secure and maintainable way to publish your ioBroker adapter packages. The migration process is straightforward and provides significant security benefits with minimal changes to your existing workflow.

If you encounter any issues during migration, please refer to the troubleshooting section or reach out to the ioBroker community for support.

## Additional Resources

- [NPM Trusted Publishing Documentation](https://docs.npmjs.com/trusted-publishers)
- [GitHub Actions OIDC Documentation](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [ioBroker Testing Action](https://github.com/ioBroker/testing)