'use strict';

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');

const {
    ROOT_OBJECT_SCHEMA,
    ALLOWED_OBJECT_TYPES,
    HIERARCHY_TYPES,
    VALID_STATE_TYPES,
    STATE_SCHEMA,
    STATE_ROLE_RULES,
} = require('../lib/config_StateRoles');

const FORBIDDEN_ID_CHARS_REGEX = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;
const ID_SUGGESTION_REGEX = /[^a-zA-Z0-9_,-.]+/g;

for (const ambiguousRole of ['button', 'button.long']) {
    if (STATE_ROLE_RULES[ambiguousRole]) {
        delete STATE_ROLE_RULES[ambiguousRole].read;
        delete STATE_ROLE_RULES[ambiguousRole].write;
    }
}

function getValueType(value) {
    if (Array.isArray(value)) {
        return 'array';
    }

    if (value === null) {
        return 'null';
    }

    return typeof value;
}

function isPlainObject(value) {
    return getValueType(value) === 'object';
}

function isStringOrI18nObject(value) {
    if (typeof value === 'string') {
        return true;
    }

    if (!isPlainObject(value)) {
        return false;
    }

    const values = Object.values(value);
    return values.length > 0 && values.every(entry => typeof entry === 'string');
}

function matchesCommonType(value, commonType) {
    if (commonType === 'mixed') {
        return true;
    }

    if (commonType === 'array') {
        return Array.isArray(value);
    }

    if (commonType === 'boolean') {
        return typeof value === 'boolean';
    }

    if (commonType === 'number') {
        return typeof value === 'number' && Number.isFinite(value);
    }

    if (commonType === 'object') {
        return isPlainObject(value);
    }

    if (commonType === 'string' || commonType === 'file' || commonType === 'json') {
        return typeof value === 'string';
    }

    if (commonType === 'multistate') {
        return ['string', 'number', 'boolean'].includes(typeof value);
    }

    return false;
}

function createLogger(options = {}) {
    const reportLines = [];
    const levelOrder = { debug: 0, info: 1, warn: 2, error: 3 };
    const activeLevel = options.debug ? 'debug' : options.log ? 'info' : null;
    let warningCount = 0;
    let errorCount = 0;

    const emit = (level, code, message) => {
        if (level === 'debug' && !options.debug) {
            return;
        }

        if (level === 'info' && !options.log && !options.debug) {
            return;
        }

        if (level === 'warn') {
            warningCount += 1;
        } else if (level === 'error') {
            errorCount += 1;
        }

        const line = `[${level.toUpperCase()}] [${code}] ${message}`;
        reportLines.push(line);

        if (activeLevel && levelOrder[level] >= levelOrder[activeLevel]) {
            console.log(line);
        }
    };

    return {
        debug: message => emit('debug', 'DBG000', message),
        info:  message => emit('info',  'INF000', message),
        warn:  (code, message) => emit('warn',  code, message),
        error: (code, message) => emit('error', code, message),
        get warningCount() {
            return warningCount;
        },
        get errorCount() {
            return errorCount;
        },
        get reportLines() {
            return reportLines;
        },
    };
}

function createRoleRuleMaps() {
    const exactRules = new Map();
    const prefixRules = [];

    for (const [role, rule] of Object.entries(STATE_ROLE_RULES)) {
        if (role.endsWith('.')) {
            prefixRules.push({ prefix: role, rule });
        } else {
            exactRules.set(role, rule);
        }
    }

    return { exactRules, prefixRules };
}

function getRoleRule(role, roleRuleMaps) {
    if (roleRuleMaps.exactRules.has(role)) {
        return roleRuleMaps.exactRules.get(role);
    }

    for (const { prefix, rule } of roleRuleMaps.prefixRules) {
        if (role.startsWith(prefix)) {
            return rule;
        }
    }

    if (role.includes('.setting.')) {
        const roleWithoutSetting = role.replace('.setting.', '.');

        if (roleRuleMaps.exactRules.has(roleWithoutSetting)) {
            return roleRuleMaps.exactRules.get(roleWithoutSetting);
        }

        for (const { prefix, rule } of roleRuleMaps.prefixRules) {
            if (roleWithoutSetting.startsWith(prefix)) {
                return rule;
            }
        }
    }

    return null;
}

