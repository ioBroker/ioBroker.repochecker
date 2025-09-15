#!/usr/bin/env node
'use strict';

/**
 * Main test runner for ioBroker.repochecker
 * 
 * This script runs all tests for the repochecker modules and validates
 * that all error codes, warnings, and suggestions are properly triggered.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// Test directories to run
const testDirs = [
    'unit',
    'integration'
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

console.log('🧪 ioBroker.repochecker Test Suite');
console.log('=====================================');

async function runTests() {
    const testRoot = __dirname;
    
    for (const testDir of testDirs) {
        const fullTestDir = path.join(testRoot, testDir);
        
        if (!fs.existsSync(fullTestDir)) {
            console.log(`⚠️  Test directory ${testDir} not found, skipping...`);
            continue;
        }
        
        console.log(`\n📁 Running tests in ${testDir}/`);
        console.log('─'.repeat(50));
        
        const testFiles = fs.readdirSync(fullTestDir)
            .filter(file => file.endsWith('.test.js'))
            .sort();
        
        if (testFiles.length === 0) {
            console.log(`⚠️  No test files found in ${testDir}/`);
            continue;
        }
        
        for (const testFile of testFiles) {
            const testPath = path.join(fullTestDir, testFile);
            console.log(`\n🔍 Running ${testFile}...`);
            
            const result = await runTestFile(testPath);
            
            if (result.success) {
                console.log(`✅ ${testFile} passed (${result.tests} tests)`);
                passedTests += result.tests;
            } else {
                console.log(`❌ ${testFile} failed`);
                if (result.output) {
                    console.log(result.output);
                }
                failedTests += result.tests || 1;
            }
            
            totalTests += result.tests || 1;
        }
    }
    
    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Test Summary');
    console.log('═'.repeat(50));
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    
    if (failedTests === 0) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('\n💥 Some tests failed!');
        process.exit(1);
    }
}

function runTestFile(testPath) {
    return new Promise((resolve) => {
        const child = spawn('node', ['--test', testPath], {
            stdio: 'pipe',
            cwd: path.dirname(testPath)
        });
        
        let output = '';
        let error = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        child.on('close', (code) => {
            const allOutput = output + error;
            
            // Parse test results from Node.js test runner output
            const testCount = (allOutput.match(/# pass \d+/g) || [])
                .reduce((sum, match) => sum + parseInt(match.split(' ')[2]), 0);
            
            resolve({
                success: code === 0,
                tests: testCount || 1,
                output: code !== 0 ? allOutput : null
            });
        });
    });
}

// Run the tests
runTests().catch(console.error);