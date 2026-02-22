'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Adapter Code
    Numbering   :   5500 - 5999

    Extension to check jsonConfig

*/

/*

  Open questions:
  - should HEADER have size attributes ?

*/

const common = require('./common.js');

let responsiveErrorLimit = 5;
let responsiveWarningLimit = 5;

const DEFAULT_MIN_ADMIN = '7.6.17';

const stdAttributes = [
    'xl',
    'lg',
    'md',
    'sm',
    'xs',

    'darkStyle',
    'default',
    'defaultFunc',
    'disabled',
    'doNotSave',
    'expertMode',
    'help',
    'helpLink',
    'hidden',
    'hideOnlyControl',
    'label',
    'newLine',
    'noMultiEdit',
    'noTranslation',
    'onChange',
    'placeholder',
    'style',
    'tooltip',
    'validator',
    'validatorErrorText',
    'validatorNoSaveOnError',

    '#include',
];

const validComponents = {
    accordion: { function: check_accordion, minAdmin: DEFAULT_MIN_ADMIN },
    alive: { function: check_alive, minAdmin: DEFAULT_MIN_ADMIN },
    autocomplete: { function: check_autocomplete, minAdmin: DEFAULT_MIN_ADMIN },
    autocompleteSendTo: { function: check_autocompleteSendTo, minAdmin: DEFAULT_MIN_ADMIN },

    certificate: { function: check_certificate, minAdmin: DEFAULT_MIN_ADMIN },
    certificates: { function: check_certificates, minAdmin: DEFAULT_MIN_ADMIN },
    certificateCollection: { function: check_certificateCollection, minAdmin: DEFAULT_MIN_ADMIN },
    checkbox: { function: check_checkbox, minAdmin: DEFAULT_MIN_ADMIN },
    checkDocker: { function: check_checkDocker, minAdmin: DEFAULT_MIN_ADMIN },
    checkLicense: { function: check_checkLicense, minAdmin: DEFAULT_MIN_ADMIN },
    chips: { function: check_chips, minAdmin: DEFAULT_MIN_ADMIN },
    color: { function: check_color, minAdmin: DEFAULT_MIN_ADMIN },
    coordinates: { function: check_coordinates, minAdmin: DEFAULT_MIN_ADMIN },
    cron: { function: check_cron, minAdmin: DEFAULT_MIN_ADMIN },
    custom: { function: check_custom, minAdmin: DEFAULT_MIN_ADMIN },
    datePicker: { function: check_datePicker, minAdmin: DEFAULT_MIN_ADMIN },
    deviceManager: { function: check_deviceManager, minAdmin: DEFAULT_MIN_ADMIN },
    divider: { function: check_divider, minAdmin: DEFAULT_MIN_ADMIN },

    file: { function: check_file, minAdmin: DEFAULT_MIN_ADMIN },
    fileSelector: { function: check_fileSelector, minAdmin: DEFAULT_MIN_ADMIN },
    func: { function: check_func, minAdmin: DEFAULT_MIN_ADMIN },

    header: { function: check_header, minAdmin: DEFAULT_MIN_ADMIN },

    image: { function: check_image, minAdmin: DEFAULT_MIN_ADMIN },
    imageSendTo: { function: check_imageSendTo, minAdmin: DEFAULT_MIN_ADMIN },
    infoBox: { function: check_infoBox, minAdmin: DEFAULT_MIN_ADMIN },
    instance: { function: check_instance, minAdmin: DEFAULT_MIN_ADMIN },
    interface: { function: check_interface, minAdmin: DEFAULT_MIN_ADMIN },
    ip: { function: check_ip, minAdmin: DEFAULT_MIN_ADMIN },

    jsonEditor: { function: check_jsonEditor, minAdmin: DEFAULT_MIN_ADMIN },

    language: { function: check_language, minAdmin: DEFAULT_MIN_ADMIN },
    license: { function: check_license, minAdmin: DEFAULT_MIN_ADMIN },

    number: { function: check_number, minAdmin: DEFAULT_MIN_ADMIN },

    objectId: { function: check_objectId, minAdmin: DEFAULT_MIN_ADMIN },

    password: { function: check_password, minAdmin: DEFAULT_MIN_ADMIN },
    pattern: { function: check_pattern, minAdmin: DEFAULT_MIN_ADMIN },
    port: { function: check_port, minAdmin: DEFAULT_MIN_ADMIN },

    qrCode: { function: check_qrCode, minAdmin: DEFAULT_MIN_ADMIN },

    room: { function: check_room, minAdmin: DEFAULT_MIN_ADMIN },

    select: { function: check_select, minAdmin: DEFAULT_MIN_ADMIN },
    selectSendTo: { function: check_selectSendTo, minAdmin: DEFAULT_MIN_ADMIN },
    sendTo: { function: check_sendTo, minAdmin: DEFAULT_MIN_ADMIN },
    setState: { function: check_setState, minAdmin: DEFAULT_MIN_ADMIN },
    slider: { function: check_slider, minAdmin: DEFAULT_MIN_ADMIN },
    state: { function: check_state, minAdmin: DEFAULT_MIN_ADMIN },
    staticImage: { function: check_staticImage, minAdmin: DEFAULT_MIN_ADMIN },
    staticLink: { function: check_staticLink, minAdmin: DEFAULT_MIN_ADMIN },
    staticText: { function: check_staticText, minAdmin: DEFAULT_MIN_ADMIN },

    table: { function: check_table, minAdmin: DEFAULT_MIN_ADMIN },
    text: { function: check_text, minAdmin: DEFAULT_MIN_ADMIN },
    textSendTo: { function: check_textSendTo, minAdmin: DEFAULT_MIN_ADMIN },
    timePicker: { function: check_timePicker, minAdmin: DEFAULT_MIN_ADMIN },

    user: { function: check_user, minAdmin: DEFAULT_MIN_ADMIN },
    uuid: { function: check_uuid, minAdmin: DEFAULT_MIN_ADMIN },
};

