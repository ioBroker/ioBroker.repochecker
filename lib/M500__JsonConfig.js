/* eslint-disable no-unused-vars */
'use strict';
/*
    This module is a support module for iobroker.repochecker

    Area checked:   Adapter Code
    Numbering   :   500 - 599

    Extension to check jsonConfig

*/

/*

  Open questions:
  - should HEADER have size attributes ?

*/

const common = require('./common.js');

let responsiveErrorLimit = 5;

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

    '#include'
];

const validComponents = {
    'accordion':check_accordion,
    'alive': check_alive,
    'autocomplete': check_autocomplete,
    'autocompleteSendTo': check_autocompleteSendTo,

    'certificate': check_certificate,
    'certificates': check_certificates,
    'certificateCollection': check_certificateCollection,
    'checkbox': check_checkbox,
    'checkLicense': check_checkLicense,
    'chips': check_chips,
    'color': check_color,
    'coordinates': check_coordinates,
    'cron': check_cron,
    'custom': check_custom,
    'datePicker': check_datePicker,
    'deviceManager': check_deviceManager,
    'divider': check_divider,

    'file': check_file,
    'fileSelector': check_fileSelector,
    'func': check_func,

    'header': check_header,

    'image': check_image,
    'imageSendTo': check_imageSendTo,
    'instance': check_instance,
    'interface': check_interface,
    'ip': check_ip,

    'jsonEditor': check_jsonEditor,

    'language': check_language,
    'license': check_license,

    'number': check_number,

    'objectId': check_objectId,

    'password': check_password,
    'pattern': check_pattern,
    'port': check_port,

    'qrCode': check_qrCode,

    'room': check_room,

    'select': check_select,
    'selectSendTo': check_selectSendTo,
    'sendTo': check_sendTo,
    'setState': check_setState,
    'slider': check_slider,
    'state': check_state,
    'staticImage': check_staticImage,
    'staticLink': check_staticLink,
    'staticText': check_staticText,

    'table': check_table,
    'text': check_text,
    'textSendTo': check_textSendTo,
    'timePicker': check_timePicker,

    'user': check_user,
    'uuid': check_uuid,
};

function handleResponsiveError(context, msg) {
    if (responsiveErrorLimit) {
        context.errors.push(`${msg}`);
        responsiveErrorLimit--;
        if (responsiveErrorLimit === 0) {
            context.errors.push(`[E510] responsive check: maximum issues reached, please fix reported ones and recheck`);
        }
    }
}

function chk_responsive (context, path, jsonConfig){
    common.debug(`chk_responsive ${path}`);
    const missing = [];
    if (!jsonConfig.xs) missing.push('xs');
    if (!jsonConfig.sm) missing.push('sm');
    if (!jsonConfig.md) missing.push('md');
    if (!jsonConfig.lg) missing.push('lg');
    if (!jsonConfig.xl) missing.push('xl');
    if (missing.length) {
        handleResponsiveError(context, `[E507] responsive check: missing size attributes [${missing.join(',')}] at ${path}`);
    }

    if ( jsonConfig.xs && jsonConfig.xs != 12) {
        handleResponsiveError(context, `[E508] responsive check: attribute "xs" should specify a value of "12" at ${path}`);
    }

    let ii = 12;
    if (jsonConfig.xs) ii = jsonConfig.xs;
    if (jsonConfig.sm && jsonConfig.sm > ii ) {
        handleResponsiveError(context, `[E509] responsive check: "sm" value (${jsonConfig.sm}) greater then value for smaller displays`);
    } else {
        ii = jsonConfig.sm;
    }
    if (jsonConfig.md && jsonConfig.md > ii ) {
        handleResponsiveError(context, `[E509] responsive check: "md" value (${jsonConfig.md}) greater then value for smaller displays`);
    } else {
        ii = jsonConfig.md;
    }
    if (jsonConfig.lg && jsonConfig.lg > ii ) {
        handleResponsiveError(context, `[E509] responsive check: "lg" value (${jsonConfig.lg}) greater then value for smaller displays`);
    } else {
        ii = jsonConfig.lg;
    }
    if (jsonConfig.xl && jsonConfig.xl > ii ) {
        handleResponsiveError(context, `[E509] responsive check: "xl" value (${jsonConfig.xl}) greater then value for smaller displays`);
    }
}

