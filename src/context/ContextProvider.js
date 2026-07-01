//create 全局状态 of user

import { createContext, useContext, useEffect, useReducer } from "react";
import reducer from './reducer';

//create default value
const initialState = {
    currentUser: null,
    openLogin: false,
    loading: false,
    alert:{open: false, message: '', severity: 'info'},
    filters: {}, // 新增全局 filters 状态
};

// assign context as initial state
const Context = createContext(initialState);

//
export const useValue = () => {
    return useContext(Context);
};

// context provider is a component that wraps the entire application
const ContextProvider = ({children}) => {
    // 懒初始化：页面第一次渲染时立刻从 localStorage 恢复 filters，
    // 避免子组件 useState 初始化时 state.filters 还是空对象的问题
    const [state, dispatch] = useReducer(reducer, initialState, (init) => {
        try {
            const savedFilters = JSON.parse(localStorage.getItem('filters'));
            if (savedFilters) return { ...init, filters: savedFilters };
        } catch {}
        return init;
    });
    useEffect(() => {
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser) {
            dispatch({type: 'UPDATE_USER', payload: currentUser});
        }
    }, []);
    return (
        <Context.Provider value={{ state, dispatch}}>{children}</Context.Provider>
    );
};

export default ContextProvider