/**
 * Validates the common block of a state object against STATE_SCHEMA.
 *
 * STATE_SCHEMA keys are written as "common.<field>" so they document
 * the full object path. The bare field name (after the "common." prefix)
 * is used when reading values out of the `common` object.
 *
 * @param {string}  stateId      - Full object id, used in error messages.
 * @param {object}  common       - The common sub-object of the state.
 * @param {object}  logger       - Logger instance.
 * @param {object}  roleRuleMaps - Pre-built role rule maps.
 */
function validateStateCommon(stateId, common, logger, roleRuleMaps) {
    if (!isPlainObject(common)) {
        logger.error('E1001', `Object "${stateId}" common must be an object.`);
        return;
    }

    // Build a set of bare keys expected by the schema (strip "common." prefix).
    const schemaKeys = new Set(
        Object.keys(STATE_SCHEMA).map(k => k.slice('common.'.length))
    );

    const unsupportedKeys = Object.keys(common).filter(key => !schemaKeys.has(key));
    if (unsupportedKeys.length > 0) {
        logger.error('E1002', `Object "${stateId}" common contains unsupported keys: ${unsupportedKeys.join(', ')}`);
    }

    for (const [schemaKey, schema] of Object.entries(STATE_SCHEMA)) {
        // schemaKey is e.g. "common.role"; bareKey is "role"
        const bareKey = schemaKey.slice('common.'.length);
        const hasValue = Object.prototype.hasOwnProperty.call(common, bareKey);

        if (schema.required && !hasValue) {
            logger.error('E1003', `Object "${stateId}" common is missing required key "${schemaKey}".`);
            continue;
        }

        if (!hasValue) {
            continue;
        }

        const value = common[bareKey];

        if (schema.types && !schema.types.includes(getValueType(value))) {
            logger.error('E1004', `Object "${stateId}" "${schemaKey}" must be of type ${schema.types.join(' or ')}.`);
            continue;
        }

        if (schema.onlyForTypes && !schema.onlyForTypes.includes(common.type)) {
            logger.error('E1005', `Object "${stateId}" "${schemaKey}" is only allowed for common.type=${schema.onlyForTypes.join(' or ')}.`);
        }

        if (schema.matchesCommonType && common.type && !matchesCommonType(value, common.type)) {
            logger.error('E1006', `Object "${stateId}" "${schemaKey}" must match common.type "${common.type}".`);
        }

        if (schema.name && !isStringOrI18nObject(value)) {
            logger.error('E1007', `Object "${stateId}" "${schemaKey}" must be a string or i18n object.`);
        }

        if (schema.role) {
            const roleRule = getRoleRule(value, roleRuleMaps);
            if (!roleRule) {
                logger.error('E1008', `Object "${stateId}" has unknown role "${value}".`);
                continue;
            }

            if (Array.isArray(roleRule.types) && common.type && !roleRule.types.includes(common.type)) {
                logger.error('E1009', `Object "${stateId}" role "${value}" does not support common.type "${common.type}".`);
            }

            if (typeof roleRule.read === 'boolean' && common.read !== roleRule.read) {
                logger.error('E1010', `Object "${stateId}" role "${value}" requires common.read=${roleRule.read}.`);
            }

            if (typeof roleRule.write === 'boolean' && common.write !== roleRule.write) {
                logger.error('E1011', `Object "${stateId}" role "${value}" requires common.write=${roleRule.write}.`);
            }
        }
    }
}

