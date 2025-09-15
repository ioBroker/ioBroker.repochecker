'use strict';

/**
 * Test fixtures for ioBroker.repochecker tests
 * 
 * This module provides sample data for testing various scenarios
 */

// Valid package.json for testing
const validPackageJson = {
    "name": "iobroker.test-adapter",
    "version": "1.0.0",
    "description": "Test adapter for ioBroker",
    "main": "main.js",
    "engines": {
        "node": ">=18"
    },
    "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1"
    },
    "repository": {
        "type": "git",
        "url": "git+https://github.com/test/ioBroker.test-adapter.git"
    },
    "keywords": [
        "iobroker",
        "test",
        "adapter"
    ],
    "author": "Test Author",
    "license": "MIT",
    "bugs": {
        "url": "https://github.com/test/ioBroker.test-adapter/issues"
    },
    "homepage": "https://github.com/test/ioBroker.test-adapter#readme",
    "dependencies": {
        "@iobroker/adapter-core": "^3.3.2"
    },
    "devDependencies": {
        "@iobroker/testing": "^5.1.0"
    }
};

// Invalid package.json missing required fields
const invalidPackageJson = {
    "name": "test-adapter", // Missing ioBroker prefix - should trigger E002
    "version": "1.0.0",
    "main": "main.js",
    "dependencies": {}, // Empty but present
    "devDependencies": {} // Empty but present
    // Missing many required fields
};

// Valid io-package.json for testing
const validIoPackageJson = {
    "common": {
        "name": "test-adapter",
        "version": "1.0.0",
        "news": {
            "1.0.0": {
                "en": "Initial release",
                "de": "Erstveröffentlichung"
            }
        },
        "title": "Test Adapter",
        "titleLang": {
            "en": "Test Adapter",
            "de": "Test Adapter"
        },
        "desc": {
            "en": "Test adapter for ioBroker",
            "de": "Test Adapter für ioBroker"
        },
        "authors": [
            "Test Author <test@example.com>"
        ],
        "keywords": [
            "test"
        ],
        "license": "MIT",
        "platform": "Javascript/Node.js",
        "mode": "daemon",
        "type": "general",
        "compact": true,
        "connectionType": "local",
        "dataSource": "poll",
        "tier": 3,
        "adminUI": {
            "config": "json"
        }
    },
    "native": {
        "option1": "value1"
    },
    "objects": [],
    "instanceObjects": []
};

// Invalid io-package.json missing required fields
const invalidIoPackageJson = {
    "common": {
        "name": "test-adapter",
        "version": "1.0.0"
        // Missing many required fields like title, desc, authors, etc.
    },
    "native": {},
    "objects": []
};

// Package.json with dependency issues
const packageJsonWithDependencyIssues = {
    "name": "iobroker.test-adapter",
    "version": "1.0.0",
    "dependencies": {
        "@iobroker/testing": "^5.1.0", // Should be in devDependencies - E074
        "request": "^2.88.2", // Deprecated package - warning
        "npm": "^8.0.0" // Forbidden dependency - error
    },
    "devDependencies": {
        "@types/node": "^18.0.0" // Should be dependency, not devDependency - warning
    }
};

// Package.json with old Node.js requirement
const packageJsonOldNode = {
    "name": "iobroker.test-adapter",
    "version": "1.0.0",
    "engines": {
        "node": ">=14" // Should be >=18 - warning
    },
    "dependencies": {},
    "devDependencies": {}
};

// io-package.json with missing translations
const ioPackageJsonMissingTranslations = {
    "common": {
        "name": "test-adapter",
        "version": "1.0.0",
        "title": "Test Adapter",
        "titleLang": {
            "en": "Test Adapter"
            // Missing German translation - W127
        },
        "desc": {
            "en": "Test adapter"
            // Missing German translation - W134
        },
        "authors": ["Test Author"],
        "keywords": ["test"],
        "license": "MIT",
        "platform": "Javascript/Node.js",
        "mode": "daemon",
        "type": "general"
    }
};

// GitHub API response for a valid repository
const validGithubApiResponse = {
    "name": "ioBroker.test-adapter",
    "full_name": "test/ioBroker.test-adapter",
    "description": "Test adapter for ioBroker",
    "private": false,
    "archived": false,
    "topics": ["iobroker", "adapter", "test"],
    "license": {
        "key": "mit",
        "name": "MIT License"
    },
    "default_branch": "main"
};

// GitHub API response for repository with issues
const githubApiResponseWithIssues = {
    "name": "ioBroker.test-adapter",
    "full_name": "test/ioBroker.test-adapter",
    "description": null, // Missing description - E801
    "private": false,
    "archived": false,
    "topics": [], // Missing topics - E802
    "license": {
        "key": "mit",
        "name": "MIT License"
    },
    "default_branch": "main"
};

// README.md content for testing
const validReadmeContent = `# ioBroker.test-adapter

Test adapter for ioBroker

## Changelog

### 1.0.0 (2024-01-01)
- Initial release

## License

MIT License

Copyright (c) 2024 Test Author

Permission is hereby granted, free of charge, to any person obtaining a copy...`;

// README.md with issues
const readmeWithIssues = `# ioBroker.test-adapter

Test adapter for ioBroker

This README is missing required sections.`;

module.exports = {
    validPackageJson,
    invalidPackageJson,
    validIoPackageJson,
    invalidIoPackageJson,
    packageJsonWithDependencyIssues,
    packageJsonOldNode,
    ioPackageJsonMissingTranslations,
    validGithubApiResponse,
    githubApiResponseWithIssues,
    validReadmeContent,
    readmeWithIssues
};