import axios from "axios";

// If REACT_APP_API_URL is specified (e.g. on Vercel pointing to Render backend), use it.
// If running in production on the same host (backend serving frontend build), use relative "".
// Otherwise in local development, default to http://localhost:5000.
const API_BASE_URL = process.env.REACT_APP_API_URL !== undefined 
    ? process.env.REACT_APP_API_URL 
    : (process.env.NODE_ENV === "production" ? "" : "http://localhost:5000");

const API = axios.create({
    baseURL: API_BASE_URL,
});

// Automatically add token to every request
API.interceptors.request.use((req) => {
    const token = localStorage.getItem("token");
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

export default API;
export { API_BASE_URL };
