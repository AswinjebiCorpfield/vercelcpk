import React from 'react'
import { MenuItem, ListItemIcon, Menu } from '@mui/material'
import { useValue } from '../../context/ContextProvider'
import { Settings, Logout } from '@mui/icons-material'
import useCheckToken from '../../hooks/useCheckToken'

function UserMenu({anchorUserMenu, setAnchorUserMenu}) {
    useCheckToken();
    const{dispatch, state:{currentUser}} = useValue();
    const handledCloseUserManu = () => {
        setAnchorUserMenu(null);
    };

    const testAuthorization = async() => {
        const url = process.env.REACT_APP_SERVER_URL + '/room';
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization:`Bearer ${currentUser.token}`,
                }
            });
            const data = await response.json();

            console.log(data);
            if(!data.success){
                if (response.status === 401) dispatch({type:'UPDATE_USER', payload:null});
                throw new Error(data.message);
            }
        } catch(error){
            console.log(error);
            dispatch({type:'UPDATE_ALERT', payload:{open:true, severity:'error', message:error.message}});
        }
    }

  return (
    <Menu
        anchorEl={anchorUserMenu}
        open={Boolean(anchorUserMenu)}
        onClose={handledCloseUserManu}
        onClick={handledCloseUserManu}
        >
        <MenuItem onClick={testAuthorization}>
            <ListItemIcon>
                <Settings fontSize="small" />
            </ListItemIcon>
            Profile
        </MenuItem>

        <MenuItem onClick = {() => dispatch({type:'UPDATE_USER', payload:null})}>
            <ListItemIcon>
                <Logout fontSize="small" />
            </ListItemIcon>
            Logout
        </MenuItem>

        <MenuItem>
        Logout</MenuItem>
    </Menu>
  )
}

export default UserMenu