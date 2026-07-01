import { useMutation } from '@tanstack/react-query';
import * as spc from '../services/SpcAuthService';


export const useAuthEmailValidate = () => {
    return useMutation({
        mutationFn: spc.authValidate,
    });
};

export const useSaveToken = () => {
    return useMutation({
        mutationFn: spc.saveToken,
    });
};

export const useEncryptToken = () => {
    return useMutation({
        mutationFn: spc.getEncryptToken,
    });
};

export const useValidation = () => {
    return useMutation({
        mutationFn: spc.ValidateAPI,
    });
};

export const usePasswordAuthentication = () => {
    return useMutation({
        mutationFn: spc.authenticateAuthCode,
    });
};
