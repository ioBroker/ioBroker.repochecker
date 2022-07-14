import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

import theme from '@iobroker/adapter-react-v5/Theme';
import Utils from '@iobroker/adapter-react-v5/Components/Utils';
let themeName = Utils.getThemeName();

function build() {
    const container = document.getElementById('root');
    const root = createRoot(container);
    return root.render(
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme(themeName)}>
            <App
                onThemeChange={_theme => {
                    themeName = _theme;
                    build();
                }}
            />
            </ThemeProvider>
        </StyledEngineProvider>
    );
}

build();

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
