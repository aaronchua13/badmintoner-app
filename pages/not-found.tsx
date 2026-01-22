import { Button, Result } from 'antd';
import { useRouter } from 'next/router';
import MainLayout from '@/layouts/MainLayout';
import Head from 'next/head';

const Custom404 = () => {
  const router = useRouter();

  return (
    <MainLayout>
      <Head>
        <title>404 - Page Not Found | Badmintoner</title>
      </Head>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh' 
      }}>
        <Result
          status="404"
          title="404"
          subTitle="Sorry, the page you visited does not exist."
          extra={
            <Button type="primary" onClick={() => router.push('/')}>
              Back Home
            </Button>
          }
        />
      </div>
    </MainLayout>
  );
};

export default Custom404;
