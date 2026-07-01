import axios from "axios";
import { AUTH } from '../helpers/ConstantHelpers';

const ApiHelper = axios.create({
    // baseURL: "http://spl-vmssipspc02:5001", // or your actual base URL
    // baseURL:"http://172.30.8.137:52591",
    baseURL: "https://spl-spc02.shimano.com.sg:5056",
    // baseURL: "http://localhost:5000",
    timeout: 60000,
});
// const REACT_APP_SPC_URL= "http://spc.corpfield.com/SPC_Portal";
// const REACT_APP_SPC_URL= "http://spl-vmssipspc02:5001";
const REACT_APP_SPC_URL= "https://spl-spc02.shimano.com.sg/SPC_Portal";

const redirectToLogin = () => {
    localStorage.removeItem(AUTH.TOKEN);
    window.location.href = '/';
};

ApiHelper.interceptors.request.use((config) => {
    const token = localStorage.getItem(AUTH.TOKEN);

    if (token && !config?.isPrivate) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (config.isMultipart) {
        config.headers["Content-Type"] = 'multipart/form-data,boundary=----WebKitFormBoundaryyrV7KO0BoCBuDbTL';
    }

    return config;
});

ApiHelper.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        if ([400, 403, 404, 412, 500, 508].includes(status)) {
            return Promise.reject(error.response?.data);
        }

        if (status === 401) {
            // redirectToLogin();
            window.location.href = REACT_APP_SPC_URL+`/login`;
            // return Promise.reject(error.response?.data);
        }

        return Promise.reject(error);
    }
);

export default ApiHelper;
