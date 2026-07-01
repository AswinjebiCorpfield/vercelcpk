// handle errors

const fetchData = async ({url, method='POST', token='', body=null,}, dispatch
) => {
    const headers = token
        ? {'Content-Type': 'application/json', authorization: `Bearer ${token}` } 
        : {'Content-Type': 'application/json'};
    body = body? {body:JSON.stringify(body)} : {};
    try {
        const response = await fetch(url, {method, headers, ...body});
        const data = await response.json();
        console.log("data",data);
        console.log("data.success:",data.success);
        if (!data.success) {
            if (response.status === 401) dispatch({type:'UPDATE_USER', payload:null});
            throw new Error(data.message);
        }

        if (data.success === false) {        //if received failed response
            if (response.status === 401) dispatch({type:'UPDATE_USER', payload:null});      // not authorized
            throw new Error(data.message);
        };

        if (!data.success) {        //if received failed response
            if (response.status === 401) dispatch({type:'UPDATE_USER', payload:null});      // not authorized
            throw new Error(data.message);
        };
        console.log("data.result:",data.result);
        return data.result;
    } catch (error) {
        dispatch({type:'UPDATE_ALERT', payload:{open:true, severity:'error', message:error.message}});
        console.log(error);
        return null;
    }
};

export default fetchData;