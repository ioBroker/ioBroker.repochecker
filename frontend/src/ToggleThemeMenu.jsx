import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Brightness4 as Brightness4Icon, Brightness7 as Brightness7Icon } from '@mui/icons-material';

export default function ToggleThemeMenu({ themeName, toggleTheme, t, className, style, size }) {
    return (
        <div
            className={className || undefined}
            style={style || undefined}
        >
            <Tooltip title={t('Change color theme')}>
                <IconButton
                    onClick={() => toggleTheme()}
                    size={size || 'medium'}
                >
                    {themeName === 'dark' && <Brightness4Icon className={className} />}
                    {themeName === 'light' && <Brightness7Icon className={className} />}
                </IconButton>
            </Tooltip>
        </div>
    );
}
