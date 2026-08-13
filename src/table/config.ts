// Base URL of the Express API; override with VITE_API_URL when deploying
export const API_URL: string =
    import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5050";
