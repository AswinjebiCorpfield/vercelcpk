import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, TextField, IconButton, DialogActions } from '@mui/material';
import { Close, Google, Password } from '@mui/icons-material';
import { useValue } from '../../context/ContextProvider';
import PasswordField from './PasswordField';
import { Button } from '@mui/material';
import { Send } from '@mui/icons-material';
import GoogleOneTapLogin from './GoogleOneTapLogin';
import { register } from '../../actions/user';

const Login = () => {
    const {state: {openLogin}, dispatch,} = useValue();
    const [title, setTitle] = useState('Login');
    const [isRegister, setIsRegister] = useState(false);
    const nameRef = useRef(null);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);
    const confirmPasswordRef = useRef(null);

    const handleClose = () => {
        dispatch({type: 'CLOSE_LOGIN'});
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const email = emailRef.current.value;
        const password = passwordRef.current.value;
        //send log in request if not register and return
        const name = nameRef.current.value;
        const confirmPassword = confirmPasswordRef.current.value;
        if (password !== confirmPassword) 
            return dispatch({
            type: 'UPDATE_ALERT', payload: {open:true, severity: 'error', message: 'Passwords do not match',},
            });
        register({name, email, password}, dispatch);
    };

useEffect(() => {
//     {isRegister ? nameRef.current.focus() : emailRef.current.focus(); }, [isRegister]);
    isRegister ? setTitle('Register') : setTitle('Login'); },
    [isRegister]);

    return (
      <Dialog
        open={openLogin}
        onClose={handleClose}>
            
        <DialogTitle>
            {title}
            <IconButton
                sx={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    color: (theme) => theme.palette.grey[500]
                }}
                onClick={handleClose}
            >
                <Close />
            </IconButton>
        </DialogTitle>

        <form onSubmit={handleSubmit}>
            <DialogContent dividers>
                <DialogContentText> 
                    Please enter your email and password
                </DialogContentText>
                {isRegister && 
                    <TextField
                        autoFocus
                        margin='normal'
                        variant='standard'
                        id='name'
                        label='Name'
                        type='text'
                        fullWidth
                        inputRef={nameRef}
                        inputProps={{minLength: 2}}
                        required
                    />
                }  
                <TextField
                        autoFocus={!isRegister}
                        margin='normal'
                        variant='standard'
                        id='email'
                        label='Email'
                        type='email'
                        fullWidth
                        inputRef={emailRef}
                        required
                    />
                <PasswordField {...{passwordRef}}/>
                {isRegister && 
                    <PasswordField passwordRef= {confirmPasswordRef} id='confirmPassword' label='Confirm Password'/>
                }
            </DialogContent>
            <DialogActions sx={{px:'19px'}}>
                <Button type='submit'variant='contained' endIcon={<Send />}>
                    Submit
                </Button>
            </DialogActions>
        </form>
            <DialogActions sx={{justifyContent: 'left', p:'5px 24px'}}>
                {isRegister ? 'Already have an account? Sign in now' : 'Don\'t have an account? Create one now'}
                <Button onClick={()=> setIsRegister(!isRegister)}>
                    {isRegister ? 'Login' : 'Register'}
                </Button>
            </DialogActions>
        <DialogActions sx={{justifyContent: 'center', py:'24px'}}>
                <GoogleOneTapLogin />
        </DialogActions>
        </Dialog>
    );
  };


export default Login;