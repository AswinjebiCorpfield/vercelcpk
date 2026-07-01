import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';


const TestPopUp = () => {
    const [open, setOpen] = useState(false);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <div>
            <Button variant="contained" color="primary" onClick={handleClickOpen}>
                打开弹出窗口
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>弹出窗口标题</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        这是一个简单的弹出窗口示例。
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} color="primary">
                        关闭
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

export default TestPopUp