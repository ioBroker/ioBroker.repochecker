import React, { Component } from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import {
    AppBar,
    Toolbar,
    Input,
    Fab,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Button,
    CircularProgress,
} from '@mui/material';

import { DoneOutlined as CheckIcon, Cancel as ErrorIcon, Announcement as WarningIcon } from '@mui/icons-material';

import { Utils, Theme, DialogMessage, I18n } from '@iobroker/adapter-react-v5';

import Comm from './Comm';
import ToggleThemeMenu from './ToggleThemeMenu';

import en from '@iobroker/adapter-react-v5/i18n/en';
import de from '@iobroker/adapter-react-v5/i18n/de';
import ru from '@iobroker/adapter-react-v5/i18n/ru';
import pt from '@iobroker/adapter-react-v5/i18n/pt';
import nl from '@iobroker/adapter-react-v5/i18n/nl';
import fr from '@iobroker/adapter-react-v5/i18n/fr';
import it from '@iobroker/adapter-react-v5/i18n/it';
import es from '@iobroker/adapter-react-v5/i18n/es';
import pl from '@iobroker/adapter-react-v5/i18n/pl';
import zhCN from '@iobroker/adapter-react-v5/i18n/zh-cn';

const NARROW_WIDTH = 500;

const styles = {
    toolbarTitle: {
        top: 0,
        right: 20,
        whiteSpace: 'nowrap',
    },
    urlInput: {
        color: 'white',
    },
    branchInput: {
        width: 100,
        marginLeft: 10,
        color: 'white',
    },
    attrTitle: {
        display: 'inline-block',
        width: 160,
        fontWeight: 'bold',
        paddingLeft: 10,
    },
    title: {
        background: '#faff7c',
        padding: 5,
        marginTop: 10,
        marginBottom: 0,
    },
    buttonCheck: {
        marginLeft: 10,
        marginRight: 20,
    },
    body: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    info: {
        padding: 20,
        overflow: 'auto',
        height: 'calc(100% - 104px)',
    },
    ok: {
        color: '#111',
    },
    error: {
        color: '#bf0000',
    },
    warning: {
        color: '#bf9100',
    },
};

class App extends Component {
    constructor(props) {
        super(props);

        const theme = Theme(Utils.getThemeName());

        const translations = {
            en,
            de,
            ru,
            pt,
            nl,
            fr,
            it,
            es,
            pl,
            'zh-cn': zhCN,
        };

        I18n.setTranslations(translations);
        I18n.setLanguage((navigator.language || navigator.userLanguage || 'en').substring(0, 2).toLowerCase());

        this.state = {
            url: window.localStorage.getItem('url') || '',
            requesting: false,
            errors: [],
            warnings: [],
            result: [],
            screenWidth: window.innerWidth,
            version: 'Adapter checker',
            branch: window.localStorage.getItem('branch') || '',
            theme,
            themeName: theme.name,
            themeType: theme.palette.mode,
            hasTravis: false,
            globalError: null,
        };

        if (window.document.location.search) {
            const query = window.document.location.search.replace(/^\?/, '');
            const pairs = query.split('&');
            pairs.forEach(pair => {
                const parts = pair.split('=');
                if (parts[0] === 'q' && parts[1]) {
                    this.state.url = decodeURIComponent(parts[1]);
                }
            });

            setTimeout(() => this.onCheck(), 500);
        }

        this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
        if (theme.palette.mode === 'dark') {
            window.document.body.style.background = '#111';
        }
    }

