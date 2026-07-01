import React, {useState} from 'react'
import { Button } from '@mui/material'
import { Google } from '@mui/icons-material'
import { useValue } from '../../context/ContextProvider'
import { jwtDecode } from 'jwt-decode'

const GoogleOneTapLogin = () => {
  const{dispatch} = useValue();
  const [disabled, setDisabled] = useState(false);

  const handleResponse = (response) => { // extract token from Google One Tap response and extract the received information
    const token = response.credential;
    const decodedToken = jwtDecode(token);
    const {email, name, picture, sub:id} = decodedToken;
    // console.log(decodedToken); 
    dispatch({
      type:'UPDATE_USER', 
      payload: { id, email, name, picture, token, google:true},
    });
    dispatch({type:'CLOSE_LOGIN'});
  }

  const handleGoogleLogin = () => {
    setDisabled(true);  
    try {
      window.google.accounts.id.initialize({ // initialize Google One Tap client
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        // client_id: '446007728900-fp7o9ffm8egfs9ksu42l0p6m5hdv81ks.apps.googleusercontent.com',
        callback: handleResponse,
      });
      window.google.accounts.id.prompt((notification) => { // display Google One Tap prompt 
        if (notification.isNotDisplayed()) {
          throw new Error('Try to clear the cookies or try again later');
        }
        if (notification.isSkippedMoment() || notification.isDismissedMoment()) {
          setDisabled(false);
        }
      });
      }
    catch (error) {
      dispatch({type:'UPDATE_ALERT', payload: {open:true, severity: 'error', message: error.message}});
      console.log(error);
    }
  }

  return (
    <Button variant="outlined" startIcon={<Google/>} disabled={disabled} onClick={handleGoogleLogin}>
        Login with Google 
    </Button>
  )
}

export default GoogleOneTapLogin;