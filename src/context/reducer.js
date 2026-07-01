//manage the state of the user in the context API globally
//user state has type and payload attributes to update the user state

// import Loading from "../components/Loading";

const reducer = (state, action) => {
    switch (action.type) {
        case 'OPEN_LOGIN':
            return { ...state, openLogin: true };
        case 'CLOSE_LOGIN':
            return { ...state, openLogin: false };
        case 'UPDATE_USER':
            localStorage.setItem('user', JSON.stringify(action.payload));
            return {...state, currentUser: action.payload};
        case 'UPDATE_ALERT':
            return {...state, alert: action.payload};
        case 'START_LOADING':
            return {...state, loading: true,};
        case 'END_LOADING':
            return {...state, loading: false,};
        case 'UPDATE_FILTERS':
            if (JSON.stringify(state.filters) === JSON.stringify(action.payload)) {
                return state;
            }
            localStorage.setItem('filters', JSON.stringify(action.payload));
            // console.log('Filters updated:', action.payload);
            return { ...state, filters: action.payload };
        default:
        throw new Error(`No matched action!`);
    }
    };

    export default reducer;