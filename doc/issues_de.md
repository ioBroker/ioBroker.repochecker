# Explanation of repo checker issues
## Content
- [E001 Kann `package.json` nicht parsen](#e001-kann-packagejson-nicht-parsen)
- [E002 No `ioBroker.` found in the name of the repository](#e002-no-iobroker-found-in-the-name-of-the-repository)
- [E003 Repository must have name ioBroker.adaptername, but now io`b`roker is in lowercase](#e003-repository-must-have-name-iobrokeradaptername-but-now-iobroker-is-in-lowercase)
- [E004 No adapter name found in URL: ${context.githubUrlOriginal}](#e004-no-adapter-name-found-in-url-contextgithuburloriginal)
- [E005 Adapter name must be lowercase](#e005-adapter-name-must-be-lowercase)
- [E006 Invalid characters found in adapter name `${adapterName}`. Only lowercase chars, digits, `-` and `_` are allowed](#e006-invalid-characters-found-in-adapter-name-adaptername-only-lowercase-chars-digits---and-_-are-allowed)
- [E024 Adapter name `${adapterName}` may not start with '_'](#e024-adapter-name-adaptername-may-not-start-with-_)
- [E007 Cannot find author repo in the URL](#e007-cannot-find-author-repo-in-the-url)
- [E020 Name of adapter in package.json must be lowercase and be equal to `iobroker.${adapterName.toLowerCase()}`. Now is `${packageJson.name}`](#e020-name-of-adapter-in-packagejson-must-be-lowercase-and-be-equal-to-iobrokeradapternametolowercase-now-is-packagejsonname)
- [E009 No version found in the package.json](#e009-no-version-found-in-the-packagejson)
- [E010 No description found in the package.json](#e010-no-description-found-in-the-packagejson)
- [E021 `licenses` in package.json are deprecated. Please use only `license`: `NAME` field.](#e021-licenses-in-packagejson-are-deprecated-please-use-only-license-name-field)
- [E013 No author found in the package.json](#e013-no-author-found-in-the-packagejson)
- [E014 NPM information found in package.json. Please remove all attributes starting with `_`](#e014-npm-information-found-in-packagejson-please-remove-all-attributes-starting-with-_)
- [E015 No license found in package.json](#e015-no-license-found-in-packagejson)
- [E016 No SPDX license found in package.json. Please use one of listed here: https://spdx.org/licenses/](#e016-no-spdx-license-found-in-packagejson-please-use-one-of-listed-here-httpsspdxorglicenses)
- [E017 No repository found in the package.json](#e017-no-repository-found-in-the-packagejson)
- [E018 Invalid repository type in package.json: ${context.packageJson.repository.type}. It should be git](#e018-invalid-repository-type-in-packagejson-contextpackagejsonrepositorytype-it-should-be-git)
- [E019 Invalid repository URL in package.json: ${context.packageJson.repository.url}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}](#e019-invalid-repository-url-in-packagejson-contextpackagejsonrepositoryurl-expected-contextgithubapidatassh_url-or-contextgithubapidataclone_url)
- [E022 Adapter name is reserved!](#e022-adapter-name-is-reserved)
- [E023 Do not include `npm` as dependency!](#e023-do-not-include-npm-as-dependency)
- [E025 Do not include `iobroker.js-controller` as dependency!](#e025-do-not-include-iobrokerjs-controller-as-dependency)
- [E100 Cannot parse io-package.json: ${e}](#e100-cannot-parse-io-packagejson-e)
- [E101 io-package.json must have at least empty `native` attribute](#e101-io-packagejson-must-have-at-least-empty-native-attribute)
- [E102 io-package.json must have common object](#e102-io-packagejson-must-have-common-object)
- [E103 `common.name` in io-package.json must be equal to `${context.adapterName.toLowerCase()}'`. Now is ${context.ioPackageJson.common.name}](#e103-commonname-in-io-packagejson-must-be-equal-to-contextadapternametolowercase-now-is-contextiopackagejsoncommonname)
- [W171 `common.title` is deprecated in io-package.json](#w171-commontitle-is-deprecated-in-io-packagejson)
- [E104 No `common.titleLang` found in io-package.json](#e104-no-commontitlelang-found-in-io-packagejson)
- [E105 `common.titleLang` must be an object. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}](#e105-commontitlelang-must-be-an-object-now-jsonstringifycontextiopackagejsoncommontitlelang)
- [W105 `common.titleLang` should be translated into all supported languages (${allowedLanguages.join(', ')})](#w105-commontitlelang-should-be-translated-into-all-supported-languages-allowedlanguagesjoin-)
- [E106 `common.titleLang` should not contain word `adapter` in the name. It is clear, that this is adapter. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}](#e106-commontitlelang-should-not-contain-word-adapter-in-the-name-it-is-clear-that-this-is-adapter-now-jsonstringifycontextiopackagejsoncommontitlelang)
- [E107 No `common.version` found in io-package.json](#e107-no-commonversion-found-in-io-packagejson)
- [E118 Versions in package.json and in io-package.json are different](#e118-versions-in-packagejson-and-in-io-packagejson-are-different)
- [E108 No `common.desc` found in io-package.json](#e108-no-commondesc-found-in-io-packagejson)
- [E109 `common.desc` in io-package.json should be an object for many languages. Found only `${context.ioPackageJson.common.desc}`](#e109-commondesc-in-io-packagejson-should-be-an-object-for-many-languages-found-only-contextiopackagejsoncommondesc)
- [W109 `common.desc` should be translated into all supported languages (${allowedLanguages.join(', ')})](#w109-commondesc-should-be-translated-into-all-supported-languages-allowedlanguagesjoin-)
- [E169 `common.keywords` must be an array in the io-package.json](#e169-commonkeywords-must-be-an-array-in-the-io-packagejson)
- [W170 `common.keywords` should not contain `${forbiddenKeywords.join(', ')}` io-package.json](#w170-commonkeywords-should-not-contain-forbiddenkeywordsjoin--io-packagejson)
- [E110 Icon not found in the io-package.json](#e110-icon-not-found-in-the-io-packagejson)
- [E111 extIcon not found in the io-package.json](#e111-exticon-not-found-in-the-io-packagejson)
- [E112 extIcon must be the same as an icon but with github path](#e112-exticon-must-be-the-same-as-an-icon-but-with-github-path)
- [W113 Adapter should support compact mode](#w113-adapter-should-support-compact-mode)
- [E114 No adapter are allowed in the repo without admin support (set `common.noConfig = true` and `common.adminUI.config = none` if adapter has no configuration)](#e114-no-adapter-are-allowed-in-the-repo-without-admin-support-set-commonnoconfig--true-and-commonadminuiconfig--none-if-adapter-has-no-configuration)
- [W156 Adapter should support admin 5 UI (jsonConfig) if you do not use a React based UI](#w156-adapter-should-support-admin-5-ui-jsonconfig-if-you-do-not-use-a-react-based-ui)
- [W164 Adapters without config `common.noConfig = true` should also set `common.adminUI.config = none`](#w164-adapters-without-config-commonnoconfig--true-should-also-set-commonadminuiconfig--none)
- [E115 No license found in io-package.json](#e115-no-license-found-in-io-packagejson)
- [E116 No SPDX license found. Please use one of listed here: https://spdx.org/licenses/](#e116-no-spdx-license-found-please-use-one-of-listed-here-httpsspdxorglicenses)
- [E117 Licenses in package.json and in io-package.json are different](#e117-licenses-in-packagejson-and-in-io-packagejson-are-different)
- [E165 Node mode found in package.json](#e165-node-mode-found-in-packagejson)
- [E166 Unknown type found in io-package.json](#e166-unknown-type-found-in-io-packagejson)
- [E162 onlyWWW should have common.mode `none` in io-package.json](#e162-onlywww-should-have-commonmode-none-in-io-packagejson)
- [E167 schedule adapters must have common.schedule property in io-package.json](#e167-schedule-adapters-must-have-commonschedule-property-in-io-packagejson)
- [E119 No type found in io-package.json](#e119-no-type-found-in-io-packagejson)
- [E120 Unknown type found in io-package.json](#e120-unknown-type-found-in-io-packagejson)
- [E121 No authors found in io-package.json](#e121-no-authors-found-in-io-packagejson)
- [E122 authors must be an Array in io-package.json](#e122-authors-must-be-an-array-in-io-packagejson)
- [E123 Authors may not be empty in io-package.json](#e123-authors-may-not-be-empty-in-io-packagejson)
- [W172 `common.localLink` in io-package.json is deprecated. Please define object `common.localLinks`: { `_default`: `...` }](#w172-commonlocallink-in-io-packagejson-is-deprecated-please-define-object-commonlocallinks--_default--)
- [E130 No `common.news` found in io-package.json](#e130-no-commonnews-found-in-io-packagejson)
- [E145 No `common.news` found for actual version ${context.ioPackageJson.common.version}](#e145-no-commonnews-found-for-actual-version-contextiopackagejsoncommonversion)
- [W145 Each `common.news` should be translated into all supported languages (${allowedLanguages.join(', ')})](#w145-each-commonnews-should-be-translated-into-all-supported-languages-allowedlanguagesjoin-)
- [E143 No main found in the package.json](#e143-no-main-found-in-the-packagejson)
- [E163 common.mode `${context.ioPackageJson.common.mode}` requires JavaScript file for `main` in package.json](#e163-commonmode-contextiopackagejsoncommonmode-requires-javascript-file-for-main-in-packagejson)
- [E144 common.installedFrom field found in io-package.json. Must be removed.](#e144-commoninstalledfrom-field-found-in-io-packagejson-must-be-removed)
- [E146 instanceObjects must be an Array in io-package.json](#e146-instanceobjects-must-be-an-array-in-io-packagejson)
- [E147 instanceObject type has an invalid type: ${instanceObject.type}](#e147-instanceobject-type-has-an-invalid-type-instanceobjecttype)
- [E148 instanceObject common.type has an invalid type! Expected `string`, received  `${typeof instanceObject.common.type}`](#e148-instanceobject-commontype-has-an-invalid-type-expected-string-received--typeof-instanceobjectcommontype)
- [E149 instanceObject common.type has an invalid value: ${instanceObject.common.type}](#e149-instanceobject-commontype-has-an-invalid-value-instanceobjectcommontype)
- [E150 No common.connectionType found in io-package.json](#e150-no-commonconnectiontype-found-in-io-packagejson)
- [E151 common.connectionType type has an invalid value `${context.ioPackageJson.common.connectionType}`](#e151-commonconnectiontype-type-has-an-invalid-value-contextiopackagejsoncommonconnectiontype)
- [E152 No common.dataSource found in io-package.json](#e152-no-commondatasource-found-in-io-packagejson)
- [E160 `admin` is not allowed in common.dependencies](#e160-admin-is-not-allowed-in-commondependencies)
- [E159 common.dependencies `js-controller` dependency should always allow future versions (>=x.x.x) - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}](#e159-commondependencies-js-controller-dependency-should-always-allow-future-versions-xxx---recommended-js-controller-recommendedjscontrollerversion)
- [E161 `js-controller` is not allowed in common.globalDependencies](#e161-js-controller-is-not-allowed-in-commonglobaldependencies)
- [E153 common.dependencies must contain {`js-controller`: `>=1.5.8`} or later - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}](#e153-commondependencies-must-contain-js-controller-158-or-later---recommended-js-controller-recommendedjscontrollerversion)
- [E154 common.dependencies must contain [{`js-controller`: `>=2.0.0`}] or later - recommended: [{`js-controller`: `>=${recommendedJsControllerVersion}`}]](#e154-commondependencies-must-contain-js-controller-200-or-later---recommended-js-controller-recommendedjscontrollerversion)
- [E157 common.protectedNative requires dependency {`js-controller`: `>=2.0.2`} or later - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}](#e157-commonprotectednative-requires-dependency-js-controller-202-or-later---recommended-js-controller-recommendedjscontrollerversion)
- [E158 common.encryptedNative requires dependency {`js-controller`: `>=3.0.3`} or later - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}](#e158-commonencryptednative-requires-dependency-js-controller-303-or-later---recommended-js-controller-recommendedjscontrollerversion)
- [E168 common.notifications requires dependency {`js-controller`: `>=3.2.0`} or later - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}](#e168-commonnotifications-requires-dependency-js-controller-320-or-later---recommended-js-controller-recommendedjscontrollerversion)
- [E155 Invalid tier value: ${context.ioPackageJson.common.tier}. Only 1, 2 or 3 are allowed!](#e155-invalid-tier-value-contextiopackagejsoncommontier-only-1-2-or-3-are-allowed)
- [E140 width and height of logo are not equal](#e140-width-and-height-of-logo-are-not-equal)
- [E141 logo is too small. It must be greater or equal than 32x32](#e141-logo-is-too-small-it-must-be-greater-or-equal-than-32x32)
- [E142 logo is too big. It must be less or equal than 512x512](#e142-logo-is-too-big-it-must-be-less-or-equal-than-512x512)
- [E124 Main file not found under URL: ${context.githubUrl}/${context.packageJson.main}](#e124-main-file-not-found-under-url-contextgithuburlcontextpackagejsonmain)
- [E125 External icon not found under URL: ${context.ioPackageJson.common.extIcon}](#e125-external-icon-not-found-under-url-contextiopackagejsoncommonexticon)
- [E200 Not found on npm. Please publish](#e200-not-found-on-npm-please-publish)
- [E201 Bluefox was not found in the collaborators on NPM!. Please execute in adapter directory: `npm owner add bluefox iobroker.${context.adapterName}`](#e201-bluefox-was-not-found-in-the-collaborators-on-npm-please-execute-in-adapter-directory-npm-owner-add-bluefox-iobrokercontextadaptername)
- [E300 Not found on travis. Please setup travis or use github actions (preferred)](#e300-not-found-on-travis-please-setup-travis-or-use-github-actions-preferred)
- [W302 Use github actions instead of travis-ci](#w302-use-github-actions-instead-of-travis-ci)
- [E301 Tests on Travis-ci.org are broken. Please fix.](#e301-tests-on-travis-ciorg-are-broken-please-fix)
- [E400 Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json](#e400-cannot-download-httpsrawgithubusercontentcomiobrokeriobrokerrepositoriesmastersources-distjson)
- [W400 Cannot find `${context.adapterName}` in latest repository](#w400-cannot-find-contextadaptername-in-latest-repository)
- [E402 Types of adapter in latest repository and in io-package.json are different `${context.latestRepo[context.adapterName].type}` !== `${context.ioPackageJson.common.type}`](#e402-types-of-adapter-in-latest-repository-and-in-io-packagejson-are-different-contextlatestrepocontextadapternametype--contextiopackagejsoncommontype)
- [E403 Version set in latest repository](#e403-version-set-in-latest-repository)
- [E404 Icon not found in latest repository](#e404-icon-not-found-in-latest-repository)
- [E405 Icon (latest) must be in the following path: ${url}](#e405-icon-latest-must-be-in-the-following-path-url)
- [E406 Meta URL (latest) not found in latest repository](#e406-meta-url-latest-not-found-in-latest-repository)
- [E407 Meta URL (latest) must be equal to ${url}io-package.json](#e407-meta-url-latest-must-be-equal-to-urlio-packagejson)
- [E420 Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json](#e420-cannot-download-httpsrawgithubusercontentcomiobrokeriobrokerrepositoriesmastersources-dist-stablejson)
- [E422 Types of adapter in stable repository and in io-package.json are different `${context.stableRepo[context.adapterName].type}` !== `${context.ioPackageJson.common.type}`](#e422-types-of-adapter-in-stable-repository-and-in-io-packagejson-are-different-contextstablerepocontextadapternametype--contextiopackagejsoncommontype)
- [E423 Adapter was found in stable repository but not in latest repo](#e423-adapter-was-found-in-stable-repository-but-not-in-latest-repo)
- [E424 No version set in stable repository](#e424-no-version-set-in-stable-repository)
- [E425 Icon not found in stable repository](#e425-icon-not-found-in-stable-repository)
- [E426 Icon (stable) must be in the following path: ${url}](#e426-icon-stable-must-be-in-the-following-path-url)
- [E427 Meta URL (stable) not found in latest repository](#e427-meta-url-stable-not-found-in-latest-repository)
- [E428 Meta URL (stable) must be equal to ${url}io-package.json](#e428-meta-url-stable-must-be-equal-to-urlio-packagejson)
- [E500 node_modules found in repo. Please delete it](#e500-node_modules-found-in-repo-please-delete-it)
- [E501 Cannot get ${context.branch}.zip on github](#e501-cannot-get-contextbranchzip-on-github)
- [E502 `admin/img/info-big.png` not found, but selectID.js used in index_m.html ](#e502-adminimginfo-bigpng-not-found-but-selectidjs-used-in-index_mhtml-)
- [E506 More non translated in german or russian words found in admin/words.js. You can use https://translator.iobroker.in/ for translations](#e506-more-non-translated-in-german-or-russian-words-found-in-adminwordsjs-you-can-use-httpstranslatoriobrokerin-for-translations)
- [E507 Cannot parse `admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}`: ${e}](#e507-cannot-parse-adminjsonconfigjsoncontextadminjsonconfigjson----5-e)
- [E508 `admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}` not found, but admin support is declared](#e508-adminjsonconfigjsoncontextadminjsonconfigjson----5-not-found-but-admin-support-is-declared)
- [E509 Cannot parse `admin/i18n/${lang}/translations.json`: ${e}](#e509-cannot-parse-admini18nlangtranslationsjson-e)
- [E510 `/admin/i18n/${lang}/translations.json` or `admin/i18n/${lang}.json` not found, but admin support is declared](#e510-admini18nlangtranslationsjson-or-admini18nlangjson-not-found-but-admin-support-is-declared)
- [W515 Why you decided to disable i18n support?](#w515-why-you-decided-to-disable-i18n-support)
- [E511 Cannot parse `admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}`: ${e}](#e511-cannot-parse-adminjsoncustomjsoncontextadminjsoncustomjson----5-e)
- [E512 `admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}` not found, but custom support is declared](#e512-adminjsoncustomjsoncontextadminjsoncustomjson----5-not-found-but-custom-support-is-declared)
- [E514 `admin/blockly.js` not found, but blockly support is declared](#e514-adminblocklyjs-not-found-but-blockly-support-is-declared)
- [E515 JavaScript-Rules support is declared, but no location in property url defined](#e515-javascript-rules-support-is-declared-but-no-location-in-property-url-defined)
- [E516 `${context.ioPackageJson.common.javascriptRules.url}` not found, but JavaScript-Rules support is declared](#e516-contextiopackagejsoncommonjavascriptrulesurl-not-found-but-javascript-rules-support-is-declared)
- [E503 `iob_npm.done` found in repo! Remove that file](#e503-iob_npmdone-found-in-repo-remove-that-file)
- [W513 `gulpfile.js` found in repo! Think about migrating to @iobroker/adapter-dev package](#w513-gulpfilejs-found-in-repo-think-about-migrating-to-iobrokeradapter-dev-package)
- [E518 `@alcalzone/release-script` is used, but `.releaseconfig.json` not found](#e518-alcalzonerelease-script-is-used-but-releaseconfigjson-not-found)
- [E519 `${context.packageJson.main}` found in package.json, but not found as file](#e519-contextpackagejsonmain-found-in-packagejson-but-not-found-as-file)
- [E504 setInterval found in `${context.packageJson.main}`, but no clearInterval detected](#e504-setinterval-found-in-contextpackagejsonmain-but-no-clearinterval-detected)
- [W504 setInterval found in `${context.packageJson.main}`, but no clearInterval detected](#w504-setinterval-found-in-contextpackagejsonmain-but-no-clearinterval-detected)
- [E505 setTimeout found in `${context.packageJson.main}`, but no clearTimeout detected](#e505-settimeout-found-in-contextpackagejsonmain-but-no-cleartimeout-detected)
- [W505 setTimeout found in `${context.packageJson.main}`, but no clearTimeout detected](#w505-settimeout-found-in-contextpackagejsonmain-but-no-cleartimeout-detected)
- [E801 No repository about text found. Please go to `${context.githubUrlOriginal}`, press the settings button beside the about title and add the description.](#e801-no-repository-about-text-found-please-go-to-contextgithuburloriginal-press-the-settings-button-beside-the-about-title-and-add-the-description)
- [E802 No topics found in the repository. Please go to `${context.githubUrlOriginal}`, press the settings button beside the about title and add some topics.](#e802-no-topics-found-in-the-repository-please-go-to-contextgithuburloriginal-press-the-settings-button-beside-the-about-title-and-add-some-topics)
- [E803 Archived repositories are not allowed.](#e803-archived-repositories-are-not-allowed)
- [E601 No README.md found](#e601-no-readmemd-found)
- [E603 NO `## Changelog` found in README.md](#e603-no--changelog-found-in-readmemd)
- [E606 Current adapter version ${context.packageJson.version} not found in README.md](#e606-current-adapter-version-contextpackagejsonversion-not-found-in-readmemd)
- [E604 No `## License` found in README.md](#e604-no--license-found-in-readmemd)
- [E605 No actual year found in copyright. Please add `Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}` at the end of README.md](#e605-no-actual-year-found-in-copyright-please-add-copyright-c-m1-year-getauthorcontextpackagejsonauthor-at-the-end-of-readmemd)
- [E701 NO LICENSE file found](#e701-no-license-file-found)
- [W801 .npmignore not found](#w801-npmignore-not-found)
- [E804 node_modules not found in ](#e804-node_modules-not-found-in-)
- [W901 .gitignore not found](#w901-gitignore-not-found)
- [E902 node_modules not found in .npmignore](#e902-node_modules-not-found-in-npmignore)
- [E903 iob_npm.done not found in .gitignore](#e903-iob_npmdone-not-found-in-gitignore)

## Issues
### [E001] Kann `package.json` nicht parsen
#### Erklärung
Beim Parsen der `package.json` ist ein Fehler aufgetreten. Details sind in den Fehlermeldungen zu finden.
#### Erforderlicher Schritt zur Behebung des Problems
Korrigiere die Datei `package.json`, sodass sie eine valide json-Datei wird.

### [E002] No `ioBroker.` found in the name of the repository
#### Erklärung
The name of the repository must start with `ioBroker.` ioBroker must be written with an capital `B`.
#### Erforderlicher Schritt zur Behebung des Problems
Correct the name of the repository by renaming it to meet standards.

### [E003] Repository must have name ioBroker.adaptername, but now io`b`roker is in lowercase

### [E004] No adapter name found in URL: ${context.githubUrlOriginal}

### [E005] Adapter name must be lowercase

### [E006] Invalid characters found in adapter name `${adapterName}`. Only lowercase chars, digits, `-` and `_` are allowed

### [E024] Adapter name `${adapterName}` may not start with '_'

### [E007] Cannot find author repo in the URL

### [E020] Name of adapter in package.json must be lowercase and be equal to `iobroker.${adapterName.toLowerCase()}`. Now is `${packageJson.name}`

### [E009] No version found in the package.json

### [E010] No description found in the package.json

### [E021] `licenses` in package.json are deprecated. Please use only `license`: `NAME` field.

### [E013] No author found in the package.json

### [E014] NPM information found in package.json. Please remove all attributes starting with `_`

### [E015] No license found in package.json

### [E016] No SPDX license found in package.json. Please use one of listed here: https://spdx.org/licenses/

### [E017] No repository found in the package.json

### [E018] Invalid repository type in package.json: ${context.packageJson.repository.type}. It should be git

### [E019] Invalid repository URL in package.json: ${context.packageJson.repository.url}. Expected: ${context.githubApiData.ssh_url} or ${context.githubApiData.clone_url}

### [E022] Adapter name is reserved!

### [E023] Do not include `npm` as dependency!

### [E025] Do not include `iobroker.js-controller` as dependency!

### [E100] Cannot parse io-package.json: ${e}

### [E101] io-package.json must have at least empty `native` attribute

### [E102] io-package.json must have common object

### [E103] `common.name` in io-package.json must be equal to `${context.adapterName.toLowerCase()}'`. Now is ${context.ioPackageJson.common.name}

### [W171] `common.title` is deprecated in io-package.json

### [E104] No `common.titleLang` found in io-package.json

### [E105] `common.titleLang` must be an object. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}

### [W105] `common.titleLang` should be translated into all supported languages (${allowedLanguages.join(', ')})

### [E106] `common.titleLang` should not contain word `adapter` in the name. It is clear, that this is adapter. Now: ${JSON.stringify(context.ioPackageJson.common.titleLang)}

### [E107] No `common.version` found in io-package.json

### [E118] Versions in package.json and in io-package.json are different

### [E108] No `common.desc` found in io-package.json

### [E109] `common.desc` in io-package.json should be an object for many languages. Found only `${context.ioPackageJson.common.desc}`

### [W109] `common.desc` should be translated into all supported languages (${allowedLanguages.join(', ')})

### [E169] `common.keywords` must be an array in the io-package.json

### [W170] `common.keywords` should not contain `${forbiddenKeywords.join(', ')}` io-package.json

### [E110] Icon not found in the io-package.json

### [E111] extIcon not found in the io-package.json

### [E112] extIcon must be the same as an icon but with github path

### [W113] Adapter should support compact mode

### [E114] No adapter are allowed in the repo without admin support (set `common.noConfig = true` and `common.adminUI.config = none` if adapter has no configuration)

### [W156] Adapter should support admin 5 UI (jsonConfig) if you do not use a React based UI

### [W164] Adapters without config `common.noConfig = true` should also set `common.adminUI.config = none`

### [E115] No license found in io-package.json

### [E116] No SPDX license found. Please use one of listed here: https://spdx.org/licenses/

### [E117] Licenses in package.json and in io-package.json are different

### [E165] Node mode found in package.json

### [E166] Unknown type found in io-package.json

### [E162] onlyWWW should have common.mode `none` in io-package.json

### [E167] schedule adapters must have common.schedule property in io-package.json

### [E119] No type found in io-package.json

### [E120] Unknown type found in io-package.json

### [E121] No authors found in io-package.json

### [E122] authors must be an Array in io-package.json

### [E123] Authors may not be empty in io-package.json

### [W172] `common.localLink` in io-package.json is deprecated. Please define object `common.localLinks`: { `_default`: `...` }

### [E130] No `common.news` found in io-package.json

### [E145] No `common.news` found for actual version ${context.ioPackageJson.common.version}

### [W145] Each `common.news` should be translated into all supported languages (${allowedLanguages.join(', ')})

### [E143] No main found in the package.json

### [E163] common.mode `${context.ioPackageJson.common.mode}` requires JavaScript file for `main` in package.json

### [E144] common.installedFrom field found in io-package.json. Must be removed.

### [E146] instanceObjects must be an Array in io-package.json

### [E147] instanceObject type has an invalid type: ${instanceObject.type}

### [E148] instanceObject common.type has an invalid type! Expected `string`, received  `${typeof instanceObject.common.type}`

### [E149] instanceObject common.type has an invalid value: ${instanceObject.common.type}

### [E150] No common.connectionType found in io-package.json

### [E151] common.connectionType type has an invalid value `${context.ioPackageJson.common.connectionType}`

### [E152] No common.dataSource found in io-package.json

### [E160] `admin` is not allowed in common.dependencies

### [E159] common.dependencies `js-controller` dependency should always allow future versions (>=x.x.x) - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}

### [E161] `js-controller` is not allowed in common.globalDependencies

### [E153] common.dependencies must contain {`js-controller`: `>=1.5.8`} or later - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}

### [E154] common.dependencies must contain [{`js-controller`: `>=2.0.0`}] or later - recommended: [{`js-controller`: `>=${recommendedJsControllerVersion}`}]

### [E157] common.protectedNative requires dependency {`js-controller`: `>=2.0.2`} or later - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}

### [E158] common.encryptedNative requires dependency {`js-controller`: `>=3.0.3`} or later - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}

### [E168] common.notifications requires dependency {`js-controller`: `>=3.2.0`} or later - recommended: {`js-controller`: `>=${recommendedJsControllerVersion}`}

### [E155] Invalid tier value: ${context.ioPackageJson.common.tier}. Only 1, 2 or 3 are allowed!

### [E140] width and height of logo are not equal

### [E141] logo is too small. It must be greater or equal than 32x32

### [E142] logo is too big. It must be less or equal than 512x512

### [E124] Main file not found under URL: ${context.githubUrl}/${context.packageJson.main}

### [E125] External icon not found under URL: ${context.ioPackageJson.common.extIcon}

### [E200] Not found on npm. Please publish

### [E201] Bluefox was not found in the collaborators on NPM!. Please execute in adapter directory: `npm owner add bluefox iobroker.${context.adapterName}`

### [E300] Not found on travis. Please setup travis or use github actions (preferred)

### [W302] Use github actions instead of travis-ci

### [E301] Tests on Travis-ci.org are broken. Please fix.

### [E400] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist.json

### [W400] Cannot find `${context.adapterName}` in latest repository

### [E402] Types of adapter in latest repository and in io-package.json are different `${context.latestRepo[context.adapterName].type}` !== `${context.ioPackageJson.common.type}`

### [E403] Version set in latest repository

### [E404] Icon not found in latest repository

### [E405] Icon (latest) must be in the following path: ${url}

### [E406] Meta URL (latest) not found in latest repository

### [E407] Meta URL (latest) must be equal to ${url}io-package.json

### [E420] Cannot download https://raw.githubusercontent.com/ioBroker/ioBroker.repositories/master/sources-dist-stable.json

### [E422] Types of adapter in stable repository and in io-package.json are different `${context.stableRepo[context.adapterName].type}` !== `${context.ioPackageJson.common.type}`

### [E423] Adapter was found in stable repository but not in latest repo

### [E424] No version set in stable repository

### [E425] Icon not found in stable repository

### [E426] Icon (stable) must be in the following path: ${url}

### [E427] Meta URL (stable) not found in latest repository

### [E428] Meta URL (stable) must be equal to ${url}io-package.json

### [E500] node_modules found in repo. Please delete it

### [E501] Cannot get ${context.branch}.zip on github

### [E502] `admin/img/info-big.png` not found, but selectID.js used in index_m.html 

### [E506] More non translated in german or russian words found in admin/words.js. You can use https://translator.iobroker.in/ for translations

### [E507] Cannot parse `admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}`: ${e}

### [E508] `admin/jsonConfig.json${context['/admin/jsonConfig.json'] ? '' : '5'}` not found, but admin support is declared

### [E509] Cannot parse `admin/i18n/${lang}/translations.json`: ${e}

### [E510] `/admin/i18n/${lang}/translations.json` or `admin/i18n/${lang}.json` not found, but admin support is declared

### [W515] Why you decided to disable i18n support?

### [E511] Cannot parse `admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}`: ${e}

### [E512] `admin/jsonCustom.json${context['/admin/jsonCustom.json'] ? '' : '5'}` not found, but custom support is declared

### [E514] `admin/blockly.js` not found, but blockly support is declared

### [E515] JavaScript-Rules support is declared, but no location in property url defined

### [E516] `${context.ioPackageJson.common.javascriptRules.url}` not found, but JavaScript-Rules support is declared

### [E503] `iob_npm.done` found in repo! Remove that file

### [W513] `gulpfile.js` found in repo! Think about migrating to @iobroker/adapter-dev package

### [E518] `@alcalzone/release-script` is used, but `.releaseconfig.json` not found

### [E519] `${context.packageJson.main}` found in package.json, but not found as file

### [E504] setInterval found in `${context.packageJson.main}`, but no clearInterval detected

### [W504] setInterval found in `${context.packageJson.main}`, but no clearInterval detected

### [E505] setTimeout found in `${context.packageJson.main}`, but no clearTimeout detected

### [W505] setTimeout found in `${context.packageJson.main}`, but no clearTimeout detected

### [E801] No repository about text found. Please go to `${context.githubUrlOriginal}`, press the settings button beside the about title and add the description.

### [E802] No topics found in the repository. Please go to `${context.githubUrlOriginal}`, press the settings button beside the about title and add some topics.

### [E803] Archived repositories are not allowed.

### [E601] No README.md found

### [E603] NO `## Changelog` found in README.md

### [E606] Current adapter version ${context.packageJson.version} not found in README.md

### [E604] No `## License` found in README.md

### [E605] No actual year found in copyright. Please add `Copyright (c) ${m[1]}-${year} ${getAuthor(context.packageJson.author)}` at the end of README.md

### [E701] NO LICENSE file found

### [W801] .npmignore not found

### [E804] node_modules not found in 

### [W901] .gitignore not found

### [E902] node_modules not found in .npmignore

### [E903] iob_npm.done not found in .gitignore

