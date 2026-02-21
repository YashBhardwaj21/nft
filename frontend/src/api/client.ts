import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api', // Use env var with fallback
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add a request interceptor to attach the token and log out the request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log(`[API REQUEST] => ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
        return config;
    },
    (error) => {
        console.error(`[API REQUEST ERROR] =>`, error);
        return Promise.reject(error);
    }
);

// Add a response interceptor to log out the response
api.interceptors.response.use(
    (response) => {
        console.log(`[API RESPONSE] <= ${response.config.method?.toUpperCase()} ${response.config.url} [${response.status}]`, response.data);
        return response;
    },
    (error) => {
        console.error(`[API RESPONSE ERROR] <= ${error.response?.config?.method?.toUpperCase()} ${error.response?.config?.url} [${error.response?.status}]`, error.response?.data || error.message);
        return Promise.reject(error);
    }
);

export default api;