function check_accordion (context, path, jsonConfig, inTable){
    common.debug(`check_accordion ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_alive(context, path, jsonConfig, inTable){
    common.debug(`check_alive ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_autocomplete(context, path, jsonConfig, inTable){
    common.debug(`check_autocomplete ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_autocompleteSendTo(context, path, jsonConfig, inTable){
    common.debug(`check_autocompleteSendTo ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_certificate(context, path, jsonConfig, inTable){
    common.debug(`check_certificate ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_certificates(context, path, jsonConfig, inTable){
    common.debug(`check_certificates ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_certificateCollection(context, path, jsonConfig, inTable){
    common.debug(`check_certificateCollection ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_checkbox(context, path, jsonConfig, inTable){
    common.debug(`check_checkbox ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_checkLicense(context, path, jsonConfig, inTable){
    common.debug(`check_checkLicense ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_chips(context, path, jsonConfig, inTable){
    common.debug(`check_chips ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_color(context, path, jsonConfig, inTable){
    common.debug(`check_color ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_coordinates(context, path, jsonConfig, inTable){
    common.debug(`check_coordinates ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_cron(context, path, jsonConfig, inTable){
    common.debug(`check_staticText ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_custom(context, path, jsonConfig, inTable){
    common.debug(`check_custom ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_datePicker(context, path, jsonConfig, inTable){
    common.debug(`check_datePicker ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_deviceManager(context, path, jsonConfig, inTable){
    common.debug(`check_deviceManager ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_divider(context, path, jsonConfig, inTable){
    common.debug(`check_divider ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_file(context, path, jsonConfig, inTable){
    common.debug(`check_file ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_fileSelector(context, path, jsonConfig, inTable){
    common.debug(`check_fileSelector ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_func(context, path, jsonConfig, inTable){
    common.debug(`check_func ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_header(context, path, jsonConfig, inTable){
    common.debug(`check_header ${path}`);
    // chk_responsive(context, path, jsonConfig); // must be discussed
}

function check_image(context, path, jsonConfig, inTable){
    common.debug(`check_image ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_imageSendTo(context, path, jsonConfig, inTable){
    common.debug(`check_imageSendTo ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_instance(context, path, jsonConfig, inTable){
    common.debug(`check_instance ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_interface(context, path, jsonConfig, inTable){
    common.debug(`check_interface ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_ip(context, path, jsonConfig, inTable){
    common.debug(`check_ip ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_jsonEditor(context, path, jsonConfig, inTable){
    common.debug(`check_jsonEditor ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_language(context, path, jsonConfig, inTable){
    common.debug(`check_language ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_license(context, path, jsonConfig, inTable){
    common.debug(`check_license ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_number(context, path, jsonConfig, inTable){
    common.debug(`check_number ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_objectId(context, path, jsonConfig, inTable){
    common.debug(`check_objectId ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_password(context, path, jsonConfig, inTable){
    common.debug(`check_password ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_pattern(context, path, jsonConfig, inTable){
    common.debug(`check_pattern ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_port(context, path, jsonConfig, inTable){
    common.debug(`check_port ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_qrCode(context, path, jsonConfig, inTable){
    common.debug(`check_qrCode ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_room(context, path, jsonConfig, inTable){
    common.debug(`check_room ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_select(context, path, jsonConfig, inTable){
    common.debug(`check_select ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_selectSendTo(context, path, jsonConfig, inTable){
    common.debug(`check_selectSendTo ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_sendTo(context, path, jsonConfig, inTable){
    common.debug(`check_sendTo ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_setState(context, path, jsonConfig, inTable){
    common.debug(`check_setState ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_slider(context, path, jsonConfig, inTable){
    common.debug(`check_slider ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_state(context, path, jsonConfig, inTable){
    common.debug(`check_state ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_staticImage(context, path, jsonConfig, inTable){
    common.debug(`check_staticImage ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_staticLink(context, path, jsonConfig, inTable){
    common.debug(`check_staticLink ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_staticText(context, path, jsonConfig, inTable){
    common.debug(`check_staticText ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_table(context, path, jsonConfig, inTable){
    common.debug(`check_table ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_text(context, path, jsonConfig, inTable){
    common.debug(`check_text ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_textSendTo(context, path, jsonConfig, inTable){
    common.debug(`check_textSendTo ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_timePicker(context, path, jsonConfig, inTable){
    common.debug(`check_timePicker ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_user(context, path, jsonConfig, inTable){
    common.debug(`check_user ${path}`);
    chk_responsive(context, path, jsonConfig);
}

function check_uuid(context, path, jsonConfig, inTable){
    common.debug(`check_uuid ${path}`);
    chk_responsive(context, path, jsonConfig);
}


function checkComponent(context, path, jsonConfig) {
    common.debug(`checkComponent (${path})`);

    const type = jsonConfig.type;
    if (!type) {
        context.error.push(`[E502] no type specified at ${path}`);
    }
    common.debug(`  type ${type}`);

    if (validComponents[type] === undefined) {
        context.error.push(`[E504] unexpected component "${type}" detected at ${path}`);
    } else if (typeof(validComponents[type]) === 'function') {
        (validComponents[type])(context, path, jsonConfig, false);
    } else {
        common.debug(`no checks defined for component ${type}`);
    }

}

function checkPanel(context, path, jsonConfig) {
    common.debug(`checkPanel(${path})`);

    const myAttributes = [
        'type',

        'collapsable',
        'color',
        'icon',
        'innerStyle',
        'items',
        'label',
    ];

    const validAttributes = stdAttributes.concat(myAttributes);

    for (const key in jsonConfig) {
        common.debug(`  scanning ${key}`);

        if (!validAttributes.includes(key)) {
            context.error.push(`[E503] unexpected type "${key}" detected at ${path}`);
        }

        if (key === 'type') {
            if (jsonConfig[key] !== 'panel') {
                console.log( `INTERNAL ERROR: unexpected type ${jsonConfig[key]} encounterd while scanning "panel"`);
                return;
            }
        }

        if (key === 'items') {
            for (const subkey in jsonConfig['items']) {
                const type = jsonConfig['items'][subkey].type;
                common.debug(`  item ${subkey} / ${type}`);
                if (!type) {
                    context.error.push(`[E502] no type specified at ${path}`);
                }

                checkComponent(context, `${path}/${subkey}`, jsonConfig['items'][subkey]);
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
            context.error.push(`[E502] no type specified at ${path}; expected "panel"`);
        }
        if (type !== 'panel') {
            context.error.push(`[E503] unexpected type "${key}" detected at ${path}; expected "panel"`);
        } else {
            checkPanel(context, `${path}/${key}`, jsonConfig[key]);
        }
    }
}

//main entry
function checkJsonConfig(context, path, jsonConfig) {
    common.debug(`checkCode_jsonConfig({context}, ${path}, {jsonConfig}`);

    const commonAttributes = [
        'i18n',
        'items',
        'type',
    ];

    const panelAttributes = [
        'collapsable',
        'color',
        'icon',
        'innerStyle',
        'label',
    ];

    const tabsAttributes = [
        'iconPosition',
        'tabsStyle',
    ];

    const validTypes = [
        'panel',
        'tabs',
    ];

    let baseType = 'panel';
    if (!jsonConfig['type']) {
        console.log(`*ERROR* base type (panel / tabs) not specified`);
    } else {
        baseType = jsonConfig['type'];
        common.debug(`  base type ${baseType}`);
        if (!validTypes.includes(baseType)) {
            context.error.push(`[E500] unexpected base type "!${baseType}" detected at ${path}`);
        }
    }

    let validAttributes = commonAttributes;
    if (baseType === 'panel') validAttributes = validAttributes.concat(panelAttributes);
    if (baseType === 'tabs') validAttributes = validAttributes.concat(tabsAttributes);

    for (const key in jsonConfig) {
        common.debug(``);
        common.debug(`scanning base attribute ${key}`);
        if (!validAttributes.includes(key)) {
            context.error.push(`[E501] unexpected attribute "${key}" detected at ${path}`);
        }
        if (key === 'items') {
            if (baseType == 'panel') {
                checkPanel( context, `${path}/items`, jsonConfig['items']);
            } else if (baseType == 'tabs') {
                checkTabs( context, `${path}/items`, jsonConfig['items']);
            }
        }
    }

    return;
}

exports.checkJsonConfig = checkJsonConfig;

// List of error and warnings used at this module
// ----------------------------------------------

// [500]