function handleResponsiveError(context, msg) {
    if (responsiveErrorLimit) {
        context.errors.push(`${msg}`);
        responsiveErrorLimit--;
        if (responsiveErrorLimit === 0) {
            context.errors.push(
                `[E5510] responsive check: maximum issues reached, please fix reported ones and recheck`,
            );
        }
    }
}

function handleResponsiveWarning(context, msg) {
    if (responsiveWarningLimit) {
        context.warnings.push(`${msg}`);
        responsiveWarningLimit--;
        if (responsiveWarningLimit === 0) {
            context.warnings.push(
                `[W5510] responsive check: maximum issues reached, please fix reported ones and recheck`,
            );
        }
    }
}

function chk_responsive(context, path, jsonConfig, component, opts) {
    common.debug(`chk_responsive ${path}`);

    opts = opts || {};

    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'];

    common.debug(`json check for ${path}`);
    if (!opts.sizesOptional) {
        const missing = [];
        for (const size of sizes) {
            common.debug(`    ${size} : ${jsonConfig[size]}`);
            if (!jsonConfig[size]) {
                missing.push(size);
            }
        }
        if (missing.length) {
            handleResponsiveError(
                context,
                `[E5507] missing size attributes [${missing.join(',')}] for ${component} at ${path}`,
            );
        }
    }

    for (const size of sizes) {
        if (jsonConfig[size] !== undefined && (jsonConfig[size] > 12 || jsonConfig[size] <= 0)) {
            handleResponsiveError(
                context,
                `[E5511] invalid size attributes "${size}":"${jsonConfig[size]}" for ${component} at ${path}. Value must be 1 to 12.`,
            );
        }
    }

    if (!opts.sizesOptional && jsonConfig.xs && jsonConfig.xs != 12) {
        handleResponsiveWarning(
            context,
            `[W5508] attribute "xs" for ${component} should specify a value of "12" at ${path}`,
        );
    }

    let ii = 12;
    if (jsonConfig.xs) {
        ii = jsonConfig.xs;
    }
    if (jsonConfig.sm && jsonConfig.sm > ii) {
        handleResponsiveError(
            context,
            `[E5509] "sm" value (${jsonConfig.sm}) for ${component} greater then value for smaller displays at ${path}`,
        );
    } else {
        ii = jsonConfig.sm;
    }
    if (jsonConfig.md && jsonConfig.md > ii) {
        handleResponsiveError(
            context,
            `[E5509] "md" value (${jsonConfig.md}) for ${component} greater then value for smaller displays at ${path}`,
        );
    } else {
        ii = jsonConfig.md;
    }
    if (jsonConfig.lg && jsonConfig.lg > ii) {
        handleResponsiveError(
            context,
            `[E5509] "lg" value (${jsonConfig.lg}) for ${component} greater then value for smaller displays at ${path}`,
        );
    } else {
        ii = jsonConfig.lg;
    }
    if (jsonConfig.xl && jsonConfig.xl > ii) {
        handleResponsiveError(
            context,
            `[E5509] "xl" value (${jsonConfig.xl}) for ${component} greater then value for smaller displays at ${path}`,
        );
    }
}

