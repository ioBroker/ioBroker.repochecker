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


import Comm from './Comm';

import CheckIcon from '@material-ui/icons/DoneOutlined';
import ErrorIcon from '@material-ui/icons/Cancel';

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
});

class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            url: window.localStorage.getItem('url') || '',
            requesting: false,
            error: '',
            result: [],
            screenWidth: window.innerWidth,
        };

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
        this.setState({error: '', result: [], requesting: true});
        Comm.check(url, (err, data) => {
            if (err || (data && data.error)) {
                this.setState({error: err || data.error, result: data ? data.checks || [] : [], requesting: false});
            } else {
                this.setState({error: '', result: data.checks, requesting: false});
            }
        });
    }

    renderResult() {
        return (
            <List component="nav">
                {this.state.result.map((line, i) => (<ListItem>
                    <ListItemIcon>
                        <CheckIcon className={this.props.classes.ok} />
                    </ListItemIcon>
                    <ListItemText primary={line} secondary={i + 1}/>
                </ListItem>))}
            </List>);
    }
    renderError() {
        return (
            <List component="nav">
                <ListItem>
                    <ListItemIcon>
                        <ErrorIcon className={this.props.classes.error} />
                    </ListItemIcon>
                    <ListItemText className={this.props.classes.error} primary={this.state.error} secondary="Error"/>
                </ListItem>
            </List>);
    }
    render() {
        return (
            <div className={this.props.classes.body}>
                <AppBar position="static" color="primary">
                    <Toolbar>
                        {this.state.screenWidth > NARROW_WIDTH ? (<h4 className={this.props.classes.toolbarTitle}>Adapter checker</h4>) : null}
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
                        <Fab className={this.props.classes.buttonCheck} size="small" color="secondary" disabled={!this.state.url || this.state.requesting} onClick={() => this.onCheck()} aria-label="Check"><CheckIcon /></Fab>
                    </Toolbar>
                </AppBar>
                <div className={this.props.classes.info}>
                    {this.state.error ? this.renderError() : null}
                    {this.state.result ? this.renderResult() : null}
                </div>
            </div>
        );
    }
}

export default withStyles(styles)(App);
