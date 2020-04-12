import React, {Component} from 'react';
import {withStyles} from '@material-ui/core/styles';
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

import Comm from './Comm';

import CheckIcon from '@material-ui/icons/DoneOutlined';
import ErrorIcon from '@material-ui/icons/Cancel';
import WarningIcon from '@material-ui/icons/Announcement';

const NARROW_WIDTH = 500;

const styles = theme => ({
    toolbarTitle: {
        position: 'absolute',
        top: 0,
        right: 20
    },
    urlInput: {
        width: 'calc(100% - 200px)',
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

    },
    info: {
        padding: 20,
    },
    ok: {
        color: '#00b200'
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
        this.state = {
            url: window.localStorage.getItem('url') || '',
            requesting: false,
            errors: [],
            warnings: [],
            result: [],
            screenWidth: window.innerWidth,
            version: 'Adapter checker',
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
        Comm.check(url, (err, data) => {
            if (err) {
                this.setState({
                    errors: [err],
                    warnings: (data && data.warnings) || [],
                    result: (data && data.checks) || [],
                    requesting: false
                });
            } else {
                this.setState({
                    errors: data.errors || [],
                    warnings: data.warnings || [],
                    result: data.checks || [],
                    version: 'v' + data.version,
                    requesting: false
                });
            }
        });
    }

    renderResult() {
        return (
            <List component="nav">
                {this.state.result.map((line, i) => (<ListItem key={line}>
                    <ListItemIcon>
                        <CheckIcon className={this.props.classes.ok} />
                    </ListItemIcon>
                    <ListItemText primary={typeof line === 'string' ? line : JSON.stringify(line)} secondary={i + 1}/>
                </ListItem>))}
            </List>);
    }

    renderError() {
        return (
            <List component="nav">
                {this.state.errors.map((line, i) => (<ListItem key={line}>
                    <ListItemIcon>
                        <ErrorIcon className={this.props.classes.error} />
                    </ListItemIcon>
                    <ListItemText className={this.props.classes.error} primary={typeof line === 'string' ? line : JSON.stringify(line)} secondary={i + 1}/>
                </ListItem>))}
            </List>);
    }

    renderWarnings() {
        return (
            <List component="nav">
                {this.state.warnings.map((line, i) => (<ListItem key={line}>
                    <ListItemIcon>
                        <WarningIcon className={this.props.classes.warning} />
                    </ListItemIcon>
                    <ListItemText className={this.props.classes.warning} primary={typeof line === 'string' ? line : JSON.stringify(line)} secondary={i + 1}/>
                </ListItem>))}
            </List>);
    }

    onOpen(path) {
        let url = this.state.url.replace('https://raw.githubusercontent.com/', 'https://github.com/');
        url = url.replace(/\/$/, '') + path;
        const win = window.open(url, '_blank');
        win.focus();
    }

    onOpenTravis() {
        let url = this.state.url.replace('https://raw.githubusercontent.com/', 'https://travis-ci.org/');
        url = url.replace(/\/$/, '');
        const win = window.open(url, '_blank');
        win.focus();
    }


    render() {
        return (
            <div className={this.props.classes.body}>
                <AppBar position="static" color="primary">
                    <Toolbar>
                        {this.state.screenWidth > NARROW_WIDTH ? (<h4 className={this.props.classes.toolbarTitle}>{this.state.version}</h4>) : null}
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
                            style={{maxWidth: this.state.screenWidth - 130}}
                            onChange={e => {
                                window.localStorage.setItem('url', e.target.value);
                                this.setState({url: e.target.value});
                            }}
                        />
                        {
                            this.state.requesting ?
                                (<CircularProgress className={this.props.classes.buttonCheck} color="secondary" />) :
                                (<Fab className={this.props.classes.buttonCheck} size="small" color="secondary" disabled={!this.state.url} onClick={() => this.onCheck()} aria-label="Check"><CheckIcon /></Fab>)
                        }
                    </Toolbar>
                </AppBar>
                <div className={this.props.classes.info}>
                    {this.state.result.length ? [
                        (<Button key="github"          color="primary" onClick={() => this.onOpen('')}>github.com</Button>),
                        (<Button key="package.json"    color="primary" onClick={() => this.onOpen('/blob/master/package.json')}>package.json</Button>),
                        (<Button key="io-package.json" color="primary" onClick={() => this.onOpen('/blob/master/io-package.json')}>io-package.json</Button>),
                        (<Button key="travis"          color="primary" onClick={() => this.onOpenTravis()}>travis-ci.org</Button>)
                    ] : null}
                    {this.state.errors   ? this.renderError()    : null}
                    {this.state.warnings ? this.renderWarnings() : null}
                    {this.state.result   ? this.renderResult()   : null}
                </div>
            </div>
        );
    }
}

export default withStyles(styles)(App);