function check_accordion(context, path, jsonConfig, _inTable) {
    common.debug(`check_accordion ${path}`);
    chk_responsive(context, path, jsonConfig, 'accordion');
}

function check_alive(context, path, jsonConfig, _inTable) {
    common.debug(`check_alive ${path}`);
    chk_responsive(context, path, jsonConfig, 'alive');
}

function check_autocomplete(context, path, jsonConfig, _inTable) {
    common.debug(`check_autocomplete ${path}`);
    chk_responsive(context, path, jsonConfig, 'autocomplete');
}

function check_autocompleteSendTo(context, path, jsonConfig, _inTable) {
    common.debug(`check_autocompleteSendTo ${path}`);
    chk_responsive(context, path, jsonConfig, 'autocompleteSendTo');
}

function check_certificate(context, path, jsonConfig, _inTable) {
    common.debug(`check_certificate ${path}`);
    chk_responsive(context, path, jsonConfig, 'certificate');
}

function check_certificates(context, path, jsonConfig, _inTable) {
    common.debug(`check_certificates ${path}`);
    chk_responsive(context, path, jsonConfig, 'certificates');
}

function check_certificateCollection(context, path, jsonConfig, _inTable) {
    common.debug(`check_certificateCollection ${path}`);
    chk_responsive(context, path, jsonConfig, 'certificateCollection');
}

function check_checkbox(context, path, jsonConfig, _inTable) {
    common.debug(`check_checkbox ${path}`);
    chk_responsive(context, path, jsonConfig, 'checkbox');
}

function check_checkLicense(context, path, jsonConfig, _inTable) {
    common.debug(`check_checkLicense ${path}`);
    chk_responsive(context, path, jsonConfig, 'checkLicense');
}

function check_checkDocker(context, path, jsonConfig, _inTable) {
    common.debug(`check_checkDocker ${path}`);
    chk_responsive(context, path, jsonConfig, 'checkDocker', { sizesOptional: true });
}

function check_chips(context, path, jsonConfig, _inTable) {
    common.debug(`check_chips ${path}`);
    chk_responsive(context, path, jsonConfig, 'chips');
}

function check_color(context, path, jsonConfig, _inTable) {
    common.debug(`check_color ${path}`);
    chk_responsive(context, path, jsonConfig, 'color');
}

function check_coordinates(context, path, jsonConfig, _inTable) {
    common.debug(`check_coordinates ${path}`);
    chk_responsive(context, path, jsonConfig, 'coordinates');
}

function check_cron(context, path, jsonConfig, _inTable) {
    common.debug(`check_cron ${path}`);
    chk_responsive(context, path, jsonConfig, 'cron');
}

function check_custom(context, path, jsonConfig, _inTable) {
    common.debug(`check_custom ${path}`);
    chk_responsive(context, path, jsonConfig, 'custom', { sizesOptional: true });
}

function check_datePicker(context, path, jsonConfig, _inTable) {
    common.debug(`check_datePicker ${path}`);
    chk_responsive(context, path, jsonConfig, 'datePicker');
}

