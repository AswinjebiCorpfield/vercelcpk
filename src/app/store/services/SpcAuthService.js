import ApiHelper from "../../config/ApiConfig";
import SpcApiHelper from "../../config/SpcApiConfig";

export const authValidate = async (formData) => {
    const { data } = await ApiHelper.post(`/validate-user?email=${formData}`, );
    return data;
};

export const saveToken = async (formData) => {
    const { data } = await ApiHelper.post(`/SaveToken`,formData );
    return data;
};

export const getEncryptToken = async (formData) => {
    const { data } = await SpcApiHelper.post(`/User/GetEncryptedToken`,formData );
    return data;
};

export const ValidateAPI = async (formData) => {
    const { data } = await SpcApiHelper.post("/User/Validate", formData);
    return data;
}

export const authenticateAuthCode = async (formData) => {
    const { data } = await SpcApiHelper.post("/Password/Authentication", formData);
    return data;
};