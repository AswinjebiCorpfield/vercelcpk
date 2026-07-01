import axios from "axios";
import { AUTH } from '../helpers/ConstantHelpers';

const SpcApiHelper = axios.create({
    // baseURL: "http://spl-vmssipspc02:5001",
    baseURL:"https://spl-spc02.shimano.com.sg:5056",
    timeout: 60000,
});
const REACT_APP_SPC_URL= "http://spc.corpfield.com/SPC_Portal";
const redirectToLogin = () => {
    localStorage.removeItem(AUTH.TOKEN);
    window.location.href = '/';
};

SpcApiHelper.interceptors.request.use(function (config) {
    const token = localStorage.getItem(AUTH.TOKEN);

    if (token && !config?.isPrivate) {
        config.headers['authorization'] = 'Bearer ' + token;
    }

    if (config.isMultipart) {
        config.headers["content-type"] = 'multipart/form-data,boundary=----WebKitFormBoundaryyrV7KO0BoCBuDbTL';
    }

    return config;
});

SpcApiHelper.interceptors.response.use(
    (response) => response,
    (error) => {
        // if (error.response?.status === 400) {
        //     return Promise.reject(error?.response?.data);
        // }
        if (error.response?.status === 401) {
            // redirectToLogin();
            // return Promise.reject(error?.response?.data);
            // window.location.href = REACT_APP_SPC_URL+`/login`;
        }
        if (error.response?.status === 403) {
            return Promise.reject(error?.response?.data);
        }
        if (error.response?.status === 404) {
            return Promise.reject(error?.response?.data);
        }
        if (error.response?.status === 412) {
            return Promise.reject(error?.response?.data);
        }
        if (error.response?.status === 500) {
            return Promise.reject(error?.response?.data);
        }
        if (error.response?.status === 508) {
            return Promise.reject(error?.response?.data);
        }
        return Promise.reject(error);
    }
);

export default SpcApiHelper;