function check_deviceManager(context, path, jsonConfig, _inTable) {
    common.debug(`check_deviceManager ${path}`);
    chk_responsive(context, path, jsonConfig, 'deviceManager', { sizesOptional: true });
}

function check_divider(context, path, jsonConfig, _inTable) {
    common.debug(`check_divider ${path}`);
    chk_responsive(context, path, jsonConfig, 'divider', { sizesOptional: true });
}

function check_file(context, path, jsonConfig, _inTable) {
    common.debug(`check_file ${path}`);
    chk_responsive(context, path, jsonConfig, 'file');
}

function check_fileSelector(context, path, jsonConfig, _inTable) {
    common.debug(`check_fileSelector ${path}`);
    chk_responsive(context, path, jsonConfig, 'fileSelector');
}

function check_func(context, path, jsonConfig, _inTable) {
    common.debug(`check_func ${path}`);
    chk_responsive(context, path, jsonConfig, 'func');
}

function check_header(context, path, jsonConfig, _inTable) {
    common.debug(`check_header ${path}`);
    chk_responsive(context, path, jsonConfig, 'header', { sizesOptional: true });
}

function check_image(context, path, jsonConfig, _inTable) {
    common.debug(`check_image ${path}`);
    chk_responsive(context, path, jsonConfig, 'image');
}

function check_imageSendTo(context, path, jsonConfig, _inTable) {
    common.debug(`check_imageSendTo ${path}`);
    chk_responsive(context, path, jsonConfig, 'imageSendTo');
}

function check_instance(context, path, jsonConfig, _inTable) {
    common.debug(`check_instance ${path}`);
    chk_responsive(context, path, jsonConfig, 'instance');
}

function check_interface(context, path, jsonConfig, _inTable) {
    common.debug(`check_interface ${path}`);
    chk_responsive(context, path, jsonConfig, 'interface');
}

function check_ip(context, path, jsonConfig, _inTable) {
    common.debug(`check_ip ${path}`);
    chk_responsive(context, path, jsonConfig, 'ip');
}

function check_infoBox(context, path, jsonConfig, _inTable) {
    common.debug(`check_infoBox ${path}`);
    chk_responsive(context, path, jsonConfig, 'infoBox', { sizesOptional: true });
}

function check_jsonEditor(context, path, jsonConfig, _inTable) {
    common.debug(`check_jsonEditor ${path}`);
    chk_responsive(context, path, jsonConfig, 'jsonEditor');
}

function check_language(context, path, jsonConfig, _inTable) {
    common.debug(`check_language ${path}`);
    chk_responsive(context, path, jsonConfig, 'language');
}

function check_license(context, path, jsonConfig, _inTable) {
    common.debug(`check_license ${path}`);
    chk_responsive(context, path, jsonConfig, 'license');
}

function check_number(context, path, jsonConfig, _inTable) {
    common.debug(`check_number ${path}`);
    chk_responsive(context, path, jsonConfig, 'number');
}

function check_objectId(context, path, jsonConfig, _inTable) {
    common.debug(`check_objectId ${path}`);
    chk_responsive(context, path, jsonConfig, 'objectId');
}

function check_password(context, path, jsonConfig, _inTable) {
    common.debug(`check_password ${path}`);
    chk_responsive(context, path, jsonConfig, 'password');
}

function check_pattern(context, path, jsonConfig, _inTable) {
    common.debug(`check_pattern ${path}`);
    chk_responsive(context, path, jsonConfig, 'pattern');
}

function check_port(context, path, jsonConfig, _inTable) {
    common.debug(`check_port ${path}`);
    chk_responsive(context, path, jsonConfig, 'port');
}

function check_qrCode(context, path, jsonConfig, _inTable) {
    common.debug(`check_qrCode ${path}`);
    chk_responsive(context, path, jsonConfig, 'qrCode');
}

function check_room(context, path, jsonConfig, _inTable) {
    common.debug(`check_room ${path}`);
    chk_responsive(context, path, jsonConfig, 'room');
}

