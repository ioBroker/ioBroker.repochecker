import React, {Component} from 'react';
import {withStyles, MuiThemeProvider} from '@material-ui/core/styles';
import './App.css';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Input from '@material-ui/core/Input';
import Fab from '@material-ui/core/Fab';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';

import CheckIcon from '@material-ui/icons/DoneOutlined';
import ErrorIcon from '@material-ui/icons/Cancel';
import WarningIcon from '@material-ui/icons/Announcement';

import Comm from './Comm';
import ToggleThemeMenu from './ToggleThemeMenu';
import Utils from '@iobroker/adapter-react/Components/Utils';
import theme from '@iobroker/adapter-react/Theme';

const NARROW_WIDTH = 500;

const styles = theme => ({
    toolbarTitle: {
        //position: 'absolute',
        top: 0,
        right: 20,
        whiteSpace: 'nowrap'
    },
    urlInput: {
        color: 'white'
    },
    branchInput: {
        width: 100,
        marginLeft: 10,
        color: 'white'
    },
    attrTitle: {
        display: 'inline-block',
        width: 160,
        fontWeight: 'bold',
        paddingLeft: 10
    },
    title: {
        background: '#faff7c',
        padding: 5,
        marginTop: 10,
        marginBottom: 0
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
        height: 'calc(100% - 104px)'
    },
    ok: {
        color: '#111',
    },
    error: {
        color: '#bf0000'
    },
    warning: {
        color: '#bf9100'
    },
});

class App extends Component {
    constructor(props) {
        super(props);

        const _theme = theme(Utils.getThemeName());

        this.state = {
            url: window.localStorage.getItem('url') || '',
            requesting: false,
            errors: [],
            warnings: [],
            result: [],
            screenWidth: window.innerWidth,
            version: 'Adapter checker',
            branch: window.localStorage.getItem('branch') || '',
            theme: _theme,
            themeName: _theme.name,
            themeType: _theme.palette.type,
            hasTravis: false,
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
    }

    componentDidMount() {
        window.addEventListener('resize', this.updateWindowDimensions());
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateWindowDimensions)
    }

    updateWindowDimensions() {
        this.setState({screenWidth: window.innerWidth});
    }

    onCheck() {
        let url = this.state.url;
        if (url.match(/\/$/, '')) {
            url = url.substring(0, url.length - 1);
        }
        this.setState({errors: [], result: [], warnings:[], requesting: true});
        Comm.check(url, this.state.branch.trim(), (err, data) => {
            if (err) {
                this.setState({
                    errors: [err],
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
        return <List component="nav">
            {this.state.result.map((line, i) => <ListItem key={line}>
                <ListItemIcon>
                    <CheckIcon className={this.props.classes.ok} style={{color: this.state.themeType === 'dark' ? '#1F1' : '#1F1'}} />
                </ListItemIcon>
                <ListItemText primary={typeof line === 'string' ? line : JSON.stringify(line)} secondary={i + 1}/>
            </ListItem>)}
        </List>;
    }

    renderError() {
        return <List component="nav">
            {this.state.errors.length ? <br/> : null}
            {this.state.errors.map((line, i) => <ListItem key={line}>
                <ListItemIcon>
                    <ErrorIcon className={this.props.classes.error} />
                </ListItemIcon>
                <ListItemText className={this.props.classes.error} primary={typeof line === 'string' ? line : JSON.stringify(line)} secondary={i + 1}/>
            </ListItem>)}
        </List>;
    }

    renderWarnings() {
        return <List component="nav">
            {this.state.warnings.map((line, i) => <ListItem key={line}>
                <ListItemIcon>
                    <WarningIcon className={this.props.classes.warning} />
                </ListItemIcon>
                <ListItemText className={this.props.classes.warning} primary={typeof line === 'string' ? line : JSON.stringify(line)} secondary={i + 1}/>
            </ListItem>)}
        </List>;
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
        let newThemeName = themeName === 'dark' ? 'blue' :
            (themeName === 'blue' ? 'colored' :
                (themeName === 'colored' ? 'light' : 'dark'));

        Utils.setThemeName(newThemeName);

        const _theme = theme(newThemeName);

        this.setState({
            theme: _theme,
            themeName: _theme.name,
            themeType: _theme.palette.type
        });
    }

    render() {
        const narrowScreen = this.state.screenWidth <= NARROW_WIDTH;

        return <MuiThemeProvider theme={this.state.theme}>
            <div
                className={this.props.classes.body}
                style={{
                    background: this.state.themeType === 'dark' ? '#111' : '#EEE',
                    color: this.state.themeType === 'dark' ? '#FFF' : '#000',
                }}
            >
                <AppBar position="static" color="primary">
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
                            className={this.props.classes.urlInput}
                            style={{maxWidth: narrowScreen ? this.state.screenWidth - 35 : this.state.screenWidth - 250, width: narrowScreen ? 'calc(100% - 35px)' : 'calc(100% - 350px)'}}
                            onChange={e => {
                                window.localStorage.setItem('url', e.target.value);
                                this.setState({url: e.target.value});
                            }}
                        />
                        {!narrowScreen ? <Input
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
                            className={this.props.classes.branchInput}
                            onChange={e => {
                                window.localStorage.setItem('branch', e.target.value);
                                this.setState({branch: e.target.value});
                            }}
                        /> : null}
                        {
                            this.state.requesting ?
                                <CircularProgress className={this.props.classes.buttonCheck} color="secondary" /> :
                                <Fab className={this.props.classes.buttonCheck} size="small" color="secondary" disabled={!this.state.url} onClick={() => this.onCheck()} aria-label="Check"><CheckIcon /></Fab>
                        }
                        {!narrowScreen ? <h4 className={this.props.classes.toolbarTitle}>{this.state.version}</h4> : null}
                        {!narrowScreen ? <ToggleThemeMenu
                            toggleTheme={() => this.toggleTheme()}
                            themeName={this.state.themeName}
                            t={w => w}
                        /> : null}
                    </Toolbar>
                </AppBar>
                <div className={this.props.classes.info}>
                    {this.state.result.length ? [
                        <Button key="github"          color="primary" onClick={() => this.onOpen('')}>github.com</Button>,
                        <Button key="package.json"    color="primary" onClick={() => this.onOpen('/blob/master/package.json')}>package.json</Button>,
                        <Button key="io-package.json" color="primary" onClick={() => this.onOpen('/blob/master/io-package.json')}>io-package.json</Button>,
                        this.state.hasTravis ? <Button key="travis" color="primary" onClick={() => this.onOpenTravis()}>travis-ci.org</Button> : null,
                        this.state.errors && this.state.errors.length ? <Button key="practices" variant="contained" color="primary" onClick={() => this.onOpenLink('https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices')}>Best practices</Button> : null,
                    ] : null}
                    {this.state.errors   ? this.renderError()    : null}
                    {this.state.warnings ? this.renderWarnings() : null}
                    {this.state.result   ? this.renderResult()   : null}
                </div>
            </div>
        </MuiThemeProvider>;
    }
}

export default withStyles(styles)(App);