    componentDidMount() {
        window.addEventListener('resize', this.updateWindowDimensions());
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateWindowDimensions);
    }

    updateWindowDimensions() {
        this.setState({ screenWidth: window.innerWidth });
    }

    onCheck() {
        let url = this.state.url;
        if (url.match(/\/$/, '')) {
            url = url.substring(0, url.length - 1);
        }

        this.setState({ errors: [], result: [], warnings: [], requesting: true });

        Comm.check(url, this.state.branch.trim(), (err, data) => {
            if (err) {
                this.setState({
                    errors: data.errors || [],
                    globalError: err,
                    warnings: (data && data.warnings) || [],
                    result: (data && data.checks) || [],
                    requesting: false,
                    hasTravis: (data && data.hasTravis) || false,
                });
            } else {
                this.setState({
                    errors: data.errors || [],
                    warnings: data.warnings || [],
                    result: data.checks || [],
                    version: 'v' + data.version,
                    requesting: false,
                    hasTravis: data.hasTravis || false,
                });
            }
        });
    }

    renderResult() {
        return (
            <List component="nav">
                {this.state.result.map((line, i) => (
                    <ListItem key={line}>
                        <ListItemIcon>
                            <CheckIcon
                                style={{ ...styles.ok, color: this.state.themeType === 'dark' ? '#1F1' : '#1F1' }}
                            />
                        </ListItemIcon>
                        <ListItemText
                            primary={typeof line === 'string' ? line : JSON.stringify(line)}
                            secondary={i + 1}
                        />
                    </ListItem>
                ))}
            </List>
        );
    }

    renderError() {
        return (
            <List component="nav">
                {this.state.errors.length ? <br /> : null}
                {this.state.errors.map((line, i) => (
                    <ListItem key={line}>
                        <ListItemIcon>
                            <ErrorIcon style={styles.error} />
                        </ListItemIcon>
                        <ListItemText
                            style={styles.error}
                            primary={typeof line === 'string' ? line : JSON.stringify(line)}
                            secondary={i + 1}
                        />
                    </ListItem>
                ))}
            </List>
        );
    }

    renderWarnings() {
        return (
            <List component="nav">
                {this.state.warnings.map((line, i) => (
                    <ListItem key={line}>
                        <ListItemIcon>
                            <WarningIcon style={styles.warning} />
                        </ListItemIcon>
                        <ListItemText
                            style={styles.warning}
                            primary={typeof line === 'string' ? line : JSON.stringify(line)}
                            secondary={i + 1}
                        />
                    </ListItem>
                ))}
            </List>
        );
    }

    onOpen(path) {
        let url = this.state.url.replace('https://raw.githubusercontent.com/', 'https://github.com/');
        url = url.replace(/\/$/, '') + path;
        const win = window.open(url, '_blank');
        win.focus();
    }

    onOpenLink(href) {
        const win = window.open(href, '_blank');
        win.focus();
    }

    onOpenTravis() {
        let url = this.state.url.replace('https://raw.githubusercontent.com/', 'https://travis-ci.org/');
        url = url.replace(/\/$/, '');
        const win = window.open(url, '_blank');
        win.focus();
    }

    toggleTheme() {
        const themeName = this.state.themeName;

        // dark => blue => colored => light => dark
        let newThemeName = themeName === 'dark' ? 'light' : 'dark';

        Utils.setThemeName(newThemeName);

        const theme = Theme(newThemeName);

        if (theme.palette.mode === 'dark') {
            window.document.body.style.background = '#111';
        } else {
            window.document.body.style.background = '#EEE';
        }
        this.setState({
            theme,
            themeName: theme.name,
            themeType: theme.palette.type,
        });
    }

    showError() {
        if (this.state.globalError) {
            return (
                <DialogMessage
                    title="Error"
                    onClose={() => this.setState({ globalError: null })}
                    text={this.state.globalError}
                />
            );
        } else {
            return null;
        }
    }

    render() {
        const narrowScreen = this.state.screenWidth <= NARROW_WIDTH;

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <div
                        style={{
                            ...styles.body,
                            background: this.state.themeType === 'dark' ? '#111' : '#EEE',
                            color: this.state.themeType === 'dark' ? '#FFF' : '#000',
                        }}
                    >
                        <AppBar
                            position="static"
                            color="primary"
                        >
                            <Toolbar>
                                <Input
                                    type="text"
                                    placeholder="https://github.com/USER/ioBroker.ADAPTER"
                                    value={this.state.url}
                                    margin="none"
                                    onKeyUp={e => {
                                        if (e.key === 'Enter' && this.state.url && !this.state.requesting) {
                                            this.onCheck();
                                        }
                                    }}
                                    readOnly={this.state.requesting}
                                    style={{
                                        ...styles.urlInput,
                                        maxWidth: narrowScreen
                                            ? this.state.screenWidth - 35
                                            : this.state.screenWidth - 250,
                                        width: narrowScreen ? 'calc(100% - 35px)' : 'calc(100% - 350px)',
                                    }}
                                    onChange={e => {
                                        window.localStorage.setItem('url', e.target.value);
                                        this.setState({ url: e.target.value });
                                    }}
                                />
                                {!narrowScreen ? (
                                    <Input
                                        type="text"
                                        placeholder="branch"
                                        value={this.state.branch}
                                        margin="none"
                                        onKeyUp={e => {
                                            if (e.key === 'Enter' && this.state.url && !this.state.requesting) {
                                                this.onCheck();
                                            }
                                        }}
                                        readOnly={this.state.requesting}
                                        style={styles.branchInput}
                                        onChange={e => {
                                            window.localStorage.setItem('branch', e.target.value);
                                            this.setState({ branch: e.target.value });
                                        }}
                                    />
                                ) : null}
                                {this.state.requesting ? (
                                    <CircularProgress
                                        style={styles.buttonCheck}
                                        color="secondary"
                                    />
                                ) : (
                                    <Fab
                                        style={styles.buttonCheck}
                                        size="small"
                                        color="secondary"
                                        disabled={!this.state.url}
                                        onClick={() => this.onCheck()}
                                        aria-label="Check"
                                    >
                                        <CheckIcon />
                                    </Fab>
                                )}
                                {!narrowScreen ? <h4 style={styles.toolbarTitle}>{this.state.version}</h4> : null}
                                {!narrowScreen ? (
                                    <ToggleThemeMenu
                                        toggleTheme={() => this.toggleTheme()}
                                        themeName={this.state.themeName}
                                        t={w => w}
                                    />
                                ) : null}
                            </Toolbar>
                        </AppBar>
                        <div style={styles.info}>
                            {this.state.result.length
                                ? [
                                      <Button
                                          key="github"
                                          color="primary"
                                          onClick={() => this.onOpen('')}
                                      >
                                          github.com
                                      </Button>,
                                      <Button
                                          key="package.json"
                                          color="primary"
                                          onClick={() => this.onOpen('/blob/master/package.json')}
                                      >
                                          package.json
                                      </Button>,
                                      <Button
                                          key="io-package.json"
                                          color="primary"
                                          onClick={() => this.onOpen('/blob/master/io-package.json')}
                                      >
                                          io-package.json
                                      </Button>,
                                      this.state.hasTravis ? (
                                          <Button
                                              key="travis"
                                              color="primary"
                                              onClick={() => this.onOpenTravis()}
                                          >
                                              travis-ci.org
                                          </Button>
                                      ) : null,
                                      this.state.errors && this.state.errors.length ? (
                                          <Button
                                              key="practices"
                                              variant="contained"
                                              color="primary"
                                              onClick={() =>
                                                  this.onOpenLink(
                                                      'https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices',
                                                  )
                                              }
                                          >
                                              Best practices
                                          </Button>
                                      ) : null,
                                  ]
                                : null}
                            {this.state.errors ? this.renderError() : null}
                            {this.state.warnings ? this.renderWarnings() : null}
                            {this.state.result ? this.renderResult() : null}
                        </div>
                        {this.showError()}
                    </div>
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}

export default App;