function check_select(context, path, jsonConfig, _inTable) {
    common.debug(`check_select ${path}`);
    chk_responsive(context, path, jsonConfig, 'select');
}

function check_selectSendTo(context, path, jsonConfig, _nTable) {
    common.debug(`check_selectSendTo ${path}`);
    chk_responsive(context, path, jsonConfig, 'selectSendTo');
}

function check_sendTo(context, path, jsonConfig, _inTable) {
    common.debug(`check_sendTo ${path}`);
    chk_responsive(context, path, jsonConfig, 'sendTo');
}

function check_setState(context, path, jsonConfig, _inTable) {
    common.debug(`check_setState ${path}`);
    chk_responsive(context, path, jsonConfig, 'setState');
}

function check_slider(context, path, jsonConfig, _inTable) {
    common.debug(`check_slider ${path}`);
    chk_responsive(context, path, jsonConfig, 'slider');
}

function check_state(context, path, jsonConfig, _inTable) {
    common.debug(`check_state ${path}`);
    chk_responsive(context, path, jsonConfig, 'state');
}

function check_staticImage(context, path, jsonConfig, _inTable) {
    common.debug(`check_staticImage ${path}`);
    chk_responsive(context, path, jsonConfig, 'staticImage', { sizesOptional: true });
}

function check_staticLink(context, path, jsonConfig, _inTable) {
    common.debug(`check_staticLink ${path}`);
    chk_responsive(context, path, jsonConfig, 'staticLink');
}

function check_staticText(context, path, jsonConfig, _inTable) {
    common.debug(`check_staticText ${path}`);
    chk_responsive(context, path, jsonConfig, 'staticText');
}

function check_table(context, path, jsonConfig, _inTable) {
    common.debug(`check_table ${path}`);
    chk_responsive(context, path, jsonConfig, 'table');
}

function check_text(context, path, jsonConfig, _inTable) {
    common.debug(`check_text ${path}`);
    chk_responsive(context, path, jsonConfig, 'text');
}

function check_textSendTo(context, path, jsonConfig, _inTable) {
    common.debug(`check_textSendTo ${path}`);
    chk_responsive(context, path, jsonConfig, 'testSendTo');
}

function check_timePicker(context, path, jsonConfig, _inTable) {
    common.debug(`check_timePicker ${path}`);
    chk_responsive(context, path, jsonConfig, 'timePicker');
}

function check_user(context, path, jsonConfig, _inTable) {
    common.debug(`check_user ${path}`);
    chk_responsive(context, path, jsonConfig, 'user');
}

function check_uuid(context, path, jsonConfig, _inTable) {
    common.debug(`check_uuid ${path}`);
    chk_responsive(context, path, jsonConfig, 'uuid');
}

function checkComponent(context, path, jsonConfig) {
    common.debug(`checkComponent (${path})`);

    const type = jsonConfig.type;
    if (!type) {
        context.errors.push(`[E5502] no type specified at ${path}`);
    }
    common.debug(`  type ${type}`);

    if (validComponents[type] === undefined) {
        context.errors.push(`[E5504] unexpected component "${type}" detected at ${path}`);
    } else if (typeof validComponents[type].function === 'function') {
        validComponents[type].function(context, path, jsonConfig, false);
    } else {
        common.debug(`no checks defined for component ${type}`);
    }
}

function checkPanel(context, path, jsonConfig, isRoot) {
    common.debug(`checkPanel(${path})`);

    const rootAttributes = ['i18n'];

    const myAttributes = ['type', 'collapsable', 'color', 'icon', 'innerStyle', 'items', 'label'];

    //console.log('on PANEL entry');
    //console.log(jsonConfig);

    const validAttributes = stdAttributes.concat(myAttributes).concat(isRoot ? rootAttributes : []);

    for (const key in jsonConfig) {
        common.debug(`  scanning ${key}`);

        if (!validAttributes.includes(key)) {
            context.errors.push(`[E5503] unexpected type "${key}" detected at ${path}`);
        }

        if (key === 'type') {
            if (jsonConfig[key] !== 'panel') {
                console.log(`INTERNAL ERROR: unexpected type ${jsonConfig[key]} encountered while scanning "panel"`);
                return;
            }
        }

        if (key === 'items') {
            for (const subkey in jsonConfig['items']) {
                const type = jsonConfig['items'][subkey].type;
                common.debug(`  item ${subkey} / ${type}`);
                if (!type) {
                    context.errors.push(`[E5502] no type specified at ${path}`);
                }

                if (type === 'panel') {
                    common.debug(`nested panel detected at ${path}/${subkey}`);
                    checkPanel(context, `${path}/${subkey}/items`, jsonConfig[key][subkey]);
                } else {
                    checkComponent(context, `${path}/${subkey}`, jsonConfig['items'][subkey]);
                }
            }
        }
    }
}