function validateHierarchyObjectOrder(objectsById, idsToCheck, logger) {
    for (const objectId of idsToCheck) {
        const levels = objectId.split('.');
        const chain = [];

        for (let index = 3; index <= levels.length; index++) {
            const levelId = levels.slice(0, index).join('.');
            const levelObject = objectsById[levelId];

            if (!levelObject) {
                continue;
            }

            chain.push({ id: levelId, type: levelObject.type });
        }

        const containsHierarchyType = chain.some(entry => HIERARCHY_TYPES.has(entry.type));
        if (containsHierarchyType && chain.some(entry => !HIERARCHY_TYPES.has(entry.type))) {
            logger.error('E2001', `Object "${objectId}" hierarchy contains non hierarchy object types.`);
        }

        const deviceCount = chain.filter(entry => entry.type === 'device').length;
        if (deviceCount > 1) {
            logger.error('E2002', `Object "${objectId}" hierarchy contains more than one device.`);
        }

        const firstChannelIndex = chain.findIndex(entry => entry.type === 'channel');
        if (firstChannelIndex !== -1 && chain.slice(firstChannelIndex + 1).some(entry => entry.type === 'device')) {
            logger.error('E2003', `Object "${objectId}" hierarchy contains a device after a channel.`);
        }

        for (let index = 0; index < chain.length - 1; index++) {
            if (chain[index].type === 'state') {
                logger.error('E2004', `Object "${objectId}" has a state object "${chain[index].id}" with children.`);
                break;
            }
        }
    }
}

function validateObjectDump(data, options = {}) {
    const logger = createLogger(options);
    const roleRuleMaps = createRoleRuleMaps();

    if (!isPlainObject(data)) {
        logger.error('E3001', 'Input JSON must contain an object at root level.');
        return { logger, relevantIds: [], objectsById: {} };
    }

    const entries = Object.entries(data);
    logger.info(`Loaded ${entries.length} root objects.`);

    for (const [rootKey, rootObject] of entries) {
        if (!isPlainObject(rootObject) || rootObject._id !== rootKey) {
            logger.error('E3002', `Root object "${rootKey}" is invalid: expected object with matching _id.`);
        }
    }

    if (logger.errorCount > 0) {
        logger.error('E3003', 'Input is not a valid ioBroker object dump. Processing aborted.');
        return { logger, relevantIds: [], objectsById: data };
    }

    const relevantIds = [];

    for (const [objectId, objectData] of entries) {
        logger.debug(`Processing object "${objectId}".`);

        for (const [requiredKey, expectedType] of Object.entries(ROOT_OBJECT_SCHEMA)) {
            if (!Object.prototype.hasOwnProperty.call(objectData, requiredKey)) {
                logger.error('E3004', `Object "${objectId}" is missing required key "${requiredKey}".`);
                continue;
            }

            const actualType = getValueType(objectData[requiredKey]);
            if (actualType !== expectedType) {
                logger.error('E3005', `Object "${objectId}" key "${requiredKey}" must be type ${expectedType}, got ${actualType}.`);
            }
        }

        const unsupportedKeys = Object.keys(objectData).filter(key => !Object.prototype.hasOwnProperty.call(ROOT_OBJECT_SCHEMA, key));
        if (unsupportedKeys.length > 0) {
            logger.error('E3006', `Object "${objectId}" contains unsupported keys: ${unsupportedKeys.join(', ')}`);
        }

        if (!ALLOWED_OBJECT_TYPES.has(objectData.type)) {
            logger.error('E3007', `Object "${objectId}" has unknown type "${objectData.type}".`);
        }

        if (HIERARCHY_TYPES.has(objectData.type)) {
            relevantIds.push(objectId);
        }

        FORBIDDEN_ID_CHARS_REGEX.lastIndex = 0;
        if (FORBIDDEN_ID_CHARS_REGEX.test(objectId)) {
            const sanitizedId = objectId.replace(FORBIDDEN_ID_CHARS_REGEX, '');
            logger.error('E3008', `Object id "${objectId}" contains forbidden characters. Suggested cleaned id: "${sanitizedId}".`);
        }

        const suggestionMatches = objectId.match(ID_SUGGESTION_REGEX);
        if (suggestionMatches) {
            const uniqueChars = [...new Set(suggestionMatches.join('').split(''))].join('');
            logger.warn('W3001', `Object id "${objectId}" contains non [a-zA-Z0-9_,-] characters (${uniqueChars}). Consider removing them.`);
        }
    }

    for (const objectId of relevantIds) {
        const levels = objectId.split('.');

        // start with index 3 to skip adaptername and instance number
        for (let index = 3; index < levels.length; index++) {
            const prefix = levels.slice(0, index).join('.');
            if (!Object.prototype.hasOwnProperty.call(data, prefix)) {
                logger.error('E3009', `Object "${objectId}" is missing intermediate object "${prefix}".`);
            }
        }
    }

    validateHierarchyObjectOrder(data, relevantIds, logger);

    for (const objectId of relevantIds) {
        const objectData = data[objectId];

        if (objectData.type !== 'state') {
            continue;
        }

        const common = objectData.common;

        if (!isPlainObject(common) || !Object.prototype.hasOwnProperty.call(common, 'type')) {
            logger.error('E3010', `State object "${objectId}" must define common.type.`);
            continue;
        }

        if (!VALID_STATE_TYPES.has(common.type)) {
            logger.error('E3011', `State object "${objectId}" has invalid common.type "${common.type}".`);
        }

        validateStateCommon(objectId, common, logger, roleRuleMaps);
    }

    return { logger, relevantIds, objectsById: data };
}

