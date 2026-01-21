export const API_URL = '/api';

const username = process.env.NEXT_PUBLIC_API_BASIC_AUTH_USER || 'admin';
const password = process.env.NEXT_PUBLIC_API_BASIC_AUTH_PASSWORD || 'password123';

const credentials = `${username}:${password}`;
const encodedCredentials = typeof window === 'undefined'
  ? Buffer.from(credentials).toString('base64')
  : btoa(credentials);

const BASIC_AUTH = `Basic ${encodedCredentials}`;

export const api = {
  async post<T>(endpoint: string, data: unknown): Promise<T> {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': BASIC_AUTH,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = 'Something went wrong';
        
        if (typeof errorData === 'object' && errorData !== null) {
          if (Array.isArray(errorData.message)) {
            errorMessage = errorData.message.join(', ');
          } else if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          }
        }
        
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error');
    }
  },

  async get(endpoint: string, token?: string) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': BASIC_AUTH, // Default to Basic Auth
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = 'Failed to fetch data';

        if (typeof errorData === 'object' && errorData !== null) {
          if (Array.isArray(errorData.message)) {
            errorMessage = errorData.message.join(', ');
          } else if (typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          }
        }

        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error');
    }
  },
};