function checkTabs(context, path, jsonConfig) {
    common.debug(`${path}`);

    // const validTypes = [
    //     'panel'
    // ];

    // const validAttributes = [
    //     'type',

    //     'collapsable',
    //     'color',
    //     'icon',
    //     'iconPosition',
    // ];

    for (const key in jsonConfig) {
        common.debug(`  scanning ${key}`);

        const type = jsonConfig[key].type;
        common.debug(`  item ${key} / ${type}`);
        if (!type) {
            context.errors.push(`[E5502] no type specified at ${path}; expected "panel"`);
        }
        if (type !== 'panel') {
            context.errors.push(`[E5503] unexpected type "${key}" detected at ${path}; expected "panel"`);
        } else {
            checkPanel(context, `${path}/${key}`, jsonConfig[key]);
        }
    }
}

//main entry
function checkJsonConfig(context, path, jsonConfig) {
    common.debug(`checkCode_jsonConfig({context}, ${path}, {jsonConfig}`);

    const commonAttributes = ['i18n', 'items', 'type'];

    const panelAttributes = ['collapsable', 'color', 'icon', 'innerStyle', 'label'];

    const tabsAttributes = ['iconPosition', 'tabsStyle'];

    const validTypes = ['panel', 'tabs'];

    let baseType = 'panel';
    if (!jsonConfig['type']) {
        console.log(`*ERROR* base type (panel / tabs) not specified`);
    } else {
        baseType = jsonConfig['type'];
        common.debug(`  base type ${baseType}`);
        if (!validTypes.includes(baseType)) {
            context.errors.push(`[E5500] unexpected base type "!${baseType}" detected at ${path}`);
        }
    }

    let validAttributes = commonAttributes;
    if (baseType === 'panel') {
        validAttributes = validAttributes.concat(panelAttributes);
    }
    if (baseType === 'tabs') {
        validAttributes = validAttributes.concat(tabsAttributes);
    }

    for (const key in jsonConfig) {
        common.debug(``);
        common.debug(`scanning base attribute ${key}`);
        if (!validAttributes.includes(key)) {
            context.errors.push(`[E5501] unexpected attribute "${key}" detected at ${path}`);
        }
        if (key === 'items') {
            if (baseType == 'panel') {
                checkPanel(context, `${path}/items`, jsonConfig, true);
            } else if (baseType == 'tabs') {
                checkTabs(context, `${path}/items`, jsonConfig['items'], false);
            }
        }
    }

    return;
}

exports.checkJsonConfig = checkJsonConfig;

// List of error and warnings used at this module
// ----------------------------------------------

// [5500] unexpected base type "!${baseType}" detected at ${path}
// [5501] unexpected attribute "${key}" detected at ${path}
// [5502] no type specified at ${path}
// [5503] unexpected type "${key}" detected at ${path}
// [5504] unexpected component "${type}" detected at ${path}
// [5505]
// [5506]
// [5507] responsive check: missing size attributes [${missing.join(',')}] at ${path}
// [5508] responsive check: attribute "xs" should specify a value of "12" at ${path}
// [5509] responsive check: "sm" value (${jsonConfig.sm}) greater then value for smaller displays
// [5510] responsive check: maximum issues reached, please fix reported ones and recheck
// [5511] invalid size attributes "${size}":"${jsonConfig[size]}" for ${component} at ${path}. Value must be 1 to 12.