function createReportPath(filePath) {
    const directory = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    return path.join(directory, `${baseName}_report.txt`);
}

function checkObjectStructure(filePath, options = {}) {
    const preLogger = createLogger(options);

    const baseName = path.basename(filePath);
    const adapterName = options.adapter;
    const filenamePattern = /^(?<adapter>[a-zA-Z0-9_-]+)\.(?<instance>\d+)\.json$/;
    const filenameMatch = baseName.match(filenamePattern);

    if (!filenameMatch) {
        preLogger.warn('W0001', `Filename "${baseName}" does not match required pattern <adapter>.<instance>.json.`);
    } else {
        const { adapter } = filenameMatch.groups;

        if (adapterName && adapter !== adapterName) {
            preLogger.warn('W0002', `Filename adapter "${adapter}" does not match --adapter "${adapterName}".`);
        }
    }

    const reportPath = createReportPath(filePath);

    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        preLogger.info('Input file is valid JSON.');
    } catch (error) {
        preLogger.error('E0001', `Input file is not valid JSON: ${error.message}`);

        const reportLines = [
            `File: ${filePath}`,
            `Adapter: ${adapterName || '<not set>'}`,
            ...preLogger.reportLines,
            '',
            `Summary: errors=${preLogger.errorCount}, warnings=${preLogger.warningCount}`,
        ];

        fs.writeFileSync(reportPath, `${reportLines.join('\n')}\n`, 'utf8');
        return { reportPath, errorCount: preLogger.errorCount, warningCount: preLogger.warningCount };
    }

    const validationResult = validateObjectDump(parsed, options);
    const errorCount = preLogger.errorCount + validationResult.logger.errorCount;
    const warningCount = preLogger.warningCount + validationResult.logger.warningCount;

    const reportLines = [
        `File: ${filePath}`,
        `Adapter: ${adapterName || '<not set>'}`,
        ...preLogger.reportLines,
        ...validationResult.logger.reportLines,
        '',
        `Summary: errors=${errorCount}, warnings=${warningCount}`,
    ];

    fs.writeFileSync(reportPath, `${reportLines.join('\n')}\n`, 'utf8');
    return { reportPath, errorCount, warningCount };
}

function runFromCommandLine(argv = process.argv.slice(2)) {
    const args = minimist(argv, {
        boolean: ['log', 'debug'],
        string: ['adapter'],
    });

    const filePath = args._[0];

    if (!filePath) {
        console.error('Usage: npm run checkObjectStructure -- <filename.json> --adapter <adapterName> [--log] [--debug]');
        process.exitCode = 1;
        return;
    }

    const absolutePath = path.resolve(process.cwd(), filePath);
    const { reportPath, errorCount } = checkObjectStructure(absolutePath, {
        adapter: args.adapter,
        log: args.log,
        debug: args.debug,
    });

    console.log(`Report written to ${reportPath}`);
    process.exitCode = errorCount > 0 ? 1 : 0;
}

if (require.main === module) {
    runFromCommandLine();
}

module.exports = {
    checkObjectStructure,
    createReportPath,
    validateObjectDump,
};
