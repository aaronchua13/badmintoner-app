import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import { message } from 'antd';

interface WithAuthProps {
  allowedRoles?: string[];
  redirectPath?: string;
  checkApi?: boolean;
}

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: WithAuthProps = {}
) {
  const { allowedRoles = [], redirectPath = '/admin/login', checkApi = true } = options;

  return (props: P) => {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('user_type');

        if (!token) {
          router.replace(redirectPath);
          return;
        }

        // Role check
        if (allowedRoles.length > 0 && userType && !allowedRoles.includes(userType)) {
          // If role is wrong, decide where to go. 
          // For admin pages, if player -> not-found
          if (userType === 'player' && allowedRoles.includes('admin')) {
             router.replace('/not-found');
             return;
          }
          // Default fallback
          router.replace('/');
          return;
        }

        if (checkApi) {
          try {
             const endpoint = userType === 'player' ? '/players/profile' : '/auth/profile';
             await api.get(endpoint, token);
             setAuthorized(true);
          } catch (error) {
             console.error('Auth check failed', error);
             localStorage.removeItem('token');
             localStorage.removeItem('user_type');
             router.replace(redirectPath);
          }
        } else {
          setAuthorized(true);
        }
        setChecking(false);
      };

      if (typeof window !== 'undefined') {
        checkAuth();
      }
    }, [router]);

    if (checking) {
       // You can return a loading spinner here
       return null; 
    }

    if (!authorized) {
       return null;
    }

    return <WrappedComponent {...props} />;
  };
}
